<script setup lang="ts">
/**
 * R49-C1 + R50-F5 方向台 · 指标条（方向状态）
 * 4 格：DHI 方向契合度 / WCE 好奇探索 / WRR 资源复用 / 未归档任务（口径与 NorthStarPanel O23 一致）
 * - 4 格全部可点击下钻，统一打开「详细指标」抽屉（NorthStarPanel 完整六指标）
 * - 日/周/累计 档位与下钻按钮并入指标条表头（R50-F5 布局优化，不再右侧悬浮）
 */
import { ref, computed } from 'vue'
import { useCompass } from '../../stores/compass'
import NorthStarPanel from './NorthStarPanel.vue'

const { d, northStarMetrics, unarchivedTaskCount, totalTaskCount } = useCompass()

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

/** R50-F5：未归档任务（N/M 分母=全部未删除任务，口径同详细指标抽屉） */
const unarchived = computed(() => unarchivedTaskCount())
const totalTasks = computed(() => totalTaskCount())

/** 下钻：4 格统一打开完整北极星抽屉 */
const drillOpen = ref(false)
function openDrill() { drillOpen.value = true }
</script>

<template>
  <div class="metric-bar">
    <div class="mb-head">
      <span class="mb-title">📊 方向状态</span>
      <div class="mb-period">
        <span :class="{ on: period === 'day' }" @click="setPeriod('day')">日</span>
        <span :class="{ on: period === 'week' }" @click="setPeriod('week')">周</span>
        <span :class="{ on: period === 'all' }" @click="setPeriod('all')">累计</span>
      </div>
      <button class="mb-drill" @click="openDrill">📋 详细指标</button>
    </div>
    <div class="mb-cells">
      <div class="mb-cell clickable" :class="'st-' + dhiState" title="DHI 方向契合度 = 已投射项目中周期窗口内有任务推进的占比 · 点击下钻详细指标" @click="openDrill">
        <div class="mb-label">DHI 方向契合度</div>
        <div class="mb-num">{{ dhiMain }}</div>
        <div class="mb-sub">{{ m.dhi.label }} · {{ m.dhi.sub }}</div>
      </div>
      <div class="mb-cell clickable" title="WCE 好奇探索率 = 探索中+已求证的好奇心数 · 点击下钻详细指标" @click="openDrill">
        <div class="mb-label">WCE 好奇探索</div>
        <div class="mb-num">{{ (m.wce.label || '').replace('项激活', '') || 0 }}</div>
        <div class="mb-sub">激活项 · {{ periodLabel }}新增 {{ wceNew }}</div>
      </div>
      <div class="mb-cell clickable" title="WRR 资源复用 = 资源卡被打开次数 · 点击下钻详细指标" @click="openDrill">
        <div class="mb-label">WRR 资源复用</div>
        <div class="mb-num">{{ wrrMain }}</div>
        <div class="mb-sub">{{ m.wrr.sub }}</div>
      </div>
      <div class="mb-cell clickable" :class="{ 'st-warn': unarchived > 0 }" title="未归档任务 = 未挂项目/指标或引用失效的任务（口径同详细指标）· 点击下钻归档" @click="openDrill">
        <div class="mb-label">未归档任务</div>
        <div class="mb-num">{{ unarchived }}<span class="mb-denom">/{{ totalTasks }}</span></div>
        <div class="mb-sub">未挂项目/指标 · 点击下钻归档</div>
      </div>
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
.metric-bar { display: flex; flex-direction: column; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-sm); overflow: hidden; }
.mb-head { display: flex; align-items: center; gap: 12px; padding: 8px 14px; border-bottom: 1px solid var(--border); background: var(--surface); }
.mb-title { font-size: 12px; font-weight: 600; color: var(--text-2); flex: 1; }
.mb-period { display: flex; border: 1px solid var(--border); border-radius: 8px; overflow: hidden; }
.mb-period span { padding: 4px 12px; font-size: 11.5px; color: var(--text-2); cursor: pointer; transition: all .12s; }
.mb-period span + span { border-left: 1px solid var(--border); }
.mb-period span:hover { background: var(--surface-3); }
.mb-period span.on { background: var(--accent-light); color: var(--accent); font-weight: 600; }
.mb-drill { border: 1px solid var(--border); background: var(--surface); color: var(--text-2); font-size: 11.5px; border-radius: 8px; padding: 4px 12px; cursor: pointer; font-family: inherit; transition: all .15s; }
.mb-drill:hover { border-color: var(--accent); color: var(--accent); }
.mb-cells { flex: 1; display: grid; grid-template-columns: repeat(4, 1fr); gap: 1px; background: var(--border); }
.mb-cell { background: var(--surface); padding: 12px 16px; display: flex; flex-direction: column; gap: 3px; }
.mb-cell.clickable { cursor: pointer; transition: background .12s; }
.mb-cell.clickable:hover { background: var(--surface-2); }
.mb-label { font-size: 10.5px; font-weight: 600; color: var(--text-3); letter-spacing: .5px; }
.mb-num { font-size: 20px; font-weight: 700; color: var(--text); font-variant-numeric: tabular-nums; line-height: 1.25; }
.mb-denom { font-size: 12px; font-weight: 500; color: var(--text-3); }
.mb-cell.st-ok .mb-num { color: var(--success); }
.mb-cell.st-mid .mb-num { color: var(--text); }
.mb-cell.st-warn .mb-num { color: var(--tag-warn-text); }
.mb-cell.st-none .mb-num { color: var(--text-4); }
.mb-sub { font-size: 10px; color: var(--text-3); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

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
  .mb-cells { grid-template-columns: repeat(2, 1fr); }
  .mb-head { flex-wrap: wrap; }
}
</style>
