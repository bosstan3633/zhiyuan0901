<script setup lang="ts">
/**
 * W10（V3.9.0）PiHero —— 画像洞察页头。
 * 口径（v6 原型 §hero + D1 决策）：
 *   5 枚 KPI chip = 卡片总量 / 连续打卡 / 活跃天数(年) / 知识熵 / 最长连续(年)
 *   右侧动作 = 刷新 · 导出 · AI 解读 · 今日战报
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
  (e: 'ai-read'): void
  (e: 'battle'): void
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
        <button class="pi-btn line" title="AI 生成画像解读（进入复盘弹窗）" @click="emit('ai-read')">✦ AI 解读</button>
        <button v-if="props.errorCount > 0" class="pi-btn line" style="color:var(--warning)"
          title="运行错误日志导出" @click="emit('export-error')">⚠ 错误 {{ props.errorCount }}</button>
        <button class="pi-btn pri" @click="emit('battle')">📊 今日战报</button>
      </div>
    </div>
  </section>
</template>
