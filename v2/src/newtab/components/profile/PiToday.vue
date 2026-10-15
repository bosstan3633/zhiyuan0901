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
  streak: number
  /** 今日三件事 · dailyFocus[today]（最多 3 件）· 点任一格进详情 */
  focus: FocusSlot[]
  /** 调度台 vs 全站日均的简单对照；null = 这库还没有基线 */
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
      </div>
    </div>
    <div class="pi-mod-b">
      <div class="pi-strip">
        <span class="pi-strip-lab">今日</span>
        <div class="pi-strip-row">
        <button class="pi-chip up" title="今日入台 · action=create（含导入）" @click="emit('drill', 'd-in')">
          <span class="v">{{ props.todayAdd }}<small>张</small></span><span class="l">今日入台</span><span class="ar">▸</span>
        </button>
        <button class="pi-chip bad" title="今日移出 · action=delete（软删，可恢复）" @click="emit('drill', 'd-out')">
          <span class="v">{{ props.todayDel }}<small>张</small></span><span class="l">今日移出</span><span class="ar">▸</span>
        </button>
        <button class="pi-chip acc" title="今日调出 · action=call（被打开的卡片）" @click="emit('drill', 'd-call')">
          <span class="v">{{ props.todayCalled }}<small>次</small></span><span class="l">今日调出</span><span class="ar">▸</span>
        </button>
        <button class="pi-chip ok" title="连续打卡 · 连续有记录的天数" @click="emit('drill', 'streak')">
          <span class="v">{{ props.streak }}<small>天</small></span><span class="l">连续打卡</span><span class="ar">▸</span>
        </button>
        <!-- ★V3.8.18（N9）**退役两枚重复 chip**：「写入记录」「复盘就绪」随本轮从 strip 里移除。
             病根＝这两枚不是读数，是**同一个出口的两个入口**——它们和模块头右上角的
             战报按钮打开的是同一个 DayDetail 弹窗（都 emit('open-battle')）。
             六个 chip 里三个跳同一个弹窗，读者要试过才知道它们是一件事；
             而 strip 的语义是"六格读数"，塞两个入口进去就破坏了它自己的语义。
             ★退役的只是**这枚入口**，能力一项未减：
               · 写入记录（writeCount）仍在父级 ProfileInsights 的日详情里，且 N6 的时间线是它的全量版；
               · 复盘就绪（reviewReady）由模块头那枚战报按钮与弹窗内的复盘段承接；
               · 两枚 chip 的 emit 通道 open-battle 一字未动（模块头那枚仍在用）。
             判据（04 分片里的 N9 条）改钉「strip 只剩四枚读数 chip + 模块头只剩一枚战报入口」。
             ★2026-10-15（用户拍板）**模块头 ▶ 图标退役**：N9 上一轮只收了 strip，模块头右上
             「打开战报」文字按钮与旁边 ▶ 图标是**同一根 open-battle 通道、同一个 DayDetail 弹窗**
             —— 同一弹窗不给两个入口，这正是 N9 自己定的原则，只是当时漏了这一对。
             能力同样一项未减：文字按钮就是那条通道的唯一入口，弹窗内容、宿主 openTodayBattle 一字未动。 -->
        </div>
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
