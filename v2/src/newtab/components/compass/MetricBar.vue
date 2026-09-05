<script setup lang="ts">
/**
 * R49-C1 + R50-F5 + R51-F14/F17 方向台 · 指标条（方向状态）
 * 4 格：DHI 方向契合度 / WCE 好奇探索 / WRR 资源复用 / 未归档任务（口径与 NorthStarPanel O23 一致）
 * - R51-F14：4 格各自独立明细（MetricDrillDrawer 右侧抽屉），条目点击定位到对应卡片
 * - R51-F17：下钻全部改为右侧抽屉滑出（「📋 详细指标」= 右侧抽屉承载完整北极星）
 * - 日/周/累计 档位并入指标条表头
 */
import { ref, computed } from 'vue'
import Drawer from '@/shared/components/Drawer.vue'
import { useCompass } from '../../stores/compass'
import NorthStarPanel from './NorthStarPanel.vue'
import MetricDrillDrawer from './MetricDrillDrawer.vue'

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

/** R51-F14/F17：四格独立下钻（右侧抽屉）+ 详细指标完整面板（右侧抽屉） */
const drillCell = ref<'' | 'dhi' | 'wce' | 'wrr' | 'unarch'>('')
function openCell(c: 'dhi' | 'wce' | 'wrr' | 'unarch') { drillCell.value = c }
const fullOpen = ref(false)
function openFull() { fullOpen.value = true }
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
      <button class="mb-drill" @click="openFull">📋 详细指标</button>
    </div>
    <div class="mb-cells">
      <div class="mb-cell clickable" :class="'st-' + dhiState" title="DHI 方向契合度 = 已投射项目中周期窗口内有任务推进的占比 · 点击下钻各方向明细" @click="openCell('dhi')">
        <div class="mb-label">DHI 方向契合度</div>
        <div class="mb-num">{{ dhiMain }}</div>
        <div class="mb-sub">{{ m.dhi.label }} · {{ m.dhi.sub }}</div>
      </div>
      <div class="mb-cell clickable" title="WCE 好奇探索率 = 探索中+已求证的好奇心数 · 点击下钻激活好奇项清单" @click="openCell('wce')">
        <div class="mb-label">WCE 好奇探索</div>
        <div class="mb-num">{{ (m.wce.label || '').replace('项激活', '') || 0 }}</div>
        <div class="mb-sub">激活项 · {{ periodLabel }}新增 {{ wceNew }}</div>
      </div>
      <div class="mb-cell clickable" title="WRR 资源复用 = 资源卡被打开次数 · 点击下钻调出资源清单" @click="openCell('wrr')">
        <div class="mb-label">WRR 资源复用</div>
        <div class="mb-num">{{ wrrMain }}</div>
        <div class="mb-sub">{{ m.wrr.sub }}</div>
      </div>
      <div class="mb-cell clickable" :class="{ 'st-warn': unarchived > 0 }" title="未归档任务 = 未挂项目/指标或引用失效的任务（口径同详细指标）· 点击下钻归档" @click="openCell('unarch')">
        <div class="mb-label">未归档任务</div>
        <div class="mb-num">{{ unarchived }}<span class="mb-denom">/{{ totalTasks }}</span></div>
        <div class="mb-sub">未挂项目/指标 · 点击下钻归档</div>
      </div>
    </div>
  </div>

  <!-- R51-F14：四格独立明细（右侧抽屉） -->
  <MetricDrillDrawer :cell="drillCell" :period="period" @close="drillCell = ''" />

  <!-- R51-F17：详细指标完整面板（右侧抽屉，替代居中弹窗） -->
  <Drawer :open="fullOpen" title="📊 方向状态 · 完整指标" width="640px" @close="fullOpen = false">
    <NorthStarPanel />
  </Drawer>
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

/* R51-F17：下钻改右侧抽屉（Drawer 组件承载），原居中弹窗样式移除 */

@media (max-width: 1080px) {
  .mb-cells { grid-template-columns: repeat(2, 1fr); }
  .mb-head { flex-wrap: wrap; }
}
</style>
