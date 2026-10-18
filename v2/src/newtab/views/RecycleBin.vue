<script setup lang="ts">
// R148-P1a：显式实例名——纳入 KeepAlive（切模块免重挂载与免重算首屏）
defineOptions({ name: 'RecycleBinView' })
import Icon from '@/shared/components/Icon.vue'

import { ref, computed } from 'vue'
import { wsDisplayNameOf, wsNameById } from '@/shared/utils/wsName'
import { useRouter } from 'vue-router'
import { useAppStore } from '../stores/app'
import { showToast } from '@/shared/components/toast'
import { useConfirm } from '@/shared/components/confirm'
import AiEntryButton from '@/shared/components/AiEntryButton.vue'
import EmptyState from '@/shared/components/EmptyState.vue'
import { purgeCardsCompletely, type PurgeTargets } from '@/shared/storage/purge'
import { detachTaskFromMetrics } from '@/shared/utils/taskLinks'
import type { ResourceCard, TaskCard, CuriosityCard, ArgumentCard, ID } from '@/shared/models'
import { CURATION_WS_ID } from '@/shared/models'
// R137-H2：AI 捞回清单（懒路由，可直接静态引 AI 栈；采纳=恢复 deletedAt 置空，与手工恢复同字段）
import AiSuggestionDrawer from '@/newtab/components/AiSuggestionDrawer.vue'
import type { AiJob } from '@/shared/ai/job'
import { aiConfig, loadAiConfig, aiReady } from '@/shared/ai/config'
import { buildTrashRescueJob } from '@/shared/ai/govern'

const aiJob = ref<AiJob | null>(null)
async function aiRescue() {
  await loadAiConfig()
  if (!aiReady.value) { showToast('请先在 设置 → AI 助手 完成接入（地址/Key/模型）'); return }
  const job = buildTrashRescueJob({ d: store.data!, depth: aiConfig.value.depth, persist: () => store.persist() })
  if (!job) { showToast('回收站里没有资源卡'); return }
  aiJob.value = job
}

/** 第卅三轮 REQ-018：回收站页面（三类卡软删数据直接复用：models 的 deletedAt）
 *  列表 + 恢复 + 永久删除 + 清空；入口在全局设置危险操作区
 */
const router = useRouter()
const store = useAppStore()
const d = computed(() => store.data!)

const tab = ref<'res' | 'task' | 'curio' | 'cat' | 'arg'>('res')

// ================= D1（V3.8.39）：恢复即生效 + 可撤销 =================
/**
 * ★撤销必须「整笔快照-回滚」，不能只把 deletedAt 塞回去。恢复动作一共改了 6 处：
 *   deletedAt / updatedAt / workspaceId / categoryId（rehomeIfOrphan 可能换台）/
 *   metric.taskIds（任务卡被回填引用）/ convertedAt+convertedTo（好奇卡清转化戳）。
 * 少回滚任何一处，都会留下一张「半恢复」的卡：例如只回滚 deletedAt 而没摘 taskIds，
 * 指标里就挂着一个已软删任务的 id——正是 `sanitizeMetricTaskIds` 启动期要消毒的那类脏数据，
 * 却在撤销这条最该「回到旧样」的路径上重新造了一遍。
 *
 * 快照按引用字段逐个存值（不是深拷贝整张卡）：撤销窗口 6s，卡在这期间只可能被本视图自己改动。
 */
interface RestoreSnap {
  id: ID
  /** 展示名，回执与撤销二次回执共用 */
  name: string
  deletedAt: number | undefined
  updatedAt: number | undefined
  /** 仅资源卡：rehomeIfOrphan 可能改过归属，撤销要把原值还回去 */
  workspaceId?: string
  categoryId?: string
  /** 仅好奇卡：恢复时清了转化戳，撤销要复原 */
  convertedAt?: number
  convertedTo?: 'task' | 'res'
}

/**
 * 可快照对象：五类对象里只有卡类有 updatedAt，分类（Category）没有——
 * 所以这里按「至少有 id 与可选 deletedAt」的最宽结构声明，具体字段走 `as` 取。
 * 与其写四份重载，不如承认它们的公共面就这么窄。
 */
type RestoreSnapSource = { id: ID; deletedAt?: number }

/** 取一组快照。必须在**改动之前**调用——它只读，不产生副作用。 */
function snapOf(x: RestoreSnapSource): RestoreSnap {
  const any = x as unknown as Record<string, unknown>
  return {
    id: x.id,
    name: '',
    deletedAt: x.deletedAt,
    updatedAt: any.updatedAt as number | undefined,
    workspaceId: any.workspaceId as ID | undefined,
    categoryId: any.categoryId as string | undefined,
    convertedAt: any.convertedAt as number | undefined,
    convertedTo: any.convertedTo as 'task' | 'res' | undefined
  }
}

/** 撤销：把快照整笔还回去。找不到卡（如已被永久删除）时如实说，不假装成功。 */
function rollback(s: RestoreSnap): boolean {
  // REQ-030 口径：persist 后整树会替换引用，闭包里的旧对象已失效 ⇒ 一律按 id 回当前树找
  const cur =
    d.value.resources.find(x => x.id === s.id) ||
    d.value.tasks.find(x => x.id === s.id) ||
    d.value.curiosities.find(x => x.id === s.id) ||
    (d.value.argCards || []).find(x => x.id === s.id) ||
    d.value.categories.find(x => x.id === s.id)
  if (!cur) return false
  const any = cur as unknown as Record<string, unknown>
  cur.deletedAt = s.deletedAt
  // 分类没有 updatedAt（见 RestoreSnapSource 注释）⇒ 字段缺失时跳过，不给它凭空造一个
  if (s.updatedAt !== undefined && any.updatedAt !== undefined) any.updatedAt = s.updatedAt
  // 资源卡：归属只在「恢复时确实动过」的情况下回填，避免给从未动过的卡乱写 undefined
  if (any.workspaceId !== undefined && s.workspaceId !== undefined) any.workspaceId = s.workspaceId
  if (any.categoryId !== undefined) any.categoryId = s.categoryId
  if (any.convertedAt !== undefined || any.convertedTo !== undefined) {
    any.convertedAt = s.convertedAt
    any.convertedTo = s.convertedTo
  }
  // 任务卡：摘掉恢复时回填的指标引用，否则指标上留一个指向已软删卡的死 id
  detachTaskFromMetrics(d.value, s.id)
  store.persist()
  return true
}

/** 统一的「恢复完成 + 可撤销」回执。★文案按真实归属说话，不一律写「已恢复到原位置」。 */
function restored(s: RestoreSnap, note: string) {
  s.name = s.name || ''
  showToast(`${s.name ? `已恢复「${s.name}」` : '已恢复'}${note}`, { label: '撤销', cb: () => {
    // ★先摘淡出缓冲再回滚：否则用户点撤销时那一行还在 150ms 缓冲里，
    // 看到的是「撤销了却什么都没回来」
    unmarkLeaving(s.id)
    if (rollback(s)) show(`↩ 已撤销恢复「${s.name || '该项'}」· 回到回收站`)
    else show('⚠ 该项已不在回收站，无法撤销恢复')
  } })
}

/** R109（F12-b）：软删分类（删除分类/删除策展台/合并重复 均走 deletedAt）——恢复 = 清 deletedAt */
const cats = computed(() =>
  d.value.categories.filter(c => c.deletedAt).sort((a, b) => (b.deletedAt || 0) - (a.deletedAt || 0)))
function restoreCat(c: { id: ID; deletedAt?: number }) {
  const s = snapOf(c)
  // ★注解只写了 id/deletedAt，但运行时传入的就是 Category 本体（见模板 v-for="c in catRows"），
  // 名字与排序锚从实际对象上取。判据 R109-5 锚的就是这串签名，不必为它扩字段。
  const real = c as { id: ID; name?: string; deletedAt?: number }
  s.name = real.name || ''
  markLeaving(c.id, c, c.deletedAt)
  c.deletedAt = undefined
  store.persist()
  restored(s, '（其下卡片仍在待分类/回收站，可手动归位）')
}

/** R2-⑤：论证节点卡（第 4 种卡）进回收站族——R1.5 的「硬删不可恢复」旁路到此为止 */
const args = computed(() =>
  (d.value.argCards || []).filter(a => a.deletedAt).sort((a, b) => (b.deletedAt || 0) - (a.deletedAt || 0)))
function restoreArg(a: ArgumentCard) {
  const s = snapOf(a)
  s.name = a.title.slice(0, 20)
  markLeaving(a.id, a, a.deletedAt)
  a.deletedAt = undefined
  a.updatedAt = Date.now()
  store.persist()
  restored(s, d.value.workspaces.some(w => w.id === a.workspaceId) ? '' : '（原策展台已删除，回台面需先恢复该台）')
}

const res = computed(() =>
  d.value.resources.filter(r => r.deletedAt).sort((a, b) => (b.deletedAt || 0) - (a.deletedAt || 0)))
const tasks = computed(() =>
  d.value.tasks.filter(t => t.deletedAt).sort((a, b) => (b.deletedAt || 0) - (a.deletedAt || 0)))
const curios = computed(() =>
  d.value.curiosities.filter(c => c.deletedAt).sort((a, b) => (b.deletedAt || 0) - (a.deletedAt || 0)))

function wsNameOf(id: string): string {
  return wsNameById(d.value.workspaces, id) || '未知策展台'
}
function catNameOf(id: string): string {
  return d.value.categories.find(c => c.id === id)?.name || '待分类'
}
function metricNameOf(metricId?: string): string {
  if (!metricId) return '未归类'
  for (const dir of d.value.compass.directions) {
    for (const proj of dir.projects) {
      const m = proj.metrics.find(x => x.id === metricId)
      if (m) return m.title
    }
  }
  return '已删除指标'
}
function fmt(t?: number): string {
  if (!t) return '—'
  const dt = new Date(t)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${dt.getFullYear()}-${p(dt.getMonth() + 1)}-${p(dt.getDate())} ${p(dt.getHours())}:${p(dt.getMinutes())}`
}
/** D1：show 升级为带可选撤销动作的包装——批量恢复与单条恢复走同一条回执通道 */
function show(msg: string, act?: { label: string; cb: () => void }) { showToast(msg, act) }

// ========== D1 · 恢复行 150ms 淡出 ==========
/**
 * ★为什么不能只靠 CSS 动画类：卡片一恢复，`res`/`tasks` 这类 computed 当场就不含它了，
 * v-for 直接把 DOM 节点摘掉——纯 CSS 的 fade-out 类根本没机会播。所以必须**本地多留一会儿**：
 * 把刚恢复的行塞进 `leaving`，渲染时把它并进列表末尾（带 leaving 样式），150ms 后真移除。
 *
 * ★为什么不用 <TransitionGroup>：它要求整块列表是一个稳定的 keyed 容器，而这里五个分区是
 * `v-if / v-else-if` 整块替换。切 tab 时旧块被直接销毁，过渡钩子根本不跑（这本身是对的），
 * 但恢复时"行离场"发生在块内、与 TransitionGroup 的 diff 时序叠在一起，很难证它每次都触发。
 * 自己控一份 leaving 缓冲，行为可读、可判据、也更好实拍。
 */
const LEAVE_MS = 150
/**
 * id → { obj 该行的原始对象（恢复后已不在软删集合里，渲染要靠它）· at 它恢复前的 deletedAt
 *       用于把缓冲行放回**原来的排序位** · timer 到期摘除 }
 */
const leaving = ref<Record<string, { obj: unknown; at: number; timer: number }>>({})

/** 把一行挂进淡出缓冲，150ms 后真移除。id 相同则以最后一次为准（连点恢复不会留下两份）。 */
function markLeaving(id: ID, obj: unknown, at?: number) {
  const prev = leaving.value[id]
  if (prev) clearTimeout(prev.timer)
  leaving.value = {
    ...leaving.value,
    [id]: { obj, at: at ?? (obj as { deletedAt?: number })?.deletedAt ?? 0, timer: window.setTimeout(() => {
      const next = { ...leaving.value }
      delete next[id]
      leaving.value = next
    }, LEAVE_MS) }
  }
}

/** 撤销恢复时：卡要立刻回来，别让它在淡出缓冲里再待 150ms（用户看到的是"撤销了却没反应"）。 */
function unmarkLeaving(id: ID) {
  const prev = leaving.value[id]
  if (!prev) return
  clearTimeout(prev.timer)
  const next = { ...leaving.value }
  delete next[id]
  leaving.value = next
}

/** 某 id 是否正在淡出（渲染层据此挂样式与禁按钮） */
function isLeaving(id: ID) { return leaving.value[id] !== undefined }

/**
 * 「真实列表 + 淡出缓冲」合流视图。
 * ★两条约束缺一不可：
 *   ① 只并入**不在 live 里**的行——否则同一张卡渲染两次；
 *   ② 缓冲行按原 deletedAt 插回原位——直接 append 会让恢复中间行时它先跳到末尾再淡出，
 *      看起来像「卡片乱滚了一下」，与「恢复有即时感知」的原意相反。
 */
function withLeaving<T extends { id: ID; deletedAt?: number }>(live: T[]): T[] {
  const extra: { obj: T; at: number }[] = []
  for (const k of Object.keys(leaving.value)) {
    const e = leaving.value[k]!
    const x = e.obj as T
    if (x && !live.some(y => y.id === x.id)) extra.push({ obj: x, at: e.at })
  }
  if (!extra.length) return live
  // 与 live 同规则倒序（软删列表一律按 deletedAt desc），缓冲行插到第一个"比我新"的活行之前
  const merged = [...live]
  for (const e of extra) {
    let i = 0
    while (i < merged.length && (merged[i]!.deletedAt || 0) > e.at) i++
    merged.splice(i, 0, e.obj)
  }
  return merged
}

// ---- 恢复 ----
/** R58-B1：恢复时原策展台/分类可能已随「删除策展台」消失——回落到第一个可用策展台的未分类，保证卡片可见可用 */
function rehomeIfOrphan(r: ResourceCard): string {
  let note = ''
  if (!d.value.workspaces.some(w => w.id === r.workspaceId)) {
    const fallback = d.value.workspaces.find(w => w.id !== CURATION_WS_ID) || d.value.workspaces[0]
    if (fallback) { r.workspaceId = fallback.id; note = '（原策展台已删除，已移入「' + wsDisplayNameOf(fallback) + '」未分类）' }
  } else if (r.categoryId && !d.value.categories.some(c => c.id === r.categoryId)) {
    r.categoryId = ''
    note = '（原分类已删除，已移入未分类）'
  }
  return note
}
function restoreRes(r: ResourceCard) {
  const s = snapOf(r)
  s.name = r.title.slice(0, 20)
  markLeaving(r.id, r, r.deletedAt)
  r.deletedAt = undefined
  const note = rehomeIfOrphan(r)
  r.updatedAt = Date.now()
  store.persist()
  restored(s, note)
}
function restoreTask(t: TaskCard) {
  const s = snapOf(t)
  s.name = t.title.slice(0, 20)
  markLeaving(t.id, t, t.deletedAt)
  t.deletedAt = undefined
  t.updatedAt = Date.now()
  // 原指标仍存在则回填 taskIds（与删除撤销口径一致）
  if (t.metricId) {
    for (const dir of d.value.compass.directions) {
      for (const proj of dir.projects) {
        for (const m of proj.metrics) {
          if (m.id === t.metricId && !m.taskIds.includes(t.id)) m.taskIds.push(t.id)
        }
      }
    }
  }
  store.persist()
  restored(s, '')
}
function restoreCurio(c: CuriosityCard) {
  const s = snapOf(c)
  s.name = c.question.slice(0, 20)
  markLeaving(c.id, c, c.deletedAt)
  c.deletedAt = undefined
  /** R167：恢复即撤销这次转化——清掉转化戳，否则池里多一条卡、头部「已转化」却还记着它（两头都对不上） */
  c.convertedAt = undefined
  c.convertedTo = undefined
  c.updatedAt = Date.now()
  store.persist()
  restored(s, '')
}

// ---- 永久删除（R146：全应用唯一真正不可逆的动作，必须逐次确认 + 回执点名）----
/** R128-A3：硬删四类副作用（附件本体 / metric.taskIds / 数组移除 / 悬空投射）统一到
 *  shared/storage/purge.purgeCardsCompletely——与设置页「清空回收站」共用一份口径。
 *  附件本体不再无条件删除：仍被其他卡（含回收站待恢复卡）引用的共享本体保留（REQ-050 转卡引用拷贝）。 */
async function purge(targets: PurgeTargets): Promise<number> {
  const r = await purgeCardsCompletely(d.value, targets)
  store.persist()
  if (r.assetsFailed > 0) show(`${r.assetsFailed} 个附件本体删除失败（孤儿可到「设置 · 数据管理」清理）`)
  return r.cards
}
async function purgeWith(what: string, name: string, targets: PurgeTargets) {
  if (!(await useConfirm({ title: '永久删除', message: `确定永久删除${what}「${name}」？\n此操作不可恢复：卡片本体、其附件（若无其它卡引用）与镜像投射记录一并清除。`, confirmText: '永久删除' }))) return
  const n = await purge(targets)
  show(n ? `已永久删除${what}「${name.slice(0, 16)}」· 不可恢复` : `${what}「${name.slice(0, 16)}」已不在回收站`)
}
function purgeRes(r: ResourceCard) { void purgeWith('资源卡', r.title, { resources: [r] }) }
function purgeTask(t: TaskCard) { void purgeWith('任务卡', t.title, { tasks: [t] }) }
function purgeCurio(c: CuriosityCard) { void purgeWith('好奇心卡', c.question, { curiosities: [c] }) }
/** R146：分类分区补上永久删除（原先只有恢复——四类对象两套口径） */
function purgeCat(c: { id: ID; name: string }) { void purgeWith('分类', c.name, { categories: [c as never] }) }
/** R2-⑤：论证卡同口径（永久删除逐次确认 + 回执点名） */
function purgeArg(a: ArgumentCard) { void purgeWith('论证卡', a.title, { argCards: [a] }) }

// ---- 全部恢复 / 清空 ----
/** 恢复是安全动作：不弹确认，但一次动作只报一条账（原实现每条各弹一次 toast，互相顶掉） */
function restoreAll() {
  const cur = tab.value
  const list = cur === 'res' ? res.value : cur === 'task' ? tasks.value : cur === 'cat' ? cats.value : cur === 'arg' ? args.value : curios.value
  if (!list.length) { show('该分区没有可恢复的条目'); return }
  const now = Date.now()
  // ★D1：先给每条拍快照（只读），改动才动手——顺序反了就只能回滚出「改动后的值」
  const snaps = (list as (ResourceCard | TaskCard | CuriosityCard | ArgumentCard)[]).map(x => snapOf(x))
  for (const x of list as { id: ID; deletedAt?: number; updatedAt?: number; convertedAt?: number; convertedTo?: 'task' | 'res' }[]) {
    markLeaving(x.id, x, x.deletedAt)
    x.deletedAt = undefined
    if (x.updatedAt !== undefined) x.updatedAt = now
    /** R167：批量恢复同样撤销转化戳（只对好奇卡存在这两个字段，其余恒为 undefined，无副作用） */
    x.convertedAt = undefined
    x.convertedTo = undefined
  }
  store.persist()
  show(`已恢复 ${list.length} 项（${tabLabelOf(cur)}）· 归属需手动归位的见各条说明`, { label: '撤销', cb: () => {
    // 逐条回滚并如实报数：可能有人在 6 秒窗口内已把其中几项永久删除
    let n = 0
    for (const s of snaps) { unmarkLeaving(s.id); if (rollback(s)) n++ }
    show(n ? `↩ 已撤销恢复 ${n} 项（${tabLabelOf(cur)}）· 回到回收站` : '⚠ 这些项已不在回收站，无法撤销恢复')
  } })
}
function tabLabelOf(k: typeof tab.value) { return k === 'res' ? '资源卡' : k === 'task' ? '任务卡' : k === 'cat' ? '分类' : k === 'arg' ? '论证卡' : '好奇心卡' }
async function purgeAll() {
  const cur = tab.value
  const list = cur === 'res' ? res.value : cur === 'task' ? tasks.value : cur === 'cat' ? cats.value : cur === 'arg' ? args.value : curios.value
  if (!list.length) { show('该分区已是空的'); return }
  if (!(await useConfirm({ title: '清空回收站分区', message: `确定永久删除本分区全部 ${list.length} 项（${tabLabelOf(cur)}）？\n不可恢复，且会一并清除仅被这些卡引用的附件本体。`, confirmText: `清空 ${list.length} 项` }))) return
  const targets: PurgeTargets =
    cur === 'cat' ? { categories: list as never }
    : cur === 'res' ? { resources: list as ResourceCard[] }
    : cur === 'task' ? { tasks: list as TaskCard[] }
    : cur === 'arg' ? { argCards: list as ArgumentCard[] }
    : { curiosities: list as CuriosityCard[] }
  const n = await purge(targets)
  show(n ? `已永久删除 ${n} 项（${tabLabelOf(cur)}）· 不可恢复` : '该分区已是空的')
}
const tabMeta = computed(() => [
  { k: 'res' as const, label: '资源卡', list: res.value, n: res.value.length },
  { k: 'cat' as const, label: '分类', list: cats.value, n: cats.value.length },
  { k: 'task' as const, label: '任务卡', list: tasks.value, n: tasks.value.length },
  { k: 'curio' as const, label: '好奇心卡', list: curios.value, n: curios.value.length },
  { k: 'arg' as const, label: '论证卡', list: args.value, n: args.value.length }
])
/** D1：五个分区的渲染视图 = 真实软删集合 + 淡出缓冲（缓冲行只剩 150ms，期间带 .leaving） */
const resRows = computed(() => withLeaving(res.value))
const taskRows = computed(() => withLeaving(tasks.value))
const curioRows = computed(() => withLeaving(curios.value))
const catRows = computed(() => withLeaving(cats.value))
const argRows = computed(() => withLeaving(args.value))
</script>

<template>
  <div class="rb-page">
    <div class="rb-head">
      <button class="rb-back" @click="router.push('/settings')">← 返回设置</button>
      <div class="rb-title"><Icon name="trash" :size="13"/> 回收站</div>
      <div class="rb-desc">删除的卡片软删除移入此处，可恢复；永久删除不可撤销</div>
      <div class="rb-actions">
        <button class="rb-btn" @click="aiRescue" title="AI 对照现存卡与活跃目标，逐条判定值得恢复/建议清除"><AiEntryButton variant="inline" label="值得捞回" /></button>
        <button class="rb-btn" @click="restoreAll"><Icon name="refresh" :size="13"/> 恢复当前分区全部</button>
        <button class="rb-btn danger" @click="purgeAll"><Icon name="trash" :size="13"/> 清空当前分区</button>
      </div>
    </div>
    <AiSuggestionDrawer v-if="aiJob" :job="aiJob" @close="aiJob = null" />

    <div class="rb-tabs">
      <button v-for="m in tabMeta" :key="m.k" class="rb-tab" :class="{on: tab === m.k}" @click="tab = m.k">
        {{ m.label }} <span class="rb-count">{{ m.n }}</span>
      </button>
    </div>

    <!-- 资源卡 -->
    <div v-if="tab === 'res'" class="rb-list">
      <div v-for="r in resRows" :key="r.id" class="rb-item" :class="{ leaving: isLeaving(r.id) }">
        <div class="rb-item-main">
          <div class="rb-item-title">{{ r.title }}</div>
          <div class="rb-item-meta"><Icon name="folderopen" :size="13"/> {{ wsNameOf(r.workspaceId) }} · {{ catNameOf(r.categoryId || "") }} · <Icon name="clock" :size="13"/> 删除于 {{ fmt(r.deletedAt) }}</div>
        </div>
        <div class="rb-item-ops">
          <button class="rb-btn sm" @click="restoreRes(r)">恢复</button>
          <button class="rb-btn sm danger" @click="purgeRes(r)">永久删除</button>
        </div>
      </div>
      <!-- G3/D3（V3.8.27）：五类共用一个契约，且是"无主行动"特例——
           这里不该催用户"去做点什么"，只说明这是什么、删除物的去向。 -->
            <!-- ★D3（V3.8.37）回收站空态：五处原本逐字相同（"这一类还没有删除项"），
           用户切到任一分区看到的都是同一句话，等于没分区。本批按 tabMeta 的五个分区别写文案。

           ★★否决原文「可在 30 天内找回」——这条不能照抄：
           规范 D3 原文写「删除的任务、好奇与资源可在 30 天内找回」，但**产品里没有这个机制**。
           逐条核过源码：软删只写 deletedAt，全库没有 purge/expire/cleanup/retention 任何定时或过期逻辑，
           也没有任何地方按天数清理；母版里 "30 天" 出现 0 次。
           真实口径是**软删永久保留**，只有用户主动点「永久删除」或「清空回收站」才真正不可逆。
           照抄 30 天等于在空态里对用户撒一个不存在的谎——用户会以为第 31 天卡就没了，
           反而不敢把重要内容放进回收站。改成"没有期限"是把机制说准，不是偷懒。

           ★幽灵按钮按原文 D3 的备选做「回到调度台」：回收站空时唯一合理的事就是离开，
           主行动位留空（D3 原文「无主行动（或回到调度台幽灵按钮）」），不硬凑一个操作。 -->
<EmptyState v-if="!res.length" class="rb-empty" size="page" icon="trash"
title="这台删除过的资源卡会停在这里"
        hint="没有期限——软删不会自己过期。只有你点「永久删除」或清空回收站，卡才真正离开本机。"
        secondary-label="回到调度台" @secondary="router.push('/')" />
    </div>

    <!-- 任务卡 -->
    <div v-else-if="tab === 'task'" class="rb-list">
      <div v-for="t in taskRows" :key="t.id" class="rb-item" :class="{ leaving: isLeaving(t.id) }">
        <div class="rb-item-main">
          <div class="rb-item-title">{{ t.title }}</div>
          <div class="rb-item-meta"><Icon name="target" :size="13"/> {{ metricNameOf(t.metricId) }} · <Icon :name="t.status === 'done' ? 'check' : t.status === 'doing' ? 'half' : 'circle'" :size="11"/>{{ t.status === 'done' ? '已完成' : t.status === 'doing' ? '进行中' : '待开始' }} · <Icon name="clock" :size="13"/> 删除于 {{ fmt(t.deletedAt) }}</div>
        </div>
        <div class="rb-item-ops">
          <button class="rb-btn sm" @click="restoreTask(t)">恢复</button>
          <button class="rb-btn sm danger" @click="purgeTask(t)">永久删除</button>
        </div>
      </div>
      <EmptyState v-if="!tasks.length" class="rb-empty" size="page" icon="trash"
title="这台删除过的任务卡会停在这里"
        hint="没有期限——软删不会自己过期。只有你点「永久删除」或清空回收站，卡才真正离开本机。"
        secondary-label="回到调度台" @secondary="router.push('/')" />
    </div>

    <!-- 好奇心卡 -->
    <div v-else-if="tab === 'curio'" class="rb-list">
      <div v-for="c in curioRows" :key="c.id" class="rb-item" :class="{ leaving: isLeaving(c.id) }">
        <div class="rb-item-main">
          <div class="rb-item-title">{{ c.question }}</div>
          <div class="rb-item-meta">
            <span v-if="c.convertedTo" class="rb-conv">{{ c.convertedTo === 'task' ? '→ 已转为任务' : '→ 已归档为资源' }}（{{ fmt(c.convertedAt) }}）· 恢复 = 撤销这次转化</span>
            <span v-else><Icon name="clock" :size="13"/> 删除于 {{ fmt(c.deletedAt) }}</span>
          </div>
        </div>
        <div class="rb-item-ops">
          <button class="rb-btn sm" @click="restoreCurio(c)">恢复</button>
          <button class="rb-btn sm danger" @click="purgeCurio(c)">永久删除</button>
        </div>
      </div>
      <EmptyState v-if="!curios.length" class="rb-empty" size="page" icon="trash"
title="这台删除过的好奇心卡会停在这里"
        hint="没有期限——软删不会自己过期。只有你点「永久删除」或清空回收站，卡才真正离开本机。"
        secondary-label="回到调度台" @secondary="router.push('/')" />
    </div>

    <!-- R109（F12-b）：分类分区（删除分类/删除策展台/合并重复 均走软删；恢复=清 deletedAt） -->
    <div v-else-if="tab === 'cat'" class="rb-list">
      <div v-for="c in catRows" :key="c.id" class="rb-item" :class="{ leaving: isLeaving(c.id) }">
        <div class="rb-item-main">
          <div class="rb-item-title"><Icon name="folder" :size="13"/> {{ c.name }}</div>
          <div class="rb-item-meta"><Icon name="folder" :size="13"/> {{ wsNameOf(c.workspaceId) }} · <Icon name="clock" :size="13"/> 删除于 {{ fmt(c.deletedAt) }}<span class="rb-note"> · 恢复后其下卡片不会自动归位（仍在待分类/回收站）</span></div>
        </div>
        <div class="rb-item-ops">
          <button class="rb-btn sm" @click="restoreCat(c)">恢复</button>
          <button class="rb-btn sm danger" @click="purgeCat(c)">永久删除</button>
        </div>
      </div>
      <EmptyState v-if="!cats.length" class="rb-empty" size="page" icon="trash"
title="这台删除过的分类会停在这里"
        hint="没有期限——软删不会自己过期。只有你点「永久删除」或清空回收站，卡才真正离开本机。"
        secondary-label="回到调度台" @secondary="router.push('/')" />
    </div>

    <!-- R2-⑤：论证卡分区（台内原生第 4 种卡，软删后与三卡同一条恢复/永久删除通道） -->
    <div v-else-if="tab === 'arg'" class="rb-list">
      <div v-for="a in argRows" :key="a.id" class="rb-item" :class="{ leaving: isLeaving(a.id) }">
        <div class="rb-item-main">
          <div class="rb-item-title"><Icon name="compass" :size="13"/> {{ a.title }}</div>
          <div class="rb-item-meta"><Icon name="folder" :size="13"/> {{ wsNameOf(a.workspaceId) }} · <Icon name="clock" :size="13"/> 删除于 {{ fmt(a.deletedAt) }}<span class="rb-note"> · 论证卡随策展台存续，台若已删需先恢复台</span></div>
        </div>
        <div class="rb-item-ops">
          <button class="rb-btn sm" @click="restoreArg(a)">恢复</button>
          <button class="rb-btn sm danger" @click="purgeArg(a)">永久删除</button>
        </div>
      </div>
      <EmptyState v-if="!args.length" class="rb-empty" size="page" icon="trash"
title="这台删除过的论证卡会停在这里"
        hint="没有期限——软删不会自己过期。只有你点「永久删除」或清空回收站，卡才真正离开本机。"
        secondary-label="回到调度台" @secondary="router.push('/')" />
    </div>

    
  </div>
</template>

<style scoped>
.rb-page { max-width: 860px; margin: 0 auto; padding: 28px 20px 60px; }
.rb-head { margin-bottom: 20px; }
.rb-back { border: 1px solid var(--border); background: var(--surface); color: var(--text-2); border-radius: 8px; padding: 6px 14px; font-size: var(--fs-sub); cursor: pointer; font-family: inherit; margin-bottom: 14px; transition: all var(--dur); }
.rb-back:hover { border-color: var(--accent); color: var(--accent); }
.rb-title { font-size: var(--fs-display); font-weight: 700; color: var(--text); margin-bottom: 6px; }
.rb-desc { font-size: var(--fs-body); color: var(--text-3); margin-bottom: 16px; }
.rb-actions { display: flex; gap: 8px; }
.rb-btn { border: 1px solid var(--border); background: var(--surface); color: var(--text-2); border-radius: 8px; padding: 8px 14px; font-size: var(--fs-body); font-weight: 600; cursor: pointer; font-family: inherit; transition: all var(--dur); }
.rb-btn:hover { border-color: var(--accent); color: var(--accent); }
.rb-btn.sm { padding: 5px 10px; font-size: var(--fs-sub); }
.rb-btn.danger { border-color: var(--danger-border); color: var(--danger); }
.rb-btn.danger:hover { background: var(--danger); color: #fff; }

.rb-tabs { display: flex; gap: 8px; margin-bottom: 14px; }
.rb-tab { flex: 1; padding: 10px 0; border: 1px solid var(--border); background: var(--surface); color: var(--text-2); border-radius: 10px; font-size: var(--fs-body); font-weight: 600; cursor: pointer; font-family: inherit; transition: all var(--dur); }
.rb-tab.on { border-color: var(--accent); background: var(--accent-light); color: var(--accent-ink); }
.rb-count { display: inline-block; min-width: 22px; padding: 1px 7px; background: var(--surface-2); border-radius: 99px; font-size: var(--fs-caption); margin-left: 4px; }

.rb-list { display: flex; flex-direction: column; gap: 8px; }
.rb-item { display: flex; align-items: center; gap: 12px; padding: 12px 14px; background: var(--surface); border: 1px solid var(--border); border-radius: 10px; transition: all var(--dur); }
.rb-item:hover { border-color: color-mix(in srgb, var(--accent) 45%, transparent); }
.rb-item-main { flex: 1; min-width: 0; }
.rb-item-title { font-size: var(--fs-body); font-weight: 600; color: var(--text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; margin-bottom: 3px; }
.rb-item-meta { font-size: var(--fs-sub); color: var(--text-3); }
/* B1-c：说明性后缀弱一档（原两处内联 color） */
.rb-note { color: var(--text-4); }
/* R167：转化出场的卡要读得出"它不是被删掉的，是转出去的"——恢复=撤销这次转化 */
.rb-conv { color: var(--accent); font-weight: 600; }
.rb-item-ops { display: flex; gap: 6px; flex-shrink: 0; }
/* D1（V3.8.39）：恢复行本地淡出 150ms。
   ★与 R153-4「降噪只动字号与间距」不冲突：那条管的是**静态**可读性（不许把正文调成灰到看不清），
   这里是一次性的离场动效——用户已经看到回执、卡片正在离场，透明回落正是「走了」的信号。
   150ms 与 toast 无关，是纯视觉时长：短到不像等待，长到能被眼睛捕捉（≈ 6 帧）。 */
.rb-item.leaving { opacity: 0; pointer-events: none; transition: opacity var(--d1-leave, 150ms) linear; }
/* G3（V3.8.27）：.rb-empty 的视觉已由 EmptyState 接管，class 只留作语义锚点 */
</style>
