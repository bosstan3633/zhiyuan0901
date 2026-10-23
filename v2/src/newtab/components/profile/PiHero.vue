<script setup lang="ts">
/**
 * V3.9.3 画像洞察首屏 → ★W17-C09（2026-10-20 用户拍板）再收敛：PiHero 只承担「页头」一件事。
 *   ① `.hero-row-top` 左 = 眉标 + 主标题；右 = 刷新 / 导出 / 错误 / 全部记录
 *   ② 原 `.hero-compass-bar`（使命主线 + ≤2 枚主攻胶囊）整体迁入 PiOverview 的方向状态面板
 *      —— 胶囊在页头只能挤成 24ch 截断，用户看不到完整项目名（C09 反馈第一条）。
 *
 * 页面定位变化：本页呈现「用户使用知源产品的状态」——产品使用状态 + 个人方向状态。
 * 四格核心读数仍在 PiOverview；连续打卡等时间指标在 PiYear。
 * 本组件零计算、零取 store。
 *
 * W12-B 页头三件套（刷新 · 导出 · 全部记录）与 E2E-21 选择器（.pi-hero）保持不变。
 * V3.9.13：周期切换并入同一工具行，删掉独立 PERIOD 提示带，首屏直接进入双面板。
 */
import Icon from '@/shared/components/Icon.vue'
import ExportMenu, { type ExportFmt } from '@/newtab/components/dashboard/ExportMenu.vue'

const props = defineProps<{
  errorCount: number
}>()

const emit = defineEmits<{
  (e: 'refresh'): void
  (e: 'export', fmt: ExportFmt): void
  /** ★W12-B：全量操作记录抽屉入口（全页唯一一枚） */
  (e: 'open-log'): void
  (e: 'export-error'): void
}>()

function onPick(fmt: ExportFmt) { emit('export', fmt) }
</script>

<template>
  <section class="pi-hero hero-card">
    <!-- 一行完成身份、周期与导出：标题不再另起一块。 -->
    <div class="hero-row-top">
      <div class="hero-head">
        <div class="pi-hero-t"><span class="pi-hero-eyebrow"><span class="dot"></span>画像洞察</span>你的知源使用画像<span class="en">PROFILE INSIGHTS</span></div>
      </div>
      <div class="pi-hero-range"><slot name="range" /></div>
      <div class="pi-hero-acts">
        <button class="pi-btn line" title="重读事件日志刷新统计" @click="emit('refresh')">⟳ 刷新</button>
        <ExportMenu @pick="onPick" />
        <button v-if="props.errorCount > 0" class="pi-btn line pi-btn-warn"
          title="运行错误日志导出" @click="emit('export-error')"><Icon name="warn" :size="13"/> 错误 {{ props.errorCount }}</button>
        <!-- ★W12-B 入口收敛：本格为全页唯一的「全部记录」入口。 -->
        <button class="pi-btn line" title="打开全量操作记录（类型 / 动作 / 时间三维筛选 + CSV 导出）"
          @click="emit('open-log')"><Icon name="folder" :size="13"/> 全部记录</button>
      </div>
    </div>
  </section>
</template>
