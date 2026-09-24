/**
 * R134-F1：上下文投影器——把 store.data（AppData）按场景压成紧凑文本喂给 LLM。
 *
 * 性能纪律（交付说明承诺）：
 *  - 只读既有数组/映射现场组装，绝不整库 JSON.stringify；
 *  - 每个投影都有深度档上限（eco/std/deep），产出目标 2~12KB；
 *  - 附件（zy-asset/IndexedDB 本体）永不进投影——只投影文字字段。
 */
import type { AppData, ResourceCard, Project, Metric, TaskCard } from '@/shared/models'
import { CURATION_WS_ID } from '@/shared/models'
import { wsDisplayNameOf } from '@/shared/utils/wsName'
import { curioRelated } from '@/shared/utils/maturity'
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

/** 标签词表（打标建议必须落在既有标签或明确新标签）
 *  R162：改喂「父/子」路径——旧实现只给节点裸名，模型看不到层级，体系里的子标签（如「生活/宜居城市」）
 *  容易被写成裸名新词；与落库口径（tagPathOf）对齐后，模型能直接选中既有子标签。 */
function tagVocab(d: AppData, cap: number): string {
  const seen = new Set<string>()
  const walk = (nodes: { name: string; children?: unknown[] }[], prefix: string) => {
    for (const n of nodes || []) {
      const p = prefix ? prefix + '/' + n.name : n.name
      seen.add(p)
      const kids = n.children as { name: string; children?: unknown[] }[] | undefined
      if (kids?.length) walk(kids, p)
    }
  }
  walk(d.tagTree || [], '')
  for (const r of d.resources || []) for (const t of r.tags || []) seen.add(t)
  return [...seen].slice(0, cap).join('、')
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

/**
 * R135：罗盘链式生成投料——给锚点（愿景层 / 目标 / 项目 / 指标 / 任务），
 * 组「上行链 + 同层兄弟现状」紧凑画像：模型据此补缺口，且不提与现有兄弟重复的建议。
 */
export function projectChain(
  d: AppData,
  level: 'directions' | 'projects' | 'metrics' | 'tasks' | 'breakdown',
  anchorId: string,
  depth: AiDepth,
): { text: string; missing: string } {
  const c = CAP[depth]
  const L: string[] = []
  const taskState = (t?: { status: string }) => (t ? (t.status === 'done' ? '✓' : t.status === 'doing' ? '▶' : '·') : '·')
  L.push(`【愿景】${cut(d.compass.vision?.content, c.desc) || '（未填——建议先与用户确认愿景再生成）'}`)
  L.push(`【使命】${cut(d.compass.mission?.content, c.desc) || '（未填）'}`)
  const dirLine = (x: typeof d.compass.directions[number], mark: string) =>
    `${mark} 目标「${x.name}」${x.term || '未分期'}/${x.status}·项目${x.projects.length}个`
  const findDir = (id: string) => d.compass.directions.find(x => x.id === id)
  if (level === 'directions') {
    const cur = d.compass.directions.map(x => dirLine(x, '·')).join('\n') || '（一个战略目标都还没有）'
    L.push(`【现有战略目标】\n${cur}`)
    L.push('【任务】依据愿景/使命，提出 2~4 个**现阶段（未来 3~12 个月）**该立的战略目标，避开与现有目标语义重复。')
  } else if (level === 'projects') {
    const dir = findDir(anchorId)
    if (!dir) return { text: '', missing: '战略目标已不存在' }
    L.push(dirLine(dir, '【本目标→】'))
    const ps = dir.projects.map(p => `· 项目「${p.name}」${p.isFocused ? '[主攻]' : ''} 进度${p.progress || 0}% ${p.status}${p.endDate ? ' 截止' + p.endDate : ''} 指标${p.metrics.length}个`).join('\n')
    L.push(`【该目标下现有项目】\n${ps || '（还没有项目）'}`)
    L.push('【任务】为该目标提出 2~4 个补齐路径依赖的攻坚项目建议，与现有项目不重复。')
  } else if (level === 'metrics') {
    let host: { dir: typeof d.compass.directions[number] | undefined; proj: Project | undefined } = { dir: undefined, proj: undefined }
    for (const x of d.compass.directions) { const p = x.projects.find(y => y.id === anchorId); if (p) { host = { dir: x, proj: p }; break } }
    if (!host.proj) return { text: '', missing: '项目已不存在' }
    if (host.dir) L.push(dirLine(host.dir, '【↑】'))
    L.push(`【本项目→】「${host.proj.name}」${host.proj.isFocused ? '[主攻]' : ''} 进度${host.proj.progress || 0}% ${host.proj.status} 截止${host.proj.endDate || '?'}`)
    const ms = host.proj.metrics.map(m => {
      const ts = m.taskIds.map(id => (d.tasks || []).find(t => t.id === id && !t.deletedAt)).filter(Boolean) as { status: string; title: string }[]
      return `· 指标「${m.title}」目标:${cut(m.target, 40) || '未写'} 任务${ts.filter(t => t.status === 'done').length}/${ts.length}`
    }).join('\n')
    L.push(`【现有成功指标】\n${ms || '（一个指标都没有——这正是问题）'}`)
    L.push('【任务】提出 2~3 个**可量化验收**的成功指标建议；若现有指标已足够则少提或说明。')
  } else if (level === 'tasks') {
    let met: Metric | undefined; let proj: Project | undefined; let dir: typeof d.compass.directions[number] | undefined
    for (const x of d.compass.directions) for (const p of x.projects) { const m = p.metrics.find(y => y.id === anchorId); if (m) { met = m; proj = p; dir = x; break } }
    if (!met || !proj) return { text: '', missing: '指标已不存在' }
    L.push(`${dir ? dirLine(dir, '【↑↑】') : ''}\n· ${proj.name} → 指标「${met.title}」（目标:${cut(met.target, 60) || '未写'}）${met.acceptance ? ` 验收:${cut(met.acceptance, c.desc)}` : ''}`)
    const ts = met.taskIds.map(id => (d.tasks || []).find(t => t.id === id && !t.deletedAt)).filter(Boolean) as TaskCard[]
    L.push(`【该指标下现有任务】\n${ts.map(t => `${taskState(t)} ${t.title}${t.dueDate ? '（' + t.dueDate + '）' : ''}`).join('\n') || '（还没有任务）'}`)
    const gap = ts.length - ts.filter(t => t.status === 'done').length
    L.push(`【任务】指标缺口=未完成 ${gap} 项。提出 3~6 个**未来两周可执行**的具体任务建议，覆盖「验收标准」但别与现有任务重复；每个任务应直接推进该指标。`)
  } else {
    const t = (d.tasks || []).find(x => x.id === anchorId)
    if (!t) return { text: '', missing: '任务已不存在' }
    let met: Metric | undefined; let proj: Project | undefined; let dir: typeof d.compass.directions[number] | undefined
    for (const x of d.compass.directions) for (const p of x.projects) { const m = p.metrics.find(y => y.taskIds.includes(anchorId)); if (m) { met = m; proj = p; dir = x; break } }
    L.push(`【待拆解任务】「${t.title}」${t.status} 优先级${t.priority}${t.dueDate ? ' 截止' + t.dueDate : ' 无截止日'}${t.estimatedMinutes ? ' 预估' + t.estimatedMinutes + '分钟' : ''}`)
    if (t.description) L.push(`描述：${cut(t.description, c.desc * 2)}`)
    L.push(`${dir ? dirLine(dir, '【↑】') : ''}`)
    if (proj && met) L.push(`归属：${proj.name} → 指标「${met.title}」（验收:${cut(met.acceptance || met.target, c.desc) || '未写'}）`)
    L.push('【任务】把该任务拆成 3~6 个**半天内可完成**的具体步骤（今天/明天就能动手的粒度），给出建议时间盒与先后顺序；步骤标题即子任务名。')
  }
  return { text: L.filter(Boolean).join('\n'), missing: '' }
}

/**
 * R136：全库资源卡目录（应用推荐投料）——一行一卡，上限走深度档；
 * 排除回收站/已在任务挂载清单（避免重复推荐已挂载）。
 */
export function cardDirectory(d: AppData, opts: { excludeIds?: Set<string> }, depth: AiDepth): string {
  const c = CAP[depth]
  const lines: string[] = []
  for (const r of d.resources || []) {
    if (r.deletedAt || opts.excludeIds?.has(r.id)) continue
    if (lines.length >= c.cards * 2) break
    lines.push(`- cardId=${r.id} 「${cut(r.title, 50)}」${r.tags?.length ? ` 标签[${r.tags.join(',')}]` : ''} 分类:${catPathOf(d, r.categoryId) || '未分类'}${r.description ? ` ${cut(r.description, 50)}` : ''} 打开${r.callCount || 0}次`)
  }
  return lines.join('\n')
}

/**
 * R137 · E1 标签体系体检投料：全部实际在用的标签值（含路径/裸叶子双口径）+ 各值用量，
 * 附标签树现状路径清单——同义合并建议必须落在真实存在的标签上。
 */
export function projectTagSystem(d: AppData, depth: AiDepth): string {
  const c = CAP[depth]
  const usage = new Map<string, number>()
  for (const arr of [d.resources, d.tasks, d.curiosities] as { id: string; tags?: string[]; deletedAt?: number }[][]) {
    for (const x of arr || []) { if (x.deletedAt) continue; for (const t of x.tags || []) usage.set(t, (usage.get(t) || 0) + 1) }
  }
  const treePaths: string[] = []
  const walk = (nodes: { name: string; children?: unknown[] }[], prefix: string) => {
    for (const n of nodes) { const p = prefix ? `${prefix}/${n.name}` : n.name; treePaths.push(p); if (n.children?.length) walk(n.children as never, p) }
  }
  walk((d.tagTree || []) as never, '')
  const used = [...usage.entries()].sort((a, b) => b[1] - a[1]).slice(0, c.list * 2)
  return [
    '【在用标签及用量（含卡片上的裸叶子名与父/子路径双口径）】',
    used.map(([t, n]) => `- ${t}（${n} 次）`).join('\n'),
    `【标签树现状路径】\n${treePaths.slice(0, c.list * 2).join('\n') || '（树为空，标签以裸名散存于卡片）'}`,
    treePaths.length > c.list * 2 ? `… 另有 ${treePaths.length - c.list * 2} 条树路径` : '',
  ].filter(Boolean).join('\n')
}

/**
 * R151 · 标签整体梳理蓝图投料：锚（愿景/使命/活跃目标与项目画像）+ 现树与用量 + **三类卡全量台账**。
 * 两条口径改动（用户拍板）：
 *  ① 台账从"只有资源卡"扩到 资源卡 + 任务卡 + 好奇心卡——标签树是三卡共用的，梳理范围必须一致；
 *  ② **不再投链接正文**——完全依据卡面现有字段判断（R143 的按需抽读整段退场）。
 *     代价如实写在提示词里：卡面信息不足的卡，宁可留空归宿也不硬塞。
 */
export function projectTagBlueprint(d: AppData, depth: AiDepth): string {
  const c = CAP[depth]
  const L: string[] = []
  L.push(`【愿景】${cut(d.compass.vision?.content, 160) || '（未填）'}\n【使命】${cut(d.compass.mission?.content, 160) || '（未填）'}`)
  const dirs = (d.compass.directions || []).filter(x => x.status === 'active').slice(0, 6).map(x => {
    const ps = (x.projects || []).slice(0, 8).map(p => {
      const ms = (p.metrics || []).slice(0, 3).map(m => cut(m.title, 14)).join('、')
      return `    · ${cut(p.name, 16)}（${p.status || 'active'}${p.progress != null ? ` · 进度 ${p.progress}%` : ''}${p.isFocused ? ' · 主攻' : ''}${ms ? `｜指标：${ms}` : ''}）`
    })
    return `- ${cut(x.name, 18)}（${x.term || '未分期'}）\n${ps.join('\n') || '    （无项目）'}`
  })
  L.push(`【用户核心关注：活跃战略目标与项目】\n${dirs.join('\n') || '（暂无活跃目标——按卡面自身脉络设计）'}`)
  const usage = new Map<string, number>()
  for (const arr of [d.resources, d.tasks, d.curiosities] as { tags?: string[]; deletedAt?: number }[][]) {
    for (const x of arr || []) { if (x.deletedAt) continue; for (const t of x.tags || []) usage.set(t, (usage.get(t) || 0) + 1) }
  }
  const treePaths: string[] = []
  const walk = (nodes: { name: string; children?: unknown[] }[], prefix: string) => {
    for (const n of nodes) { const p = prefix ? `${prefix}/${n.name}` : n.name; treePaths.push(p); if (n.children?.length) walk(n.children as never, p) }
  }
  walk((d.tagTree || []) as never, '')
  L.push(`【现有标签树】\n${treePaths.join('\n') || '（空树——标签全以裸名散存）'}\n【在用标签及用量】\n${[...usage.entries()].sort((a, b) => b[1] - a[1]).slice(0, c.list * 3).map(([t, n]) => `- ${t}（${n} 次）`).join('\n') || '（一个标签都还没有）'}`)
  // 三类卡台账：全量不抽样（"对全库卡片做梳理"是需求本体）；每行只带卡面字段
  const res = (d.resources || []).filter(r => !r.deletedAt)
  const tks = (d.tasks || []).filter(t => !t.deletedAt)
  const cus = (d.curiosities || []).filter(x => !x.deletedAt)
  const row = (kind: string, id: string, title: string, desc: string, tags: string[], extra: string) =>
    `- [${kind}] cardId=${id} 「${cut(title, 30)}」 描述:${desc ? cut(desc, 40) : '（空）'} 标签[${tags.join('、') || '无'}]${extra}`
  const lines = [
    ...res.map(r => {
      let domain = ''
      try { domain = new URL(r.link || '').host } catch { /* 非网页链接留空 */ }
      return row('res', r.id, r.title, r.description || '', r.tags || [], ` 打开${r.callCount || 0}次${domain ? ' 域名:' + domain : ''}`)
    }),
    ...tks.map(t => row('task', t.id, t.title, t.description || '', t.tags || [], ` 状态:${t.status || 'todo'} 优先级:${t.priority || '-'}${t.dueDate ? ` 截止:${t.dueDate}` : ''}`)),
    ...cus.map(x => row('curio', x.id, x.question, x.description || '', x.tags || [], ` 状态:${x.status || 'todo'}`)),
  ]
  L.push(`【全库卡片台账（共 ${lines.length} 张：资源 ${res.length} · 任务 ${tks.length} · 好奇 ${cus.length}；只用卡面字段，不读链接正文）】\n${lines.join('\n')}`)
  return L.filter(Boolean).join('\n\n')
}

/** R137 · H2 回收站捞回投料：软删清单（含删除时间）+ 现存卡目录与活跃目标做"是否还需要"参照 */
export function projectTrash(d: AppData, depth: AiDepth): string {
  const c = CAP[depth]
  const tr = (d.resources || []).filter(r => r.deletedAt).sort((a, b) => (b.deletedAt! - a.deletedAt!)).slice(0, c.cards)
  const live = new Set((d.resources || []).filter(r => !r.deletedAt).map(r => r.title))
  const dirs = (d.compass.directions || []).filter(x => x.status === 'active').map(x => `· ${x.name}（${x.term || '未分期'}）`).join('\n')
  return [
    `【回收站清单】共 ${tr.length} 张资源卡（删于 30 天内优先评估）`,
    ...tr.map(r => {
      const sim = [...live].find(t => t !== r.title && (t.includes(r.title.slice(0, 6)) || r.title.includes(t.slice(0, 6))))
      return `- cardId=${r.id} 「${cut(r.title, 50)}」 删前分类:${catPathOf(d, r.categoryId) || '未分类'} 标签[${(r.tags || []).join(',')}] 删前打开${r.callCount || 0}次 删除于${new Date(r.deletedAt!).toLocaleDateString('zh-CN')}${sim ? ` ⚠与现存卡「${cut(sim, 30)}」疑似同物` : ''}`
    }),
    dirs ? `【当前活跃战略目标（相关性参照）】\n${dirs}` : '',
  ].filter(Boolean).join('\n')
}

/** R137 · G2 跨台相似卡投料：全库卡目录（带台归属）+ 台清单 */
export function projectCrossDeck(d: AppData, depth: AiDepth): { text: string; hubIds: Set<string> } {
  const c = CAP[depth]
  const wsName = new Map((d.workspaces || []).map(w => [w.id, wsDisplayNameOf(w)]))
  const hubIds = new Set<string>((d.resources || []).filter(r => !r.deletedAt && r.workspaceId === CURATION_WS_ID).map(r => r.id))
  const lines: string[] = []
  for (const r of d.resources || []) {
    if (r.deletedAt) continue
    if (lines.length >= c.cards * 2) break
    lines.push(`- cardId=${r.id} 台[${wsName.get(r.workspaceId) || '?'}] 「${cut(r.title, 50)}」${r.tags?.length ? ` 标签[${r.tags.join(',')}]` : ''}${r.description ? ` ${cut(r.description, 40)}` : ''}`)
  }
  const boards = (d.workspaces || []).filter(w => !w.archived && w.kind !== 'resource').map(w => `· wsId=${w.id} ${wsDisplayNameOf(w)}`).join('\n')
  return { text: `【全库卡目录】\n${lines.join('\n')}\n\n【策展台清单】\n${boards}`, hubIds }
}

/** R137 · G1 金字塔主题漂移投料：每台 主题卡 + 卡群样本 */
export function projectThesis(d: AppData, depth: AiDepth): string {
  const c = CAP[depth]
  const blocks: string[] = []
  for (const w of d.workspaces || []) {
    if (w.archived) continue
    const cards = (d.resources || []).filter(r => !r.deletedAt && r.workspaceId === w.id)
    const th = cards.find(r => r.isThesis)
    if (!th) continue
    const sample = cards.filter(r => !r.isThesis).slice(0, c.titles).map(r => `· ${cut(r.title, 40)}${r.tags?.length ? ` [${r.tags.join(',')}]` : ''}`).join('\n')
    blocks.push(`台 wsId=${w.id} 「${wsDisplayNameOf(w)}」主题卡:「${cut(th.title, 40)}」${th.description ? ` 论点:${cut(th.description, c.desc)}` : ''}\n卡群 ${cards.length - 1} 张：\n${sample || '（无其它卡）'}`)
  }
  return blocks.join('\n\n') || ''
}

/** R144 · G1 论点提炼投料：单台卡群全量台账（分类归属+用量）+ 愿景使命锚 + 已抽读正文 */
export function projectDeckThesis(d: AppData, wsId: string, depth: AiDepth, snips: Map<string, string>): string {
  const c = CAP[depth]
  const ws = (d.workspaces || []).find(w => w.id === wsId)
  if (!ws) return ''
  const cards = (d.resources || []).filter(r => !r.deletedAt && r.workspaceId === wsId && !r.isThesis)
  if (!cards.length) return ''
  const L: string[] = []
  const th = (d.resources || []).find(r => r.workspaceId === wsId && r.isThesis && !r.deletedAt)
  L.push(`【本台】${wsDisplayNameOf(ws)}${th ? `\n【现有中心论点】「${cut(th.title, 40)}」${cut(th.description, c.desc)}` : '\n【现有中心论点】（还没有——请从卡群证据里立一个）'}`)
  L.push(`【愿景】${cut(d.compass.vision?.content, 120) || '（未填）'}\n【使命】${cut(d.compass.mission?.content, 120) || '（未填）'}`)
  const catName = new Map((d.categories || []).filter(x => !x.deletedAt).map(x => [x.id, x.name]))
  const rows = cards.slice(0, c.cards).map(r =>
    `- cardId=${r.id} 「${cut(r.title, 40)}」 分类:${catName.get(r.categoryId) || '未分'} 描述:${r.description?.trim() ? cut(r.description.trim(), 50) : '（空）'} 标签[${(r.tags || []).join('、') || '无'}] 打开${r.callCount || 0}次`)
  L.push(`【卡群台账（共 ${cards.length} 张${cards.length > c.cards ? `，取前 ${c.cards}` : ''}）】\n${rows.join('\n')}`)
  const mine = [...snips.entries()].filter(([id]) => cards.some(r => r.id === id))
  L.push(mine.length
    ? `【链接正文抽样（${mine.length} 篇）】\n${mine.map(([id, t]) => `· cardId=${id} 正文节选：${t.replace(/\n/g, ' ')}`).join('\n')}`
    : '【链接正文抽样】（本轮未补读正文——只据卡面判断，别假装有读过）')
  return L.join('\n\n')
}

/** R144 · G2 好奇研判投料：待探索池逐条（含挂载数/成熟度/动静）+ 愿景使命与活跃目标做「值不值得转」的参照 */
export function projectCurioPool(d: AppData, ids: string[], depth: AiDepth, snips: Map<string, string>): string {
  const c = CAP[depth]
  const want = new Set(ids)
  const pool = (d.curiosities || []).filter(x => want.has(x.id) && !x.deletedAt).slice(0, c.cards)
  if (!pool.length) return ''
  const L: string[] = []
  L.push(`【愿景】${cut(d.compass.vision?.content, 120) || '（未填）'}\n【使命】${cut(d.compass.mission?.content, 120) || '（未填）'}`)
  const dirs = (d.compass.directions || []).filter(x => x.status === 'active').slice(0, 6)
    .map(x => `- ${x.name}（${x.term || '未分期'}）：${x.projects.map(p => cut(p.name, 16)).join('、') || '无项目'}`)
  L.push(`【活跃战略目标】\n${dirs.join('\n') || '（暂无活跃目标）'}`)
  const day = 86400000
  const rows = pool.map(x => {
    const rel = curioRelated(d, x)
    let host = ''
    try { host = new URL(x.sourceUrl || '').host } catch { /* 无来源链接留空 */ }
    const age = Math.max(0, Math.round((Date.now() - (x.lastCalledAt || x.updatedAt || x.createdAt)) / day))
    return `- curioId=${x.id} 「${cut(x.question, 60)}」 ${x.status === 'doing' ? '探索中' : '待探索'} 挂资源${rel.length}张${rel.length ? `(${cut(rel[0]!.title, 16)})` : ''}${host ? ` 来源:${host}` : ''} 打开${x.callCount || 0}次 ${age}天没动过`
  })
  L.push(`【待探索池（${pool.length} 条）】\n${rows.join('\n')}`)
  const mine = [...snips.entries()].filter(([id]) => pool.some(x => x.id === id))
  L.push(mine.length
    ? `【来源正文抽样（${mine.length} 篇）】\n${mine.map(([id, t]) => `· curioId=${id} 正文节选：${t.replace(/\n/g, ' ')}`).join('\n')}`
    : '【来源正文抽样】（未补读正文——只据卡面研判，别假装有读过）')
  return L.join('\n\n')
}

/** R144 · G3 找佐证投料：目标分支（名称/定义/现有卡）+ 资源台全库目录（镜像机制只接受资源台源卡） */
export function projectEvidenceFor(
  d: AppData, depth: AiDepth, branch: { name: string; definition?: string; path: string },
  existing: { id: string; title: string }[], board: ResourceCard[],
): string {
  const c = CAP[depth]
  const L: string[] = []
  L.push(`【金字塔分支】${branch.path}\n这一支论证：${cut(branch.definition, 60) || '（台里没写定义——按分支名与其上层论点自行推断）'}`)
  L.push(`【该分支已有的卡（${existing.length} 张，不要重复推荐）】\n${existing.map(x => `· ${cut(x.title, 40)}`).join('\n') || '（一张都没有——这正是来找证据的原因）'}`)
  const rows = board.slice(0, c.cards).map(r =>
    `- cardId=${r.id} 「${cut(r.title, 44)}」${r.description ? ` ${cut(r.description.trim(), 60)}` : ''}${r.tags?.length ? ` 标签[${r.tags.join(',')}]` : ''} 打开${r.callCount || 0}次`)
  L.push(`【资源台卡目录（${board.length} 张${board.length > c.cards ? `，取前 ${c.cards}` : ''}）】\n${rows.join('\n') || '（资源台是空的——无卡可佐证）'}`)
  return L.join('\n\n')
}

/** R144 · G4 成果文稿投料：愿景使命 + 活跃目标进度 + 各台论点 + 近期完成 + 卡群样本（全部可指回出处） */
export function projectDeliverMaterial(d: AppData, depth: AiDepth, genre: string): string {
  const c = CAP[depth]
  const L: string[] = []
  L.push(`【体裁要求】${cut(genre, 60) || '一篇可直接转发的短文'}\n【愿景】${cut(d.compass.vision?.content, 120) || '（未填）'}\n【使命】${cut(d.compass.mission?.content, 120) || '（未填）'}`)
  const dirs = (d.compass.directions || []).filter(x => x.status === 'active').slice(0, 6).map(x => {
    const ps = x.projects.map(p => `· 项目「${cut(p.name, 20)}」${p.isFocused ? '[主攻] ' : ''}进度${p.progress || 0}% ${p.endDate ? '截止' + p.endDate : '未定期限'}`).join('\n')
    return `- 目标「${cut(x.name, 24)}」（${x.term || '未分期'}）\n${ps || '  （无项目）'}`
  })
  L.push(`【活跃战略目标与推进】\n${dirs.join('\n') || '（暂无活跃目标）'}`)
  const ths = (d.resources || []).filter(r => !r.deletedAt && r.isThesis).slice(0, 8).map(r =>
    `- 「${cut(r.title, 40)}」${cut(r.description, c.desc)}`)
  L.push(`【各策展台中心论点（用户已经立住的判断）】\n${ths.join('\n') || '（还没有中心论点——那就从证据直接写，别硬造立场）'}`)
  const monthAgo = Date.now() - 30 * 86400000
  const done = (d.tasks || []).filter(t => !t.deletedAt && t.status === 'done' && (t.completedAt || t.updatedAt) >= monthAgo)
    .slice(0, c.list).map(t => `- ✅ ${cut(t.title, 40)}${t.completedAt ? `（${new Date(t.completedAt).toLocaleDateString('zh-CN')} 完成）` : ''}`)
  L.push(`【近 30 天完成的任务（成果候选）】\n${done.join('\n') || '（近 30 天没有完成任务——那就写成「下一阶段计划」而非「成绩单」，别把没做的事写成做过）'}`)
  const opened = (d.resources || []).filter(r => !r.deletedAt && !r.isThesis && (r.lastCalledAt || 0) >= monthAgo)
    .sort((a, b) => (b.callCount || 0) - (a.callCount || 0)).slice(0, c.titles)
    .map(r => `- 「${cut(r.title, 40)}」${cut(r.description, 40)} 打开${r.callCount || 0}次`)
  L.push(`【近期用过的资源卡（素材出处）】\n${opened.join('\n') || '（近期没打开过任何卡）'}`)
  return L.join('\n\n')
}

/**
 * R138-F2′：一周台账投影——本周完成/新增任务、本周打开过的卡、活跃目标进度、WRR 口径数字。
 * 只取近 7 天窗口，行数走深度档。
 */
export function projectWeekDigest(d: AppData, depth: AiDepth): string {
  const c = CAP[depth]
  const weekAgo = Date.now() - 7 * 86400000
  const done = (d.tasks || []).filter(t => !t.deletedAt && t.status === 'done' && (t.completedAt || t.updatedAt) >= weekAgo).slice(0, c.list)
  const added = (d.tasks || []).filter(t => !t.deletedAt && t.createdAt >= weekAgo && t.status !== 'done').slice(0, c.list)
  const opened = (d.resources || []).filter(r => !r.deletedAt && (r.lastCalledAt || 0) >= weekAgo).sort((a, b) => (b.callCount || 0) - (a.callCount || 0)).slice(0, c.titles)
  const stalled = (d.tasks || []).filter(t => !t.deletedAt && t.status === 'doing' && t.updatedAt < weekAgo).slice(0, c.list)
  const dirs = (d.compass.directions || []).filter(x => x.status === 'active').map(x => {
    const projs = x.projects.map(p => {
      const ms = p.metrics.map(m => {
        const ts = m.taskIds.map(id => (d.tasks || []).find(t => t.id === id && !t.deletedAt)).filter(Boolean) as { status: string }[]
        return `${ts.filter(t => t.status === 'done').length}/${ts.length}`
      })
      return `「${cut(p.name, 24)}」${p.progress || 0}% 指标[${ms.join(',')}]`
    })
    return `- ${x.name}（${x.term || '未分期'}）：${projs.join('；') || '无项目'}`
  })
  // R139：调用分布（按台聚合）+ 主攻项目投入对照——深度洞察的"重心偏离"证据源
  const wsName = new Map((d.workspaces || []).map(w => [w.id, w.name]))
  const byWs = new Map<string, { n: number; calls: number }>()
  for (const r of opened) {
    const k = wsName.get(r.workspaceId) || '未知台'
    const cur = byWs.get(k) || { n: 0, calls: 0 }
    byWs.set(k, { n: cur.n + 1, calls: cur.calls + (r.callCount || 0) })
  }
  const dist = [...byWs.entries()].sort((a, b) => b[1].n - a[1].n).slice(0, 6)
    .map(([k, v]) => `- ${k}：${v.n} 卡（这些卡累计 ${v.calls} 次调用）`)
  const focused = (d.compass.directions || []).flatMap(x => x.projects.filter(p => p.isFocused).map(p => ({ dir: x.name, p }))).slice(0, 3)
  const fLines = focused.map(({ dir, p }) => {
    const ts = (d.tasks || []).filter(t => !t.deletedAt && t.projectId === p.id)
    const tDone = ts.filter(t => t.status === 'done' && (t.completedAt || t.updatedAt) >= weekAgo).length
    const tStall = ts.filter(t => t.status === 'doing' && t.updatedAt < weekAgo).length
    const tOpen = ts.filter(t => t.status !== 'done').length
    return `- 主攻「${cut(p.name, 24)}」（目标:${dir}）：进度 ${p.progress || 0}%，未完成任务 ${tOpen}，本周完成 ${tDone}，停滞 ${tStall}`
  })
  const L: string[] = [
    `【本周（近 7 天）完成的任务】\n${done.map(t => `- ${cut(t.title, 40)}`).join('\n') || '（无）'}`,
    `【本周新增且在推进的任务】\n${added.map(t => `- ${cut(t.title, 40)}（${t.status === 'doing' ? '进行中' : '待开始'}${t.dueDate ? '，限 ' + t.dueDate : ''}）`).join('\n') || '（无）'}`,
    stalled.length ? `【停滞中的任务（超 7 天未更新）】\n${stalled.map(t => `- ${cut(t.title, 40)}`).join('\n')}` : '',
    `【本周打开过的资源卡】\n${opened.map(r => `- ${cut(r.title, 40)}（累计 ${r.callCount || 0} 次）`).join('\n') || '（无）'}`,
    dist.length ? `【本周调用分布（按工作台）】\n${dist.join('\n')}` : '',
    fLines.length ? `【主攻项目投入对照】\n${fLines.join('\n')}` : '',
    `【活跃目标现状】\n${dirs.join('\n') || '（无活跃目标）'}`,
  ]
  return L.filter(Boolean).join('\n\n')
}

/** R138-C1′：任务一句话录入的项目/指标候选清单（id 供模型回填，sanitize 在宿主 apply） */
export function projectTaskTargets(d: AppData, depth: AiDepth): string {
  const c = CAP[depth]
  const lines: string[] = []
  for (const dir of d.compass.directions || []) {
    if (dir.status === 'archived') continue
    for (const p of dir.projects) {
      if (p.status === 'archived' || lines.length >= c.list) continue
      lines.push(`- projectId=${p.id} 「${cut(p.name, 30)}」（目标:${dir.name}）`)
      for (const m of p.metrics.slice(0, 4)) lines.push(`  - metricId=${m.id} ${cut(m.title, 30)}`)
    }
  }
  return lines.join('\n') || '（暂无项目）'
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
