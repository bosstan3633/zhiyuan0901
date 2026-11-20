<script setup lang="ts">
import { computed, ref } from 'vue'
import Icon from '@/shared/components/Icon.vue'
import EmptyState from '@/shared/components/EmptyState.vue'
import { emitOpenDrawer } from '@/shared/utils/bus'
import { recordCardOpen } from '@/shared/storage/stats'
import { scheduleCardDate } from '@/shared/storage/planSchedule'
import { showToast } from '@/shared/components/toast'
import { useAppStore } from '../../stores/app'
import { CURIOSITY_STATUS, useCuriosity, type CuriStatus } from '../../stores/curiosity'
import type { CuriosityCard } from '@/shared/models'

const store = useAppStore()
const { curiosities, setStatus } = useCuriosity()
const search = ref('')
const statusFilter = ref<CuriStatus | 'all'>('all')
const viewMode = ref<'calendar' | 'board'>('calendar')
const listCollapsed = ref(false)
const monthCursor = ref(new Date(new Date().getFullYear(), new Date().getMonth(), 1, 12))
const dragId = ref('')
const overKey = ref('')
const overStatus = ref<CuriStatus | ''>('')

const live = computed(() =>
  curiosities.value
    .filter(card => !card.lifecycleArchived)
    .slice()
    .sort((a, b) => (Number(b.pinned) - Number(a.pinned)) || ((b.createdAt || 0) - (a.createdAt || 0))))

const filtered = computed(() => {
  const query = search.value.trim().toLowerCase()
  return live.value
    .filter(card => statusFilter.value === 'all' || card.status === statusFilter.value)
    .filter(card => !query || card.question.toLowerCase().includes(query))
})

const counts = computed(() => {
  const out: Record<string, number> = { all: live.value.length }
  for (const card of live.value) out[card.status] = (out[card.status] || 0) + 1
  return out
})

const scheduled = computed(() => filtered.value.filter(card => !!card.dueDate))
const pending = computed(() => filtered.value.filter(card => !card.dueDate))
const monthPrefix = computed(() => dateKey(monthCursor.value).slice(0, 7))
const monthTitle = computed(() => `${monthCursor.value.getFullYear()} 年 ${monthCursor.value.getMonth() + 1} 月`)
const monthScheduled = computed(() => scheduled.value.filter(card => (card.dueDate || '').startsWith(monthPrefix.value)))

const byDay = computed(() => {
  const map = new Map<string, CuriosityCard[]>()
  for (const card of scheduled.value) {
    if (!card.dueDate) continue
    const rows = map.get(card.dueDate) || []
    rows.push(card)
    map.set(card.dueDate, rows)
  }
  return map
})

const days = computed(() => {
  const first = monthCursor.value
  const start = new Date(first)
  start.setDate(first.getDate() - ((first.getDay() + 6) % 7))
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start)
    date.setDate(start.getDate() + index)
    const key = dateKey(date)
    return {
      key,
      day: date.getDate(),
      inMonth: date.getMonth() === first.getMonth(),
      today: key === dateKey(new Date()),
      cards: byDay.value.get(key) || [],
    }
  })
})

const boardColumns = computed(() =>
  (Object.keys(CURIOSITY_STATUS) as CuriStatus[]).map(status => ({
    status,
    meta: CURIOSITY_STATUS[status],
    cards: filtered.value
      .filter(card => card.status === status)
      .slice()
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)),
  })))

function dateKey(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function shortDate(value?: string): string {
  if (!value) return '未落图'
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  return match ? `${Number(match[2])}/${Number(match[3])}` : value
}

function shiftMonth(delta: number): void {
  monthCursor.value = new Date(monthCursor.value.getFullYear(), monthCursor.value.getMonth() + delta, 1, 12)
}

function goToday(): void {
  const now = new Date()
  monthCursor.value = new Date(now.getFullYear(), now.getMonth(), 1, 12)
}

function openCard(card: CuriosityCard): void {
  recordCardOpen(store.data!, card)
  store.persistHot()
  emitOpenDrawer({ kind: 'curio', id: card.id })
}

function onDragStart(event: DragEvent, card: CuriosityCard): void {
  dragId.value = card.id
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', card.id)
  }
}

function scheduleOn(day: string): void {
  overKey.value = ''
  const card = filtered.value.find(row => row.id === dragId.value)
  dragId.value = ''
  if (!card) return
  if (scheduleCardDate(store.data!, card, day, { source: 'calendar' })) {
    store.persist()
    showToast(`已安排到 ${day.slice(5, 7)} 月 ${day.slice(8, 10)} 日`)
  }
}

function clearDue(card: CuriosityCard): void {
  if (!card.dueDate) return
  scheduleCardDate(store.data!, card, undefined, { source: 'calendar' })
  store.persist()
  showToast('已取消计划执行日期，回到未落图')
}

function changeStatus(status: CuriStatus): void {
  overStatus.value = ''
  const card = live.value.find(row => row.id === dragId.value)
  dragId.value = ''
  if (!card || card.status === status) return
  setStatus(card.id, status)
  showToast(`已改为${CURIOSITY_STATUS[status].label}`)
}

function toggleStatus(card: CuriosityCard): void {
  const next: CuriStatus = card.status === 'done' ? 'todo' : 'done'
  setStatus(card.id, next)
}

function statusLabel(status: CuriStatus): string {
  return CURIOSITY_STATUS[status].label
}

function resetForFresh(): void {
  search.value = ''
  statusFilter.value = 'all'
  viewMode.value = 'calendar'
  listCollapsed.value = false
}

defineExpose({ resetForFresh, openDetail: (id: string) => {
  const card = live.value.find(row => row.id === id)
  if (card) openCard(card)
} })
</script>

<template>
  <div class="curio-workbench" :class="{ 'list-hidden': listCollapsed }">
    <header class="cw-toolbar">
      <label class="cw-search">
        <Icon name="search" :size="13" />
        <input v-model="search" placeholder="搜索好奇心…" aria-label="搜索好奇心">
      </label>
      <select v-model="statusFilter" aria-label="按好奇心状态筛选">
        <option value="all">全部状态（{{ counts.all || 0 }}）</option>
        <option v-for="(meta, key) in CURIOSITY_STATUS" :key="key" :value="key">{{ meta.label }}（{{ counts[key] || 0 }}）</option>
      </select>
      <div class="cw-view-switch" role="group" aria-label="好奇心视图">
        <button type="button" :class="{ on: viewMode === 'calendar' }" @click="viewMode = 'calendar'">日历</button>
        <button type="button" :class="{ on: viewMode === 'board' }" @click="viewMode = 'board'">看板</button>
      </div>
      <button v-if="listCollapsed" class="cw-expand" type="button" @click="listCollapsed = false">
        <Icon name="arrowright" :size="12" /> 展开清单
      </button>
    </header>

    <div class="cw-main">
      <aside v-if="!listCollapsed" class="cw-pool">
        <header class="cw-pool-head">
          <div>
            <b>好奇心清单</b>
            <span>{{ filtered.length }} 张 · {{ pending.length }} 未落图</span>
          </div>
          <button class="cw-collapse" type="button" @click="listCollapsed = true"><Icon name="arrowleft" :size="11" /> 折叠</button>
        </header>
        <div class="cw-pool-list">
          <article
            v-for="card in filtered"
            :key="card.id"
            class="cw-pool-item"
            draggable="true"
            tabindex="0"
            @dragstart="onDragStart($event, card)"
            @dragend="dragId = ''; overKey = ''; overStatus = ''"
            @click="openCard(card)"
            @keydown.enter.prevent="openCard(card)"
          >
            <button class="cw-check" :class="{ done: card.status === 'done' }" type="button" :aria-label="card.status === 'done' ? '恢复待探索' : '标记已求证'" @click.stop="toggleStatus(card)">
              <Icon v-if="card.status === 'done'" name="check" :size="9" />
            </button>
            <span class="cw-copy">
              <b><Icon v-if="card.pinned" name="pin" :size="10" />{{ card.question }}</b>
              <small>
                <span class="cw-status" :class="'is-' + card.status">{{ statusLabel(card.status) }}</span>
                <span class="cw-date" :class="{ scheduled: !!card.dueDate }"><Icon name="calendar" :size="10" />{{ shortDate(card.dueDate) }}</span>
              </small>
            </span>
          </article>
          <EmptyState v-if="!filtered.length" size="inline" icon="bulb" title="没有匹配的好奇心" hint="调整状态或搜索条件。" />
        </div>
      </aside>

      <section v-if="viewMode === 'calendar'" class="cw-calendar" aria-label="好奇心日历">
        <header class="cw-cal-head">
          <div>
            <b>{{ monthTitle }}</b>
            <span>本月已落图 {{ monthScheduled.length }} 张 · 拖动卡片安排日期</span>
          </div>
          <div class="cw-cal-actions">
            <button type="button" aria-label="上个月" @click="shiftMonth(-1)"><Icon name="arrowleft" :size="14" /></button>
            <button type="button" @click="goToday">今天</button>
            <button type="button" aria-label="下个月" @click="shiftMonth(1)"><Icon name="arrowright" :size="14" /></button>
          </div>
        </header>
        <div class="cw-weekdays"><span v-for="day in ['一','二','三','四','五','六','日']" :key="day">周{{ day }}</span></div>
        <div class="cw-grid">
          <div
            v-for="cell in days"
            :key="cell.key"
            class="cw-day"
            :class="{ outside: !cell.inMonth, today: cell.today, over: overKey === cell.key }"
            @dragover.prevent
            @dragenter.prevent="overKey = cell.key"
            @dragleave.self="overKey = ''"
            @drop.prevent="scheduleOn(cell.key)"
          >
            <header><span>{{ cell.day }}</span><em v-if="cell.cards.length">{{ cell.cards.length }}</em></header>
            <div class="cw-day-list">
              <article
                v-for="card in cell.cards.slice(0, 3)"
                :key="card.id"
                class="cw-chip"
                :class="'is-' + card.status"
                draggable="true"
                role="button"
                tabindex="0"
                :title="card.question"
                @dragstart="onDragStart($event, card)"
                @dragend="dragId = ''"
                @click="openCard(card)"
                @keydown.enter.prevent="openCard(card)"
                @keydown.space.prevent="openCard(card)"
              >
                <span>{{ card.question }}</span>
                <button type="button" title="取消计划日期" @click.stop="clearDue(card)"><Icon name="x" :size="9" /></button>
              </article>
              <small v-if="cell.cards.length > 3" class="cw-more">+{{ cell.cards.length - 3 }}</small>
            </div>
          </div>
        </div>
      </section>

      <section v-else class="cw-board" aria-label="好奇心看板">
        <section
          v-for="column in boardColumns"
          :key="column.status"
          class="cw-board-col"
          :class="['is-' + column.status, { over: overStatus === column.status }]"
          @dragover.prevent
          @dragenter.prevent="overStatus = column.status"
          @dragleave.self="overStatus = ''"
          @drop.prevent="changeStatus(column.status)"
        >
          <header>
            <span class="cw-dot" />
            <b>{{ column.meta.label }}</b>
            <em>{{ column.cards.length }}</em>
          </header>
          <div class="cw-board-list">
            <article
              v-for="card in column.cards"
              :key="card.id"
              class="cw-board-card"
              draggable="true"
              role="button"
              tabindex="0"
              @dragstart="onDragStart($event, card)"
              @dragend="dragId = ''; overStatus = ''"
              @click="openCard(card)"
              @keydown.enter.prevent="openCard(card)"
              @keydown.space.prevent="openCard(card)"
            >
              <div class="cw-board-title">{{ card.question }}</div>
              <footer>
                <span :class="{ scheduled: !!card.dueDate }"><Icon name="calendar" :size="11" />{{ shortDate(card.dueDate) }}</span>
              </footer>
            </article>
            <div v-if="!column.cards.length" class="cw-board-empty">拖入卡片改变状态</div>
          </div>
        </section>
      </section>
    </div>
  </div>
</template>

<style scoped>
.curio-workbench { display: flex; flex-direction: column; gap: 10px; padding: 12px; }
.cw-toolbar { display: flex; align-items: center; gap: 7px; flex-wrap: wrap; padding: 8px; border: 1px solid var(--border); border-radius: var(--radius-md); background: var(--surface-2); }
.cw-search { display: flex; flex: 1; min-width: 200px; align-items: center; gap: 6px; padding: 0 9px; border: 1px solid var(--border); border-radius: var(--radius-sm); background: var(--surface); color: var(--text-3); }
.cw-search input { flex: 1; min-width: 0; min-height: 31px; border: 0; outline: 0; background: transparent; color: var(--text); font: inherit; font-size: var(--fs-caption); }
.cw-toolbar select { min-height: 31px; padding: 4px 8px; border: 1px solid var(--border); border-radius: var(--radius-sm); background: var(--surface); color: var(--text-2); font: inherit; font-size: var(--fs-caption); }
.cw-view-switch { display: inline-flex; gap: 2px; padding: 2px; border: 1px solid var(--border); border-radius: var(--radius-sm); background: var(--surface); }
.cw-view-switch button { min-height: 25px; padding: 0 10px; border: 0; border-radius: 5px; background: transparent; color: var(--text-3); font: inherit; font-size: var(--fs-micro); font-weight: 650; cursor: pointer; }
.cw-view-switch button.on { background: var(--accent-light); color: var(--accent-ink); }
.cw-expand { display: inline-flex; align-items: center; gap: 4px; min-height: 28px; padding: 0 9px; border: 1px solid var(--border); border-radius: 8px; background: var(--surface); color: var(--text-2); font: inherit; font-size: var(--fs-micro); cursor: pointer; }
.cw-main { display: grid; grid-template-columns: minmax(250px, 310px) minmax(0, 1fr); gap: 10px; min-height: 580px; }
.list-hidden .cw-main { grid-template-columns: minmax(0, 1fr); }
.cw-pool { display: flex; min-width: 0; flex-direction: column; overflow: hidden; border: 1px solid var(--border); border-radius: var(--radius-xl); background: var(--surface); }
.cw-pool-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 11px 12px; border-bottom: 1px solid var(--border); }
.cw-pool-head b { display: block; color: var(--text); font-size: var(--fs-body); }
.cw-pool-head span { display: block; margin-top: 2px; color: var(--text-3); font-size: var(--fs-micro); }
.cw-collapse { display: inline-flex; align-items: center; gap: 3px; min-height: 26px; padding: 0 7px; border: 1px solid var(--border); border-radius: 7px; background: var(--surface); color: var(--text-3); font: inherit; font-size: var(--fs-micro); cursor: pointer; }
.cw-pool-list { flex: 1; min-height: 0; overflow: auto; padding: 7px; }
.cw-pool-item { display: grid; grid-template-columns: 18px minmax(0, 1fr); align-items: start; gap: 7px; padding: 9px 7px; border: 1px solid transparent; border-radius: 9px; cursor: pointer; }
.cw-pool-item:hover { border-color: var(--border); background: var(--surface-2); }
.cw-check { display: inline-grid; width: 17px; height: 17px; place-items: center; margin-top: 2px; padding: 0; border: 1.5px solid var(--border-strong); border-radius: 5px; background: var(--surface); color: #fff; cursor: pointer; }
.cw-check.done { border-color: var(--success, #52a46a); background: var(--success, #52a46a); }
.cw-copy { display: flex; min-width: 0; flex-direction: column; gap: 3px; }
.cw-copy b { display: flex; gap: 4px; overflow: hidden; color: var(--text); font-size: var(--fs-sub); line-height: 1.45; text-overflow: ellipsis; white-space: nowrap; }
.cw-copy b :deep(svg) { flex: none; margin-top: 3px; color: var(--accent); }
.cw-copy small { display: flex; align-items: center; gap: 6px; color: var(--text-3); font-size: var(--fs-micro); }
.cw-status { padding: 1px 6px; border-radius: 99px; background: var(--surface-2); }
.cw-status.is-doing { background: var(--accent-light); color: var(--accent-ink); }
.cw-status.is-done { background: var(--tag-success-bg, #e8f5e9); color: var(--tag-success-text, #2e7d32); }
.cw-date { display: inline-flex; align-items: center; gap: 3px; }
.cw-date.scheduled { color: var(--accent-ink); }
.cw-calendar { display: flex; min-width: 0; flex-direction: column; overflow: hidden; border: 1px solid var(--border); border-radius: var(--radius-xl); background: var(--surface); }
.cw-cal-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 11px 12px; border-bottom: 1px solid var(--border); }
.cw-cal-head b { display: block; color: var(--text); font-size: var(--fs-body); }
.cw-cal-head span { display: block; margin-top: 2px; color: var(--text-3); font-size: var(--fs-micro); }
.cw-cal-actions { display: flex; gap: 4px; }
.cw-cal-actions button { min-height: 28px; padding: 0 9px; border: 1px solid var(--border); border-radius: 7px; background: var(--surface); color: var(--text-2); font: inherit; font-size: var(--fs-micro); cursor: pointer; }
.cw-weekdays { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); border-bottom: 1px solid var(--border); background: var(--surface-2); }
.cw-weekdays span { padding: 6px 8px; color: var(--text-3); font-size: var(--fs-micro); text-align: center; }
.cw-grid { display: grid; flex: 1; grid-template-columns: repeat(7, minmax(0, 1fr)); grid-template-rows: repeat(6, minmax(76px, 1fr)); }
.cw-day { min-width: 0; border-right: 1px solid var(--border); border-bottom: 1px solid var(--border); background: var(--surface); }
.cw-day:nth-child(7n) { border-right: 0; }
.cw-day.outside { background: var(--surface-2); opacity: 0.56; }
.cw-day.today { box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--accent) 45%, transparent); }
.cw-day.over { background: var(--accent-light); }
.cw-day > header { display: flex; align-items: center; justify-content: space-between; padding: 4px 6px; color: var(--text-3); font-size: var(--fs-micro); }
.cw-day > header em { font-style: normal; }
.cw-day-list { display: flex; flex-direction: column; gap: 2px; padding: 0 4px 4px; }
.cw-chip { display: flex; align-items: center; gap: 3px; padding: 2px 4px; border-left: 2px solid var(--border-strong); border-radius: 4px; background: var(--surface-2); color: var(--text-2); font-size: var(--fs-tiny); cursor: grab; }
.cw-chip.is-doing { border-left-color: var(--accent); }
.cw-chip.is-done { border-left-color: var(--success, #52a46a); opacity: 0.7; }
.cw-chip.is-shelf { border-left-color: var(--border-strong); }
.cw-chip span { min-width: 0; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.cw-chip button { flex: none; padding: 0; border: 0; background: none; color: var(--text-2); cursor: pointer; }
.cw-more { padding-left: 4px; color: var(--text-3); font-size: var(--fs-tiny); }
.cw-board { display: grid; grid-auto-columns: minmax(210px, 1fr); grid-auto-flow: column; gap: 9px; min-height: 580px; overflow-x: auto; }
.cw-board-col { display: flex; min-height: 580px; flex-direction: column; overflow: hidden; border: 1px solid var(--border); border-radius: var(--radius-xl); background: var(--surface); }
.cw-board-col.over { border-color: var(--accent); box-shadow: inset 0 0 0 1px var(--accent); }
.cw-board-col > header { display: flex; align-items: center; gap: 6px; padding: 10px 12px; border-bottom: 1px solid var(--border); }
.cw-dot { width: 8px; height: 8px; border-radius: 99px; background: var(--text-3); }
.cw-board-col.is-doing .cw-dot { background: var(--accent); }
.cw-board-col.is-done .cw-dot { background: var(--success, #52a46a); }
.cw-board-col header b { flex: 1; color: var(--text); font-size: var(--fs-caption); }
.cw-board-col header em { color: var(--text-3); font-size: var(--fs-micro); font-style: normal; }
.cw-board-list { display: flex; flex: 1; min-height: 0; flex-direction: column; gap: 6px; overflow: auto; padding: 8px; }
.cw-board-card { padding: 9px; border: 1px solid var(--border); border-radius: 10px; background: var(--surface-2); cursor: pointer; }
.cw-board-card:hover { background: var(--surface); box-shadow: var(--shadow-sm); }
.cw-board-title { color: var(--text); font-size: var(--fs-sub); font-weight: 650; line-height: 1.5; }
.cw-board-card footer { margin-top: 7px; color: var(--text-3); font-size: var(--fs-micro); }
.cw-board-card footer span { display: inline-flex; align-items: center; gap: 4px; }
.cw-board-card footer span.scheduled { color: var(--accent-ink); }
.cw-board-empty { display: grid; min-height: 80px; place-items: center; border: 1px dashed var(--border); border-radius: 9px; color: var(--text-4); font-size: var(--fs-caption); }
@media (max-width: 900px) {
  .cw-main { grid-template-columns: minmax(0, 1fr); }
  .cw-pool { max-height: 320px; }
}
</style>
