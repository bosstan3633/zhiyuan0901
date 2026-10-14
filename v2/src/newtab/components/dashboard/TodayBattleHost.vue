<script setup lang="ts">
/**
 * ★W12-D（V3.8.16）TodayBattleHost —— 「今日战报」弹窗的**自包含宿主**。
 *
 * 为什么独立成组件：日详情 DayDetail 原生长在 Heatmap.vue 内部（靠 selDay 驱动），
 * 于是「调度台要能弹今日战报」必须连带把整个年度热力图挂上才成立。用户 2026-10-13 拍板
 * 热力图从调度台退役（画像洞察页已全量覆盖），若不解耦，删热力图就会把今日战报一起删掉，
 * 而它要保留 ⇒ 先解耦、再退役。解耦方式照搬 HeatmapModule 那个已被 W2-3 判据认可的
 * 「自包含宿主」模式：数据桥 + 事件日志读取 + 日详情承载全在本组件内，
 * CompassHome 只挂一行、源码里不出现 readEventLog（R49-3 负锚：调度台视图不直接碰事件日志）。
 *
 * 数据桥口径与 HeatmapModule 同源（刻意重复而非抽 composable——少动判据、少改既有断言语义）：
 *  · 事件日志优先，空日志回退卡片时间派生（老数据无 zy_event_log）
 *  · base 由 useDashboardStats 反推
 *  · 打开战报前重读事件日志（keep-alive 下本组件只挂载一次，否则快照冻结在首次挂载那一刻）
 */
import './dashboard.css'
import { computed, onMounted, ref, shallowRef, watch } from 'vue'
import { useAppStore } from '@/newtab/stores/app'
import type { CardEvent } from '@/shared/utils/eventLog'
import { readEventLog } from '@/shared/utils/eventLog'
import { useDashboardStats } from './useDashboardStats'
import { useDailyLogRequest } from '@/newtab/composables/useDailyLog'
import DayDetail from './DayDetail.vue'
import DashboardLogDrawer, { type LogPreset } from './DashboardLogDrawer.vue'
import { todayKey } from '@/shared/utils/reviewReport'

const store = useAppStore()
const gd = computed(() => store.data!)

const gResLive = computed(() => gd.value.resources.filter(r => !r.deletedAt))
const gTaskLive = computed(() => gd.value.tasks.filter(t => !t.deletedAt))
const gCurioLive = computed(() => gd.value.curiosities.filter(c => !c.deletedAt))
const linkCardCount = computed(() => gResLive.value.filter(r => (r.link || '').trim()).length)

// ---- 事件日志（readEventLog 优先，空日志回退卡片时间派生）----
const eventLog = shallowRef<CardEvent[]>([])
const logEmpty = ref(true)
async function refreshEventLog() {
  const log = await readEventLog()
  eventLog.value = log.slice().reverse()
  logEmpty.value = log.length === 0
}
const derivedEvents = computed<CardEvent[]>(() => {
  const out: CardEvent[] = []
  const flat = [
    ...gd.value.resources.map(r => ({ kind: 'resource' as const, id: r.id, title: r.title || '（无标题）', createdAt: r.createdAt || 0, deletedAt: r.deletedAt })),
    ...gd.value.tasks.map(t => ({ kind: 'task' as const, id: t.id, title: t.title || '（无标题）', createdAt: t.createdAt || 0, deletedAt: t.deletedAt })),
    ...gd.value.curiosities.map(c => ({ kind: 'curiosity' as const, id: c.id, title: c.question || '（无标题）', createdAt: c.createdAt || 0, deletedAt: c.deletedAt }))
  ]
  for (const x of flat) {
    if (x.createdAt) out.push({ id: `d-${x.id}-c`, ts: x.createdAt, action: 'create', kind: x.kind, title: x.title, cardId: x.id })
    if (x.deletedAt) out.push({ id: `d-${x.id}-d`, ts: x.deletedAt, action: 'delete', kind: x.kind, title: x.title, cardId: x.id })
  }
  return out.sort((a, b) => b.ts - a.ts)
})
const timelineEvents = computed<CardEvent[]>(() => (logEmpty.value ? derivedEvents.value : eventLog.value))

// ---- 数据桥 + 选中态（不选日 ⇒ 弹窗不显示）----
const dash = useDashboardStats(
  () => gd.value,
  () => timelineEvents.value,
  () => ({ res: gResLive.value.length, task: gTaskLive.value.length, curio: gCurioLive.value.length })
)
const dashYear = dash.year
const dashSelDay = dash.selDay
const dashStats = dash.stats

/** 战报默认打开「今天」。跨年历史日（品牌区「今日战报」之外的入口）会经 pendingDay 校正年份。 */
function applyDay(day: string): void {
  const y = Number(day.slice(0, 4))
  if (y >= 2000 && y <= 2100 && y !== dashYear.value) dashYear.value = y
  dashSelDay.value = day
}
const openToday = () => applyDay(todayKey())

/* useDailyLogRequest 是模块级单例：品牌区 / ⌘K 等外部入口发起的「今日战报」请求由此消费。
   ★打开前必须重读事件日志——本组件走 keep-alive 只挂载一次，否则快照冻结在首次挂载那一刻。 */
const { pendingDay, consume } = useDailyLogRequest()
watch(pendingDay, async (d) => {
  if (!d) return
  await refreshEventLog()
  applyDay(consume()!)
})

// ---- 日详情「查看全部记录 ›」→ 打开全量抽屉并按该日预筛（先关弹窗再开抽屉，遮罩不叠两层）----
const logOpen = ref(false)
const logPreset = ref<LogPreset>({ kind: 'all', action: 'all', from: '', to: '' })
function onOpenLog(day: string) {
  dashSelDay.value = null
  logPreset.value = { kind: 'all', action: 'all', from: day, to: day, note: `来源：日详情「查看全部记录」—— 已按 ${day} 预筛，可自由改条件。` }
  logOpen.value = true
}

onMounted(() => {
  void refreshEventLog()
  const d = consume()
  if (d) applyDay(d)
})

defineExpose({ openToday })
</script>

<template>
  <div class="dz-battle-host">
    <Teleport to="body">
      <div v-if="dashSelDay" class="dz-day-modal-overlay" @click.self="dashSelDay = null">
        <div class="dz-day-modal" role="dialog" aria-modal="true">
          <DayDetail :stats="dashStats" :day="dashSelDay" :events="timelineEvents" :live-link="linkCardCount"
            @close="dashSelDay = null" @open-log="onOpenLog" />
        </div>
      </div>
    </Teleport>
    <DashboardLogDrawer :open="logOpen" :events="timelineEvents" :data="gd" :preset="logPreset" @close="logOpen = false" />
  </div>
</template>