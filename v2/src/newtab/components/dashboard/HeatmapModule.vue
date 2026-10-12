<script setup lang="ts">
/**
 * W2（V3.8.2）：年度热力图的**自包含宿主**。
 *
 * 为什么独立成组件：热力图整体从设置页知源仪表盘迁到调度台（今日三件事下方、三卡上方），
 * 但它不是"搬一行模板"——它要一条完整数据桥（useDashboardStats）+ 事件日志（readEventLog + 派生回退）
 * + 链接卡片数 + 全量记录抽屉（承接日详情「查看全部记录 ›」）。把这一坨塞进 CompassHome.vue
 * 会让本就 1,100 行的视图再涨 ~120 行，且 CompassHome 源码里不该出现 readEventLog
 * （R49-3 负断言：调度台视图不直接碰事件日志）。
 *
 * 与设置页的关系：设置页仍保留「概览带 + 复盘段 + 操作记录」，只有热力图主体 + 日详情迁到本组件。
 * 两处各有一份 useDashboardStats 实例（互不影响：年份 / 选中日各自独立）。
 *
 * 数据桥口径（与 GlobalSettings 的仪表盘段同源，刻意重复 ~15 行而非抽 composable——少动判据）：
 *  · 事件日志优先，空日志时回退到卡片时间派生（老数据无 zy_event_log）
 *  · live 取真实在库数，base 由 useDashboardStats 反推（见该文件头注释）
 */
import './dashboard.css'
import { computed, onMounted, ref, shallowRef, watch } from 'vue'
import { useAppStore } from '@/newtab/stores/app'
import type { CardEvent } from '@/shared/utils/eventLog'
import { readEventLog } from '@/shared/utils/eventLog'
import { useDashboardStats } from './useDashboardStats'
import { useDailyLogRequest } from '@/newtab/composables/useDailyLog'
import Heatmap from './Heatmap.vue'
import DashboardLogDrawer, { type LogPreset } from './DashboardLogDrawer.vue'

const store = useAppStore()
const gd = computed(() => store.data!)

const gResLive = computed(() => gd.value.resources.filter(r => !r.deletedAt))
const gTaskLive = computed(() => gd.value.tasks.filter(t => !t.deletedAt))
const gCurioLive = computed(() => gd.value.curiosities.filter(c => !c.deletedAt))
const linkCardCount = computed(() => gResLive.value.filter(r => (r.link || '').trim()).length)

// ---- 事件日志（readEventLog 优先，空日志回退卡片时间派生） ----
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

// ---- 数据桥 + 选中态 ----
const dash = useDashboardStats(
  () => gd.value,
  () => timelineEvents.value,
  () => ({ res: gResLive.value.length, task: gTaskLive.value.length, curio: gCurioLive.value.length })
)
const dashYear = dash.year
const dashSelDay = dash.selDay
const dashStats = dash.stats

/* W5（V3.8.5）#6：品牌区「今日战报」请求消费 —— 置 selDay + 校正年份（跨年历史日也能落到正确年视图）。
   请求是模块级单例，挂载时消费一次、此后 watch 即时消费；选中日同时驱动概览带时间绑定（既有语义，零新机制）。 */
const { pendingDay, consume } = useDailyLogRequest()
function applyDailyLogDay(day: string): void {
  const y = Number(day.slice(0, 4))
  if (y >= 2000 && y <= 2100 && y !== dashYear.value) dashYear.value = y
  dashSelDay.value = day
}
watch(pendingDay, (d) => { if (d) applyDailyLogDay(consume()!) })

// ---- 日详情「查看全部记录 ›」→ 打开全量抽屉并按该日预筛 ----
// ★ W6 增补（用户拍板 2026-10-12）：点「查看全部记录」先关日详情弹窗再开右侧抽屉——
//   两个面板并存会让遮罩叠两层、交互语义含糊（"退出当前弹窗"）。dashSelDay 置 null 即关。
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
  if (d) applyDailyLogDay(d)
})
</script>

<template>
  <div class="dz-heatmap-host">
    <Heatmap
      :stats="dashStats" :year="dashYear" :sel-day="dashSelDay"
      :events="timelineEvents" :live-link="linkCardCount"
      @update:year="dashYear = $event" @update:sel-day="dashSelDay = $event"
      @open-log="onOpenLog" />
    <DashboardLogDrawer :open="logOpen" :events="timelineEvents" :data="gd" :preset="logPreset" @close="logOpen = false" />
  </div>
</template>
