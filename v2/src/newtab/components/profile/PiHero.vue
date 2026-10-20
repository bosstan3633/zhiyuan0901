<script setup lang="ts">
/**
 * V3.9.3 画像洞察首屏重排：PiHero 只承担「页头 + 方向坐标」两件事。
 *   ① `.hero-row-top`  左 = 眉标 + 主标题；右 = 刷新 / 导出 / 错误 / 全部记录
 *   ② `.hero-compass-bar` = 使命主线 + ≤2 枚主攻胶囊
 *
 * 四格核心读数已整体迁入 PiOverview。此前 Hero 与概览双栏各渲染一遍同一组读数，
 * 首屏出现两层完全重复的指标；V3.9.3 起概览是四格唯一承载处，Hero 回到常驻路标角色。
 * 本组件零计算、零取 store。
 *
 * W12-B 页头三件套（刷新 · 导出 · 全部记录）与 E2E-21 选择器（.pi-hero）保持不变——
 *   本组件以 `class="pi-hero hero-card"` 双类共存，E2E 零修改直过（排期文档 §三-2 勘误）。
 */
import Icon from '@/shared/components/Icon.vue'
import ExportMenu, { type ExportFmt } from '@/newtab/components/dashboard/ExportMenu.vue'

const props = defineProps<{
  /** 使命主线（mission.content → vision.content，空则宿主传 '' 由本组件出轻引导） */
  missionText: string
  /** 主攻胶囊（≤2，进度 0-100） */
  focusPills: { id: string; name: string; progress: number }[]
  errorCount: number
}>()

const emit = defineEmits<{
  (e: 'refresh'): void
  (e: 'export', fmt: ExportFmt): void
  /** ★W12-B：全量操作记录抽屉入口（全页唯一一枚） */
  (e: 'open-log'): void
  (e: 'export-error'): void
  /** F2：使命为空的轻引导 → 前往方向台设定 */
  (e: 'goto-compass'): void
  /** 主攻胶囊点击 = 打开**这个项目**的详情抽屉（右侧滑出），不落统一的指标下钻。 */
  (e: 'open-project', projectId: string): void
}>()

function onPick(fmt: ExportFmt) { emit('export', fmt) }
</script>

<template>
  <section class="pi-hero hero-card">
    <!-- ① 首行两端对齐（F1）：1280px 视口下按钮组稳居右上，绝不掉行。
     ★W14-T2（用户拍板 2026-10-16 · 方案A 两行化）：副标题「不是又一个仪表盘…」整段退役
     （Hero 是常驻路标，不该是全页最大的标题块），眉标与主标题并作一行 → 首层从五行压到一行。 -->
    <div class="hero-row-top">
      <div class="hero-head">
        <div class="pi-hero-t"><span class="pi-hero-eyebrow"><span class="dot"></span>画像洞察</span>你的知识生命体征<span class="en">PROFILE INSIGHTS</span></div>
      </div>
      <div class="pi-hero-acts">
        <button class="pi-btn line" title="重读事件日志刷新统计" @click="emit('refresh')">⟳ 刷新</button>
        <ExportMenu @pick="onPick" />
        <button v-if="props.errorCount > 0" class="pi-btn line pi-btn-warn"
          title="运行错误日志导出" @click="emit('export-error')"><Icon name="warn" :size="13"/> 错误 {{ props.errorCount }}</button>
        <!-- ★W12-B 入口收敛（用户 2026-10-13 拍板）：AI 解读与今日战报两枚能力在下方模块各有同级入口，
             此格为全页唯一的「全部记录」入口。W13 起仍为刷新 · 导出 · 全部记录三件套（W12-B1 钉住）。 -->
        <button class="pi-btn line" title="打开全量操作记录（类型 / 动作 / 时间三维筛选 + CSV 导出）"
          @click="emit('open-log')"><Icon name="folder" :size="13"/> 全部记录</button>
      </div>
    </div>

    <!-- ② 通栏使命与主攻坐标带：首屏的方向上下文只在这里出现一次。 -->
    <div class="hero-compass-bar">
      <span class="hcb-mission" :title="props.missionText || '尚未设定使命愿景'">
        <i class="hcb-ico"><Icon name="compass" :size="13"/></i><b>使命主线</b>
        <em v-if="props.missionText">{{ props.missionText }}</em>
        <button v-else class="hcb-empty" @click="emit('goto-compass')">尚未设定使命愿景 —— 点击前往方向台设定 ›</button>
      </span>
      <span class="hcb-pills">
        <button v-for="(p, i) in props.focusPills.slice(0, 2)" :key="p.id" class="hcb-pill"
          :title="`主攻 ${i + 1} · ${p.name} · 进度 ${p.progress}% · 点击查看项目详情`"
          @click="emit('open-project', p.id)">
          <Icon name="main-focus" :size="13"/> 主攻 {{ i + 1 }}：{{ p.name }} <b>{{ p.progress }}%</b>
        </button>
      </span>
    </div>
  </section>
</template>
