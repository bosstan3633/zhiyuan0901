<script setup lang="ts">
/**
 * W10（V3.9.0）PiYear —— 时间轴模块③ 全年 · YEAR。
 * 口径（v6 原型 §mod-year + T6 决策）：
 *   strip = 全年累计（入台/调出/状态变更/清理）
 *   年度热力图 = 复用 Heatmap.vue（点任意格 → 该日战报）
 *   生命周期 = 复用 LifecyclePanel.vue（T6：并入本段；#lc-sec 锚保留供深链）
 * lifecycle 写操作经 emit 上抛，由宿主持久化。不重复造甜甜圈——LifecyclePanel 自带三态可视化。
 */
import { computed } from 'vue'
import { yearAgg, longestStreak } from '@/shared/utils/reviewReport'
import type { DailyStats } from '@/shared/utils/dailyStats'
import type { CardEvent } from '@/shared/utils/eventLog'
import Heatmap from '@/newtab/components/dashboard/Heatmap.vue'
import LifecyclePanel, { type LifecycleCard } from '@/newtab/components/LifecyclePanel.vue'

const props = defineProps<{
  stats: DailyStats
  year: number
  selDay: string | null
  events: CardEvent[]
  liveLink: number
  lcCards: LifecycleCard[]
  /** 全量事件日志（累计口径）；空日志回退由宿主处理 */
  allEvents: CardEvent[]
}>()

const emit = defineEmits<{
  (e: 'update:year', y: number): void
  (e: 'update:selDay', d: string | null): void
  (e: 'open-battle', day: string): void
  (e: 'open-review'): void
  (e: 'lc-locate', id: string, kind: LifecycleCard['kind']): void
  (e: 'lc-archive', id: string): void
  (e: 'lc-snooze', id: string): void
  (e: 'lc-reactivate', id: string): void
  (e: 'lc-set-days', id: string, days: number | null): void
  (e: 'lc-settings'): void
}>()

const ya = computed(() => yearAgg(props.stats, props.year))
const ls = computed(() => longestStreak(props.stats, props.year))

/** 累计事件统计（全量事件日志；无日志时为 0，UI 显示 0 而非假数据） */
const cum = computed(() => {
  let create = 0, call = 0, status = 0, del = 0
  for (const e of props.allEvents) {
    if (e.action === 'create') create++
    else if (e.action === 'call') call++
    else if (e.action === 'status') status++
    else if (e.action === 'delete' || e.action === 'purge') del++
  }
  return { create, call, status, del }
})
</script>

<template>
  <section class="pi-mod" id="mod-year">
    <div class="pi-mod-h">
      <span class="pi-mod-ico i-year">📅</span>
      <div class="pi-mod-t">
        <h2>这一年，你走过什么<span class="en">YEAR</span></h2>
        <p>全年尺度：热力看分布、生命周期看流转。点任意一天 → 该日战报。</p>
      </div>
      <div class="pi-mod-acts">
        <button class="pi-btn line" @click="emit('open-review')">📈 目标对账</button>
      </div>
    </div>
    <div class="pi-mod-b">
      <div class="pi-strip">
        <span class="pi-strip-lab">累计</span>
        <div class="pi-strip-row">
        <button class="pi-chip up" title="累计入台 · action=create 全量" @click="emit('open-battle', props.selDay || ya.last || '')">
          <span class="v">{{ cum.create.toLocaleString() }}<small>次</small></span><span class="l">入台</span><span class="ar">▸</span>
        </button>
        <button class="pi-chip acc" title="累计调出 · 卡片被打开次数" @click="emit('open-battle', props.selDay || ya.last || '')">
          <span class="v">{{ cum.call.toLocaleString() }}<small>次</small></span><span class="l">调出</span><span class="ar">▸</span>
        </button>
        <button class="pi-chip" title="累计状态变更 · 生命周期迁移" @click="emit('open-battle', props.selDay || ya.last || '')">
          <span class="v">{{ cum.status.toLocaleString() }}<small>次</small></span><span class="l">状态变更</span><span class="ar">▸</span>
        </button>
        <button class="pi-chip bad" title="累计清理 · delete + purge" @click="emit('open-battle', props.selDay || ya.last || '')">
          <span class="v">{{ cum.del.toLocaleString() }}<small>次</small></span><span class="l">清理</span><span class="ar">▸</span>
        </button>
        </div>
      </div>

      <div class="pi-hair"></div>

      <div>
        <div class="pi-sect"><span class="n">1</span><span class="t">年度热力图</span><span class="m">点任意格 → 该日战报</span></div>
        <div class="pi-hmbox">
          <Heatmap :stats="stats" :year="year" :sel-day="selDay" :events="events" :live-link="liveLink"
            @update:year="emit('update:year', $event)" @update:sel-day="emit('update:selDay', $event)"
            @open-log="emit('open-battle', $event)" />
          <div class="pi-hm-legend">
            <span>少</span>
            <span class="s" style="background:var(--heat-0)"></span><span class="s" style="background:var(--heat-1)"></span>
            <span class="s" style="background:var(--heat-2)"></span><span class="s" style="background:var(--heat-3)"></span>
            <span class="s" style="background:var(--heat-4)"></span><span class="s" style="background:var(--heat-5)"></span>
            <span>多</span>
            <span class="hm-stats">活跃 <b>{{ ya.act }}</b> 天 · 最长连续 <b>{{ ls }}</b> 天<template v-if="ya.peak"> · 单日峰值 <b>{{ ya.peak[1] }}</b> 分（{{ ya.peak[0].slice(5) }}）</template></span>
          </div>
        </div>
      </div>

      <div id="lc-sec">
        <div class="pi-sect">
          <span class="n">2</span><span class="t">资源生命周期</span>
          <span class="m">活跃 / 冷却 / 归档 三态</span>
          <button class="pi-btn sm line" style="margin-left:auto" @click="emit('lc-settings')">⚙ 阈值设置</button>
        </div>
        <LifecyclePanel kind="all" :cards="lcCards"
          @locate="(id, kind) => emit('lc-locate', id, kind)"
          @archive="id => emit('lc-archive', id)"
          @snooze="id => emit('lc-snooze', id)"
          @reactivate="id => emit('lc-reactivate', id)"
          @set-days="(id, days) => emit('lc-set-days', id, days)" />
      </div>
    </div>
  </section>
</template>
