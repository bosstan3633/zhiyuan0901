<script setup lang="ts">
import Icon from '@/shared/components/Icon.vue'
import { computed } from 'vue'
import type { AppData } from '@/shared/models'
import PiOverview, { type FocusProjectView } from './PiOverview.vue'
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
  missionText: string
  focusProjects: FocusProjectView[]
  lcCards: LifecycleCard[]
  focusFilter?: 'active' | 'cooling' | 'archived'
}>()
const emit = defineEmits<{
  (e: 'kpi-drill', k: 'total' | 'entropy' | 'support' | 'focus'): void
  (e: 'topic-drill', k: 'topic-all' | 'topic-published' | 'topic-supported' | 'topic-month'): void
  (e: 'goto-compass'): void
  (e: 'open-project', projectId: string): void
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
</script>
<template>
  <div class="pi-card-analysis">
    <PiOverview v-bind="props" @kpi-drill="emit('kpi-drill', $event)" @topic-drill="emit('topic-drill', $event)"
      @goto-compass="emit('goto-compass')" @open-project="emit('open-project', $event)" />
    <section class="pi-mod pi-focus-analysis" aria-label="今日三件事数据分析">
      <div class="pi-mod-h">
        <span class="pi-mod-ico"><Icon name="compass" :size="13" /></span>
        <div class="pi-mod-t"><h2>三件事，是否持续推进<span class="en">DAILY FOCUS</span></h2><p>只分析真实历史槽位；跨日镜像不重复计算，隐藏展示也不抹除记录。</p></div>
        <span class="pi-focus-today">今天完成 {{ focusAnalysis.todayDone }} / {{ focusAnalysis.todayTotal }}</span>
      </div>
      <div class="pi-focus-analysis-grid">
        <div><strong>{{ focusAnalysis.activeDays }}</strong><span>近 30 天安排日</span></div>
        <div><strong>{{ focusAnalysis.cards }}</strong><span>进入三件事的卡片</span></div>
        <div><strong>{{ focusAnalysis.done }}</strong><span>完成槽次</span></div>
        <div><strong>{{ completionRate }}<small>%</small></strong><span>槽次完成率</span></div>
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
.pi-focus-analysis-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; padding: 0 24px 24px; }
.pi-focus-analysis-grid > div { display: grid; gap: 6px; padding: 18px; border: 1px solid var(--border); border-radius: var(--radius-lg); background: var(--surface-2); }
.pi-focus-analysis-grid strong { font-size: var(--fs-headline); font-variant-numeric: tabular-nums; }
.pi-focus-analysis-grid small { font-size: var(--fs-caption); }
.pi-focus-analysis-grid span { color: var(--text-3); font-size: var(--fs-caption); }
@media (max-width: 800px) { .pi-focus-analysis-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); padding-inline: 16px; } }
</style>
