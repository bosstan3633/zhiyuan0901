<script setup lang="ts">
/**
 * W14-T2（2026-10-16 · 用户拍板方案A 两行化）PiHero —— 常驻路标，两行结构 `.hero-card`：
 *   ① `.hero-row-top`  两端对齐页头：左 = 眉标 + 主标题（同行的 fs-title）；右 = 刷新/导出/错误/全部记录
 *   ② `.hero-data-row` 数据行 = `.hero-compass-bar`（🧭 使命主线 + ≤2 枚 🚀 主攻胶囊）
 *                          并排 `.hero-kpis-grid`（4 等宽底盘：全库净资产 / 知识熵 / 证据支撑 / 精力落主攻）
 *
 * ★为什么压：Hero 在页面最顶部且常驻，内容全是"读一眼就够"的底盘读数。原先三层（眉标行 + 22px 大标题
 *   + 两行副标题 + 使命带 + 三行排布的四张卡）实测约 378px、占首屏约三分之一，而今天的三件事才是主角 ——
 *   主次颠倒。压后约 150px，副标题「不是又一个仪表盘…」按用户拍板整段退役（它是页面定调语，
 *   但不该占常驻区的三行高度），眉标降为标题前的一枚小字。
 *
 * ★W13-D1 指标去重：原「连续打卡 / 活跃天数 / 最长连续」三枚 chip 整体迁出本组件
 *   （连续打卡 + 最长连续 → PiYear 年度 strip4；活跃天数同去），全页仅时间轴一处展示。
 *   全部数值由宿主 ProfileInsights 计算后传入；本组件零计算、零取 store。
 *
 * W12-B 页头三件套（刷新 · 导出 · 全部记录）与 E2E-21 选择器（.pi-hero）保持不变——
 *   本组件以 `class="pi-hero hero-card"` 双类共存，E2E 零修改直过（排期文档 §三-2 勘误）。
 */
import ExportMenu, { type ExportFmt } from '@/newtab/components/dashboard/ExportMenu.vue'

const props = defineProps<{
  total: number
  kindCounts: { res: number; task: number; curio: number }
  entropy: number
  /** Top 3 高频标签（知识熵卡副行） */
  topTags: string[]
  /** 任务证据支撑率 %（F3 口径：有 SupportLink 的未删任务占比） */
  supportRate: number
  /** 近 30 天精力落主攻 %（F3 口径：归属主攻的有效动作占比） */
  focusShare: number
  /** 使命主线（mission.content → vision.content，空则宿主传 '' 由本组件出轻引导） */
  missionText: string
  /** 主攻胶囊（≤2，进度 0-100） */
  focusPills: { id: string; name: string; progress: number }[]
  errorCount: number
}>()

const emit = defineEmits<{
  (e: 'drill', kpi: 'total' | 'entropy' | 'support' | 'focus'): void
  (e: 'refresh'): void
  (e: 'export', fmt: ExportFmt): void
  /** ★W12-B：全量操作记录抽屉入口（全页唯一一枚） */
  (e: 'open-log'): void
  (e: 'export-error'): void
  /** F2：使命为空的轻引导 → 前往方向台设定 */
  (e: 'goto-compass'): void
  /** ★W14-T1（用户拍板 2026-10-16）：主攻胶囊点击 = 打开**这个项目**的详情抽屉（右侧滑出）。
      原行为 emit('drill','focus') 两枚胶囊落同一个「主攻动作记录」抽屉，按下那一下丢掉了项目身份 ——
      现与 drill 平行分出独立发射器，drill 的 focus 键语义仍归「近30天精力落主攻」那张底盘卡。 */
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
        <button v-if="props.errorCount > 0" class="pi-btn line" style="color:var(--warning)"
          title="运行错误日志导出" @click="emit('export-error')">⚠ 错误 {{ props.errorCount }}</button>
        <!-- ★W12-B 入口收敛（用户 2026-10-13 拍板）：AI 解读与今日战报两枚能力在下方模块各有同级入口，
             此格为全页唯一的「全部记录」入口。W13 起仍为刷新 · 导出 · 全部记录三件套（W12-B1 钉住）。 -->
        <button class="pi-btn line" title="打开全量操作记录（类型 / 动作 / 时间三维筛选 + CSV 导出）"
          @click="emit('open-log')">🗂 全部记录</button>
      </div>
    </div>

<!-- ★W14-T2 方案A 两行化：② 通栏使命与主攻坐标带（F2）＋ ③ 4 等宽底盘指标卡（F3）并作一行
     —— Hero 常驻页面顶部，是路标不是舞台；原先三层的体量把首屏真正的主角（今天的三件事）挤到了下半屏。
     负锚：`.hero-kpis-grid` 仍是 repeat(4,1fr) 等宽铺满（N7 钉住，不许改回居中或不等宽）。 -->
    <div class="hero-data-row">
      <!-- ② 使命主线 + 主攻胶囊（F2） -->
      <div class="hero-compass-bar">
        <span class="hcb-mission" :title="props.missionText || '尚未设定使命愿景'">
          <i class="hcb-ico">🧭</i><b>使命主线</b>
          <em v-if="props.missionText">{{ props.missionText }}</em>
          <button v-else class="hcb-empty" @click="emit('goto-compass')">尚未设定使命愿景 —— 点击前往方向台设定 ›</button>
        </span>
        <span class="hcb-pills">
          <button v-for="(p, i) in props.focusPills.slice(0, 2)" :key="p.id" class="hcb-pill"
            :title="`主攻 ${i + 1} · ${p.name} · 进度 ${p.progress}% · 点击查看项目详情`"
            @click="emit('open-project', p.id)">
            🚀 主攻 {{ i + 1 }}：{{ p.name }} <b>{{ p.progress }}%</b>
          </button>
        </span>
      </div>

      <!-- ③ 4 等宽底盘指标卡（F3） -->
      <div class="hero-kpis-grid">
        <button class="hero-kpi" title="卡片总量 · 未删除；副行为三类卡构成" @click="emit('drill', 'total')">
          <span class="v">{{ props.total.toLocaleString() }}<small>张</small></span>
          <span class="l">全库净资产</span>
          <span class="d">资源 {{ props.kindCounts.res }} · 任务 {{ props.kindCounts.task }} · 好奇 {{ props.kindCounts.curio }}</span>
        </button>
        <button class="hero-kpi" title="知识熵 · 卡片标签分布离散度（bit）；点击看高频标签簇" @click="emit('drill', 'entropy')">
          <span class="v">{{ props.entropy.toFixed(1) }}<small>bit</small></span>
          <span class="l">知识熵 (聚焦度)</span>
          <span class="d">{{ props.topTags.length ? props.topTags.join(' · ') : '尚无带标签的卡片' }}</span>
        </button>
        <button class="hero-kpi" title="任务有证据支撑 = 有支撑资源关联的未删任务 ÷ 未删任务总数" @click="emit('drill', 'support')">
          <span class="v">{{ props.supportRate }}<small>%</small></span>
          <span class="l">任务有证据支撑</span>
          <span class="d">已挂支撑资源卡的任务占比</span>
        </button>
        <button class="hero-kpi" title="近30天精力落主攻 = 归属主攻项目的有效动作 ÷ 近30天总有效动作" @click="emit('drill', 'focus')">
          <span class="v">{{ props.focusShare }}<small>%</small></span>
          <span class="l">近30天精力落主攻</span>
          <span class="d">有效动作落入主攻项目比</span>
        </button>
      </div>
    </div>
  </section>
</template>
