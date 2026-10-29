import { ref, reactive, computed, watch, watchEffect, onMounted, shallowRef } from 'vue'
import type { Ref, ComputedRef, ShallowRef } from 'vue'
import type { AiPersona } from '@/shared/ai/scenarios'
import { useConfirm } from '@/shared/components/confirm'
import { showToast } from '@/shared/components/toast'
import { uid, dateKey, weekStartKey } from '@/shared/utils'
import { freshTagsOf, knownTagSet, canonicalTagsOf } from '@/shared/utils/tags'
import type { FieldDef, AppData, ResourceCard, TaskCard, CuriosityCard, Workspace, Category, TagNode, ID } from '@/shared/models'
import type { AiJob, AiRow } from '@/shared/ai/job'
import { aiConfig, loadAiConfig, patchAiConfig, aiReady, type AiDepth } from '@/shared/ai/config'
import { listModels, testConnection as aiTestConnection, chatStream, extractJson } from '@/shared/ai/llm'
import { projectCards, projectLibrary, catPathOf as aiCatPathOf } from '@/shared/ai/project'
import { batchEnrichSystem, diagnosisSystem, allPersonas, personaOverrides, sanitizeRefs, type EnrichSuggestion } from '@/shared/ai/scenarios'
import { buildTagGovernJob, buildTrashRescueJob, buildTagBlueprintJob, buildTagAssignJob, consumeTagBlueprintAdopted, getTagReviseBackup, restoreTagReviseBackup , reviseSnips } from '@/shared/ai/govern'
import { buildReviewJob } from '@/shared/ai/select'
import { withReport } from '@/shared/ai/reports'
import { listJobStates, clearFinished, type JobState } from '@/shared/ai/runner'
import { buildDeliverJob } from '@/shared/ai/batchG'
import { toOpenableUrl, openExternalLink } from '@/shared/utils/link'
import { openHtmlAsset } from '@/shared/utils/htmlAsset'
import type { useGlobalSettings, TtRow } from './useGlobalSettings'

export function useGlobalSettingsPanels(deps: Pick<ReturnType<typeof useGlobalSettings>, 'ttTogglePick' | 'ttRows' | 'ttPicked' | 'activePage' | 'gd' | 'store' | 'ttDetail' | 'ttCardDragging' | 'ttDropTarget' | 'ttActiveTag' | 'findTagNode' | 'ttEditing' | 'tagFlat' | 'ttCollapsed' | 'ttFlash' | 'tagTree' | 'tagSubtreeIds' | 'tagDepth' | 'safeChildren'>): { ttDragId: string | null; ttCardDragIds: string[] | null; onTtRowClick: (row: TtRow) => void; ttAllChecked: ComputedRef<boolean>; toggleTtAll: () => void; aiJob: ShallowRef<AiJob | null, AiJob | null>; aiJobKey: Ref<string, string>; aiModels: Ref<string[], string[]>; aiBusy: Ref<"" | "models" | "test", "" | "models" | "test">; aiMsg: Ref<string, string>; aiGenre: Ref<string, string>; aiPersonas: ComputedRef<AiPersona[]>; aiPersonaSel: Ref<string[], string[]>; aiPersonaSynced: boolean; aiNewP: { name: string; brief: string; focus: string; }; aiAddPersona: () => void; aiRemovePersona: (id: string) => void; aiEditP: Ref<string, string>; aiPersonaCfg: (id: string) => { id: string; enabled: boolean; style: string; brief?: string | undefined; focus?: string | undefined; } | undefined; aiPatchPersona: (id: string, p: Partial<{ enabled: boolean; style: string; brief: string; focus: string; }>) => void; aiCustomPatch: (id: string, k: "name" | "brief" | "focus", v: string) => void; aiOpenJob: (job: AiJob | null, emptyMsg: string) => void; aiTray: ComputedRef<JobState[]>; aiOpenState: (s: JobState) => void; aiTrayClear: () => void; aiTagGovern: () => Promise<void>; aiReviseBak: Ref<{ at: number; } | null, { at: number; } | { at: number; } | null>; aiTagRevise: () => Promise<void>; aiJobClosed: () => void; aiCheckReviseBak: () => Promise<void>; aiRestoreRevise: () => Promise<void>; aiTrashRescue: () => void; aiWeeklyReview: () => void; aiDeliver: () => void; aiErr: (e: unknown) => string; aiGuard: () => boolean; aiFetchModels: () => Promise<void>; aiTestConn: () => Promise<void>; aiTogglePersona: (id: string) => void; aiCatVocab: (d: AppData, cards: ResourceCard[]) => string; aiTtEnrich: () => void; aiEnrichIds: (ids: Set<string>) => void; aiDiagnose: () => void; onTtRowDblClick: (row: TtRow) => void; onTtRowDragStart: (e: DragEvent, row: TtRow) => void; onTtRowDragEnd: () => void; ttMoveCards: (targetPath: string) => void; openCardLink: (r: { linkType?: string | undefined; link?: string | undefined; assets?: { id: string; kind: string; }[] | undefined; }) => void; ttRename: (id: string) => void; ttConfirm: () => void; ttCancel: () => void; ttRemove: (id: string) => Promise<void>; ttDragStart: (e: DragEvent, id: string) => void; ttDragEnd: () => void; ttDrop: (e: DragEvent, targetId: string) => void; ttUnnest: (rootId: string, childId: string) => void; ttCollectFromCards: () => void; activeManualSec: Ref<string, string> } {
  const { ttTogglePick, ttRows, ttPicked, activePage, gd, store, ttDetail, ttCardDragging, ttDropTarget, ttActiveTag, findTagNode, ttEditing, tagFlat, ttCollapsed, ttFlash, tagTree, tagSubtreeIds, tagDepth, safeChildren } = deps
let ttDragId: string | null = null
let ttCardDragIds: string[] | null = null
function onTtRowClick(row: TtRow) { ttTogglePick(row.id) }
// R132-T1：全选本标签——口径为当前类型过滤/搜索结果集（ttRows），与全景「全选本分类」一致
const ttAllChecked = computed(() => ttRows.value.length > 0 && ttRows.value.every(r => ttPicked.value.has(r.id)))
function toggleTtAll() { ttPicked.value = ttAllChecked.value ? new Set() : new Set(ttRows.value.map(r => r.id)) }

// ============== R134-F（批次 F）· AI 助手：接入配置 + 批量补全 + 沉睡唤醒 + 深度诊断 v0 ==============
// 纪律：建议只活在抽屉内存态；采纳才走既有字段写入 + persist 一次；全部手动触发、零常驻、零启动链。
const aiJob = shallowRef<AiJob | null>(null)
/** R148-T：绑 runner 的功能身份（空=旧绑法，抽屉即任务） */
const aiJobKey = ref('')
const aiModels = ref<string[]>([])
const aiBusy = ref<'' | 'models' | 'test'>('')
const aiMsg = ref('')
// R158：沉睡天数参数随沉睡扫描入口迁往 GlobalPopups「AI 建议」面板
const aiGenre = ref('')
const aiPersonas = computed(() => allPersonas())
const aiPersonaSel = ref<string[]>([])
let aiPersonaSynced = false
const aiNewP = reactive({ name: '', brief: '', focus: '' })
watch(activePage, async (p) => { if (p === 'ai') { await loadAiConfig(); if (!aiPersonaSynced) { aiPersonaSel.value = aiPersonas.value.map(x => x.id); aiPersonaSynced = true } } if (p === 'tags') void aiCheckReviseBak() })
// GS 本身即懒路由：挂载时预载一次，标签管理等页的 AI 钮 disabled 态首帧即正确
void loadAiConfig()

function aiAddPersona() {
  const name = aiNewP.name.trim(); const focus = aiNewP.focus.trim()
  if (!name || !focus) { showToast('自建专家至少要有名称与关注面'); return }
  const list = [...(aiConfig.value.customPersonas || []), { id: 'custom-' + Date.now(), name, brief: aiNewP.brief.trim() || '用户自定义专家', focus }]
  patchAiConfig({ customPersonas: list })
  aiPersonaSel.value = [...aiPersonaSel.value, list[list.length - 1].id]
  aiNewP.name = ''; aiNewP.brief = ''; aiNewP.focus = ''
  showToast(`已添加专家「${name}」`)
}
function aiRemovePersona(id: string) {
  patchAiConfig({ customPersonas: (aiConfig.value.customPersonas || []).filter(x => x.id !== id) })
  aiPersonaSel.value = aiPersonaSel.value.filter(x => x !== id)
}
// R140：专家编辑面——启停/风格覆盖持久化（personas[]），自建专家三元组可改
const aiEditP = ref('')
function aiPersonaCfg(id: string) { return (aiConfig.value.personas || []).find(x => x.id === id) }
function aiPatchPersona(id: string, p: Partial<{ enabled: boolean; style: string; brief: string; focus: string }>) {
  const list = [...(aiConfig.value.personas || [])]
  const i = list.findIndex(x => x.id === id)
  const next = { id, enabled: true, style: '', ...(i >= 0 ? list[i] : {}), ...p }
  if (i >= 0) list[i] = next; else list.push(next)
  patchAiConfig({ personas: list })
  if (p.enabled === false) aiPersonaSel.value = aiPersonaSel.value.filter(x => x !== id)
}
function aiCustomPatch(id: string, k: 'name' | 'brief' | 'focus', v: string) {
  const val = v.trim()
  if (k === 'name' && !val) { showToast('专家名不能为空'); return }
  patchAiConfig({ customPersonas: (aiConfig.value.customPersonas || []).map(x => x.id === id ? { ...x, [k]: val || x[k] } : x) })
}
/** R137 治理四钮（标签体检入口在标签管理页；其余三个在 AI 页） */
function aiOpenJob(job: AiJob | null, emptyMsg: string) {
  if (!aiGuard()) return
  if (!job) { showToast(emptyMsg); return }
  aiJobKey.value = job.key || ''
  aiJob.value = job
}
/** R148-T：任务托盘——后台在跑/跑完的 AI 任务一览，点「展开」回到那份结果（不重跑） */
const aiTray = computed(() => listJobStates())
function aiOpenState(s: JobState) { aiJobKey.value = s.key; aiJob.value = s.job }
function aiTrayClear() { clearFinished() }
async function aiTagGovern() { await loadAiConfig(); aiOpenJob(buildTagGovernJob({ d: gd.value, depth: aiConfig.value.depth, persist: () => store.persist() }), '标签体系还是空的，先给卡片打几个标签') }
// R143（反馈）：标签整体梳理——蓝图评审门 → 采纳自动接力全卡归架门；快照还原钮随备份存在而现
const aiReviseBak = ref<{ at: number } | null>(null)
async function aiTagRevise() {
  if (!aiGuard()) return
  await loadAiConfig()
  const jb = buildTagBlueprintJob({ d: gd.value, depth: aiConfig.value.depth, persist: () => store.persist() })
  if (!jb) { showToast('全库卡还太少（三类合计不足 6 张），整体梳理等有库了再来'); return }
  aiJob.value = jb
}
function aiJobClosed() {
  if (consumeTagBlueprintAdopted()) {
    aiReviseBak.value = { at: Date.now() }
    const aj = buildTagAssignJob({ d: gd.value, depth: aiConfig.value.depth, persist: () => store.persist() })
    if (aj) { aiJob.value = aj; showToast('蓝图已落地，接着全卡归架打标'); return }
  }
  aiJob.value = null
  aiJobKey.value = ''
}
async function aiCheckReviseBak() { aiReviseBak.value = await getTagReviseBackup() }
async function aiRestoreRevise() {
  if (!(await useConfirm({ title: '还原上次整体梳理', message: '标签树与卡片标签将回滚到上次「整体梳理」之前（其余数据不动）。继续？', confirmText: '还原' }))) return
  showToast(await restoreTagReviseBackup(gd.value, () => store.persist()))
  aiReviseBak.value = null
}
// R158：aiCrossDeck / aiThesisDrift / aiDormantScan 三函数随被动入口迁往 GlobalPopups「AI 建议」面板退役
// （job 构造逻辑逐项原样搬迁，见 GlobalPopups.vue aiAdviceRun；本页不再持有被动型入口）
function aiTrashRescue() { aiOpenJob(buildTrashRescueJob({ d: gd.value, depth: aiConfig.value.depth, persist: () => store.persist() }), '回收站是空的') }
/** R138-F2′：本周回顾草稿（采纳=存为一张周回顾资源卡） */
function aiWeeklyReview() { aiOpenJob(buildReviewJob({ d: gd.value, depth: aiConfig.value.depth, persist: () => store.persist() }), '近 7 天没有台账数据（任务/打开记录都是空的）') }
/** R144 · G4：成果文稿（论点+目标+近期完成 → 可交付文稿；采纳=存卡，次通道=下载 .md） */
function aiDeliver() {
  aiOpenJob(buildDeliverJob({ d: gd.value, depth: aiConfig.value.depth, persist: () => store.persist(), genre: aiGenre.value.trim() }), '库里还没有论点卡或已完成任务——先立个论点或做完一件事再来成文')
}

function aiErr(e: unknown): string { return (e as Error)?.message || String(e) }
function aiGuard(): boolean {
  if (!aiReady.value) { showToast('请先在「AI 助手」页填好 API 地址 / Key / 模型并测试连接'); activePage.value = 'ai'; return false }
  return true
}
async function aiFetchModels() {
  aiBusy.value = 'models'; aiMsg.value = ''
  try { aiModels.value = await listModels(); aiMsg.value = `拉到 ${aiModels.value.length} 个模型，可直接选用` }
  catch (e) { aiModels.value = []; aiMsg.value = `列表拉取失败：${aiErr(e)}（模型名可手填）` }
  aiBusy.value = ''
}
async function aiTestConn() {
  aiBusy.value = 'test'; aiMsg.value = ''
  try { aiMsg.value = `连接成功：${await aiTestConnection()}` }
  catch (e) { aiMsg.value = `${aiErr(e)}` }
  aiBusy.value = ''
}
function aiTogglePersona(id: string) {
  aiPersonaSel.value = aiPersonaSel.value.includes(id) ? aiPersonaSel.value.filter(x => x !== id) : [...aiPersonaSel.value, id]
}
/** 分类候选词表（限选中卡涉及的台；categoryId 供模型回填，sanitizeRefs 再校验） */
function aiCatVocab(d: AppData, cards: ResourceCard[]): string {
  const wsIds = new Set(cards.map(c => c.workspaceId))
  const lines: string[] = []
  for (const c of d.categories) {
    if (c.deletedAt || !wsIds.has(c.workspaceId)) continue
    lines.push(`categoryId=${c.id}：${aiCatPathOf(d, c.id)}`)
    if (lines.length >= 60) break
  }
  return lines.join('\n')
}

/** A1-批量：标签管理右列选中卡 → 逐卡补标签/描述/分类建议 */
function aiTtEnrich() { aiEnrichIds(ttPicked.value) }
/** R138-H3：泛型化——任意 id 集走批量补全评审（书签导入完成后复用同一条 job） */
function aiEnrichIds(ids: Set<string>) {
  if (!aiGuard()) return
  const d = gd.value
  const { text, cards } = projectCards(d, ids, aiConfig.value.depth)
  if (!cards.length) { showToast('勾选里没有资源卡（批量补全只处理资源卡）'); return }
  const catList = aiCatVocab(d, cards)
  const known = knownTagSet(d)
  const drop = { ghost: 0, fresh: 0, empty: 0 }
  aiJob.value = {
    // R149：key 里带入选集——同一批卡再点=attach 看进度，换一批=新起任务（不会拿旧结果糊弄）
    key: 'enrich:batch:' + [...ids].sort().join('|'),
    title: `批量补全（${cards.length} 张卡）`,
    hint: '逐卡建议：标签（优先复用词表）/ 描述（只补空描述）/ 分类迁移。勾选采纳即直接写入。左栏是这批卡的现状，右栏是补全后的样子（按卡对齐）。',
    promptScope: 'enrich:batch',
    before: () => cards.map(c => ({ key: c.id, main: `${c.title}`.slice(0, 40) || '（无名卡）', sub: `标签 ${(c.tags || []).join('、') || '（无）'} · 描述 ${c.description ? c.description.slice(0, 30) : '（空）'}` })),
    build: () => ({ messages: [
      { role: 'system', content: batchEnrichSystem() },
      { role: 'user', content: text + (catList ? `\n\n【分类候选】\n${catList}` : '') },
    ] }),
    parse: (raw) => {
      const items = Array.isArray((raw as { items?: unknown })?.items) ? (raw as { items: EnrichSuggestion[] }).items : []
      const rows: AiRow[] = []
      for (const s0 of items) {
        const s = sanitizeRefs(s0, d)
        if (!s.cardId) continue
        const card = cards.find(c => c.id === s.cardId)
        if (!card) continue
        // R162：先归一回既有标签体系，查不到才保留为真新词
        const addTags = canonicalTagsOf(d, (s.tags || []).filter(t => typeof t === 'string' && t.trim())).filter(t => !(card.tags || []).includes(t))
        const fresh = freshTagsOf(addTags, known)
        if (fresh.length) drop.fresh++
        const parts: string[] = []
        if (addTags.length) parts.push(`标签 +${addTags.join('、')}${fresh.length ? `（其中 ${fresh.join('、')} 是体系外新词）`: ''}`)
        if (s.description?.trim() && !card.description) parts.push(`描述：${s.description.trim()}`)
        if (s.categoryId && s.categoryId !== card.categoryId) parts.push(`分类 → ${aiCatPathOf(d, s.categoryId)}`)
        if (!parts.length) { drop.empty++; continue }
        // R147-a：只往体系里塞新词、别无实料的行=默认不勾
        rows.push({ key: s.cardId, pair: card.id, changeType: 'edit', main: `${card.title}`.slice(0, 40) || '（无名卡）', sub: parts.join('\n') + (s.reason ? `\n· ${s.reason}` : ''), weak: fresh.length > 0 && !s.description?.trim() && !s.categoryId, data: { ...s, addTags } })
      }
      return rows
    },
    audit: () => [drop.ghost ? `${drop.ghost} 行 cardId 不在勾选里` : '', drop.fresh ? `${drop.fresh} 张卡被塞了体系外新词（已判弱）` : '', drop.empty ? `${drop.empty} 行没有可落项` : ''].filter(Boolean).join('、') || null,
    apply: (rows) => {
      const dd = gd.value
      let n = 0
      for (const r of rows) {
        const s = r.data as EnrichSuggestion & { addTags?: string[] }
        const card = dd.resources.find(x => x.id === s.cardId && !x.deletedAt)
        if (!card) continue
        if (s.addTags?.length) card.tags = [...new Set([...(card.tags || []), ...canonicalTagsOf(dd, s.addTags)])].slice(0, 10)
        if (s.description?.trim() && !card.description) card.description = s.description.trim()
        if (s.categoryId && dd.categories.some(c => c.id === s.categoryId && !c.deletedAt)) card.categoryId = s.categoryId
        card.updatedAt = Date.now()
        n++
      }
      if (n) store.persist()
      return `已补全 ${n} 张卡`
    },
  }
}

// R158：aiDormantScan（沉睡资源唤醒 job 构造）随入口迁往 GlobalPopups「AI 建议」面板，此处退役。

/** 深度诊断 v1：所选专家逐一会诊（自定义 run 接管多轮调用与进度回显）；发现可勾选采纳=生成跟进任务卡 */
function aiDiagnose() {
  if (!aiGuard()) return
  const d = gd.value
  const ov = personaOverrides()
  const sel = aiPersonas.value.filter(p => aiPersonaSel.value.includes(p.id) && ov[p.id]?.enabled !== false)
  if (!sel.length) { showToast('至少勾选一位专家'); return }
  const digest = projectLibrary(d, aiConfig.value.depth)
  aiOpenJob(withReport({
    key: 'diag',
    title: `深度诊断 · ${sel.length} 位专家会诊`,
    hint: `整库摘要投料 ${digest.length} 字（${aiConfig.value.depth === 'eco' ? '经济' : aiConfig.value.depth === 'deep' ? '深度' : '标准'}档）。勾选发现采纳=各生成一张跟进任务卡（未归属，自行挂链）；不勾即纯参考。`,
    build: () => ({ messages: [{ role: 'user', content: digest }] }),
    parse: () => [],
    apply: (rows) => {
      const dd = gd.value
      let n = 0
      for (const r of rows) {
        const f = r.data as { severity?: string; title?: string; detail?: string; suggestion?: string }
        if (!f.title) continue
        dd.tasks.unshift({
          id: uid('tk'), kind: 'task', title: String(f.title).slice(0, 40), status: 'todo',
          priority: f.severity === 'high' ? 'high' : f.severity === 'low' ? 'low' : 'medium',
          description: ['诊断发现：', f.detail, f.suggestion && `➜ 建议：${f.suggestion}`].filter(Boolean).join('\n').slice(0, 600),
          customFields: {},
          createdAt: Date.now(), updatedAt: Date.now(),
        } as import('@/shared/models').TaskCard)
        n++
      }
      if (n) store.persist()
      return `已生成 ${n} 张诊断跟进任务（在任务面板未归类区，可再挂链）`
    },
    async run({ signal, onDelta }) {
      let progress = ''
      const rows: AiRow[] = []
      for (const p of sel) {
        if (signal.aborted) break
        progress += `${p.icon} ${p.name} 分析中…\n`
        onDelta(progress)
        const text = await chatStream({
          messages: [{ role: 'system', content: diagnosisSystem(p, ov[p.id]?.style || '') }, { role: 'user', content: digest }],
          signal,
          onDelta: t => onDelta(progress + t.slice(-400)),
        })
        const parsed = extractJson<{ findings?: { severity: string; title: string; detail?: string; suggestion?: string }[] }>(text)
        const found = Array.isArray(parsed?.findings) ? parsed.findings : []
        found.forEach((f, i) => rows.push({
          key: `${p.id}:${i}`,
          badge: `${p.icon}${f.severity === 'high' ? '高' : f.severity === 'mid' ? '中' : '低'}`,
          badgeType: f.severity === 'high' ? 'danger' : f.severity === 'mid' ? 'warn' : 'neutral',
          main: f.title,
          sub: [f.detail, f.suggestion && `➜ ${f.suggestion}`].filter(Boolean).join('\n'),
          data: f,
        }))
        progress = progress.replace(`${p.icon} ${p.name} 分析中…\n`, `${p.icon} ${p.name}：${found.length} 条发现\n`)
        onDelta(progress)
      }
      if (!rows.length) throw new Error('各位专家都没有给出可成立的发现（数据太稀疏或模型过于保守，可换深度档重试）')
      return rows
    },
  }, { d, persist: () => store.persist() },
    () => `深度诊断 ${new Date().toLocaleDateString('zh-CN')}`,
    (rows) => rows.map(r => `## ${r.badge || ''} ${r.main}\n${r.sub || ''}`).join('\n\n'),
    ['深度诊断']), '各位专家没有给出可成立的发现')
}
function onTtRowDblClick(row: TtRow) { ttDetail.value = row }
function onTtRowDragStart(e: DragEvent, row: TtRow) { ttCardDragIds = ttPicked.value.has(row.id) ? [...ttPicked.value] : [row.id]; if (!ttPicked.value.has(row.id)) ttTogglePick(row.id); ttCardDragging.value = true; e.dataTransfer?.setData('text/plain', ttCardDragIds.join(',')) }
function onTtRowDragEnd() { ttCardDragIds = null; ttCardDragging.value = false; ttDropTarget.value = '' }
/** R127：替换语义——从当前选中标签移到目标标签（移除源 + 添加目标；三类卡同步） */
function ttMoveCards(targetPath: string) {
  const ids = new Set(ttCardDragIds || [])
  const from = ttActiveTag.value
  if (!ids.size || !from || targetPath === from) return
  let moved = 0
  // R132-T2 ★BUG 修复：移动判据与右列展示判据（cardHasTag 路径+叶子双口径）统一——
  // 原 tags.includes(from) 精确匹配，卡上存裸叶子名而选中态是「父/子」路径（或反之）时
  // 该行被静默 continue，表现为「拖过去 A 不减 B 不增」。
  const fromLeaf = from.split('/').pop() || from
  const apply = (arr?: { id: string; tags?: string[] }[]) => {
    for (const x of arr || []) {
      if (!ids.has(x.id)) continue
      const tags = Array.isArray(x.tags) ? x.tags : []
      const kept = tags.filter(t => t !== from && t !== fromLeaf)
      if (kept.length === tags.length) continue
      x.tags = [...new Set(kept.concat(targetPath))]
      moved++
    }
  }
  apply(store.data!.resources as { id: string; tags?: string[] }[])
  apply(store.data!.tasks as unknown as { id: string; tags?: string[] }[])
  apply(store.data!.curiosities as unknown as { id: string; tags?: string[] }[])
  store.persist()
  ttPicked.value = new Set()
  showToast(moved ? `已移动 ${moved} 张卡片 → #${targetPath}` : '没有可移动的卡片')
}
function openCardLink(r: { linkType?: string; link?: string; assets?: Array<{ id: string; kind: string }> }) {
  if (r.linkType === 'file' && /^zy-asset:\/\//i.test((r.link || '').trim())) {
    const assetId = (r.link || '').trim().replace(/^zy-asset:\/\//i, '')
    const meta = (r.assets || []).find(a => a.id === assetId)
    if (meta && (meta.kind === 'html' || meta.kind === 'pdf')) { openHtmlAsset(meta as never); return }
  }
  const url = toOpenableUrl(r.linkType as never, r.link || '')
  if (url) openExternalLink(url)
  else showToast('该卡片无可打开链接')
}
/** B16：行内重命名 */
function ttRename(id: string) {
  const hit = findTagNode(id)
  if (!hit) return
  ttEditing.value = { id, parentId: null, value: hit.node.name }
}
function ttConfirm() {
  const ed = ttEditing.value
  if (!ed) return
  ttEditing.value = null
  const name = ed.value.trim()
  if (!name) return
  const dup = tagFlat().some(t => t.name === name && t.id !== ed.id)
  if (dup) { showToast('已存在同名标签'); return }
  if (ed.id) {
    // 重命名：级联同步所有卡片
    const hit = findTagNode(ed.id)
    if (!hit) return
    const oldName = hit.node.name
    const parentName = hit.parent?.name
    const oldPath = parentName ? parentName + '/' + oldName : oldName
    const newPath = parentName ? parentName + '/' + name : name
    hit.node.name = name
    const d = store.data!
    // R126：路径感知级联（自身 + 子路径前缀整体替换）
    // R129-B4：同步数直接取本次实际改动的卡数——原先二次调 tagUsage(裸名) 统计，子标签因卡上存的是
    // 「父/新名」路径恒得 0，toast 便谎报「同步 0 张卡片」。
    const swap = (arr?: string[]) => (Array.isArray(arr) ? arr.map(t => {
      if (t === oldPath) return newPath
      if (t.startsWith(oldPath + '/')) return newPath + t.slice(oldPath.length)
      return t
    }) : [])
    let synced = 0
    const applySwap = (card: { tags?: string[] }) => {
      const before = (card.tags || []).join('\u0000')
      card.tags = swap(card.tags)
      if ((card.tags || []).join('\u0000') !== before) synced++
    }
    d.resources.forEach(applySwap)
    d.tasks.forEach(applySwap)
    d.curiosities.forEach(applySwap)
    store.persist()
    showToast(synced ? `已重命名并同步 ${synced} 张卡片` : '已重命名（该标签当前无卡片挂载）')
  } else if (ed.parentId) {
    const parent = findTagNode(ed.parentId)
    if (!parent) return
    parent.node.children = parent.node.children || []
    const nid = uid('tag')
    parent.node.children.push({ id: nid, name })
    store.persist()
    ttCollapsed.value = new Set([...ttCollapsed.value].filter(x => x !== parent.node.id))
    ttFlash(nid)
    showToast(`已在 #${parent.node.name} 下创建 #${name}`)
  } else {
    const nid = uid('tag')
    store.data!.tagTree.push({ id: nid, name })
    store.persist()
    ttFlash(nid)
    showToast(`已创建 #${name}`)
  }
}
function ttCancel() { ttEditing.value = null }
async function ttRemove(id: string) {
  const hit = findTagNode(id)
  if (!hit) return
  const ids = tagSubtreeIds(id)
  const names = tagFlat().filter(t => ids.includes(t.id)).map(t => '#' + t.name)
  const subCount = ids.length - 1
  if (!(await useConfirm({ title: '删除标签', message: `确定删除 ${names.join(' ')} ？${subCount > 0 ? `\n（含 ${subCount} 个子标签）`: ''}\n卡片上的对应标签会一并移除。`, confirmText: '确认删除' }))) return
  // R126（诉求 7）：删除级联——同步移除卡片上的路径标签（含子路径）
  const killPaths = new Set<string>()
  const collectPaths = (node: { name: string; children?: unknown[] }, parentName?: string) => {
    killPaths.add(parentName ? parentName + '/' + node.name : node.name)
    for (const c of (node.children || []) as { name: string; children?: unknown[] }[]) collectPaths(c, parentName ? parentName + '/' + node.name : node.name)
  }
  collectPaths(hit.node as { name: string; children?: unknown[] }, hit.parent?.name)
  hit.list.splice(hit.index, 1)
  const d = store.data!
  const killList = [...killPaths]
  const strip = (arr: string[] | undefined): string[] => (Array.isArray(arr) ? arr.filter(t => !killPaths.has(t) && !killList.some(p => t.startsWith(p + '/'))) : [])
  d.resources.forEach(r => r.tags = strip(r.tags))
  d.tasks.forEach(t => t.tags = strip(t.tags))
  d.curiosities.forEach(c => c.tags = strip(c.tags))
  store.persist()
  showToast(`已删除 ${names.join(' ')}${subCount > 0 ? `（含 ${subCount} 个子标签）`: ''}`)
}
function ttDragStart(e: DragEvent, id: string) { ttDragId = id }
function ttDragEnd() { ttDragId = null; ttDropTarget.value = '' }
/** R126（诉求 7）：拖拽挂载=根→根一级（最多两级）；卡片标签同步重写为「父/子」路径 */
function ttDrop(e: DragEvent, targetId: string) {
  e.preventDefault()
  ttDropTarget.value = ''
  // R127：卡片拖拽（右列 → 左树）优先：移动=替换语义
  if (ttCardDragIds && ttCardDragIds.length) {
    const hit0 = findTagNode(targetId)
    if (hit0) ttMoveCards(hit0.parent ? hit0.parent.name + '/' + hit0.node.name : hit0.node.name)
    ttCardDragIds = null
    return
  }
  if (!ttDragId || ttDragId === targetId) return
  if (tagSubtreeIds(ttDragId).includes(targetId)) { showToast('不能挂载到自己的子标签下'); return }
  if (tagDepth(targetId) >= 1) { showToast('最多两级：只能挂到根标签下'); return }
  const from = findTagNode(ttDragId)
  const to = findTagNode(targetId)
  if (!from || !to) return
  if (from.parent) { showToast('子标签不能再挂载'); return }
  if (safeChildren(from.node).length) { showToast('含子标签的标签不可再挂载（最多两级）'); return }
  const oldPath = from.node.name
  const newPath = to.node.name + '/' + from.node.name
  from.list.splice(from.index, 1)
  to.node.children = to.node.children || []
  to.node.children.push(from.node)
  const d = store.data!
  const swap = (arr?: string[]) => (Array.isArray(arr) ? arr.map(t => (t === oldPath ? newPath : t)) : [])
  d.resources.forEach(r => r.tags = swap(r.tags))
  d.tasks.forEach(t => t.tags = swap(t.tags))
  d.curiosities.forEach(c => c.tags = swap(c.tags))
  store.persist()
  ttDragId = null
  showToast(`「${from.node.name}」已成为「${to.node.name}」的子标签（卡片同步为 #${newPath}）`)
}
/** R126（诉求 7）：子标签提升为根（卡片路径回退为名称） */
function ttUnnest(rootId: string, childId: string) {
  const root = findTagNode(rootId)
  const child = findTagNode(childId)
  if (!root || !child || !root.node.children) return
  const oldPath = root.node.name + '/' + child.node.name
  const newName = child.node.name
  root.node.children = root.node.children.filter(c => c.id !== childId)
  store.data!.tagTree.push(child.node)
  const d = store.data!
  const swap = (arr?: string[]) => (Array.isArray(arr) ? arr.map(t => (t === oldPath ? newName : t)) : [])
  d.resources.forEach(r => r.tags = swap(r.tags))
  d.tasks.forEach(t => t.tags = swap(t.tags))
  d.curiosities.forEach(c => c.tags = swap(c.tags))
  store.persist()
  showToast(`⇪ 「${newName}」已提升为根标签`)
}
/** R126（诉求 7）：从卡片收纳标签——三卡上未入树的标签批量注册为根/子标签 */
function ttCollectFromCards() {
  const d = store.data!
  const roots = new Set((d.tagTree || []).map(n2 => n2.name))
  const childPaths = new Set<string>()
  for (const r0 of d.tagTree || []) for (const c0 of safeChildren(r0)) childPaths.add(r0.name + '/' + c0.name)
  const seen = new Set<string>()
  let added = 0
  const all = [...(d.resources || []), ...(d.tasks || []), ...(d.curiosities || [])]
  for (const card of all) {
    for (const t of card.tags || []) {
      if (!t || seen.has(t)) continue
      seen.add(t)
      if (t.includes('/')) {
        const parts = t.split('/')
        const rn = parts[0], cn = parts.slice(1).join('/')
        if (!rn || !cn || childPaths.has(t)) continue
        let root = (d.tagTree || []).find(x => x.name === rn)
        if (!root) { root = { id: uid('tag'), name: rn }; d.tagTree.push(root); roots.add(rn); added++ }
        root.children = root.children || []
        root.children.push({ id: uid('tag'), name: cn })
        childPaths.add(t); added++
      } else if (!roots.has(t)) {
        d.tagTree.push({ id: uid('tag'), name: t }); roots.add(t); added++
      }
    }
  }
  if (added) { store.persist(); showToast(`⤓ 已收纳 ${added} 个标签到标签树`) } else showToast('没有需要收纳的新标签')
}


// ---- 使用手册（第二十轮：数据外置 manual-data.ts，五篇结构） ----
const activeManualSec = ref('quick-1')




  return {
    onTtRowClick, ttAllChecked, toggleTtAll, ttDragId, ttCardDragIds, aiJob, aiJobKey, aiModels, aiBusy, aiMsg, aiGenre, aiPersonas, aiPersonaSel, aiPersonaSynced, aiNewP, aiAddPersona, aiRemovePersona, aiEditP, aiPersonaCfg, aiPatchPersona, aiCustomPatch, aiOpenJob, aiTray, aiOpenState, aiTrayClear, aiTagGovern, aiReviseBak, aiTagRevise, aiJobClosed, aiCheckReviseBak, aiRestoreRevise, aiTrashRescue, aiWeeklyReview, aiDeliver, aiErr, aiGuard, aiFetchModels, aiTestConn, aiTogglePersona, aiCatVocab, aiTtEnrich, aiEnrichIds, aiDiagnose, onTtRowDblClick, onTtRowDragStart, onTtRowDragEnd, ttMoveCards, openCardLink, ttRename, ttConfirm, ttCancel, ttRemove, ttDragStart, ttDragEnd, ttDrop, ttUnnest, ttCollectFromCards, activeManualSec,
  }
}
