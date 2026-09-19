/**
 * R134-F1：上下文投影器——把 store.data（AppData）按场景压成紧凑文本喂给 LLM。
 *
 * 性能纪律（交付说明承诺）：
 *  - 只读既有数组/映射现场组装，绝不整库 JSON.stringify；
 *  - 每个投影都有深度档上限（eco/std/deep），产出目标 2~12KB；
 *  - 附件（zy-asset/IndexedDB 本体）永不进投影——只投影文字字段。
 */
import type { AppData, ResourceCard } from '@/shared/models'
import { wsDisplayNameOf } from '@/shared/utils/wsName'
import type { AiDepth } from './config'

const CAP: Record<AiDepth, { cards: number; titles: number; list: number; desc: number }> = {
  eco:  { cards: 30,  titles: 5,  list: 20,  desc: 80 },
  std:  { cards: 60,  titles: 10, list: 40,  desc: 150 },
  deep: { cards: 150, titles: 20, list: 80,  desc: 300 },
}

function cut(s: string | undefined, n: number): string {
  const t = (s || '').replace(/\s+/g, ' ').trim()
  return t.length > n ? t.slice(0, n) + '…' : t
}

/** 「台 / 父分类 / 子分类」路径（悬空分类降级为台名） */
export function catPathOf(d: AppData, catId: string): string {
  const cat = d.categories.find(c => c.id === catId)
  if (!cat) return ''
  const ws = d.workspaces.find(w => w.id === cat.workspaceId)
  const parts = [ws ? wsDisplayNameOf(ws) : '', cat.name]
  let p = cat.parentId ? d.categories.find(c => c.id === cat.parentId) : null
  let guard = 0
  while (p && guard++ < 4) { parts.splice(1, 0, p.name); p = p.parentId ? d.categories.find(c => c.id === p!.parentId) || null : null }
  return parts.filter(Boolean).join(' / ')
}

function cardLine(d: AppData, r: ResourceCard, c: typeof CAP.std): string {
  const bits = [`「${cut(r.title, 60)}」`]
  if (r.link) bits.push(`链接:${cut(r.link, 90)}`)
  if (r.tags?.length) bits.push(`标签:[${r.tags.join(',')}]`)
  const cat = catPathOf(d, r.categoryId)
  if (cat) bits.push(`分类:${cat}`)
  if (r.description) bits.push(`描述:${cut(r.description, c.desc)}`)
  bits.push(`打开${r.callCount || 0}次`)
  if (r.lastCalledAt) bits.push(`最近${new Date(r.lastCalledAt).toLocaleDateString('zh-CN')}`)
  return bits.join(' | ')
}

/** 标签词表（打标建议必须落在既有标签或明确新标签） */
function tagVocab(d: AppData, cap: number): string {
  const seen = new Set<string>()
  for (const n of d.tagTree || []) { collectTagNames(n, seen) }
  for (const r of d.resources || []) for (const t of r.tags || []) seen.add(t)
  return [...seen].slice(0, cap).join('、')
}
function collectTagNames(node: { name: string; children?: unknown[] }, seen: Set<string>) {
  seen.add(node.name)
  for (const c of node.children || []) collectTagNames(c as never, seen)
}

/** 单卡画像：卡本体 + 同分类邻居目录（供"这张卡是干嘛的、和谁同类"判断） */
export function projectCard(d: AppData, card: ResourceCard, depth: AiDepth): string {
  const c = CAP[depth]
  const sib = (d.resources || []).filter(r => r.categoryId === card.categoryId && r.id !== card.id && !r.deletedAt)
    .slice(0, c.titles).map(r => '· ' + cut(r.title, 50)).join('\n')
  return [
    `【待分析资源卡】\n${cardLine(d, card, c)}`,
    sib ? `【同分类其它卡目录（仅标题）】\n${sib}` : '',
    `【现有标签词表】\n${tagVocab(d, c.list)}`,
  ].filter(Boolean).join('\n\n')
}

/** 批量补全投影：选中的 N 张卡逐行画像 */
export function projectCards(d: AppData, ids: Set<string> | string[], depth: AiDepth): { text: string; cards: ResourceCard[] } {
  const c = CAP[depth]
  const idset = ids instanceof Set ? ids : new Set(ids)
  const cards = (d.resources || []).filter(r => idset.has(r.id) && !r.deletedAt).slice(0, c.cards)
  const text = [
    '【待补全卡片清单】',
    ...cards.map(r => `- cardId=${r.id} ${cardLine(d, r, c)}`),
    '',
    `【现有标签词表】\n${tagVocab(d, c.list)}`,
  ].join('\n')
  return { text, cards }
}

/** 沉睡资源扫描：days 内零打开的资源卡 + 近期活跃任务/项目做"是否还相关"参照 */
export function projectDormant(d: AppData, days: number, depth: AiDepth): { text: string; count: number; scanned: number } {
  const c = CAP[depth]
  const now = Date.now()
  const live = (d.resources || []).filter(r => !r.deletedAt && r.workspaceId !== undefined)
  const dormant = live
    .filter(r => !r.pinned && !r.starred && (r.lastCalledAt || r.createdAt || 0) < now - days * 86400000)
    .sort((a, b) => (a.lastCalledAt || a.createdAt || 0) - (b.lastCalledAt || b.createdAt || 0))
    .slice(0, c.cards)
  const doing = (d.tasks || []).filter(t => !t.deletedAt && t.status !== 'done').slice(0, 15)
    .map(t => '· ' + cut(t.title, 50)).join('\n')
  const dirs = (d.compass.directions || []).filter(x => x.status === 'active')
    .map(x => `· ${x.name}（${x.term || '未分期'}，项目${x.projects.length}个）`).join('\n')
  return {
    count: dormant.length,
    scanned: live.length,
    text: [
      `【沉睡判定】最近打开（或创建）早于 ${days} 天、且未置顶未星标，共 ${dormant.length} 张（全库 ${live.length} 张参与扫描）`,
      '【沉睡卡清单】',
      ...dormant.map(r => {
        const last = r.lastCalledAt || r.createdAt || 0
        const idleDays = Math.floor((now - last) / 86400000)
        return `- cardId=${r.id} 「${cut(r.title, 60)}」 | ${idleDays}天未打开 | 历史打开${r.callCount || 0}次 | 分类:${catPathOf(d, r.categoryId) || '未分类'} | 标签:[${(r.tags || []).join(',')}]`
      }),
      doing ? `\n【当前进行中的任务（相关性参照）】\n${doing}` : '',
      dirs ? `\n【活跃战略目标】\n${dirs}` : '',
    ].filter(Boolean).join('\n'),
  }
}

/** 整库摘要（深度诊断投料）：罗盘六层链 + 各台计数与代表卡 + 全局数字体检料 */
export function projectLibrary(d: AppData, depth: AiDepth): string {
  const c = CAP[depth]
  const L: string[] = []
  L.push(`【愿景】${cut(d.compass.vision?.content, c.desc) || '（未填）'}`)
  L.push(`【使命】${cut(d.compass.mission?.content, c.desc) || '（未填）'}`)
  const chain: string[] = []
  for (const dir of d.compass.directions || []) {
    if (dir.status === 'archived') continue
    chain.push(`目标「${dir.name}」status=${dir.status} term=${dir.term || '未分期'}`)
    for (const p of dir.projects.slice(0, c.titles)) {
      const ms = (p.metrics || []).map(m => {
        const total = m.taskIds?.length || 0
        const done = (m.taskIds || []).filter(id => (d.tasks || []).some(t => t.id === id && t.status === 'done')).length
        return `${cut(m.title, 40)}(任务${done}/${total})`
      })
      chain.push(`  └ 项目「${p.name}」${p.isFocused ? '[主攻]' : ''} 进度${p.progress || 0}% ${p.status} 截止${p.endDate || '?'} 指标: ${ms.join('；') || '无'}`)
    }
  }
  L.push('【罗盘链】\n' + (chain.join('\n') || '（暂无方向）'))
  const orphanTasks = (d.tasks || []).filter(t => !t.deletedAt && !t.metricId && !t.projectId).length
  const wsLines: string[] = []
  for (const w of d.workspaces || []) {
    const cards = (d.resources || []).filter(r => !r.deletedAt && r.workspaceId === w.id)
    const cats = (d.categories || []).filter(x => !x.deletedAt && x.workspaceId === w.id).length
    const sample = cards.slice(0, depth === 'eco' ? 3 : c.titles).map(r => '· ' + cut(r.title, 40)).join('\n')
    wsLines.push(`台「${wsDisplayNameOf(w)}」(${w.kind}${w.archived ? ',已归档' : ''}) 分类${cats} 卡${cards.length}\n${sample}`)
  }
  L.push('【工作台目录】\n' + wsLines.join('\n'))
  const total = { res: (d.resources || []).filter(r => !r.deletedAt).length, task: (d.tasks || []).filter(t => !t.deletedAt).length, done: (d.tasks || []).filter(t => !t.deletedAt && t.status === 'done').length, curio: (d.curiosities || []).filter(x => !x.deletedAt).length, trash: (d.resources || []).filter(r => r.deletedAt).length + (d.tasks || []).filter(t => t.deletedAt).length }
  L.push(`【全局计数】资源${total.res} · 任务${total.task}(完成${total.done}) · 好奇${total.curio} · 回收站${total.trash} · 无归属任务${orphanTasks}`)
  return L.join('\n\n')
}
