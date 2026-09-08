<script setup lang="ts">
/**
 * R49-C1 + R50-F5 + R51-F14/F17 方向台 · 指标条（方向状态）
 * 4 格：方向状态（R64：战略目标/推进项目，DHI 退役）/ WCE 好奇探索 / WRR 资源复用 / 未归档任务
 * - R51-F14：4 格各自独立明细（MetricDrillDrawer 右侧抽屉），条目点击定位到对应卡片
 * - R57-F3：「📋 详细指标」完整面板入口移除（口径收束到四格自下钻 + 页头今日记录组）
 * - 日/周/累计 档位并入指标条表头
 * - R65-F8：纵向再压缩——单行指标条（副行信息收 tooltip，下钻抽屉不变）
 */
import { ref, computed } from 'vue'
import { useCompass } from '../../stores/compass'
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

/** 方向状态主数字（R64 口径）：主数字 = 战略目标数；副行 = 推进中项目数 */
const dhiMain = computed(() => String(m.value.dhi.goals ?? 0))

/** R50-F5：未归档任务（N/M 分母=全部未删除任务，口径同详细指标抽屉） */
const unarchived = computed(() => unarchivedTaskCount())
const totalTasks = computed(() => totalTaskCount())

/** R51-F14：四格独立下钻（右侧抽屉）｜ R57-F3：「详细指标」完整面板入口移除（口径收束到四格下钻 + 页头今日记录组） */
const drillCell = ref<'' | 'dhi' | 'wce' | 'wrr' | 'unarch'>('')
function openCell(c: 'dhi' | 'wce' | 'wrr' | 'unarch') { drillCell.value = c }
</script>

<template>
  <!-- R65-F8：纵向再压缩——单行指标条（标题+档位+四指标一行；副行信息收进 tooltip，下钻抽屉不变） -->
  <div class="metric-bar">
    <div class="mb-row">
      <span class="mb-title">📊 方向状态</span>
      <div class="mb-period">
        <span :class="{ on: period === 'day' }" @click="setPeriod('day')">日</span>
        <span :class="{ on: period === 'week' }" @click="setPeriod('week')">周</span>
        <span :class="{ on: period === 'all' }" @click="setPeriod('all')">累计</span>
      </div>
      <span class="mb-divider" />
      <div class="mb-cell clickable" title="战略目标 = 使命下拆解的方向数；推进中项目 = 挂有任务（任务数≠0）的项目数 · 点击下钻各目标明细" @click="openCell('dhi')">
        <span class="mb-k">战略目标</span><span class="mb-v">{{ dhiMain }}</span><span class="mb-k2">推进 {{ m.dhi.pushing }}</span>
      </div>
      <span class="mb-divider" />
      <div class="mb-cell clickable" title="WCE 好奇探索率 = 探索中+已求证的好奇心数（{{ m.wce.sub }}）· 点击下钻激活好奇项清单" @click="openCell('wce')">
        <span class="mb-k">WCE 探索</span><span class="mb-v">{{ m.wce.count ?? 0 }}</span><span class="mb-k2">{{ m.wce.sub }}</span>
      </div>
      <span class="mb-divider" />
      <div class="mb-cell clickable" title="WRR 资源复用 = 资源卡被打开次数（{{ m.wrr.sub }}）· 点击下钻调出资源清单" @click="openCell('wrr')">
        <span class="mb-k">WRR 复用</span><span class="mb-v">{{ wrrMain }}</span><span class="mb-k2">{{ m.wrr.sub }}</span>
      </div>
      <span class="mb-divider" />
      <div class="mb-cell clickable" :class="{ 'st-warn': unarchived > 0 }" title="未归档任务 = 未挂项目/指标或引用失效的任务（口径同详细指标）· 点击下钻归档" @click="openCell('unarch')">
        <span class="mb-k">未归档</span><span class="mb-v">{{ unarchived }}<i class="mb-denom">/{{ totalTasks }}</i></span><span class="mb-k2">点击归档</span>
      </div>
    </div>
  </div>

  <!-- R51-F14：四格独立明细（右侧抽屉） -->
  <MetricDrillDrawer :cell="drillCell" :period="period" @close="drillCell = ''" />
</template>

<style scoped>
/* R65-F8：单行指标条（原双行四格压缩为一行，纵向 ~30px） */
.metric-bar { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-sm); margin-bottom: 10px; }
.mb-row { display: flex; align-items: center; gap: 12px; padding: 6px 14px; min-width: 0; }
.mb-title { font-size: 11.5px; font-weight: 600; color: var(--text-2); flex-shrink: 0; }
.mb-period { display: flex; border: 1px solid var(--border); border-radius: 8px; overflow: hidden; flex-shrink: 0; }
.mb-period span { padding: 2px 10px; font-size: 11px; color: var(--text-2); cursor: pointer; transition: all .12s; }
.mb-period span + span { border-left: 1px solid var(--border); }
.mb-period span:hover { background: var(--surface-3); }
.mb-period span.on { background: var(--accent-light); color: var(--accent); font-weight: 600; }
.mb-divider { width: 1px; height: 16px; background: var(--border); flex-shrink: 0; }
.mb-cell { display: flex; align-items: baseline; gap: 6px; min-width: 0; padding: 2px 6px; border-radius: 6px; }
.mb-cell.clickable { cursor: pointer; transition: background .12s; }
.mb-cell.clickable:hover { background: var(--surface-2); }
.mb-k { font-size: 10.5px; font-weight: 600; color: var(--text-3); letter-spacing: .3px; flex-shrink: 0; }
.mb-v { font-size: 13.5px; font-weight: 700; color: var(--text); font-variant-numeric: tabular-nums; line-height: 1.2; }
.mb-k2 { font-size: 10px; color: var(--text-4); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-width: 0; }
.mb-denom { font-size: 10.5px; font-weight: 500; color: var(--text-3); font-style: normal; }
.mb-cell.st-warn .mb-v { color: var(--tag-warn-text); }

@media (max-width: 1080px) {
  .mb-row { flex-wrap: wrap; row-gap: 4px; }
}
</style>
