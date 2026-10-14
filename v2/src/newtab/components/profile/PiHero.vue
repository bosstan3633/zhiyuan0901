<script setup lang="ts">
/**
 * W10（V3.9.0）PiHero —— 画像洞察页头。
 * 口径（v6 原型 §hero + D1 决策）：
 *   5 枚 KPI chip = 卡片总量 / 连续打卡 / 活跃天数(年) / 知识熵 / 最长连续(年)
 *   右侧动作 = 刷新 · 导出 · （错误 N，仅计数>0 时）· 全部记录
 *   ★W12-B：原为「刷新 · 导出 · AI 解读 · 今日战报」，前两枚能力在下方模块里都有同级入口
 *   （复盘 → 近期「周/月复盘」+ 全年「目标对账」；战报 → 今日模块「打开战报」），
 *   按用户 2026-10-13 拍板收敛掉；「全部记录」由页面底部上提为全页唯一入口。
 * 全部数值由宿主 ProfileInsights 计算后传入；本组件零计算、零取 store。
 */
import ExportMenu, { type ExportFmt } from '@/newtab/components/dashboard/ExportMenu.vue'

const props = defineProps<{
  total: number
  streak: number
  activeDays: number
  entropy: number
  longest: number
  errorCount: number
}>()

const emit = defineEmits<{
  (e: 'drill', kpi: 'total' | 'streak' | 'active' | 'entropy' | 'longest'): void
  (e: 'refresh'): void
  (e: 'export', fmt: ExportFmt): void
  /** ★W12-B：全量操作记录抽屉入口（由页面底部上提，全页唯一一枚） */
  (e: 'open-log'): void
  (e: 'export-error'): void
}>()

function onPick(fmt: ExportFmt) { emit('export', fmt) }
</script>

<template>
  <section class="pi-hero">
    <div class="pi-hero-l">
      <div class="pi-hero-eyebrow"><span class="dot"></span>画像洞察 · PROFILE INSIGHTS</div>
      <h1 class="pi-hero-t">你的知识生命体征<span class="en">PROFILE INSIGHTS</span></h1>
      <p class="pi-hero-sub">不是又一个仪表盘，是<b style="color:var(--text)">一条时间线</b>：今天做了什么、这一周什么节奏、这一年走过多远。所有指标可点开明细。</p>
      <div class="pi-hero-sum">
        <button class="pi-hchip" title="卡片总量 · 未删除" @click="emit('drill', 'total')">
          <span class="v">{{ props.total.toLocaleString() }}<small>张</small></span><span class="l">卡片总量</span>
        </button>
        <button class="pi-hchip" title="连续打卡 · 连续有记录的天数" @click="emit('drill', 'streak')">
          <span class="v">{{ props.streak }}<small>天</small></span><span class="l">连续打卡</span>
        </button>
        <button class="pi-hchip" title="活跃天数 · 本年有任意有效动作" @click="emit('drill', 'active')">
          <span class="v">{{ props.activeDays }}<small>天</small></span><span class="l">活跃天数</span>
        </button>
        <button class="pi-hchip" title="知识熵 · 卡片标签分布离散度（bit）" @click="emit('drill', 'entropy')">
          <span class="v">{{ props.entropy.toFixed(1) }}</span><span class="l">知识熵</span>
        </button>
        <button class="pi-hchip" title="最长连续 · 本年历史峰值" @click="emit('drill', 'longest')">
          <span class="v">{{ props.longest }}<small>天</small></span><span class="l">最长连续</span>
        </button>
      </div>
    </div>
    <div class="pi-hero-r">
      <div class="pi-hero-acts">
        <button class="pi-btn line" title="重读事件日志刷新统计" @click="emit('refresh')">⟳ 刷新</button>
        <ExportMenu @pick="onPick" />
        <button v-if="props.errorCount > 0" class="pi-btn line" style="color:var(--warning)"
          title="运行错误日志导出" @click="emit('export-error')">⚠ 错误 {{ props.errorCount }}</button>
        <!-- ★W12-B 入口收敛（用户 2026-10-13 拍板）：页头这一格原先是「✦ AI 解读」+「📊 今日战报」，
             两者的能力在下方模块里都有同级入口（复盘：近期「周/月复盘」+ 全年「目标对账」；
             战报：今日模块「打开战报」），属重复。
             现按拍板：AI 解读整枚删除（复盘由带周期的模块入口承接，语义更贴语境），
             「今日战报」这一格换成全页唯一的「全部记录」入口（原先它待在页面最底部，
             与近期模块里那一枚也重复）。「今日战报」在今日模块内仍可达，能力一项未减。 -->
        <button class="pi-btn line" title="打开全量操作记录（类型 / 动作 / 时间三维筛选 + CSV 导出）"
          @click="emit('open-log')">🗂 全部记录</button>
      </div>
    </div>
  </section>
</template>
