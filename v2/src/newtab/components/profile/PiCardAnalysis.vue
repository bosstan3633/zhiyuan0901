<script setup lang="ts">
import Icon from '@/shared/components/Icon.vue'
import { computed } from 'vue'
import type { AppData } from '@/shared/models'
import PiOverview from './PiOverview.vue'
import LifecyclePanel, { type LifecycleCard } from '@/newtab/components/LifecyclePanel.vue'

const props = defineProps<{
  data: AppData
  total: number
  kindCounts: { res: number; task: number; curio: number; topic: number }
  topicStats: { all: number; published: number; supported: number; month: number }
  entropy: number
  topTags: string[]
  supportRate: number
  focusShare: number
  todayImport: number
  lcCards: LifecycleCard[]
  focusFilter?: 'active' | 'cooling' | 'archived'
}>()
const emit = defineEmits<{
  (e: 'kpi-drill', k: 'total' | 'entropy' | 'support' | 'focus'): void
  (e: 'topic-drill', k: 'topic-all' | 'topic-published' | 'topic-supported' | 'topic-month'): void
  (e: 'lc-locate', id: string, kind: LifecycleCard['kind']): void
  (e: 'lc-archive', id: string): void
  (e: 'lc-snooze', id: string): void
  (e: 'lc-reactivate', id: string): void
  (e: 'lc-set-days', id: string, days: number | null): void
  (e: 'lc-settings'): void
}>()
const focusAnalysis = computed(() => {
  const entries = Object.entries(props.data.dailyFocus || {})
  const today = new Date().toLocaleDateString('sv-SE')
  const last30 = entries.filter(([day]) => day >= new Date(Date.now() - 29 * 86400000).toLocaleDateString('sv-SE'))
  const todaySlots = (props.data.dailyFocus?.[today] || []).filter(slot => !slot.cleared && slot.sourceId)
  const all30 = last30.flatMap(([, slots]) => (slots || []).filter(slot => !slot.cleared && slot.sourceId))
  const ids = new Set(all30.map(slot => `${slot.sourceType}:${slot.sourceId}`))
  return {
    activeDays: last30.filter(([, slots]) => (slots || []).some(slot => !slot.cleared && slot.sourceId)).length,
    planned: all30.length,
    done: all30.filter(slot => slot.done).length,
    cards: ids.size,
    todayDone: todaySlots.filter(slot => slot.done).length,
    todayTotal: todaySlots.length,
  }
})
const completionRate = computed(() => focusAnalysis.value.planned ? Math.round(focusAnalysis.value.done / focusAnalysis.value.planned * 100) : 0)
const focusWeek = computed(() => {
  const out: { day: string; label: string; planned: number; done: number; pct: number }[] = []
  for (let offset = 6; offset >= 0; offset -= 1) {
    const date = new Date(Date.now() - offset * 86400000)
    const key = date.toLocaleDateString('sv-SE')
    const slots = (props.data.dailyFocus?.[key] || []).filter(slot => !slot.cleared && slot.sourceId)
    const done = slots.filter(slot => slot.done).length
    out.push({
      day: key,
      label: offset === 0 ? '今天' : '日一二三四五六'[date.getDay()],
      planned: slots.length,
      done,
      pct: slots.length ? Math.round(done / slots.length * 100) : 0,
    })
  }
  return out
})
</script>
<template>
  <div class="pi-card-analysis">
    <PiOverview
      :total="total" :kind-counts="kindCounts" :topic-stats="topicStats"
      :entropy="entropy" :top-tags="topTags" :support-rate="supportRate"
      :focus-share="focusShare" :today-import="todayImport"
      @kpi-drill="emit('kpi-drill', $event)" @topic-drill="emit('topic-drill', $event)"
    />
    <section class="pi-mod pi-focus-analysis" aria-label="今日三件事数据分析">
      <div class="pi-mod-h">
        <span class="pi-mod-ico"><Icon name="compass" :size="13" /></span>
        <div class="pi-mod-t"><h2>三件事，是否持续推进<span class="en">DAILY FOCUS</span></h2><p>只看真实历史槽位与完成动作；跨日镜像不重复计算，隐藏展示也不抹除记录。</p></div>
        <span class="pi-focus-today">今天完成 {{ focusAnalysis.todayDone }} / {{ focusAnalysis.todayTotal }}</span>
      </div>
      <div class="pi-focus-layout">
        <div class="pi-focus-rate" :style="{ '--focus-rate': completionRate + '%' }">
          <div class="pi-focus-ring">
            <span><strong>{{ completionRate }}</strong><small>%</small></span>
          </div>
          <p><b>近 30 天槽次完成率</b><span>{{ focusAnalysis.done }} 完成 / {{ focusAnalysis.planned }} 安排</span></p>
        </div>
        <div class="pi-focus-facts">
          <div><strong>{{ focusAnalysis.activeDays }}</strong><span>安排日</span><small>近 30 天</small></div>
          <div><strong>{{ focusAnalysis.cards }}</strong><span>进入卡片</span><small>去重后</small></div>
          <div><strong>{{ focusAnalysis.planned }}</strong><span>落位槽次</span><small>真实历史</small></div>
          <div><strong>{{ focusAnalysis.done }}</strong><span>完成槽次</span><small>已勾选</small></div>
        </div>
        <div class="pi-focus-trend" aria-label="近七天三件事完成节奏">
          <header><b>近 7 日节奏</b><span>柱高 = 当日完成率</span></header>
          <div class="pi-focus-bars">
            <div v-for="day in focusWeek" :key="day.day" class="pi-focus-day" :class="{ today: day.day === new Date().toLocaleDateString('sv-SE') }"
              :title="`${day.day} · 完成 ${day.done}/${day.planned}`">
              <span class="pi-focus-bar"><i :style="{ height: (day.planned ? Math.max(8, day.pct) : 3) + '%' }" /></span>
              <small>{{ day.label }}</small>
            </div>
          </div>
        </div>
      </div>
    </section>
    <section class="pi-mod" id="lc-sec">
      <div class="pi-mod-h"><div class="pi-mod-t"><h2>资源生命周期与高价值沉睡证据唤醒</h2><p>活跃 / 冷却 / 归档，把仍有价值的证据重新带回工作面。</p></div><button class="pi-btn sm line pi-lc-settings" @click="emit('lc-settings')"><Icon name="settings" :size="13"/> 阈值设置</button></div>
      <div class="pi-mod-b"><LifecyclePanel kind="all" :cards="lcCards" :focus="focusFilter"
        @locate="(id, kind) => emit('lc-locate', id, kind)" @archive="id => emit('lc-archive', id)"
        @snooze="id => emit('lc-snooze', id)" @reactivate="id => emit('lc-reactivate', id)"
        @set-days="(id, days) => emit('lc-set-days', id, days)" /></div>
    </section>
  </div>
</template>
<style scoped>
.pi-card-analysis { display: grid; gap: 20px; }
.pi-focus-today { margin-left: auto; color: var(--accent-ink); font-size: var(--fs-caption); font-weight: 700; }
.pi-focus-layout {
  display: grid;
  grid-template-columns: minmax(210px, .8fr) minmax(330px, 1.4fr) minmax(280px, 1fr);
  gap: 12px;
  padding: 0 22px 22px;
}
.pi-focus-rate {
  display: flex; align-items: center; gap: 13px; min-width: 0;
  padding: 13px; border: 1px solid var(--border); border-radius: var(--radius-lg);
  background: color-mix(in srgb, var(--accent-light) 28%, var(--surface));
}
.pi-focus-ring {
  display: grid; width: 68px; height: 68px; flex: none; place-items: center;
  border-radius: 50%;
  background: conic-gradient(var(--accent) var(--focus-rate), var(--surface-3) 0);
}
.pi-focus-ring::before { grid-area: 1 / 1; width: 54px; height: 54px; border-radius: 50%; background: var(--surface); content: ''; }
.pi-focus-ring > span { z-index: 1; grid-area: 1 / 1; display: flex; align-items: baseline; gap: 1px; }
.pi-focus-ring strong { font-size: 20px; line-height: 1; font-variant-numeric: tabular-nums; }
.pi-focus-ring small { color: var(--text-3); font-size: var(--fs-micro); }
.pi-focus-rate p { display: flex; min-width: 0; flex-direction: column; gap: 4px; margin: 0; }
.pi-focus-rate b { color: var(--text); font-size: var(--fs-caption); }
.pi-focus-rate span { color: var(--text-3); font-size: var(--fs-micro); }
.pi-focus-facts { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 7px; }
.pi-focus-facts > div {
  display: grid; min-width: 0; grid-template-columns: auto minmax(0, 1fr); align-items: baseline; gap: 2px 7px;
  padding: 9px 11px; border: 1px solid var(--border); border-radius: var(--radius-md); background: var(--surface-2);
}
.pi-focus-facts strong { font-size: var(--fs-headline); font-variant-numeric: tabular-nums; }
.pi-focus-facts span { color: var(--text-2); font-size: var(--fs-caption); }
.pi-focus-facts small { grid-column: 1 / -1; color: var(--text-4); font-size: var(--fs-micro); }
.pi-focus-trend { display: flex; flex-direction: column; gap: 8px; padding: 11px 12px; border: 1px solid var(--border); border-radius: var(--radius-lg); background: var(--surface-2); }
.pi-focus-trend header { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; }
.pi-focus-trend header b { color: var(--text); font-size: var(--fs-caption); }
.pi-focus-trend header span { color: var(--text-4); font-size: var(--fs-micro); }
.pi-focus-bars { display: grid; min-height: 76px; grid-template-columns: repeat(7, minmax(0, 1fr)); align-items: end; gap: 5px; }
.pi-focus-day { display: flex; min-width: 0; flex-direction: column; align-items: center; gap: 4px; height: 100%; }
.pi-focus-bar { display: flex; width: 100%; height: 58px; align-items: flex-end; overflow: hidden; border-radius: 6px 6px 3px 3px; background: var(--surface-3); }
.pi-focus-bar i { display: block; width: 100%; min-height: 2px; border-radius: 6px 6px 3px 3px; background: var(--accent); transition: height var(--dur-fast); }
.pi-focus-day.today .pi-focus-bar i { background: var(--accent-ink); }
.pi-focus-day small { color: var(--text-3); font-size: var(--fs-micro); }
.pi-focus-day.today small { color: var(--accent-ink); font-weight: 700; }
@media (max-width: 1050px) {
  .pi-focus-layout { grid-template-columns: minmax(220px, .9fr) minmax(0, 1.2fr); }
  .pi-focus-trend { grid-column: 1 / -1; }
}
@media (max-width: 720px) {
  .pi-focus-layout { grid-template-columns: 1fr; padding-inline: 16px; }
  .pi-focus-trend { grid-column: auto; }
  .pi-focus-today { width: 100%; margin-left: 0; }
}
</style>
