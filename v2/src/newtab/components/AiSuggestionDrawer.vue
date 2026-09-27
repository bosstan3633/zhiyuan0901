<script lang="ts">
/** 契约类型已迁至 shared/ai/job.ts（R135：供 .ts 侧共用）；本块 re-export 保兼容 */
export type { AiRow, AiJob } from '@/shared/ai/job'
</script>

<script setup lang="ts">
/**
 * R134-F1：AI 建议评审抽屉（所有场景共用的消费面）。
 * R154：升级为**对照式评审**——左栏=该入口的当前形态，右栏=AI 补全后的完整形态，
 * 行级一一对应（新增/改写/移动/未变），右栏可就地编辑后再采纳。
 * 性能与数据纪律：建议数据只活在本组件内存态（shallowRef），**不进 store、不落盘**——
 * 用户勾选采纳时由 job.apply 走既有 action + persist；中止/关抽屉即弃。
 * 渲染零原文 HTML 指令：模型回显与用户编辑一律纯文本插值，天然免疫提示词注入的 XSS 面。
 * ★双栏在本组件内部自排，`Drawer.vue` 一字不动（它挂着全站 30+ 抽屉宿主）。
 */
import { computed, onUnmounted, ref, shallowRef, watch } from 'vue'
import Modal from '@/shared/components/Modal.vue'
import AiEntryButton from '@/shared/components/AiEntryButton.vue'
import { showToast } from '@/shared/components/toast'
import { pushUndo } from '@/shared/utils/undo'
import { useAppStore } from '@/newtab/stores/app'
// R167：判决卡版式的"依据"要本地可核事实（成熟度），引的是纯领域 util（无 AI 依赖、无启动面影响）
import { curioMaturity } from '@/shared/utils/maturity'
import type { CuriosityCard } from '@/shared/models'
import { chatStream, extractJson, setLlmFeedSink } from '@/shared/ai/llm'
import { getJobState, openJob, rerunJob, retire, stop as stopJob, type JobState } from '@/shared/ai/runner'
import type { AiJob, AiRow } from '@/shared/ai/job'
import { changeSummary, pairRows, resolveBefore, unpairedBefore } from '@/shared/ai/pair'
import {
  DIRECTIVE_CAP, directiveSlot, loadDirectives, markRunAdopted, promoteToPersona,
  setDirective, setTier, tierOf, withDirective, type DirTier,
} from '@/shared/ai/directive'

/**
 * R148-T / R149：两种绑法并存，且**默认即后台化**。
 *  · 绑法定位：`jobKey` 显式传入 > `job.key`（各场景工厂本就带的功能身份）> 空串=一次性模式。
 *    R148 曾要求宿主逐个传 `job-key`，实测漏绑就退回"关抽屉=杀任务"——改在这里收口，
 *    13 个宿主一次全接上，工厂加场景也不必再记着接线。
 *  · 有 key = 任务搬到 runner 里后台跑，**关抽屉不杀任务**；同 key 再点：在跑就 attach 看进度，
 *    跑完就看结果 +「↻ 重新运行」。
 */
const props = defineProps<{ job: AiJob | null; jobKey?: string }>()
const store = useAppStore()
const emit = defineEmits<{ close: [] }>()

type Phase = 'running' | 'done' | 'error' | 'stopped' | 'idle'
const phase = ref<Phase>('idle')
const errMsg = ref('')
const streamText = ref('')
const rows = shallowRef<AiRow[]>([])
const picked = ref<Set<string>>(new Set())
const showRaw = ref(false)
let ctrl: AbortController | null = null
let jobSeq = 0

/** R154：右栏就地编辑的草稿（只活内存，关抽屉即弃；采纳前合进行再喂 apply） */
const drafts = ref(new Map<string, { main?: string; sub?: string }>())
const savedDrafts = ref(new Map<string, { main?: string; sub?: string }>())
const editing = ref<string | null>(null)
const onlyDiff = ref(false)
/** R154：整树替换类的第一下只弹确认，第二下才写库 */
const confirmText = ref('')
/** R154：指令框本地态（失焦或点重跑才落库，免得每敲一个字进一次历史） */
const dirText = ref('')
const dirTier = ref<DirTier>('object')
const dirPast = ref<{ text: string; at: number }[]>([])
const dirOpen = ref(false)

/** 本次生效的任务身份（空串 = 不进 runner，沿用一次性语义） */
const keyOf = computed(() => props.jobKey || props.job?.key || '')
const open = computed(() => !!props.job || (!!keyOf.value && !!bound.value))
/** R147-b：投料与耗时——投料由 llm 层在线路处回调累计（自定义 run 也算得着），耗时抽屉自己掐表 */
const feed = ref({ chars: 0, calls: 0, pt: 0, ct: 0 })
const savedNote = ref('')
const secs = ref(0)
let tick: ReturnType<typeof setInterval> | null = null
function stopTick() { if (tick) { clearInterval(tick); tick = null } }

/** 后台模式下的任务状态（响应式：runner 每次 patch 都换新 Map） */
const bound = computed<JobState | null>(() => (keyOf.value ? getJobState(keyOf.value) || null : null))
/** 契约对象：后台模式一律用**正在跑的那份 job**，避免"显示的是新锚点、结果却是旧锚点" */
const cur = computed<AiJob | null>(() => (bound.value ? bound.value.job : props.job))
const vPhase = computed<Phase>(() => (bound.value ? (bound.value.phase === 'queued' ? 'running' : bound.value.phase) : phase.value))
const vRows = computed<AiRow[]>(() => (bound.value ? bound.value.rows : rows.value))
const vRaw = computed(() => (bound.value ? bound.value.raw : streamText.value))
function copyRaw() { navigator.clipboard?.writeText(vRaw.value).then(() => showToast('✓ 模型原文已复制'), () => showToast('⚠ 复制失败（浏览器拦了剪贴板）')) }
const vErr = computed(() => (bound.value ? bound.value.err : errMsg.value))
const vFeed = computed(() => (bound.value ? bound.value.feed : feed.value))
const vSecs = computed(() => (bound.value ? bound.value.secs : secs.value))
const vSaved = computed(() => (bound.value ? bound.value.savedNote : savedNote.value))
const queued = computed(() => !!bound.value && bound.value.phase === 'queued')

/* ===== R154 对照层：配对与草稿只活在这一层，runner 与工厂都不知道有人改过字 ===== */
const pane = computed(() => resolveBefore(cur.value?.before))
/** 左栏没内容 = 这个入口还没接地基 → 退回旧单栏，不出现空栏 */
const dual = computed(() => pane.value.length > 0)
const shown = computed<AiRow[]>(() => {
  const base = vRows.value.map(r => ({ ...r }))
  if (dual.value) pairRows(pane.value, base)
  return base.map(r => {
    const d = drafts.value.get(r.key)
    return d && r.edit?.toRow ? r.edit.toRow(r, d) : r
  })
})
const summary = computed(() => changeSummary(shown.value))
const dropped = computed(() => (dual.value && cur.value?.paneMode !== 'context' ? unpairedBefore(pane.value, shown.value).length : 0))
/** R149（用户拍板）：apply 缺省 = 只读报告型——产出跑完自动落一张卡，抽屉不出「采纳」按钮，
 *  勾选框与「全选」一并撤掉（没有要采纳的东西还让人勾，是假动作）。 */
const hasAdopt = computed(() => !!cur.value?.apply && (cur.value?.adoptable ?? true))
const picksSomething = computed(() => hasAdopt.value || !!cur.value?.secondary)
/** 可采纳行：参谋行与"未变"行都不算（没变的东西给人勾是假动作） */
const adoptableN = computed(() => shown.value.filter(r => !r.advisory && r.changeType !== 'same').length)
const pickedRows = computed(() => shown.value.filter(r => picked.value.has(r.key) && !r.advisory))
const canApply = computed(() => hasAdopt.value && picked.value.size > 0)
/** R141：参谋推荐——verdict 行带 recommend=detail 时，「写入详情」升为主按钮（AI 告诉你该按哪个） */
const recDetail = computed(() => shown.value.some(r => (r.data as { recommend?: string } | undefined)?.recommend === 'detail'))
/** R147-a：判弱的行默认不勾，但仍在列表里可见可勾（判定权在人） */
const weakN = computed(() => shown.value.filter(r => r.weak && !r.advisory).length)
/** R167：optIn 行＝建议覆盖用户已填的字段，默认不勾（理由与"不可信"不同，所以另记一笔账） */
const optInN = computed(() => shown.value.filter(r => r.optIn && !r.advisory).length)
/** R147-c：消毒账（工厂闭包自己攒的丢弃计数），空态与工具条共用 */
const auditLine = ref('')
const impactLine = computed(() => cur.value?.impact?.(pickedRows.value) || '')
/** R154（拍板③）：报告型编辑过才点亮「存为卡」 */
const dirty = computed(() => [...drafts.value.entries()].some(([k, v]) => JSON.stringify(savedDrafts.value.get(k)) !== JSON.stringify(v)))
const canResave = computed(() => !!cur.value?.resave && dirty.value)
/* R166 定案 8：job 自己声明了主采纳文案就用它（拆解=「✓ 采纳为子任务」）——
   按钮该说出"点了会改什么"；没声明才回落通用的「采纳（直接写库）」。计数后缀两种都保留。 */
const adoptLabel = computed(() => {
  if (isVerdict.value) return VERDICT_LABEL[verdictPick.value] || '✓ 采纳判决'
  const base = cur.value?.adoptLabel || (confirmText.value ? '✓ 确认写库' : '✓ 采纳（直接写库）')
  return `${base}（${picked.value.size}）`
})
const hotPair = ref('')

/**
 * R167：左右分栏可拖（22%~70%），点分隔条复位 40%。
 * ★ 拖拽期只锁 user-select，不给弹窗加 `pointer-events:none`——那样分隔条自己的 click 会落到 body 上（原型实测：点复位没反应）。
 */
const split = ref(40)
const dragging = ref(false)
function startDrag(e: MouseEvent): void {
  const host = (e.target as HTMLElement).closest('.ai-dual') as HTMLElement | null
  if (!host) return
  dragging.value = true
  const rect = host.getBoundingClientRect()
  const move = (ev: MouseEvent) => { split.value = Math.min(70, Math.max(22, ((ev.clientX - rect.left) / rect.width) * 100)) }
  const up = () => {
    dragging.value = false
    document.removeEventListener('mousemove', move)
    document.removeEventListener('mouseup', up)
  }
  document.addEventListener('mousemove', move)
  document.addEventListener('mouseup', up)
  e.preventDefault()
}
/** 跑完后步骤不再单独占一行：折进「采纳前须知」的次行（跑动中仍显示在头部） */
const stepsLine = computed(() => (vPhase.value === 'done' && cur.value?.steps?.length
  ? cur.value.steps.map(s => '✓ ' + s.label).join(' · ') : ''))
/** R167：单条研判走「判决卡」版式（一条建议摊成左右对照会空半屏） */
const isVerdict = computed(() => cur.value?.layout === 'verdict' && vPhase.value === 'done' && shown.value.length > 0)
const curioMaturityOf = curioMaturity
const verdictRow = computed(() => shown.value[0])
/** R167：判决卡——三态恒定列出（模型只给推荐），选中的那一条才是采纳时写回的数据 */
const VERDICTS = [
  { v: 'convert', label: '→ 转成任务', hint: '建 1 张任务卡 · 本条从池中离场（回收站可撤）· 已转化 +1' },
  { v: 'keep', label: '继续养着', hint: '什么都不改（判词可另存进正文）' },
  { v: 'drop', label: '置为搁置', hint: '状态改「已搁置」，不删卡、随时可改回' },
] as const
const verdictModelPick = computed(() => (verdictRow.value?.data as { __verdict?: string } | undefined)?.__verdict || '')
/** 判词只在"用户选的就是模型那条判决"时才是模型说的话——换了选项还显示原判词，等于替模型编新理由 */
const verdictWhy = computed(() => {
  const d = verdictRow.value?.data as { __verdict?: string; __why?: string } | undefined
  if (!d) return ''
  return d.__verdict === verdictPick.value ? (d.__why || '（模型没给判词）') : '（这条是你自己选的，模型原判是「' + (VERDICTS.find(x => x.v === d.__verdict)?.label || d.__verdict) + '」）'
})
const verdictTitle0 = computed(() => (verdictRow.value?.data as { __title?: string } | undefined)?.__title || '')
const verdictPick = ref('')
/** R167：判决卡——采纳钮必须说出"点下去会发生什么"（转=建卡+本条离场，搁置=只改状态，养=什么都不写） */
const VERDICT_LABEL: Record<string, string> = {
  convert: '✓ 转成任务（本条从池中离场）', keep: '✓ 继续养着（什么都不改）', drop: '✓ 置为已搁置（不删卡）',
}
const verdictTitle = ref('')
/** 依据一律本地数出来的（模型只给判词），否则"依据"就成了第二份可编造的话 */
const verdictFacts = computed(() => {
  const c = (verdictRow.value?.data as { __card?: CuriosityCard } | undefined)?.__card
  if (!c) return []
  const m = curioMaturityOf(c)
  const days = Math.max(0, Math.round((Date.now() - (c.createdAt || Date.now())) / 86400000))
  return [
    `成熟度 ${m.grade} · 就绪 ${m.score}`,
    `捕获至今 ${days} 天，打开 ${c.callCount || 0} 次`,
    c.sourceUrl ? '带来源链接（转任务时随卡带走）' : '无来源链接',
    c.tags?.length ? `已打 ${c.tags.length} 个标签` : '未打标签',
  ]
})
watch(shown, (v) => { if (v.length && !verdictPick.value) verdictPick.value = (v[0].data as { __verdict?: string }).__verdict || '' })
watch(verdictTitle0, (v) => { if (v && !verdictTitle.value) verdictTitle.value = v }, { immediate: true })

function defaultPicks(out: AiRow[]): Set<string> {
  return new Set(out.filter(r => !r.advisory && !r.weak && !r.optIn && r.changeType !== 'same').map(r => r.key))
}
function showState(s: JobState): void {
  const base = s.rows.map(r => ({ ...r }))
  if (dual.value) pairRows(pane.value, base)
  picked.value = defaultPicks(base)
  auditLine.value = s.job.audit?.() || ''
}

async function run(job: AiJob) {
  const seq = ++jobSeq
  phase.value = 'running'; errMsg.value = ''; streamText.value = ''; rows.value = []; picked.value = new Set(); showRaw.value = false
  drafts.value = new Map(); savedDrafts.value = new Map(); editing.value = null; confirmText.value = ''
  feed.value = { chars: 0, calls: 0, pt: 0, ct: 0 }; secs.value = 0; auditLine.value = ''; savedNote.value = ''
  stopTick(); tick = setInterval(() => { if (seq === jobSeq) secs.value++ }, 1000)
  setLlmFeedSink((m) => {
    if (seq !== jobSeq) return
    const f = feed.value
    f.chars += m.inChars; f.calls++; f.pt += m.promptTokens || 0; f.ct += m.completionTokens || 0
  })
  ctrl?.abort()
  ctrl = new AbortController()
  const onDelta = (t: string) => { if (seq === jobSeq) streamText.value = t }
  try {
    let out: AiRow[]
    if (job.run) {
      out = await job.run({ signal: ctrl.signal, onDelta })
    } else {
      const { messages, jsonMode } = await job.build()
      const text = await chatStream({ messages, jsonMode: job.rawText ? false : jsonMode !== false, signal: ctrl.signal, onDelta })
      if (!text.trim()) throw new Error('模型返回为空（可能超时或余额不足）')
      out = job.parse(job.rawText ? text : extractJson(text))
    }
    if (seq !== jobSeq) return
    rows.value = out
    const base = out.map(r => ({ ...r }))
    if (dual.value) pairRows(pane.value, base)
    picked.value = defaultPicks(base)
    auditLine.value = job.audit?.() || ''
    // R149：报告型走后台 runner 才结算落卡；宿主漏绑 jobKey 时这里补落一次，
    // 否则"撤掉采纳按钮"会让用户既拿不到卡也没有回执——比旧版更糟。
    if (job.autoReport && !keyOf.value) {
      const p = job.autoReport.build(out)
      if (p) savedNote.value = job.autoReport.save(p)
    }
    phase.value = 'done'
  } catch (e) {
    if (seq !== jobSeq) return
    const msg = (e as Error).message || String(e)
    if ((e as Error).name === 'AbortError') { emit('close'); return }
    errMsg.value = msg
    phase.value = 'error'
  } finally {
    if (seq === jobSeq) stopTick()
    setLlmFeedSink(null)
  }
}

watch(() => [props.job, keyOf.value] as const, ([j, k]) => {
  // R154：指令在**这里**单点接上（withDirective 幂等）——14 个宿主与 23 个工厂一行都不用改
  if (!k) { if (j) run(withDirective(j)); return }
  const st = getJobState(k)
  if (!st) { if (j) openJob(k, j.title, () => withDirective(j)); return }
  // 换专家执笔 = 用户点名要换一个视角重来，attach 旧结果等于没听见他选了什么（R141 persona 通道）
  if (j && st.job.persona && j.persona && j.persona.current !== st.job.persona.current) rerunJob(k, () => withDirective(j))
}, { immediate: true })
/** 后台任务状态一落地就把勾选态铺好（attach 时不能是空选） */
watch(bound, (s) => { if (s && s.phase === 'done') showState(s) })
/** R154：换 job 时把指令框对齐到新作用域（先读盘，否则历史是空的） */
watch(cur, async (j) => { await syncDir(j) }, { immediate: true })
async function syncDir(j: AiJob | null): Promise<void> {
  if (!j?.promptScope) { dirText.value = ''; dirPast.value = []; return }
  await loadDirectives()
  dirTier.value = tierOf(j.promptScope)
  const slot = directiveSlot(j)
  dirText.value = slot?.text || ''
  dirPast.value = (slot?.past || []).map(p => ({ text: p.text, at: p.at }))
}

function rerun(): void {
  const k = keyOf.value
  if (!k) return
  const j = props.job
  const s = rerunJob(k, j ? () => j : undefined)
  if (s) showState(s)
}
function stopAll(): void {
  if (keyOf.value) { stopJob(keyOf.value); return }
  stop()
}

function toggle(key: string) {
  const next = new Set(picked.value)
  if (next.has(key)) next.delete(key); else next.add(key)
  picked.value = next
}
function toggleAll() {
  const adoptableRows = shown.value.filter(r => !r.advisory && r.changeType !== 'same')
  picked.value = picked.value.size === adoptableRows.length ? new Set() : new Set(adoptableRows.map(r => r.key))
}
function pickStrongOnly() {
  picked.value = defaultPicks(shown.value.filter(r => !r.weak))
}
/** 这一行能不能改：工厂没给 toRow 就不给编辑——宁可不能改，也不能"看着改了、写库还是原值" */
function canEdit(r: AiRow): boolean { return !!(r.edit?.main && r.edit.toRow) }
function startEdit(r: AiRow): void { if (canEdit(r)) editing.value = r.key }
function commitEdit(r: AiRow, text: string): void {
  editing.value = null
  const next = text.trim()
  const origin = drafts.value.get(r.key)?.main ?? r.main
  if (next === origin) return
  const d = new Map(drafts.value)
  if (next) d.set(r.key, { main: next }); else d.delete(r.key)
  drafts.value = d
  // 编辑即视为"这条我要"——改完不勾等于把刚写的字丢掉
  if (next && !picked.value.has(r.key)) { const p = new Set(picked.value); p.add(r.key); picked.value = p }
}
function hover(r: AiRow): void { hotPair.value = r.pair || '' }
function unhover(): void { hotPair.value = '' }

/** 采纳完 = 这轮结束：后台任务从列表里收掉，避免"旧结果挂着" */
function finishAfterApply(): void {
  if (keyOf.value) retire(keyOf.value)
  emit('close')
}
async function adopt() {
  const job = cur.value
  if (!job?.apply) return
  // R167：判决卡——三态由**用户点选**（模型的判决只是推荐），采纳时把所选态写回行的 data 再交给 apply。
  // 不做这一步就等于"模型判什么就是什么"，正违反 AI 不替决策。
  const sel = isVerdict.value && verdictRow.value
    ? [{ ...verdictRow.value, data: { ...(verdictRow.value.data as object), __verdict: verdictPick.value, __title: verdictTitle.value } }]
    : pickedRows.value
  if (!sel.length) return
  // R154：整树替换类先弹确认，第二下才真写库
  const cf = job.confirm?.(sel)
  if (cf && !confirmText.value) { confirmText.value = cf; return }
  confirmText.value = ''
  // R159（T2）：AI 采纳是直接写库（风险最高）——采纳前压整库快照，Ctrl/Cmd+Z 可整笔回退
  const snap = JSON.stringify(store.data)
  try {
    const summary = await job.apply(sel)
    pushUndo(`AI 采纳（${sel.length} 项）`, () => { store.data = JSON.parse(snap); store.persist() })
    showToast(typeof summary === 'string' ? summary : '✓ 已采纳', { label: '撤销', cb: () => { store.data = JSON.parse(snap); store.persist() } })
    if (job.promptScope) markRunAdopted(job)
    finishAfterApply()
  } catch (e) { showToast('⚠ 采纳失败：' + (e as Error).message) }
}
function stop() { ctrl?.abort(); ctrl = null }
function close() {
  // 后台模式：关抽屉只是收起视图，任务继续跑（R148 用户点名）
  if (keyOf.value) { emit('close'); return }
  stopTick(); setLlmFeedSink(null); ctrl?.abort(); emit('close')
}
async function adoptSecondary() {
  const job = cur.value
  if (!job?.secondary) return
  const sel = pickedRows.value
  if (!sel.length) return
  try {
    const summary = await job.secondary.apply(sel)
    showToast(typeof summary === 'string' ? summary : '✓ 已处理')
    finishAfterApply()
  } catch (e) { showToast('⚠ 处理失败：' + (e as Error).message) }
}
/** R154（拍板③）：报告型「存为卡」——用编辑后的正文刷新**同一张**卡，不新增第二张 */
async function saveAgain() {
  const job = cur.value
  if (!job?.resave) return
  try {
    const s = await job.resave(shown.value)
    showToast(typeof s === 'string' ? s : '✓ 已存为卡')
    savedDrafts.value = new Map(drafts.value)
  } catch (e) { showToast('⚠ 存卡失败：' + (e as Error).message) }
}

/* ===== R154 指令框 ===== */
const dirCap = computed(() => Math.max(0, DIRECTIVE_CAP - dirText.value.trim().length))
function commitDir(): void {
  const j = cur.value
  if (!j?.promptScope) return
  setDirective(j.promptScope, dirText.value, dirTier.value === 'object' ? j.promptObject : undefined)
  void syncDir(j)
}
async function switchTier(t: DirTier): Promise<void> {
  const j = cur.value
  if (!j?.promptScope) return
  commitDir()
  setTier(j.promptScope, t)
  dirTier.value = t
  await syncDir(j)
}
function applyDirAndRerun(): void {
  commitDir()
  const j = cur.value
  if (!j) return
  if (keyOf.value) { rerun(); return }
  void run(j)
}
async function promote(): Promise<void> {
  const t = dirText.value.trim()
  if (!t) { showToast('指令是空的，没什么可存'); return }
  commitDir()
  try {
    const id = await promoteToPersona(t, '')
    showToast(`✓ 已存为自建专家「${t.slice(0, 12)}」· 设置 › AI 助手 › 角色库可改名与停用（${id}）`)
  } catch (e) { showToast('⚠ ' + (e as Error).message) }
}
function pickDir(text: string): void { dirText.value = text; dirOpen.value = false }
/** R166 D9：弹窗内不建第二套专家编辑器——只跳 设置 → AI 助手（hash 走 router 同款口径，不引新依赖） */
function gotoPersonaAdmin(): void { window.location.hash = '#/settings?page=ai' }

/* ===== R161 任务 6：弹窗内键盘 —— Cmd/Ctrl+Enter = 采纳选中 =====
 * Esc 由 `Modal.vue` 提供（捕获阶段 + stopPropagation），此处**不重复实现**，免得一次 Esc 关两层。
 * 本监听同样走捕获阶段并 stopPropagation：弹窗压着 TaskAddDrawer 之类的宿主时，
 * 宿主的 Ctrl+Enter（新建任务）不该被隔着弹窗点着。 */
function onDocKey(e: KeyboardEvent) {
  if (e.key !== 'Enter' || !(e.ctrlKey || e.metaKey)) return
  if (!canApply.value) return
  e.preventDefault(); e.stopPropagation()
  void adopt()
}
// ★ `immediate: true` 不可省（R161 实测）：宿主写法是 `<AiSuggestionDrawer v-if="aiJob" …>`，
//   而本组件的 `open = computed(() => !!props.job)` —— 出生那一刻 open 已是 true，watch 等不到
//   变化 ⇒ Cmd/Ctrl+Enter 的 document 监听从不注册（与 Modal.vue 的 Esc 同一个坑，两处一并修）。
watch(open, (v) => {
  if (v) document.addEventListener('keydown', onDocKey, true)
  else document.removeEventListener('keydown', onDocKey, true)
}, { immediate: true })

onUnmounted(() => { document.removeEventListener('keydown', onDocKey, true); jobSeq++; stopTick(); if (!keyOf.value) { setLlmFeedSink(null); ctrl?.abort() } })
</script>

<template>
  <!-- R167：对照弹窗定高（左右两栏各自滚，上半部不再吃掉一半屏）；非对照的窄弹窗照旧按内容高 -->
  <Modal :open="open" :title="cur?.title || 'AI 建议'" class="ai-modal"
    :width="dual ? 'min(1200px, 92vw)' : '620px'" :height="dual ? 'min(760px, 88vh)' : ''" @close="close">
    <!-- ① 头部：AI 徽标 + 场景名（徽标走 R155 的统一入口容器，尺寸只有 --icon-* 一个来源） -->
    <template #title>
      <AiEntryButton variant="inline" large :spin="vPhase === 'running'" :label="cur?.title || 'AI 建议'" />
      <span v-if="cur?.subject" class="ai-subject">{{ cur.subject }}</span>
      <span v-if="vPhase === 'running' && cur?.steps?.length" class="ai-steps">
        <span v-for="(s, i) in cur.steps" :key="i" class="ai-step" :class="s.state">{{ s.label }}</span>
      </span>
    </template>
    <!-- R141（反馈 #2/#3）：专家下拉上移弹窗头部（跑的过程中也可见可换）；subject 标明正在处理哪张卡 -->
    <template v-if="cur?.persona" #title-extra>
      <!-- R166 D9：弹窗内**不建第二套专家编辑器**——只给跳转。自建角色的启停/编辑恒在 设置→AI 助手 -->
      <select class="ai-persona" :value="cur.persona.current" title="换一个专家视角重新生成"
        @change="cur.persona!.onPick(($event.target as HTMLSelectElement).value)">
        <option v-for="o in cur.persona.options" :key="o.id" :value="o.id">{{ o.label }}</option>
      </select>
      <button class="ai-btn sm ai-persona-manage" title="到 设置 → AI 助手 管理专家（启停与自建角色都只在那一处）"
        @click="gotoPersonaAdmin">⚙ 管理专家</button>
    </template>
    <!-- ② 固定行：一次性指令（R167 压成三列一条：标签列 | 输入框 | 动作列）。
         角色=谁来写（可复用）、指令=这次要什么（优先级高于角色，但改不了输出结构）。
         ★ 不做"聚焦即长高"——整条带子会跳一下，右侧按钮会跑到鼠标底下（原型实测踩过）；要更大空间往下拖。 -->
    <template v-if="cur?.promptScope" #sub>
      <div class="ai-dir">
        <div class="ai-dir-l">
          <b>🎯 本次指令</b>
          <span class="ai-dir-tiers">
            <button v-if="cur.promptObject" class="tier" :class="{ on: dirTier === 'object' }"
              :title="'这条只跟' + (cur.promptObjectLabel || '这个对象') + '走'"
              @click="switchTier('object')">这张卡</button>
            <button class="tier" :class="{ on: dirTier === 'entry' }" :disabled="!cur.promptObject"
              :title="cur.promptObject ? '升档后本入口下所有对象共用这条指令（含以后新建的）' : '本入口没有更细的对象作用域'"
              @click="switchTier('entry')">这类入口</button>
          </span>
        </div>
        <div class="ai-dir-m">
          <textarea v-model="dirText" class="ai-dir-ta" rows="2"
            placeholder="例：描述别写口号，只写这周能拿去报价的素材。指令只能改口径，改不了输出结构（那是场景骨架）。"
            @blur="commitDir" />
          <div class="ai-dir-cap">剩 {{ dirCap }} 字 · {{ dirTier === 'object' && cur.promptObject ? '只记在这张卡上' : '本入口共用' }} · 关窗即清，要长期复用请「存为角色」</div>
        </div>
        <div class="ai-dir-btns">
          <span v-if="dirPast.length" class="ai-hist">
            <button class="ai-btn sm" @click.stop="dirOpen = !dirOpen">历史 ▾</button>
            <span v-if="dirOpen" class="ai-hist-menu">
              <button v-for="(h, i) in dirPast" :key="i" class="ai-hist-item" @click="pickDir(h.text)">
                <span class="ai-hist-t">{{ h.text }}</span>
                <span class="ai-hist-m">{{ new Date(h.at).toLocaleDateString('zh-CN') }} · {{ h.text.length }} 字</span>
              </button>
            </span>
          </span>
          <button class="ai-btn sm" title="把这条口径存成可复用角色，之后任何入口的角色下拉都能选它" @click="promote">↗ 存为角色</button>
          <button class="ai-btn sm" title="带上这条指令重新生成" @click="applyDirAndRerun">应用并重跑 ↻</button>
        </div>
      </div>
    </template>
    <div class="ai-body">
      <div v-if="cur?.hint" class="ai-hint">{{ cur.hint }}</div>

      <div class="ai-dual" :class="{ single: !dual }" :style="{ '--split': split + '%' }">
        <!-- 左栏：当前形态（只读；跑的时候正好读它） -->
        <div v-if="dual" class="ai-col ai-col-l">
          <div class="ai-col-head">
            <b>当前形态</b><span class="ai-col-sub">采纳后即刷新</span>
            <span class="ai-col-end">{{ pane.length }} 行</span>
          </div>
          <div class="ai-col-body">
            <div v-for="b in pane" :key="b.key" class="ai-prow" :class="{ deep: b.depth === 1, hot: hotPair === b.key }"
              @mouseenter="hotPair = b.key" @mouseleave="hotPair = ''">
              <span v-if="b.label" class="ai-pk">{{ b.label }}</span>
              <span class="ai-pv">
                <span v-if="b.main">{{ b.main }}</span><span v-else class="ai-pempty">（空）</span>
                <span v-if="b.sub" class="ai-psub">{{ b.sub }}</span>
              </span>
              <span v-if="b.badge" class="ai-badge" :class="'b-' + (b.badgeType || 'neutral')">{{ b.badge }}</span>
            </div>
          </div>
        </div>
        <!-- R167：可拖分栏（22%~70%，点把手复位）。★ 拖拽期只禁 user-select，
             绝不能给弹窗加 pointer-events:none —— 那会让分隔条自身的点击落到 body（原型实测踩过） -->
        <div v-if="dual" class="ai-drag" :class="{ act: dragging }" title="拖动调宽 · 点一下复位"
          @mousedown="startDrag"><i></i></div>
        <!-- 右栏：AI 补全后完整形态 -->
        <div class="ai-col ai-col-r">
          <div class="ai-col-head">
            <b>AI 补全后完整形态</b>
          </div>

          <div v-if="vPhase === 'running'" class="ai-status">
            <div class="ai-run-row">
              <span class="ai-dot-pulse"></span>
              <template v-if="queued">排队中（同时最多 2 个 AI 任务，前面的跑完自动开始）</template>
              <template v-else>专家思考/生成中… 已 {{ vSecs }}s<span v-if="vFeed.calls"> · 已发 {{ vFeed.calls }} 次请求 / 投料 {{ vFeed.chars }} 字</span></template>
              <button class="ai-btn sm" @click="stopAll">⏹ 停止</button>
            </div>
            <pre v-if="vRaw" class="ai-stream">{{ vRaw.slice(-600) }}</pre>
          </div>

          <div v-else-if="vPhase === 'error'" class="ai-status ai-err">
            ⚠ {{ vErr }}
            <span v-if="vFeed.chars" class="ai-err-feed">（本次已投料 {{ vFeed.chars }} 字 / {{ vSecs }}s）</span>
            <button class="ai-btn sm" @click="keyOf ? rerun() : cur && run(cur)">↻ 重试</button>
          </div>

          <!-- R149：⏹ 停止留下一条"作废"记录并给重跑出口（旧版把任务抹没，抽屉只剩空白） -->
          <div v-else-if="vPhase === 'stopped'" class="ai-status ai-stopped">
            ⏹ 已停止，本轮结果作废（未写入任何数据）
            <span v-if="vFeed.chars || vSecs" class="ai-err-feed">（本次已投料 {{ vFeed.chars }} 字 / {{ vSecs }}s）</span>
            <button class="ai-btn sm" @click="keyOf ? rerun() : cur && run(cur)">↻ 重新运行</button>
          </div>

          <template v-else-if="vPhase === 'done'">
            <div v-if="vSaved" class="ai-saved">📥 {{ vSaved }}</div>
            <div v-if="!shown.length" class="ai-empty">
              {{ hasAdopt || cur?.secondary ? '模型没有给出可采纳的建议' : '模型没有给出可存的正文' }}<span v-if="auditLine">——{{ auditLine }}</span>。
              <div class="ai-empty-hint">换专家执笔、把卡片描述补一句，或换个更具体的关键词再问一次。</div>
              <!-- R153：空态要能自证——"模型到底答了什么"直接摊开，判"没答"还是"答了被消毒丢掉"不必再猜 -->
              <button v-if="vRaw.trim()" class="ai-btn sm ghost ai-rawbtn" @click="showRaw = !showRaw">{{ showRaw ? '收起模型原文' : '看模型原文（' + vRaw.length + ' 字）' }}</button>
              <pre v-if="showRaw && vRaw.trim()" class="ai-stream">{{ vRaw.length > 6000 ? vRaw.slice(0, 6000) + '\n…（截到 6000 字，完整原文请用下方复制）' : vRaw }}</pre>
              <button v-if="showRaw && vRaw.trim()" class="ai-btn sm ghost" @click="copyRaw">复制原文</button>
            </div>
            <!-- R167：单条研判走「判决卡」——三态由用户点选（模型只给推荐），
                 判词与本地依据分列，采纳钮写明点下去会发生什么 -->
            <template v-else-if="isVerdict">
              <div class="ai-vd">
                <div class="ai-vd-q">{{ verdictRow?.main }}</div>
                <div class="ai-vd-3">
                  <button v-for="o in VERDICTS" :key="o.v" type="button" class="ai-vd-opt"
                    :class="{ on: verdictPick === o.v, rec: verdictModelPick === o.v }" @click="verdictPick = o.v">
                    <b>{{ o.label }}</b><small>{{ o.hint }}</small>
                    <em v-if="verdictModelPick === o.v">模型推荐</em>
                  </button>
                </div>
                <template v-if="verdictPick === 'convert'">
                  <div class="ai-vd-lb">建议任务标题（可改，采纳即按这个建卡）</div>
                  <textarea v-model="verdictTitle" rows="2" class="ai-vd-tt" />
                </template>
                <div class="ai-vd-why"><b>判词</b>｜{{ verdictWhy }}</div>
                <div class="ai-vd-facts">
                  <b>本地依据（数出来的，不是模型报的）</b>
                  <ul><li v-for="f in verdictFacts" :key="f">{{ f }}</li></ul>
                </div>
                <div v-if="auditLine" class="ai-vd-audit">消毒：{{ auditLine }}</div>
              </div>
            </template>
            <template v-else>
              <div class="ai-toolbar">
                <label v-if="picksSomething" class="ai-all"><input type="checkbox" :checked="picked.size === adoptableN && adoptableN > 0" @change="toggleAll" /> 全选</label>
                <button v-if="weakN && picksSomething" class="ai-btn sm ghost" @click="pickStrongOnly">只留高置信</button>
                <span v-if="picksSomething" class="ai-count">已选 {{ picked.size }}/{{ adoptableN }}</span>
                <span v-else class="ai-count">整篇成文，跑完自动落卡</span>
              </div>
              <!-- R167：采纳前须知合成一条（影响面 + 弱相关/覆盖账 + 消毒 + 跑完的步骤），
                   原先是"黄条 impact + 橙字 flags + 灰字消毒"三堆并排，读起来像三段报错 -->
              <div v-if="impactLine || weakN || optInN || auditLine || stepsLine" class="ai-note">
                <span class="ai-note-dot"></span>
                <span class="ai-note-tx">
                  <b>{{ impactLine || '采纳前须知' }}</b>
                  <span v-if="weakN || optInN || auditLine || stepsLine" class="ai-note-sub">
                    {{ [stepsLine, weakN && picksSomething ? `${weakN} 条判为弱相关已默认不勾` : '', optInN && picksSomething ? `${optInN} 条要覆盖你已写的内容、同样默认不勾` : '', auditLine ? `消毒：${auditLine}` : ''].filter(Boolean).join(' · ') }}
                  </span>
                </span>
              </div>
              <pre v-if="showRaw" class="ai-stream">{{ vRaw }}</pre>
              <!-- R167：建议行改"卡片解剖"——左 3px 色条=变更类型；首行=字段名 + 右端置信/变更；
                   次行=建议正文；判词用 hairline 隔开单独成行；未变行不给勾选框（原先挂着一个点不动的空框） -->
              <div class="ai-rows">
                <label v-for="r in shown" :key="r.key" class="ai-card"
                  :class="{ on: picksSomething && !r.advisory && picked.has(r.key), advisory: r.advisory || !picksSomething, weak: picksSomething && r.weak, same: r.changeType === 'same', edited: drafts.has(r.key), dim: onlyDiff && r.changeType === 'same', hot: hotPair === r.key, ['ct-' + (r.changeType || 'new')]: true }"
                  @mouseenter="hover(r)" @mouseleave="unhover">
                  <input v-if="!r.advisory && picksSomething && r.changeType !== 'same'" type="checkbox" :checked="picked.has(r.key)" @change="toggle(r.key)" />
                  <span v-else-if="r.advisory" class="ai-adv-mark" title="参谋建议（只读）">🧭</span>
                  <span v-else class="ai-cb-ph"></span>
                  <span class="ai-card-bd">
                    <span class="ai-card-hd">
                      <b v-if="r.badge" class="ai-card-f">{{ r.badge }}</b>
                      <span class="ai-card-sp"></span>
                      <span v-if="r.weak && !r.advisory && picksSomething" class="ai-conf warn" title="模型没给理由 / id 靠猜 / 不在既有体系——默认不勾，判定权在你">低置信</span>
                      <span v-else-if="r.optIn && !r.advisory && picksSomething" class="ai-conf" title="这条要覆盖你已经写过的内容——默认不勾，勾上才替换（AI 不替你改主意）">覆盖需勾</span>
                      <span v-if="dual && r.changeType" class="ai-chg-tag" :class="'t-' + r.changeType">{{
                        { new: '新增', edit: '改写', move: '移动', same: '未变' }[r.changeType] }}</span>
                    </span>
                    <span class="ai-row-main">
                      <textarea v-if="editing === r.key" class="ai-edit" rows="3"
                        :value="drafts.get(r.key)?.main ?? r.main"
                        @click.stop @blur="commitEdit(r, ($event.target as HTMLTextAreaElement).value)"
                        @keydown.esc.stop="editing = null" />
                      <template v-else>
                        <span :class="{ 'ai-clickable': canEdit(r) }" :title="canEdit(r) ? '点击编辑（编辑即视为要采纳这一项）' : ''"
                          @click.stop="startEdit(r)">{{ r.main }}</span>
                        <span v-if="drafts.has(r.key)" class="ai-edited-mark" title="你改过这条">✏️</span>
                      </template>
                    </span>
                    <span v-if="r.sub" class="ai-row-sub">{{ r.sub }}</span>
                  </span>
                </label>
              </div>
            </template>
          </template>
        </div>
      </div>

      <!-- ④ 差异汇总行：改动账 + 视图开关 + 投料/耗时 —— 原先三样都挤在右栏表头一行，窄窗被劈成三截 -->
      <div v-if="vPhase === 'done' && vRows.length" class="ai-sum">
        <span v-if="dual" class="ai-chg">
          <i class="c-new">+{{ summary.new }} 新增</i>·<i class="c-edit">{{ summary.edit }} 改写</i>
          <template v-if="summary.move">·<i class="c-move">{{ summary.move }} 移动</i></template>
          ·<i class="c-same">{{ summary.same }} 未变</i>
          <i v-if="dropped" class="c-drop">左栏 {{ dropped }} 行未被认领</i>
        </span>
        <span class="ai-sum-end">
          <button v-if="dual" class="ai-btn sm ghost" :class="{ on: onlyDiff }" @click="onlyDiff = !onlyDiff">只看差异 ▦</button>
          <button class="ai-btn sm ghost" @click="showRaw = !showRaw">{{ showRaw ? '收起原文' : '原文' }}</button>
        </span>
        <span class="ai-usage">投料 {{ vFeed.chars }} 字<span v-if="vFeed.calls > 1"> · {{ vFeed.calls }} 次请求</span>{{ vFeed.pt ? ' · token ' + vFeed.pt + '/' + vFeed.ct : '' }} · 产出 {{ vRaw.length }} 字 · {{ vSecs }}s</span>
      </div>
    </div>

    <template #footer>
      <div v-if="confirmText" class="ai-confirm">⚠ {{ confirmText }}</div>
      <div class="ai-foot-row">
        <button class="ai-btn" @click="close">关闭</button>
        <button v-if="keyOf && vPhase === 'done'" class="ai-btn" title="重新问一次（当前结果作废）" @click="rerun">↻ 重新运行</button>
        <button v-if="canResave" class="ai-btn" title="用你编辑过的正文刷新那张卡（同名复用，不新增第二张）" @click="saveAgain">📥 存为卡（已编辑 {{ drafts.size }}）</button>
        <button v-if="cur?.secondary && vRows.length" class="ai-btn" :class="{ primary: recDetail }" :disabled="picked.size === 0"
          @click="adoptSecondary">{{ cur.secondary.label }}（{{ picked.size }}）</button>
        <button v-if="hasAdopt && vRows.length" class="ai-btn" :class="{ primary: !recDetail, danger: !!cur?.confirm }" :disabled="!canApply"
          @click="adopt">{{ adoptLabel }}</button>
      </div>
    </template>
  </Modal>
</template>

<style scoped>
.ai-body { display: flex; flex-direction: column; gap: var(--sp-4); font-size: var(--fs-body); color: var(--text-2); flex: 1; min-height: 0 }
.ai-steps { display: flex; gap: 6px; flex-wrap: wrap; }
.ai-step { font-size: var(--fs-caption); padding: 2px 9px; border-radius: var(--radius-xs); background: var(--surface-2); color: var(--text-4); letter-spacing: var(--tracking-sm); }
.ai-step.done { color: var(--success); background: var(--success-bg-soft); }
.ai-step.on { color: #fff; background: var(--accent); font-weight: 600; }
.ai-subject { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; padding: 2px 9px; background: var(--surface-2); border-radius: var(--radius-xs); color: var(--text-3); font-size: var(--fs-caption); font-weight: 400; }
.ai-hint { font-size: var(--fs-sub); color: var(--text-3); line-height: 1.6; flex-shrink: 0 }
/* R167：影响面 + 弱相关/覆盖账 + 消毒 + 跑完的步骤，合成一条「采纳前须知」（原先三堆并排像三段报错） */
.ai-note { display: flex; gap: 9px; align-items: flex-start; padding: 8px 11px; border: 1px solid var(--border); border-radius: var(--radius-sm); background: var(--surface-2); margin-bottom: 4px; flex-shrink: 0 }
.ai-note-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--warning); margin-top: 6px; flex-shrink: 0 }
.ai-note-tx { min-width: 0; font-size: var(--fs-caption); line-height: 1.65; color: var(--text-2) }
.ai-note-tx b { color: var(--text); font-weight: 600 }
.ai-note-sub { display: block; color: var(--text-3); margin-top: 2px }
.ai-status { padding: 14px; border: 1px solid var(--border); border-radius: var(--radius-sm); background: var(--surface-2); line-height: 1.7; }
.ai-err { color: var(--danger); display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
.ai-stopped { color: var(--text-2); display: flex; flex-wrap: wrap; gap: 8px; align-items: center; border-style: dashed; }
.ai-run-row { display: flex; align-items: center; gap: 8px; }
.ai-dot-pulse { width: 8px; height: 8px; border-radius: 50%; background: var(--accent); animation: breathe 1.2s ease-in-out infinite; }
.ai-stream { margin-top: 8px; max-height: 180px; overflow: auto; padding: 8px 10px; background: var(--surface-3); border: 1px solid var(--border); border-radius: var(--radius-xs); font-size: var(--fs-caption); line-height: 1.6; white-space: pre-wrap; word-break: break-all; color: var(--text-3); font-family: ui-monospace, Menlo, monospace; }
.ai-empty { padding: 24px; text-align: center; color: var(--text-3); line-height: 1.7 }
.ai-empty-hint { margin-top: 6px; font-size: var(--fs-sub); color: var(--text-4) }
.ai-err-feed { font-size: var(--fs-caption); color: var(--text-4) }
.ai-saved { padding: 7px 11px; border: 1px solid var(--success, var(--accent)); background: var(--success-bg-soft, var(--accent-light)); color: var(--success, var(--accent)); border-radius: var(--radius-sm); font-size: var(--fs-sub); line-height: 1.6 }
.ai-toolbar { display: flex; align-items: center; gap: 10px; font-size: var(--fs-sub); color: var(--text-3); flex-wrap: wrap }
.ai-sum .ai-usage { margin-left: auto }
.ai-all { display: flex; align-items: center; gap: 5px; cursor: pointer; }
.ai-persona-manage { margin-left: 6px; }
.ai-persona { padding: 3px 6px; border: 1px solid var(--border); border-radius: var(--radius-xs); background: var(--surface-2); color: var(--text-2); font-size: var(--fs-caption); cursor: pointer; font-family: inherit; max-width: 160px; }
.ai-usage { margin-left: auto; }
.ai-rows { display: flex; flex-direction: column; gap: 6px; }
/* R167：建议行＝卡片解剖。左 3px 竖条=变更类型（绿 新增 / 主题色 改写 / 橙 移动 / 灰 未变），
   首行 字段名 + 右端置信与变更，次行 建议正文，判词用 hairline 隔开单独成行。 */
.ai-card { position: relative; display: flex; gap: 10px; padding: 10px 12px 10px 15px; border: 1px solid var(--border); border-radius: var(--radius-sm); background: var(--surface); cursor: pointer; transition: border-color var(--dur), box-shadow var(--dur) }
.ai-card::before { content: ''; position: absolute; left: -1px; top: -1px; bottom: -1px; width: 3px; border-radius: var(--radius-sm) 0 0 var(--radius-sm); background: var(--border-strong) }
.ai-card.ct-new::before { background: var(--success) }
.ai-card.ct-edit::before { background: var(--accent) }
.ai-card.ct-move::before { background: var(--warning) }
.ai-card.on { border-color: var(--accent) }
.ai-card:hover { border-color: var(--border-strong) }
.ai-card.hot { border-color: var(--accent-2, var(--accent)); box-shadow: 0 0 0 3px var(--accent-glow) }
.ai-card.advisory { cursor: default; border-style: dashed; background: var(--surface-2) }
.ai-card.same { opacity: .6 }
.ai-card.dim { display: none }
.ai-card.edited { border-color: var(--accent) }
.ai-cb-ph { width: 16px; flex-shrink: 0 }
.ai-card-bd { display: flex; flex-direction: column; gap: 3px; min-width: 0; flex: 1 }
.ai-card-hd { display: flex; align-items: center; gap: 8px }
.ai-card-f { font-size: var(--fs-caption); font-weight: 600; color: var(--text-3); letter-spacing: var(--tracking-sm) }
.ai-card-sp { margin-left: auto }
.ai-conf { font-size: var(--fs-caption); padding: 1px 7px; border-radius: var(--radius-xs); background: var(--tag-neutral-bg); color: var(--tag-neutral-text) }
.ai-conf.warn { background: var(--warning-bg-soft); color: var(--warning) }
.ai-row-main { color: var(--text); font-weight: 500; line-height: 1.55; word-break: break-word }
.ai-row-sub { color: var(--text-3); font-size: var(--fs-caption); line-height: 1.65; margin-top: 5px; padding-top: 5px; border-top: 1px solid var(--border); white-space: pre-wrap; word-break: break-word }
.ai-badge { display: inline-block; margin-right: 6px; padding: 1px 6px; border-radius: var(--radius-xs); font-size: var(--fs-caption); font-weight: 600; vertical-align: 1px; }
.ai-badge.b-warn { background: var(--warning-bg-soft); color: var(--warning); }
.ai-badge.b-ok { background: var(--success-bg-soft); color: var(--success); }
.ai-badge.b-danger { background: var(--danger-bg-soft); color: var(--danger); }
.ai-badge.b-neutral { background: var(--tag-neutral-bg); color: var(--tag-neutral-text); }
.ai-btn { padding: 8px 14px; border: 1px solid var(--border); border-radius: var(--radius-sm); background: var(--surface-2); color: var(--text); font-size: var(--fs-body); cursor: pointer; font-family: inherit; transition: all var(--dur); }
/* R161：强调色只给主行动（.primary / .ghost.on = 当前态）——次级按钮 hover 一律走中性，不再"满屏泛紫" */
.ai-btn:hover { border-color: var(--border-strong); color: var(--text); }
.ai-btn.primary { background: var(--accent); border-color: var(--accent); color: #fff; }
.ai-btn.primary:hover { filter: brightness(1.08); color: #fff; }
.ai-btn.primary:disabled { opacity: var(--opacity-disabled); cursor: not-allowed; filter: none; }
.ai-btn.sm { padding: 3px 9px; font-size: var(--fs-caption); }
.ai-btn.ghost { background: transparent; }
.ai-btn.ghost.on { color: var(--accent-ink); border-color: var(--accent); background: var(--accent-light); }
.ai-btn.danger { background: var(--danger); border-color: var(--danger); color: #fff; }
.ai-btn.danger:hover { filter: brightness(1.06); color: #fff; }
/* ===== R154 双栏 ===== */
/* R167：对照区吃满剩余高度，两栏各自滚（原先整页滚，滚到下面看不见栏头也看不见这次的指令） */
.ai-dual { display: grid; grid-template-columns: var(--split, 40%) 7px 1fr; gap: 12px; flex: 1; min-height: 0 }
.ai-dual.single { display: block }
.ai-col { display: flex; flex-direction: column; min-width: 0; min-height: 0; overflow-y: auto; scrollbar-width: thin }
.ai-col-l { border-right: 1px solid var(--border) }
.ai-col-head { display: flex; align-items: center; gap: 8px; padding: 6px 2px; font-size: var(--fs-sub); color: var(--text-3); border-bottom: 1px solid var(--border); flex-wrap: wrap; flex-shrink: 0; position: sticky; top: 0; background: var(--surface); z-index: 1 }
.ai-adv-mark { font-size: var(--fs-sub); line-height: 1.5; }
/* 可拖分栏：7px 缝 + 中央把手；hover/拖动时把手变主题色并拉长 */
.ai-drag { position: relative; cursor: col-resize; display: flex; align-items: center; justify-content: center; background: var(--border); border-radius: 2px }
.ai-drag i { width: 3px; height: 26px; border-radius: 2px; background: var(--border-strong); transition: all var(--dur) }
.ai-drag:hover i, .ai-drag.act i { background: var(--accent); height: 44px }
.ai-drag::after { content: ''; position: absolute; inset: 0 -4px }
.ai-col-head b { color: var(--text-2); font-size: var(--fs-caption); letter-spacing: .4px; }
.ai-col-sub { color: var(--text-4); font-size: var(--fs-caption); }
.ai-col-end { margin-left: auto; display: flex; gap: 6px; align-items: center; }
.ai-col-body { flex: 1; min-height: 0; padding: 6px 0 }
.ai-chg { font-size: var(--fs-caption); color: var(--text-4); display: flex; gap: 4px; align-items: center; flex-wrap: wrap }
.ai-chg i { font-style: normal }
.ai-chg .c-new { color: var(--success) }
.ai-chg .c-edit { color: var(--accent) }
.ai-chg .c-move { color: var(--warning) }
.ai-chg .c-same { color: var(--text-4) }
.ai-chg .c-drop { color: var(--danger) }
.ai-prow { display: flex; gap: 8px; align-items: flex-start; padding: 6px 8px; border-radius: var(--radius-xs); border: 1px solid transparent; }
.ai-prow.hot { background: var(--surface-2); border-color: var(--border) }
.ai-prow.deep { margin-left: 18px }
.ai-pk { font-size: var(--fs-caption); color: var(--text-4); flex-shrink: 0; min-width: 34px; padding-top: 2px }
.ai-pv { flex: 1; min-width: 0; font-size: var(--fs-sub); color: var(--text); word-break: break-word }
.ai-psub { display: block; font-size: var(--fs-caption); color: var(--text-3); margin-top: 2px; white-space: pre-wrap }
.ai-pempty { color: var(--text-4) }
.ai-chg-tag { font-size: var(--fs-tiny); padding: 2px 6px; border-radius: var(--radius-xs); align-self: flex-start; letter-spacing: var(--tracking-sm); white-space: nowrap; font-weight: 600 }
.ai-chg-tag.t-new { background: var(--success-bg-soft); color: var(--success) }
.ai-chg-tag.t-edit { background: var(--accent-light); color: var(--accent-ink) }
.ai-chg-tag.t-move { background: var(--warning-bg-soft); color: var(--warning) }
.ai-chg-tag.t-same { background: var(--tag-neutral-bg); color: var(--tag-neutral-text); font-weight: 400 }
.ai-clickable { cursor: text; border-bottom: 1px dashed var(--border-strong) }
.ai-edit { width: 100%; background: var(--surface-3); border: 1px solid var(--accent); border-radius: var(--radius-xs); color: var(--text); font-size: var(--fs-body); line-height: 1.6; padding: 5px 7px; font-family: inherit; resize: vertical; outline: none }
.ai-edited-mark { margin-left: 5px; font-size: var(--fs-caption) }
/* ===== R154 指令框 ===== */
/* R167：指令条压成"标签列 | 输入框 | 动作列"一行（原先三段竖排，光这一块就 ~160px）。
   ★ 不做聚焦即长高：整条带子会跳、右侧按钮会跑到鼠标底下（原型实测），要更大空间往下拖。 */
.ai-dir { display: grid; grid-template-columns: 112px 1fr auto; gap: var(--sp-3); align-items: start; border: 1px solid var(--border); background: var(--surface-2); padding: 8px 10px; border-radius: var(--radius-sm) }
.ai-dir-l { display: flex; flex-direction: column; gap: 5px; font-size: var(--fs-caption); color: var(--text-4); line-height: 1.4 }
.ai-dir-l b { color: var(--text-2); font-size: var(--fs-sub) }
.ai-dir-tiers { display: flex; gap: 4px }
.ai-dir-tiers .tier { font-size: var(--fs-caption); padding: 1px 7px; border: 1px solid var(--border-strong); border-radius: var(--radius-xs); background: var(--surface); color: var(--text-3); cursor: pointer; font-family: inherit; white-space: nowrap }
.ai-dir-tiers .tier.on { border-color: var(--accent); color: var(--accent-ink); background: var(--accent-light); font-weight: 600 }
.ai-dir-tiers .tier:disabled { opacity: var(--opacity-disabled); cursor: not-allowed }
.ai-dir-m { min-width: 0 }
.ai-dir-cap { margin-top: 3px; font-size: var(--fs-caption); color: var(--text-4); font-variant-numeric: tabular-nums }
.ai-dir-ta { display: block; width: 100%; min-width: 0; background: var(--surface); border: 1px solid var(--border-strong); border-radius: var(--radius-xs); color: var(--text); font-size: var(--fs-sub); line-height: 1.6; padding: 5px 8px; font-family: inherit; resize: vertical; outline: none }
.ai-dir-ta:focus { border-color: var(--accent); box-shadow: var(--shadow-focus, none) }
.ai-dir-btns { display: flex; flex-direction: column; gap: 5px; align-items: stretch; flex-shrink: 0 }
.ai-dir-btns .ai-btn { white-space: nowrap }
.ai-hist { position: relative }
.ai-hist { position: relative; display: inline-block }
.ai-hist-menu { position: absolute; bottom: 26px; right: 0; width: 380px; background: var(--surface-3); border: 1px solid var(--border-strong); border-radius: var(--radius-sm); box-shadow: var(--shadow); padding: 5px; display: flex; flex-direction: column; gap: 2px; z-index: 5 }
.ai-hist-item { display: flex; flex-direction: column; gap: 2px; text-align: left; padding: 6px 7px; border: none; border-radius: var(--radius-xs); background: transparent; color: var(--text-2); font-size: var(--fs-sub); cursor: pointer; font-family: inherit }
.ai-hist-item:hover { background: var(--surface-2) }
.ai-hist-t { color: var(--text); line-height: 1.5 }
.ai-hist-m { font-size: var(--fs-caption); color: var(--text-4); font-variant-numeric: tabular-nums }
/* ===== R161 模块分隔：1px 分隔线 + 24/32 间距节奏（不靠边框堆叠，靠留白分区） ===== */
.ai-sum {
  display: flex; align-items: center; gap: var(--sp-3); flex-wrap: wrap;
  margin-top: var(--sp-2); padding-top: var(--sp-4);
  border-top: 1px solid var(--border);
}
.ai-sum-end { display: flex; gap: 6px; align-items: center; }
/* 底部 ===== */
.ai-confirm { width: 100%; margin-bottom: 6px; padding: 6px 10px; border: 1px solid var(--danger); background: var(--danger-bg-soft); color: var(--danger); border-radius: var(--radius-xs); font-size: var(--fs-sub); line-height: 1.6 }
.ai-foot-row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; width: 100% }
/* R161 响应式第二档（768~1199）：双栏降单栏 —— 复用同一套 DOM 与 `dual` 分支，
   只改排版方向，不写第二套模板（任务书硬要求："复用现有 dual=false 路径"） */
@media (max-width: 1199px) {
  .ai-dual { grid-template-columns: 1fr; gap: var(--sp-2) }
  .ai-col-l { border-right: none; border-bottom: 1px solid var(--border) }
  .ai-drag { display: none }
  .ai-col-body { max-height: 26vh }
}

/* ===== R167：对照弹窗定高 + 单条判决卡 ===== */
/* 只有本组件（挂了 .ai-modal 类）走"正文不滚、两栏各自滚"；Modal 壳的其它宿主一字不变 */
.ai-modal :deep(.md-body) { overflow: hidden; display: flex; flex-direction: column }
.ai-modal :deep(.md-head) { padding: var(--sp-3) var(--sp-5) }
.ai-modal :deep(.md-sub) { padding-top: var(--sp-2) }
.ai-vd { display: flex; flex-direction: column; gap: var(--sp-3); padding-top: var(--sp-2) }
.ai-vd-q { font-size: var(--fs-title); line-height: 1.75; color: var(--text); border-left: 2px solid var(--accent); padding-left: var(--sp-3) }
.ai-vd-3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: var(--sp-2) }
.ai-vd-opt { position: relative; text-align: left; padding: 10px 11px; border: 1px solid var(--border); border-radius: var(--radius-sm); background: var(--surface); color: var(--text); font-family: inherit; cursor: pointer; transition: all var(--dur) }
.ai-vd-opt b { display: block; font-size: var(--fs-sub); margin-bottom: 3px; color: var(--text-2) }
.ai-vd-opt small { display: block; font-size: var(--fs-caption); line-height: 1.5; color: var(--text-4) }
.ai-vd-opt em { display: inline-block; margin-top: 6px; font-size: var(--fs-micro); font-style: normal; padding: 1px 6px; border-radius: var(--radius-xs); background: var(--tag-neutral-bg); color: var(--tag-neutral-text) }
.ai-vd-opt:hover { border-color: var(--border-strong) }
.ai-vd-opt.on { border-color: var(--accent); background: var(--accent-light) }
.ai-vd-opt.on b { color: var(--accent) }
.ai-vd-lb { font-size: var(--fs-caption); color: var(--text-4); letter-spacing: var(--tracking-sm) }
.ai-vd-tt { width: 100%; box-sizing: border-box; margin-top: 4px; border: 1px solid var(--border-strong); border-radius: var(--radius-sm); background: var(--surface); color: var(--text); font-size: var(--fs-body); line-height: 1.6; padding: 7px 10px; font-family: inherit; resize: vertical; outline: none }
.ai-vd-tt:focus { border-color: var(--accent); box-shadow: var(--shadow-focus, none) }
.ai-vd-why, .ai-vd-facts { padding: var(--sp-3) var(--sp-4); background: var(--surface-2); border-radius: var(--radius-sm); font-size: var(--fs-sub); line-height: 1.8; color: var(--text-2) }
.ai-vd-why b, .ai-vd-facts b { color: var(--text) }
.ai-vd-facts ul { margin: 4px 0 0; padding-left: 18px }
.ai-vd-facts li { margin: 2px 0 }
.ai-vd-audit { font-size: var(--fs-caption); color: var(--text-4) }
</style>
