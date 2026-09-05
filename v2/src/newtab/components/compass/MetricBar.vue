<script setup lang="ts">
/**
 * R49-C1 方向台 · 指标条（方向状态）
 * 4 格：DHI 方向契合度 / WCE 好奇探索 / WRR 资源复用 / 偏航行动
 * 前三项复用 useCompass().northStarMetrics 三档口径（日/周/累计）；偏航=未关联项目的活跃任务数
 * 「详细指标」下钻抽屉复用 NorthStarPanel 完整六指标（北极星随改版收进下钻）
 */
import { ref, computed } from 'vue'
import { useAppStore } from '../../stores/app'
import { useCompass } from '../../stores/compass'
import NorthStarPanel from './NorthStarPanel.vue'

const store = useAppStore()
const { d, northStarMetrics, offCourseCount } = useCompass()

const period = ref<'day' | 'week' | 'all'>('day')
const m = computed(() => northStarMetrics(period.value))

const periodLabel = computed(() => (period.value === 'day' ? '今日' : period.value === 'week' ? '本周' : '累计'))
function setPeriod(p: 'day' | 'week' | 'all') { period.value = p }

/** WRR 主数字（纯数字，供 18px 焦点） */
const wrrMain = computed(() => {
  const s = d.value.stats?.wrr
  if (period.value === 'day') {
    const sot = new Date(); sot.setHours(0, 0, 0, 0)
    return d.value.resources.filter(r => !r.deletedAt && (r.lastCalledAt || 0) >= sot.getTime()).length
  }
  if (period.value === 'week') return s?.thisWeekUsage ?? 0
  return s?.totalCumulativeUsage ?? 0
})

/** WCE 新增数（周期内捕获的好奇心数） */
const wceNew = computed(() => {
  const days = period.value === 'day' ? 1 : period.value === 'week' ? 7 : 9999
  return d.value.curiosities.filter(c => !c.deletedAt && Date.now() - c.createdAt < days * 86400_000).length
})

/** DHI 数值焦点：清晰=100 / 关注=50+ / 模糊=<50 / —（无投射项目） */
const dhiMain = computed(() => {
  const sub = m.value.dhi.sub || ''
  const mt = sub.match(/(\d+)已投射·(\d+)在轨/)
  if (!mt) return '—'
  const pinned = Number(mt[1]); const active = Number(mt[2])
  if (!pinned) return '—'
  return Math.round((active / pinned) * 100) + '%'
})
const dhiState = computed(() => {
  const label = m.value.dhi.label
  return label === '清晰' ? 'ok' : label === '关注' ? 'mid' : label === '—' ? 'none' : 'warn'
})

/** 下钻：完整北极星（抽屉内含三档联动与新增/删除卡） */
const drillOpen = ref(false)
</script>

<template>
  <div class="metric-bar">
    <div class="mb-cells">
      <div class="mb-cell" :class="'st-' + dhiState" title="DHI 方向契合度 = 已投射项目中周期窗口内有任务推进的占比">
        <div class="mb-label">DHI 方向契合度</div>
        <div class="mb-num">{{ dhiMain }}</div>
        <div class="mb-sub">{{ m.dhi.label }} · {{ m.dhi.sub }}</div>
      </div>
      <div class="mb-cell" title="WCE 好奇探索率 = 探索中+已求证的好奇心数">
        <div class="mb-label">WCE 好奇探索</div>
        <div class="mb-num">{{ (m.wce.label || '').replace('项激活', '') || 0 }}</div>
        <div class="mb-sub">激活项 · {{ periodLabel }}新增 {{ wceNew }}</div>
      </div>
      <div class="mb-cell" title="WRR 资源复用 = 资源卡被打开次数">
        <div class="mb-label">WRR 资源复用</div>
        <div class="mb-num">{{ wrrMain }}</div>
        <div class="mb-sub">{{ m.wrr.sub }}</div>
      </div>
      <div class="mb-cell" :class="{ 'st-warn': offCourseCount() > 0 }" title="偏航行动 = 未关联项目的活跃任务数">
        <div class="mb-label">偏航行动</div>
        <div class="mb-num">{{ offCourseCount() }}</div>
        <div class="mb-sub">未关联项目的活跃任务</div>
      </div>
    </div>
    <div class="mb-side">
      <div class="mb-period">
        <span :class="{ on: period === 'day' }" @click="setPeriod('day')">日</span>
        <span :class="{ on: period === 'week' }" @click="setPeriod('week')">周</span>
        <span :class="{ on: period === 'all' }" @click="setPeriod('all')">累计</span>
      </div>
      <button class="mb-drill" @click="drillOpen = true">📊 详细指标</button>
    </div>
  </div>

  <!-- 详细指标下钻抽屉（完整北极星） -->
  <Transition name="fade">
    <div v-if="drillOpen" class="mb-overlay" @click="drillOpen = false" />
  </Transition>
  <Transition name="pop">
    <div v-if="drillOpen" class="mb-drawer">
      <div class="mb-drawer-head">
        <span>📊 方向状态 · 完整指标</span>
        <span class="mb-drawer-close" @click="drillOpen = false">×</span>
      </div>
      <div class="mb-drawer-body">
        <NorthStarPanel />
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.metric-bar { display: flex; align-items: stretch; gap: 12px; }
.mb-cells { flex: 1; display: grid; grid-template-columns: repeat(4, 1fr); gap: 1px; background: var(--border); border: 1px solid var(--border); border-radius: var(--radius-sm); overflow: hidden; }
.mb-cell { background: var(--surface); padding: 12px 16px; display: flex; flex-direction: column; gap: 3px; }
.mb-label { font-size: 10.5px; font-weight: 600; color: var(--text-3); letter-spacing: .5px; }
.mb-num { font-size: 20px; font-weight: 700; color: var(--text); font-variant-numeric: tabular-nums; line-height: 1.25; }
.mb-cell.st-ok .mb-num { color: var(--success); }
.mb-cell.st-mid .mb-num { color: var(--text); }
.mb-cell.st-warn .mb-num { color: var(--tag-warn-text); }
.mb-cell.st-none .mb-num { color: var(--text-4); }
.mb-sub { font-size: 10px; color: var(--text-3); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.mb-side { display: flex; flex-direction: column; align-items: flex-end; justify-content: center; gap: 7px; flex-shrink: 0; }
.mb-period { display: flex; border: 1px solid var(--border); border-radius: 8px; overflow: hidden; }
.mb-period span { padding: 5px 12px; font-size: 11.5px; color: var(--text-2); cursor: pointer; transition: all .12s; }
.mb-period span + span { border-left: 1px solid var(--border); }
.mb-period span:hover { background: var(--surface-3); }
.mb-period span.on { background: var(--accent-light); color: var(--accent); font-weight: 600; }
.mb-drill { border: 1px solid var(--border); background: var(--surface); color: var(--text-2); font-size: 11.5px; border-radius: 8px; padding: 5px 12px; cursor: pointer; font-family: inherit; transition: all .15s; }
.mb-drill:hover { border-color: var(--accent); color: var(--accent); }

/* 下钻抽屉 */
.mb-overlay { position: fixed; inset: 0; background: rgba(0,0,0,.25); z-index: 210; }
.mb-drawer { position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 640px; max-width: 94vw; max-height: 80vh; background: var(--surface); border-radius: var(--radius); box-shadow: var(--shadow-lg); z-index: 211; display: flex; flex-direction: column; overflow: hidden; }
.mb-drawer-head { padding: 14px 20px; border-bottom: 1px solid var(--border); display: flex; align-items: center; font-size: 14px; font-weight: 600; }
.mb-drawer-head span:first-child { flex: 1; }
.mb-drawer-close { width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; border-radius: 6px; cursor: pointer; color: var(--text-3); font-size: 17px; }
.mb-drawer-close:hover { background: var(--surface-3); color: var(--text); }
.mb-drawer-body { flex: 1; overflow-y: auto; padding: 14px 20px; }

.fade-enter-active, .fade-leave-active { transition: opacity .2s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
.pop-enter-active, .pop-leave-active { transition: all .18s ease; }
.pop-enter-from, .pop-leave-to { opacity: 0; transform: translate(-50%, -50%) scale(.96); }

@media (max-width: 1080px) {
  .metric-bar { flex-direction: column; }
  .mb-cells { grid-template-columns: repeat(2, 1fr); }
  .mb-side { flex-direction: row; width: 100%; justify-content: flex-end; }
}
</style>
