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
// R129-B10：本周口径统一走 weekUsageOf（周戳不是本周 = 0）
import { weekUsageOf } from '@/shared/storage/stats'
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
  if (period.value === 'week') return weekUsageOf(d.value)
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
  <!-- R120-TB1：合流方向条（单行）——左槽主攻 · 档位段控 · 5 项指标 · 右槽（存储/同步 chip + 复盘）
       W5（V3.8.5）#1：三段浅底色分组块（导航口径 / 五指标 / 右槽动作），38px 单行不变 -->
  <div class="metric-bar">
    <div class="mb-row">
      <div class="mb-group mb-nav">
        <slot name="left" />
        <div class="mb-period" title="统计口径：日 / 周 / 累计">
          <span v-pressable :class="{ on: period === 'day' }" @click="setPeriod('day')">日</span>
          <span v-pressable :class="{ on: period === 'week' }" @click="setPeriod('week')">周</span>
          <span v-pressable :class="{ on: period === 'all' }" @click="setPeriod('all')">累计</span>
        </div>
      </div>
      <div class="mb-group mb-metrics">
        <div class="mb-cell clickable" v-pressable title="战略目标 = 使命下拆解的方向数 · 点击下钻各目标明细" @click="openCell('dhi')">
          <span class="mb-k">战略目标</span><span class="mb-v">{{ dhiMain }}</span>
        </div>
        <div class="mb-cell clickable" v-pressable title="推进项目 = 挂有任务（任务数≠0）的项目数 · 点击下钻各目标明细" @click="openCell('dhi')">
          <span class="mb-k">推进项目</span><span class="mb-v">{{ pushingMain }}</span>
        </div>
        <div class="mb-cell clickable" v-pressable title="WCE 好奇探索 = 好奇卡「创建 + 状态变更 + 删除」的事件数（{{ m.wce.label }}）· 点击下钻明细" @click="openCell('wce')">
          <span class="mb-k">WCE 探索</span><span class="mb-v">{{ m.wce.count ?? 0 }}</span>
        </div>
        <div class="mb-cell clickable" v-pressable title="WRR 资源复用 = 资源卡被打开次数（{{ m.wrr.sub }}）· 点击下钻调出资源清单" @click="openCell('wrr')">
          <span class="mb-k">WRR 复用</span><span class="mb-v">{{ wrrMain }}</span>
        </div>
        <!-- ★M1（V3.8.28）：读数去琥珀。原实现在读数 > 0 时给这一格挂警示类、把数字染成琥珀，
             于是「还有多少没做完」被读成催促；镜面口径下它只是一个事实读数，颜色不参与评价。
             琥珀只留给真正的停滞细节（14 天无推进一类），不留给"你还没做完"。 -->
        <div class="mb-cell clickable" v-pressable title="未归档任务 = 未挂项目/指标、或引用已失效的任务，尚未归位到方向 · 分母为全部未删任务 · 口径同明细 · 点击下钻归档" @click="openCell('unarch')">
          <span class="mb-k">未归档</span><span class="mb-v">{{ unarchived }}<i class="mb-denom">/{{ totalTasks }}</i></span>
        </div>
      </div>
      <!-- 右端扩展位：存储/同步 chip + 周报（R120-TB1） -->
      <div class="mb-group mb-right"><slot name="right" /></div>
    </div>
  </div>

  <!-- 各自下钻（右侧抽屉） -->
  <MetricDrillDrawer :cell="drillCell" :period="period" @close="drillCell = ''" />
</template>

<style scoped>
/* R120-TB1：合流方向条——单行 ≤38px，全 tokens（四主题自适应）
   R175（原型）：圆角对齐 radius-md（10px），磨砂底玻璃浓度 72%→88% 更贴近原型近实心
   ★M2（V3.8.28）：本条是「支撑层」不是主角面 —— 去掉投影（投影意味着浮起），
   底色回收一档；读数行退到 caption 网格，让下方三件事重新成为首屏焦点。 */
.metric-bar { background: color-mix(in srgb, var(--surface) 92%, transparent); backdrop-filter: blur(12px); border: 1px solid var(--border); border-radius: var(--radius-md); margin-bottom: 10px; }
/* ★M2：间距统一到 8px 网格（原 6/2/5/7 混用），一眼可扫而不再零碎 */
.mb-row { display: flex; align-items: center; gap: 8px; padding: 5px 14px; min-height: 38px; max-height: 38px; min-width: 0; }
/* W5（V3.8.5）#1：三段浅底色分组块（替代 1px 分隔线）——surface-2 浅底 + 圆角，38px 单行不变 */
.mb-group { display: flex; align-items: center; gap: 8px; min-width: 0; background: var(--surface-2); border-radius: 7px; padding: 3px 8px; }
.mb-metrics { gap: 4px; }
.mb-period { display: flex; border: 1px solid var(--border); border-radius: 7px; overflow: hidden; flex-shrink: 0; }
.mb-period span { padding: 2px 9px; font-size: var(--fs-caption); color: var(--text-3); cursor: pointer; transition: all var(--dur-fast); }
.mb-period span + span { border-left: 1px solid var(--border); }
.mb-period span:hover { background: var(--surface-3); color: var(--text-2); }
.mb-period span.on { background: var(--accent-light); color: var(--accent-ink); font-weight: 600; }
.mb-cell { display: flex; align-items: baseline; gap: 6px; min-width: 0; padding: 2px 8px; border-radius: 6px; }
.mb-cell.clickable { cursor: pointer; transition: background var(--dur-fast); }
.mb-cell.clickable:hover { background: var(--surface-2); }
/* ★M2：只降字号、不降对比 —— 读数退为支撑层靠的是字阶（12→11px）与 8px 网格，
   不是把字调暗。R153-4 记着一条实测：这一行的小字曾量到 3.14:1（低于 AA）而抬到 text-2，
   所以这里的 key/value/denom 全部保持 text-2 及以上，denom 也不再往下压到 9px。 */
.mb-k { font-size: var(--fs-caption); font-weight: 500; color: var(--text-2); flex-shrink: 0; }
.mb-v { font-size: var(--fs-caption); font-weight: 700; color: var(--text); font-variant-numeric: tabular-nums; line-height: 1.2; }
.mb-denom { font-size: var(--fs-caption); font-weight: 500; color: var(--text-2); font-style: normal; }
/* 右端扩展位——今日记录四格 + 周报 + 去方向台（右对齐） */
.mb-right { margin-left: auto; display: flex; align-items: center; gap: 8px; flex-shrink: 0; }

/* M6（B7-e · V3.8.40）：窄窗改为**横向滚动**，不再纵向换行。
   ★为什么必须改而不是"反正没溢出就算了"：实测三档宽度下换行把指标条从 38px 撑到
     73px（1024）/ 104px（800），而它就压在「今日三件事」正上方——模块顶缘被从 y=120 推到
     y=186，等于**用一行指标把主角往下挤了 66px**。规范写的就是「指标条横向滚动」，
     换行虽不破版、却恰恰破了「主角始终首屏可达」这条验收。
   ★横向滚动要连带处理右槽：`.mb-right` 的 `margin-left: auto` 在 nowrap 容器里会把
     后面所有内容推到不可达（auto 外边距吃掉剩余空间），窄屏下改成固定 gap。 */
@media (max-width: 1180px) {
  .mb-row { flex-wrap: nowrap; overflow-x: auto; max-height: none; scrollbar-width: thin; }
  .mb-group { flex-shrink: 0; }
  .mb-right { margin-left: 0; }
}

</style>
