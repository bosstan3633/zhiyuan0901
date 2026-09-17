<script setup lang="ts">
/**
 * R49-C1 + R50-F5 + R51-F14/F17 + R120-TB1 指标条（方向状态）
 * R120-TB1（合流方向条）：单行 ≤40px —— [左槽：主攻] + 日/周/累计 + 5 项指标
 *   （战略目标 / 推进项目 / WCE 探索 / WRR 复用 / 未归档）+ [右槽：今日记录四格 + 周报 + 去方向台]
 * - 5 项均各自下钻（MetricDrillDrawer 右侧抽屉；推进项目复用 dhi 明细）
 * - 日/周/累计 档位保留（功能不动，视觉压缩为段控）
 */
import { ref, computed } from 'vue'
import { useCompass } from '../../stores/compass'
import MetricDrillDrawer from './MetricDrillDrawer.vue'

const { d, northStarMetrics, unarchivedTaskCount, totalTaskCount } = useCompass()

const period = ref<'day' | 'week' | 'all'>('day')
const m = computed(() => northStarMetrics(period.value))

const periodLabel = computed(() => (period.value === 'day' ? '今日' : period.value === 'week' ? '本周' : '累计'))
function setPeriod(p: 'day' | 'week' | 'all') { period.value = p }

/** WRR 主数字（周期内资源被打开次数） */
const wrrMain = computed(() => {
  const s = d.value.stats?.wrr
  if (period.value === 'day') {
    const sot = new Date(); sot.setHours(0, 0, 0, 0)
    return d.value.resources.filter(r => !r.deletedAt && (r.lastCalledAt || 0) >= sot.getTime()).length
  }
  if (period.value === 'week') return s?.thisWeekUsage ?? 0
  return s?.totalCumulativeUsage ?? 0
})

/** 方向状态主数字（R64 口径）：战略目标数；推进项目数独立成格（R120-TB1） */
const dhiMain = computed(() => String(m.value.dhi.goals ?? 0))
const pushingMain = computed(() => String(m.value.dhi.pushing ?? 0))

/** R50-F5：未归档任务（N/M 分母=全部未删除任务，口径同明细抽屉） */
const unarchived = computed(() => unarchivedTaskCount())
const totalTasks = computed(() => totalTaskCount())

/** R51-F14：各自下钻（右侧抽屉） */
const drillCell = ref<'' | 'dhi' | 'wce' | 'wrr' | 'unarch'>('')
function openCell(c: 'dhi' | 'wce' | 'wrr' | 'unarch') { drillCell.value = c }
</script>

<template>
  <!-- R120-TB1：合流方向条（单行）——左槽主攻 · 档位段控 · 5 项指标 · 右槽（记录四格/周报/去方向台） -->
  <div class="metric-bar">
    <div class="mb-row">
      <slot name="left" />
      <span class="mb-divider" />
      <div class="mb-period" title="统计口径：日 / 周 / 累计">
        <span :class="{ on: period === 'day' }" @click="setPeriod('day')">日</span>
        <span :class="{ on: period === 'week' }" @click="setPeriod('week')">周</span>
        <span :class="{ on: period === 'all' }" @click="setPeriod('all')">累计</span>
      </div>
      <span class="mb-divider" />
      <div class="mb-cell clickable" title="战略目标 = 使命下拆解的方向数 · 点击下钻各目标明细" @click="openCell('dhi')">
        <span class="mb-k">战略目标</span><span class="mb-v">{{ dhiMain }}</span>
      </div>
      <div class="mb-cell clickable" title="推进项目 = 挂有任务（任务数≠0）的项目数 · 点击下钻各目标明细" @click="openCell('dhi')">
        <span class="mb-k">推进项目</span><span class="mb-v">{{ pushingMain }}</span>
      </div>
      <div class="mb-cell clickable" title="WCE 好奇探索 = 探索中+已求证的好奇心数（{{ m.wce.sub }}）· 点击下钻激活好奇项清单" @click="openCell('wce')">
        <span class="mb-k">WCE 探索</span><span class="mb-v">{{ m.wce.count ?? 0 }}</span>
      </div>
      <div class="mb-cell clickable" title="WRR 资源复用 = 资源卡被打开次数（{{ m.wrr.sub }}）· 点击下钻调出资源清单" @click="openCell('wrr')">
        <span class="mb-k">WRR 复用</span><span class="mb-v">{{ wrrMain }}</span>
      </div>
      <div class="mb-cell clickable" :class="{ 'st-warn': unarchived > 0 }" title="未归档任务 = 未挂项目/指标或引用失效的任务（口径同明细）· 点击下钻归档" @click="openCell('unarch')">
        <span class="mb-k">未归档</span><span class="mb-v">{{ unarchived }}<i class="mb-denom">/{{ totalTasks }}</i></span>
      </div>
      <!-- 右端扩展位：今日记录四格 + 周报 + 去方向台（R120-TB1：记录四格落在周报左侧） -->
      <div class="mb-right"><slot name="right" /></div>
    </div>
  </div>

  <!-- 各自下钻（右侧抽屉） -->
  <MetricDrillDrawer :cell="drillCell" :period="period" @close="drillCell = ''" />
</template>

<style scoped>
/* R120-TB1：合流方向条——单行 ≤40px，全 tokens（四主题自适应） */
.metric-bar { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-sm); margin-bottom: 10px; }
.mb-row { display: flex; align-items: center; gap: 10px; padding: 5px 14px; min-height: 34px; max-height: 40px; min-width: 0; }
.mb-period { display: flex; border: 1px solid var(--border); border-radius: 7px; overflow: hidden; flex-shrink: 0; }
.mb-period span { padding: 2px 9px; font-size: 10.5px; color: var(--text-3); cursor: pointer; transition: all .12s; }
.mb-period span + span { border-left: 1px solid var(--border); }
.mb-period span:hover { background: var(--surface-3); color: var(--text-2); }
.mb-period span.on { background: var(--accent-light); color: var(--accent); font-weight: 600; }
.mb-divider { width: 1px; height: 14px; background: var(--border); flex-shrink: 0; }
.mb-cell { display: flex; align-items: baseline; gap: 5px; min-width: 0; padding: 2px 7px; border-radius: 6px; }
.mb-cell.clickable { cursor: pointer; transition: background .12s; }
.mb-cell.clickable:hover { background: var(--surface-2); }
.mb-k { font-size: 11.5px; font-weight: 500; color: var(--text-2); flex-shrink: 0; }
.mb-v { font-size: 12.5px; font-weight: 700; color: var(--text); font-variant-numeric: tabular-nums; line-height: 1.2; }
.mb-denom { font-size: 10.5px; font-weight: 500; color: var(--text-3); font-style: normal; }
.mb-cell.st-warn .mb-v { color: var(--tag-warn-text); }
/* 右端扩展位——今日记录四格 + 周报 + 去方向台（右对齐） */
.mb-right { margin-left: auto; display: flex; align-items: center; gap: 8px; flex-shrink: 0; }

@media (max-width: 1180px) {
  .mb-row { flex-wrap: wrap; row-gap: 4px; max-height: none; }
}
</style>
