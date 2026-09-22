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
import Drawer from '@/shared/components/Drawer.vue'
import { showToast } from '@/shared/components/toast'
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
/** R147-c：消毒账（工厂闭包自己攒的丢弃计数），空态与工具条共用 */
const auditLine = ref('')
const impactLine = computed(() => cur.value?.impact?.(pickedRows.value) || '')
/** R154（拍板③）：报告型编辑过才点亮「存为卡」 */
const dirty = computed(() => [...drafts.value.entries()].some(([k, v]) => JSON.stringify(savedDrafts.value.get(k)) !== JSON.stringify(v)))
const canResave = computed(() => !!cur.value?.resave && dirty.value)
const adoptLabel = computed(() => (confirmText.value ? '✓ 确认写库' : '✓ 采纳（直接写库）') + `（${picked.value.size}）`)
const hotPair = ref('')

function defaultPicks(out: AiRow[]): Set<string> {
  return new Set(out.filter(r => !r.advisory && !r.weak && r.changeType !== 'same').map(r => r.key))
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
  const sel = pickedRows.value
  if (!sel.length) return
  // R154：整树替换类先弹确认，第二下才真写库
  const cf = job.confirm?.(sel)
  if (cf && !confirmText.value) { confirmText.value = cf; return }
  confirmText.value = ''
  try {
    const summary = await job.apply(sel)
    showToast(typeof summary === 'string' ? summary : '✓ 已采纳')
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

onUnmounted(() => { jobSeq++; stopTick(); if (!keyOf.value) { setLlmFeedSink(null); ctrl?.abort() } })
</script>

<template>
  <Drawer :open="open" :title="cur?.title || 'AI 建议'" :width="dual ? 'min(1120px, 94vw)' : '560px'" @close="close">
    <!-- R141（反馈 #2/#3）：专家下拉上移抽屉头部（跑的过程中也可见可换）；subject 标明正在处理哪张卡 -->
    <template v-if="cur?.persona" #title-extra>
      <select class="ai-persona" :value="cur.persona.current" title="换一个专家视角重新生成"
        @change="cur.persona!.onPick(($event.target as HTMLSelectElement).value)">
        <option v-for="o in cur.persona.options" :key="o.id" :value="o.id">{{ o.label }}</option>
      </select>
    </template>
    <div class="ai-body">
      <div v-if="cur?.steps?.length" class="ai-steps">
        <span v-for="(s, i) in cur.steps" :key="i" class="ai-step" :class="s.state">{{ s.label }}</span>
      </div>
      <div v-if="cur?.subject" class="ai-subject">{{ cur.subject }}</div>
      <div v-if="cur?.hint" class="ai-hint">{{ cur.hint }}</div>
      <!-- R154：影响面从"采纳后回执"提到"采纳前"，且随勾选重算（本地数出来的，不是模型报的） -->
      <div v-if="impactLine" class="ai-impact">{{ impactLine }}</div>

      <div class="ai-dual" :class="{ single: !dual }">
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

        <!-- 右栏：AI 补全后完整形态 -->
        <div class="ai-col ai-col-r">
          <div class="ai-col-head">
            <b>AI 补全后完整形态</b>
            <span v-if="dual" class="ai-chg">
              <i class="c-new">+{{ summary.new }} 新增</i>·<i class="c-edit">{{ summary.edit }} 改写</i>
              <template v-if="summary.move">·<i class="c-move">{{ summary.move }} 移动</i></template>
              ·<i class="c-same">{{ summary.same }} 未变</i>
              <i v-if="dropped" class="c-drop">左栏 {{ dropped }} 行未被认领</i>
            </span>
            <span class="ai-col-end">
              <button v-if="dual" class="ai-btn sm ghost" :class="{ on: onlyDiff }" @click="onlyDiff = !onlyDiff">只看差异 ▦</button>
              <button class="ai-btn sm ghost" @click="showRaw = !showRaw">{{ showRaw ? '收起' : '原文' }}</button>
            </span>
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
            <template v-else>
              <div class="ai-toolbar">
                <label v-if="picksSomething" class="ai-all"><input type="checkbox" :checked="picked.size === adoptableN && adoptableN > 0" @change="toggleAll" /> 全选</label>
                <button v-if="weakN && picksSomething" class="ai-btn sm ghost" @click="pickStrongOnly">只留高置信</button>
                <span v-if="picksSomething" class="ai-count">已选 {{ picked.size }}/{{ adoptableN }}</span>
                <span v-else class="ai-count">整篇成文，跑完自动落卡</span>
                <span class="ai-usage">投料 {{ vFeed.chars }} 字<span v-if="vFeed.calls > 1"> · {{ vFeed.calls }} 次请求</span>{{ vFeed.pt ? ' · token ' + vFeed.pt + '/' + vFeed.ct : '' }} · 产出 {{ vRaw.length }} 字 · {{ vSecs }}s</span>
              </div>
              <div v-if="weakN || auditLine" class="ai-flags">
                <span v-if="weakN && picksSomething" class="ai-flag warn">{{ weakN }} 条判为弱相关（缺理由/靠猜），已默认不勾——要采纳请自己勾上</span>
                <span v-if="auditLine" class="ai-flag">消毒：{{ auditLine }}</span>
              </div>
              <pre v-if="showRaw" class="ai-stream">{{ vRaw }}</pre>
              <div class="ai-rows">
                <label v-for="r in shown" :key="r.key" class="ai-row"
                  :class="{ on: picksSomething && !r.advisory && picked.has(r.key), advisory: r.advisory || !picksSomething, weak: picksSomething && r.weak, same: r.changeType === 'same', edited: drafts.has(r.key), dim: onlyDiff && r.changeType === 'same' }"
                  @mouseenter="hover(r)" @mouseleave="unhover">
                  <input v-if="!r.advisory && picksSomething && r.changeType !== 'same'" type="checkbox" :checked="picked.has(r.key)" @change="toggle(r.key)" />
                  <span v-else-if="r.advisory" class="ai-adv-mark" title="参谋建议（只读）">🧭</span>
                  <span class="ai-row-txt">
                    <span class="ai-row-main">
                      <span v-if="r.badge" class="ai-badge" :class="'b-' + (r.badgeType || 'neutral')">{{ r.badge }}</span>
                      <span v-if="r.weak && !r.advisory && picksSomething" class="ai-badge b-warn" title="模型没给理由 / id 靠猜 / 不在既有体系——默认不勾，判定权在你">低置信</span>
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
                  <span v-if="dual && r.changeType" class="ai-chg-tag" :class="'t-' + r.changeType">{{
                    { new: '新增', edit: '改写', move: '移动', same: '未变' }[r.changeType] }}</span>
                </label>
              </div>
            </template>
          </template>
        </div>
      </div>

      <!-- R154：一次性指令。角色=谁来写（可复用）、指令=这次要什么（优先级高于角色，但改不了输出结构） -->
      <div v-if="cur?.promptScope" class="ai-dir">
        <div class="ai-dir-head">
          <b>🎯 本次指令</b><span class="ai-prio">优先级高于角色</span>
          <span class="ai-scope">
            <button v-if="cur.promptObject" :class="{ on: dirTier === 'object' }"
              :title="'这条只跟' + (cur.promptObjectLabel || '这个对象') + '走'"
              @click="switchTier('object')">这张卡{{ cur.promptObjectLabel ? ' · ' + cur.promptObjectLabel : '' }}</button>
            <button :class="{ on: dirTier === 'entry' }" :disabled="!cur.promptObject"
              :title="cur.promptObject ? '升档后本入口下所有对象共用这条指令（含以后新建的）' : '本入口没有更细的对象作用域'"
              @click="switchTier('entry')">这类入口</button>
          </span>
          <span class="ai-dir-cap">剩 {{ dirCap }} 字 · {{ dirTier === 'object' && cur.promptObject ? '只记在这张卡上' : '本入口共用' }}</span>
        </div>
        <div class="ai-dir-row">
          <textarea v-model="dirText" class="ai-dir-ta" rows="2"
            placeholder="例：描述别写口号，只写这周能拿去报价的素材。指令只能改口径，改不了输出结构（那是场景骨架）。"
            @blur="commitDir" />
          <span class="ai-dir-btns">
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
          </span>
        </div>
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
  </Drawer>
</template>

<style scoped>
.ai-body { display: flex; flex-direction: column; gap: 10px; font-size: 12.5px; color: var(--text-2); }
.ai-steps { display: flex; gap: 6px; flex-wrap: wrap; }
.ai-step { font-size: 11px; padding: 2px 9px; border-radius: var(--radius-xs); background: var(--surface-2); color: var(--text-4); letter-spacing: var(--tracking-sm); }
.ai-step.done { color: var(--success); background: var(--success-bg-soft); }
.ai-step.on { color: #fff; background: var(--accent); font-weight: 600; }
.ai-subject { padding: 7px 11px; background: var(--accent-light); border: 1px solid var(--accent); border-radius: var(--radius-sm); color: var(--accent); font-size: 12px; font-weight: 600; }
.ai-hint { font-size: 11.5px; color: var(--text-3); line-height: 1.6; }
.ai-impact { padding: 7px 11px; border: 1px solid var(--border); border-left: 2px solid var(--warning); background: var(--warning-bg-soft); border-radius: var(--radius-xs); color: var(--text-2); font-size: 11.5px; line-height: 1.6; }
.ai-status { padding: 14px; border: 1px solid var(--border); border-radius: var(--radius-sm); background: var(--surface-2); line-height: 1.7; }
.ai-err { color: var(--danger); display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
.ai-stopped { color: var(--text-2); display: flex; flex-wrap: wrap; gap: 8px; align-items: center; border-style: dashed; }
.ai-run-row { display: flex; align-items: center; gap: 8px; }
.ai-dot-pulse { width: 8px; height: 8px; border-radius: 50%; background: var(--accent); animation: breathe 1.2s ease-in-out infinite; }
.ai-stream { margin-top: 8px; max-height: 180px; overflow: auto; padding: 8px 10px; background: var(--surface-3); border: 1px solid var(--border); border-radius: var(--radius-xs); font-size: 11px; line-height: 1.6; white-space: pre-wrap; word-break: break-all; color: var(--text-3); font-family: ui-monospace, Menlo, monospace; }
.ai-empty { padding: 24px; text-align: center; color: var(--text-3); line-height: 1.7 }
.ai-empty-hint { margin-top: 6px; font-size: 11.5px; color: var(--text-4) }
.ai-err-feed { font-size: 11px; color: var(--text-4) }
.ai-saved { padding: 7px 11px; border: 1px solid var(--success, var(--accent)); background: var(--success-bg-soft, var(--accent-light)); color: var(--success, var(--accent)); border-radius: var(--radius-sm); font-size: 11.5px; line-height: 1.6 }
.ai-flags { display: flex; flex-direction: column; gap: 4px }
.ai-flag { font-size: 11.5px; color: var(--text-4); line-height: 1.5 }
.ai-flag.warn { color: var(--warning) }
.ai-toolbar { display: flex; align-items: center; gap: 10px; font-size: 11.5px; color: var(--text-3); flex-wrap: wrap }
.ai-all { display: flex; align-items: center; gap: 5px; cursor: pointer; }
.ai-persona { padding: 3px 6px; border: 1px solid var(--border); border-radius: var(--radius-xs); background: var(--surface-2); color: var(--text-2); font-size: 11px; cursor: pointer; font-family: inherit; max-width: 160px; }
.ai-usage { margin-left: auto; }
.ai-rows { display: flex; flex-direction: column; gap: 6px; }
.ai-row { display: flex; gap: 9px; padding: 9px 11px; border: 1px solid var(--border); border-radius: var(--radius-sm); background: var(--surface); cursor: pointer; transition: border-color var(--dur); }
.ai-row.on { border-color: var(--accent); background: var(--accent-light); }
.ai-row.advisory { cursor: default; border-style: dashed; background: var(--surface-2); border-color: var(--warning); }
.ai-row.same { opacity: .6 }
.ai-row.dim { display: none }
.ai-row.edited { border-color: var(--accent); box-shadow: inset 2px 0 0 var(--accent); }
.ai-adv-mark { font-size: 12px; line-height: 1.5; }
.ai-row-txt { display: flex; flex-direction: column; gap: 3px; min-width: 0; flex: 1; }
.ai-row-main { color: var(--text); font-weight: 500; line-height: 1.5; }
.ai-row-sub { color: var(--text-3); font-size: 11.5px; line-height: 1.6; white-space: pre-wrap; word-break: break-word; }
.ai-badge { display: inline-block; margin-right: 6px; padding: 1px 6px; border-radius: var(--radius-xs); font-size: 10.5px; font-weight: 600; vertical-align: 1px; }
.ai-badge.b-warn { background: var(--warning-bg-soft); color: var(--warning); }
.ai-badge.b-ok { background: var(--success-bg-soft); color: var(--success); }
.ai-badge.b-danger { background: var(--danger-bg-soft); color: var(--danger); }
.ai-badge.b-neutral { background: var(--tag-neutral-bg); color: var(--tag-neutral-text); }
.ai-btn { padding: 8px 14px; border: 1px solid var(--border); border-radius: var(--radius-sm); background: var(--surface-2); color: var(--text); font-size: 12.5px; cursor: pointer; font-family: inherit; transition: all var(--dur); }
.ai-btn:hover { border-color: var(--accent); color: var(--accent); }
.ai-btn.primary { background: var(--accent); border-color: var(--accent); color: #fff; }
.ai-btn.primary:hover { filter: brightness(1.08); color: #fff; }
.ai-btn.primary:disabled { opacity: var(--opacity-disabled); cursor: not-allowed; filter: none; }
.ai-btn.sm { padding: 3px 9px; font-size: 11px; }
.ai-btn.ghost { background: transparent; }
.ai-btn.ghost.on { color: var(--accent); border-color: var(--accent); background: var(--accent-light); }
.ai-btn.danger { background: var(--danger); border-color: var(--danger); color: #fff; }
.ai-btn.danger:hover { filter: brightness(1.06); color: #fff; }
/* ===== R154 双栏 ===== */
.ai-dual { display: flex; gap: 12px; min-height: 0; align-items: stretch; }
.ai-dual.single { display: block; }
.ai-col { display: flex; flex-direction: column; min-width: 0; flex: 1; }
.ai-col-l { width: 420px; flex: 0 0 420px; border-right: 1px solid var(--border); padding-right: 12px; }
.ai-col-head { display: flex; align-items: center; gap: 8px; padding: 6px 2px; font-size: 11.5px; color: var(--text-3); border-bottom: 1px solid var(--border); flex-wrap: wrap; }
.ai-col-head b { color: var(--text-2); font-size: 11px; letter-spacing: .4px; }
.ai-col-sub { color: var(--text-4); font-size: 10.5px; }
.ai-col-end { margin-left: auto; display: flex; gap: 6px; align-items: center; }
.ai-col-body { overflow-y: auto; max-height: 52vh; padding: 6px 0 }
.ai-chg { font-size: 11px; color: var(--text-4); display: flex; gap: 4px; align-items: center; flex-wrap: wrap }
.ai-chg i { font-style: normal }
.ai-chg .c-new { color: var(--success) }
.ai-chg .c-edit { color: var(--accent) }
.ai-chg .c-move { color: var(--warning) }
.ai-chg .c-same { color: var(--text-4) }
.ai-chg .c-drop { color: var(--danger) }
.ai-prow { display: flex; gap: 8px; align-items: flex-start; padding: 6px 8px; border-radius: var(--radius-xs); border: 1px solid transparent; }
.ai-prow.hot { background: var(--surface-2); border-color: var(--border) }
.ai-prow.deep { margin-left: 18px }
.ai-pk { font-size: 10.5px; color: var(--text-4); flex-shrink: 0; min-width: 34px; padding-top: 2px }
.ai-pv { flex: 1; min-width: 0; font-size: 12px; color: var(--text); word-break: break-word }
.ai-psub { display: block; font-size: 11px; color: var(--text-3); margin-top: 2px; white-space: pre-wrap }
.ai-pempty { color: var(--text-4) }
.ai-chg-tag { font-size: 10px; padding: 2px 6px; border-radius: var(--radius-xs); align-self: flex-start; letter-spacing: var(--tracking-sm); white-space: nowrap; font-weight: 600 }
.ai-chg-tag.t-new { background: var(--success-bg-soft); color: var(--success) }
.ai-chg-tag.t-edit { background: var(--accent-light); color: var(--accent) }
.ai-chg-tag.t-move { background: var(--warning-bg-soft); color: var(--warning) }
.ai-chg-tag.t-same { background: var(--tag-neutral-bg); color: var(--tag-neutral-text); font-weight: 400 }
.ai-clickable { cursor: text; border-bottom: 1px dashed var(--border-strong) }
.ai-edit { width: 100%; background: var(--surface-3); border: 1px solid var(--accent); border-radius: var(--radius-xs); color: var(--text); font-size: 12.5px; line-height: 1.6; padding: 5px 7px; font-family: inherit; resize: vertical; outline: none }
.ai-edited-mark { margin-left: 5px; font-size: 11px }
/* ===== R154 指令框 ===== */
.ai-dir { border-top: 1px solid var(--border); background: var(--surface-2); padding: 8px 10px; border-radius: var(--radius-xs); display: flex; flex-direction: column; gap: 6px }
.ai-dir-head { display: flex; align-items: center; gap: 7px; font-size: 11px; color: var(--text-3); flex-wrap: wrap }
.ai-dir-head b { color: var(--text-2); font-size: 11px }
.ai-prio { font-size: 10px; padding: 1px 6px; border-radius: var(--radius-xs); background: var(--curio-bg, var(--accent-light)); color: var(--curio-amber, var(--accent)); font-weight: 600 }
.ai-scope { display: flex; border: 1px solid var(--border-strong); border-radius: var(--radius-xs); overflow: hidden }
.ai-scope button { font-size: 10.5px; padding: 2px 8px; border: none; background: var(--surface); color: var(--text-3); cursor: pointer; font-family: inherit; white-space: nowrap }
.ai-scope button.on { background: var(--accent); color: #fff; font-weight: 600 }
.ai-scope button:disabled { opacity: var(--opacity-disabled); cursor: not-allowed }
.ai-dir-cap { margin-left: auto; font-size: 10.5px; color: var(--text-4); font-variant-numeric: tabular-nums }
.ai-dir-row { display: flex; gap: 7px; align-items: flex-start }
.ai-dir-ta { flex: 1; min-width: 0; background: var(--surface); border: 1px solid var(--border-strong); border-radius: var(--radius-xs); color: var(--text); font-size: 12px; line-height: 1.6; padding: 5px 8px; font-family: inherit; resize: vertical; outline: none }
.ai-dir-ta:focus { border-color: var(--accent); box-shadow: var(--shadow-focus, none) }
.ai-dir-btns { display: flex; gap: 6px; align-items: center; flex-shrink: 0 }
.ai-hist { position: relative; display: inline-block }
.ai-hist-menu { position: absolute; bottom: 26px; right: 0; width: 380px; background: var(--surface-3); border: 1px solid var(--border-strong); border-radius: var(--radius-sm); box-shadow: var(--shadow); padding: 5px; display: flex; flex-direction: column; gap: 2px; z-index: 5 }
.ai-hist-item { display: flex; flex-direction: column; gap: 2px; text-align: left; padding: 6px 7px; border: none; border-radius: var(--radius-xs); background: transparent; color: var(--text-2); font-size: 11.5px; cursor: pointer; font-family: inherit }
.ai-hist-item:hover { background: var(--surface-2) }
.ai-hist-t { color: var(--text); line-height: 1.5 }
.ai-hist-m { font-size: 10.5px; color: var(--text-4); font-variant-numeric: tabular-nums }
/* ===== 底部 ===== */
.ai-confirm { width: 100%; margin-bottom: 6px; padding: 6px 10px; border: 1px solid var(--danger); background: var(--danger-bg-soft); color: var(--danger); border-radius: var(--radius-xs); font-size: 11.5px; line-height: 1.6 }
.ai-foot-row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; width: 100% }
/* 窄窗退化：双栏撑不开时左栏降为顶部摘要条，不留两套模板 */
@media (max-width: 900px) {
  .ai-dual { flex-direction: column; gap: 8px }
  .ai-col-l { width: auto; flex: 0 0 auto; border-right: none; padding-right: 0; border-bottom: 1px solid var(--border) }
  .ai-col-body { max-height: 26vh }
}
</style>
