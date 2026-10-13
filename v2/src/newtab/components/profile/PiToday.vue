<script setup lang="ts">
/**
 * W10（V3.9.0）PiToday —— 时间轴模块① 今天 · TODAY。
 * 口径（v6 原型 §mod-now + 产品现状）：
 *   strip = 今日入台 / 今日移出 / 今日调出 / 写入记录 / 连续打卡 / 复盘就绪
 *   今日三件事 = dailyFocus[today]（来自调度台；点击 → 回调度台详情）
 *   洞察条 = 今日入台 vs 年日均线的简单对比（确定性、非 AI）
 * 全部数值由宿主传入；本组件零取 store。
 */
import type { FocusSlot } from '@/shared/models'

const props = defineProps<{
  todayAdd: number
  todayDel: number
  todayCalled: number
  writeCount: number
  streak: number
  /** T1c 口径：今日 ≥1 有效动作（w>0）即就绪 */
  reviewReady: boolean
  /** 今日三件事（dailyFocus[today]，最多 3 槽；空数组 = 今天还没排） */
  focus: FocusSlot[]
  /** 今日入台 vs 年日均线（宿主算好；null = 今年还没有数据） */
  avgDailyCreate: number | null
}>()

const emit = defineEmits<{
  (e: 'drill', k: 'd-in' | 'd-out' | 'd-call' | 'streak'): void
  (e: 'open-battle'): void
  (e: 'open-focus'): void
}>()

/** 洞察文案（确定性规则，非 AI）：入台超均线 / 低于均线 / 齐平 */
const insight = (() => {
  if (props.avgDailyCreate === null || props.todayAdd === 0) return ''
  const avg = props.avgDailyCreate
  const diff = props.todayAdd - avg
  if (diff >= 1) return `入台 ${props.todayAdd} 张已超年日均线（${avg.toFixed(1)}），比平时多 ${Math.round(diff)} 张——趁热补一条复盘，把今天的记录固化成结论。`
  if (diff <= -1) return `今日入台 ${props.todayAdd} 张，低于年日均线（${avg.toFixed(1)}）。节奏低一天没关系，打开一张旧卡回顾也算有效动作。`
  return `今日入台 ${props.todayAdd} 张，与年日均线（${avg.toFixed(1)}）基本持平——稳定本身就是稀缺品。`
})()
</script>

<template>
  <section class="pi-mod" id="mod-now">
    <div class="pi-mod-h">
      <span class="pi-mod-ico i-now">📊</span>
      <div class="pi-mod-t">
        <h2>今日战报<span class="en">DAILY REPORT</span><span class="tagline">DayDetail · 五段式</span></h2>
        <p>当天的四类记录，全部来自本机事件日志。点任一格 → 明细下钻（单击定位 · 双击开链接）。</p>
      </div>
      <div class="pi-mod-acts">
        <button class="pi-btn line" @click="emit('open-battle')">打开战报</button>
        <button class="pi-btn pri" title="打开今日战报" @click="emit('open-battle')">▸</button>
      </div>
    </div>
    <div class="pi-mod-b">
      <div class="pi-strip">
        <span class="pi-strip-lab">今日</span>
        <button class="pi-chip up" title="今日入台 · action=create（含导入）" @click="emit('drill', 'd-in')">
          <span class="v">{{ props.todayAdd }}<small>张</small></span><span class="l">今日入台</span><span class="ar">▸</span>
        </button>
        <button class="pi-chip bad" title="今日移出 · action=delete（软删，可恢复）" @click="emit('drill', 'd-out')">
          <span class="v">{{ props.todayDel }}<small>张</small></span><span class="l">今日移出</span><span class="ar">▸</span>
        </button>
        <button class="pi-chip acc" title="今日调出 · action=call（被打开的卡片）" @click="emit('drill', 'd-call')">
          <span class="v">{{ props.todayCalled }}<small>次</small></span><span class="l">今日调出</span><span class="ar">▸</span>
        </button>
        <button class="pi-chip" title="写入记录（全量时间线）" @click="emit('open-battle')">
          <span class="v">{{ props.writeCount }}<small>条</small></span><span class="l">写入记录</span><span class="ar">▸</span>
        </button>
        <button class="pi-chip ok" title="连续打卡 · 连续有记录的天数" @click="emit('drill', 'streak')">
          <span class="v">{{ props.streak }}<small>天</small></span><span class="l">连续打卡</span><span class="ar">▸</span>
        </button>
        <button class="pi-chip acc" title="复盘就绪 · 今天有 ≥1 条有效动作" @click="emit('open-battle')">
          <span class="v">{{ props.reviewReady ? '✅' : '…' }}</span><span class="l">复盘就绪</span><span class="ar">▸</span>
        </button>
      </div>

      <div class="pi-hair"></div>

      <div v-if="props.focus.length">
        <div class="pi-sect"><span class="n">1</span><span class="t">今日三件事</span><span class="m">来自调度台 · 点任一格进详情</span></div>
        <div class="pi-f3">
          <button v-for="(f, i) in props.focus" :key="f.id || i" class="pi-fcard" @click="emit('open-focus')">
            <span class="fc-n">{{ String(i + 1).padStart(2, '0') }}</span>
            <div class="fc-row">
              <span class="fc-ck" :class="{ done: f.done }">{{ f.done ? '✓' : '' }}</span>
              <div class="fc-t">{{ f.text || '（空槽）' }}</div>
            </div>
            <div class="fc-meta">
              <span class="pi-tag neutral">{{ f.sourceType === 'task' ? '✅ 任务' : f.sourceType === 'resource' ? '📇 资源' : f.sourceType === 'curiosity' ? '💡 好奇' : '✎ 文本' }}</span>
              <span class="pi-tag" :class="f.done ? 'ok' : 'acc'">{{ f.done ? '✓ 已完成' : '进行中' }}</span>
            </div>
          </button>
        </div>
      </div>
      <div v-else class="pi-f3-done">今天还没有排三件事 —— 去<b>调度台</b>排一排，晚上复盘会更清楚。</div>

      <div v-if="insight" class="pi-insight"><span class="ic">💡</span><div><b>今日洞察：</b>{{ insight }}</div></div>
    </div>
  </section>
</template>
