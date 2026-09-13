<script lang="ts">
/** R110-LC：三卡生命周期面板（泛化组件；宿主传 kind 与**真实卡对象数组**） */
import type { ResourceCard, TaskCard, CuriosityCard } from '@/shared/models'
/** 三卡联合（宿主直接传 store 中的活卡引用，面板只发意图、宿主落库——面板不改 props） */
export type LifecycleCard = ResourceCard | TaskCard | CuriosityCard
</script>

<script setup lang="ts">
import { computed, ref } from 'vue'
import Drawer from '@/shared/components/Drawer.vue'
import { lifecycleState, type LifecycleState } from '@/shared/utils/lifecycle'
import { showToast } from '@/shared/components/toast'

const props = defineProps<{
  open: boolean
  kind: LifecycleCard['kind']
  cards: LifecycleCard[]
}>()
const emit = defineEmits<{
  (e: 'close'): void
  /** 下钻定位：宿主关闭面板并定位到该卡（复用各自既有 hl 链路） */
  (e: 'locate', id: string): void
  /** R110-LC：三个写意图——宿主对**真实卡对象**落库 + persist（面板自身不改数据） */
  (e: 'archive', id: string): void
  (e: 'snooze', id: string): void
  (e: 'reactivate', id: string): void
}>()

const TITLES: Record<string, string> = {
  resource: '⏳ 资源生命周期',
  task: '⏳ 任务生命周期',
  curiosity: '⏳ 好奇心生命周期'
}

type Filter = 'active' | 'cooling' | 'archived'
const filter = ref<Filter>('cooling')

interface Entry { card: LifecycleCard; state: LifecycleState; daysIdle: number }
/** 纯计算：不写 ref、不在 computed 内取时间戳存 state（避免自触发重算） */
const entries = computed<Entry[]>(() => {
  const now = Date.now()
  return props.cards.map(card => ({
    card,
    state: lifecycleState(card, now),
    daysIdle: Math.floor((now - lastOf(card)) / 86400_000)
  }))
})

const stats = computed(() => ({
  active: entries.value.filter(x => x.state === 'active').length,
  cooling: entries.value.filter(x => x.state === 'cooling').length,
  archived: entries.value.filter(x => x.state === 'archived').length,
  total: entries.value.length
}))

const visible = computed(() => entries.value.filter(x => x.state === filter.value).sort((a, b) => a.daysIdle - b.daysIdle))

/** 甜甜圈（SVG stroke-dasharray 三段） */
const R = 34
const C = 2 * Math.PI * R
const donut = computed(() => {
  const t = Math.max(stats.value.total, 1)
  const a = (stats.value.active / t) * C
  const c = (stats.value.cooling / t) * C
  const ar = (stats.value.archived / t) * C
  return [
    { cls: 'dn-active', dash: `${a} ${C - a}`, off: 0 },
    { cls: 'dn-cooling', dash: `${c} ${C - c}`, off: -a },
    { cls: 'dn-archived', dash: `${ar} ${C - ar}`, off: -(a + c) }
  ]
})

function setFilter(f: Filter) { filter.value = f }
/** 三卡标题口径：好奇心卡是 question，资源/任务卡是 title */
function titleOf(card: LifecycleCard): string {
  return ('question' in card ? card.question : card.title) || '（无标题）'
}
/** 判定基准时间（与 engine.lastActiveOf 同口径，仅用于展示天数） */
function lastOf(card: LifecycleCard): number {
  const c = card as { lastCalledAt?: number; completedAt?: number }
  return c.lastCalledAt || c.completedAt || card.updatedAt || card.createdAt || 0
}
function onArchive(e: Entry) { emit('archive', e.card.id); showToast(`📦 已归档「${titleOf(e.card).slice(0, 24)}」`) }
function onSnooze(e: Entry) { emit('snooze', e.card.id); showToast('⏳ 已忽略 30 天（延后评估）') }
function onReactivate(e: Entry) { emit('reactivate', e.card.id); showToast(`🔥 「${titleOf(e.card).slice(0, 24)}」已重新激活`) }
function onLocate(e: Entry) { emit('locate', e.card.id) }
function fmtIdle(d: number): string { return d > 0 ? `${d} 天` : '今天' }
/** 任务/好奇心卡都有 status（资源卡无）——模板不能写 TS 断言，故收在这里 */
function isDone(card: LifecycleCard): boolean {
  return (card as { status?: string }).status === 'done'
}
</script>

<template>
  <Drawer :open="open" :title="TITLES[kind] || '⏳ 生命周期'" width="520px" @close="emit('close')">
    <div class="lc-body">
      <!-- 三态统计（R110：可点击下钻=切换列表过滤） -->
      <div class="lc-top">
        <svg width="92" height="92" viewBox="0 0 92 92" class="lc-donut">
          <circle cx="46" cy="46" :r="R" fill="none" stroke="var(--surface-3)" stroke-width="10" />
          <circle v-for="seg in donut" :key="seg.cls" class="lc-dn" :class="seg.cls" cx="46" cy="46" :r="R"
            fill="none" stroke-width="10" :stroke-dasharray="seg.dash" :stroke-dashoffset="seg.off"
            stroke-linecap="butt" transform="rotate(-90 46 46)" />
          <text x="46" y="50" text-anchor="middle" class="lc-dn-num">{{ stats.total }}</text>
        </svg>
        <div class="lc-stats">
          <div class="lc-stat clickable" :class="{ on: filter === 'active' }" @click="setFilter('active')">
            <div class="lc-stat-num">🔥 {{ stats.active }}</div><div class="lc-stat-lab">活跃</div>
          </div>
          <div class="lc-stat clickable" :class="{ on: filter === 'cooling' }" @click="setFilter('cooling')">
            <div class="lc-stat-num">🧊 {{ stats.cooling }}</div><div class="lc-stat-lab">冷却</div>
          </div>
          <div class="lc-stat clickable" :class="{ on: filter === 'archived' }" @click="setFilter('archived')">
            <div class="lc-stat-num">📦 {{ stats.archived }}</div><div class="lc-stat-lab">归档</div>
          </div>
        </div>
      </div>
      <div class="lc-hint">阈值：30 天未活动 → 冷却 · 90 天未活动 → 归档候选 · 点击统计切换列表 · 点击条目定位卡片</div>

      <!-- 列表（当前过滤态） -->
      <div class="lc-list">
        <div v-for="e in visible" :key="e.card.id" class="lc-row clickable" @click="onLocate(e)">
          <div class="lc-row-main">
            <div class="lc-row-title" :class="{ done: isDone(e.card) }">{{ titleOf(e.card) }}</div>
            <div class="lc-row-meta">
              <span class="lc-badge" :class="'lc-' + e.state">{{ e.state === 'active' ? '🔥 活跃' : e.state === 'cooling' ? '🧊 冷却' : '📦 归档' }} {{ fmtIdle(e.daysIdle) }}</span>
            </div>
          </div>
          <div class="lc-row-ops" @click.stop>
            <template v-if="e.state === 'cooling'">
              <button class="lc-op" @click="onArchive(e)">📦 归档</button>
              <button class="lc-op" @click="onSnooze(e)">忽略 30d</button>
            </template>
            <template v-else-if="e.state === 'archived'">
              <button class="lc-op primary" @click="onReactivate(e)">🔥 重新激活</button>
            </template>
          </div>
        </div>
        <div v-if="!visible.length" class="lc-empty">{{ filter === 'archived' ? '归档区是空的——冷却卡的「📦 归档」会把它移到这里' : '该状态下暂无卡片' }}</div>
      </div>
    </div>
  </Drawer>
</template>

<style scoped>
.lc-body { display: flex; flex-direction: column; gap: 12px; }
.lc-top { display: flex; align-items: center; gap: 18px; }
.lc-dn-num { font-size: 15px; font-weight: 700; fill: var(--text); }
.lc-dn.lc-dn-active { stroke: var(--success); }
.lc-dn.lc-dn-cooling { stroke: #E8A33D; }
.lc-dn.lc-dn-archived { stroke: var(--text-4); }
.lc-stats { flex: 1; display: flex; flex-direction: column; gap: 6px; }
.lc-stat { display: flex; align-items: center; gap: 10px; padding: 7px 12px; border-radius: 8px; border: 1px solid transparent; font-size: 12.5px; color: var(--text-2); transition: all .12s; }
.lc-stat.clickable { cursor: pointer; }
.lc-stat.clickable:hover { background: var(--surface-3); }
.lc-stat.on { background: var(--accent-light); border-color: color-mix(in srgb, var(--accent) 30%, transparent); color: var(--accent); font-weight: 600; }
.lc-stat-num { font-variant-numeric: tabular-nums; font-weight: 700; min-width: 44px; }
.lc-stat-lab { flex: 1; }
.lc-hint { font-size: 10.5px; color: var(--text-3); }
.lc-list { display: flex; flex-direction: column; gap: 4px; min-height: 200px; }
.lc-row { display: flex; align-items: center; gap: 10px; padding: 9px 10px; border-radius: 8px; border: 1px solid var(--border); transition: all .12s; }
.lc-row.clickable { cursor: pointer; }
.lc-row.clickable:hover { background: var(--surface-2); border-color: var(--border-strong); }
.lc-row-main { flex: 1; min-width: 0; }
.lc-row-title { font-size: 12.5px; color: var(--text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.lc-row-title.done { text-decoration: line-through; color: var(--text-3); }
.lc-row-meta { margin-top: 2px; }
.lc-badge { font-size: 10px; color: var(--text-3); }
.lc-badge.lc-cooling { color: #E8A33D; }
.lc-badge.lc-archived { color: var(--text-4); }
.lc-row-ops { display: flex; gap: 6px; flex-shrink: 0; }
.lc-op { border: 1px solid var(--border); background: var(--surface); color: var(--text-2); font-size: 11px; border-radius: 6px; padding: 3px 9px; cursor: pointer; font-family: inherit; transition: all .12s; }
.lc-op:hover { border-color: var(--accent); color: var(--accent); }
.lc-op.primary { border-color: var(--accent); background: var(--accent); color: #fff; }
.lc-op.primary:hover { background: var(--accent-hover); }
.lc-empty { padding: 28px 10px; text-align: center; color: var(--text-3); font-size: 12px; }
</style>
