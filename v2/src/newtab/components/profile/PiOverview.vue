<script setup lang="ts">
/**
 * 画像洞察 · 首屏状态双面板（★W17-C09 · 2026-10-20 用户拍板原型 profile-insights-review-v2.html）。
 *
 * 卡片分析首层：只保留卡片构成与使用状态，不再重复方向台的主攻项目信息。
 *
 * ★退役带备案：原右栏「今日焦点三行」整块退役——它与调度台首页重复，
 *   排三件事、勾选、归位、填空的能力唯一归调度台（用户 2026-10-20 拍板）。
 */
import Icon from '@/shared/components/Icon.vue'

const props = defineProps<{
  /** 四格读数：全库净资产 / 知识熵 / 证据支撑率 / 近 30 天精力落主攻 */
  total: number
  kindCounts: { res: number; task: number; curio: number; topic: number }
  topicStats: { all: number; published: number; supported: number; month: number }
  entropy: number
  topTags: string[]
  supportRate: number
  focusShare: number
  /** 今日导入卡数：保留“新增 / 导入”双口径，避免 PiToday 退役后旧承诺从界面消失。 */
  todayImport: number
}>()

const emit = defineEmits<{
  (e: 'kpi-drill', k: 'total' | 'entropy' | 'support' | 'focus'): void
  (e: 'topic-drill', k: 'topic-all' | 'topic-published' | 'topic-supported' | 'topic-month'): void
}>()

/** 近 30 天使用构成（用三类在库占比作诚实近似；事件口径的 30 天窗口另见周期段） */
const mix = () => {
  const { res, task, curio, topic } = props.kindCounts
  const sum = res + task + curio + topic
  return { res, task, curio, topic, sum, resPct: sum ? Math.round(res / sum * 100) : 0, taskPct: sum ? Math.round(task / sum * 100) : 0, curioPct: sum ? Math.round(curio / sum * 100) : 0, topicPct: sum ? Math.round(topic / sum * 100) : 0 }
}
</script>

<template>
  <div class="pi-overview">
    <!-- 卡片构成与使用 -->
    <section class="pi-ov-card" aria-labelledby="pi-usage-title">
      <div class="pi-ov-head">
        <div class="t pi-ov-titleline">
          <span class="eyebrow">CARD COMPOSITION</span>
          <h2 id="pi-usage-title">卡片构成与使用</h2>
          <span class="pi-ov-sub">全库资产、资源支撑与主攻投入</span>
        </div>
        <span v-if="todayImport > 0" class="pi-imp-badge"
          :title="`今日导入 ${todayImport} 张卡；导入继承原创建时间，不计入今天新建`">
          <Icon name="upload" :size="13" /> 导 {{ todayImport }}
        </span>
      </div>
      <div class="pi-ov-kpis">
        <button class="pi-ov-kpi"
          :title="`全库净资产 = 四类未删卡合计（回收站不计）· 资源 ${kindCounts.res} · 任务 ${kindCounts.task} · 好奇 ${kindCounts.curio} · 选题 ${kindCounts.topic} —— 点击看明细`"
          @click="emit('kpi-drill', 'total')">
          <span class="v">{{ total.toLocaleString() }}<small>张</small></span>
          <span class="l">在库卡片</span>
        </button>
        <button class="pi-ov-kpi"
          :title="`知识熵 ${entropy.toFixed(1)} bit = 卡片标签分布的离散度（越高铺得越散）· 高频标签：${topTags.length ? topTags.join(' · ') : '尚无带标签的卡片'} —— 点击看明细`"
          @click="emit('kpi-drill', 'entropy')">
          <span class="v">{{ entropy.toFixed(1) }}<small>bit</small></span>
          <span class="l">标签分布</span>
        </button>
        <button class="pi-ov-kpi"
          :title="`任务有证据支撑 ${supportRate}% = 有 ≥1 张支撑资源卡关联的未删任务 ÷ 未删任务总数 —— 点击看明细`"
          @click="emit('kpi-drill', 'support')">
          <span class="v">{{ supportRate }}<small>%</small></span>
          <span class="l">任务有资源支撑</span>
        </button>
        <button class="pi-ov-kpi pi-ov-kpi-bar"
          :title="`近 30 天精力落主攻 ${focusShare}% = 归属主攻项目任务的有效动作 ÷ 近 30 天总有效动作 —— 点击看明细`"
          @click="emit('kpi-drill', 'focus')">
          <span class="v">{{ focusShare }}<small>%</small></span>
          <span class="l">近 30 天精力落主攻</span>
          <span class="pi-ov-kpi-track" aria-hidden="true">
            <span class="pi-ov-kpi-fill" :style="{ width: Math.max(0, Math.min(100, props.focusShare)) + '%' }"></span>
          </span>
        </button>
      </div>
      <div class="pi-ov-topic-band" aria-label="选题成果指标">
        <span class="pi-ov-topic-head"><b>选题成果</b></span>
        <div class="pi-ov-topic-grid">
          <button type="button" @click="emit('topic-drill', 'topic-all')">
            <strong>{{ topicStats.all }}</strong><span>在库选题</span>
          </button>
          <button type="button" @click="emit('topic-drill', 'topic-published')">
            <strong>{{ topicStats.published }}</strong><span>已发布</span>
          </button>
          <button type="button" @click="emit('topic-drill', 'topic-supported')">
            <strong>{{ topicStats.supported }}</strong><span>有资源支撑</span>
          </button>
          <button type="button" @click="emit('topic-drill', 'topic-month')">
            <strong>{{ topicStats.month }}</strong><span>本月新增</span>
          </button>
        </div>
        <button class="pi-ov-topic-all" type="button" @click="emit('topic-drill', 'topic-all')">全部 <span>›</span></button>
      </div>
      <div v-if="mix().sum" class="pi-ov-mix">
        <span class="pi-ov-mix-lab">在库构成</span>
        <span class="pi-ov-mix-bar" aria-hidden="true">
          <i class="m-res" :style="{ width: mix().resPct + '%' }"></i>
          <i class="m-task" :style="{ width: mix().taskPct + '%' }"></i>
          <i class="m-curio" :style="{ width: mix().curioPct + '%' }"></i>
          <i class="m-topic" :style="{ width: mix().topicPct + '%' }"></i>
        </span>
        <span class="pi-ov-mix-tx">资源 {{ mix().resPct }}% · 任务 {{ mix().taskPct }}% · 好奇 {{ mix().curioPct }}% · 选题 {{ mix().topicPct }}%</span>
      </div>
    </section>
  </div>
</template>

<style scoped>
/* V4.7.7：卡片分析首层只讲卡片自身，不再重复方向台。 */
.pi-overview { display: block; }
.pi-ov-card { height: auto; min-height: 0; display: flex; flex-direction: column; }
.pi-ov-card .pi-ov-kpis { margin-top: 0; }
.pi-ov-card .pi-ov-mix { margin-top: auto; }
.pi-ov-sub { color: var(--text-4); font-size: var(--fs-micro); white-space: nowrap; }
.pi-ov-kpis { margin-inline: -2px; }
.pi-ov-kpi { min-height: 58px; padding: 8px 10px 6px; }
.pi-ov-kpi .v { font-size: calc(var(--fs-headline) + 1px); }
.pi-ov-topic-band { display: flex; align-items: center; gap: 7px; margin-top: 0; padding: 4px 7px; border: 1px solid color-mix(in srgb, var(--accent) 16%, var(--border)); border-radius: var(--radius-sm); background: linear-gradient(135deg, color-mix(in srgb, var(--accent) 6%, var(--surface)), var(--surface) 62%); }
.pi-ov-topic-head { flex: none; display: flex; align-items: baseline; gap: 7px; min-width: 0; }
.pi-ov-topic-head b { color: var(--text); font-size: var(--fs-caption); letter-spacing: .02em; }
.pi-ov-topic-grid { display: grid; flex: 1; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 4px; min-width: 0; }
.pi-ov-topic-grid button { display: flex; min-width: 0; align-items: baseline; justify-content: center; gap: 4px; padding: 3px 4px; border: 1px solid color-mix(in srgb, var(--accent) 12%, var(--border)); border-radius: 6px; background: color-mix(in srgb, var(--surface) 88%, transparent); color: inherit; font-family: inherit; text-align: left; cursor: pointer; transition: border-color var(--dur-fast), background var(--dur-fast); }
.pi-ov-topic-grid button:hover { border-color: color-mix(in srgb, var(--accent) 44%, var(--border)); background: var(--accent-light); transform: translateY(-1px); }
.pi-ov-topic-grid strong { color: var(--text); font-size: var(--fs-sub); line-height: 1.15; font-variant-numeric: tabular-nums; }
.pi-ov-topic-grid span { overflow: hidden; color: var(--text-3); font-size: var(--fs-tiny); text-overflow: ellipsis; white-space: nowrap; }
.pi-ov-topic-all { flex: none; padding: 2px 1px; border: 0; background: none; color: var(--accent-ink); font: inherit; font-size: var(--fs-tiny); font-weight: 700; white-space: nowrap; cursor: pointer; }
.pi-ov-topic-all:hover { text-decoration: underline; }
.pi-ov-mix { display: flex; align-items: center; gap: 7px; padding-top: 5px; border-top: 1px solid var(--border); font-size: var(--fs-tiny); color: var(--text-4); min-width: 0; }
.pi-ov-mix-lab { flex: none; }
.pi-ov-mix-bar { flex: 1; min-width: 40px; height: 4px; display: flex; border-radius: 999px; overflow: hidden; background: var(--surface-3); }
.pi-ov-mix-bar i { display: block; height: 100%; }
.pi-ov-mix-bar .m-res { background: var(--accent); }
.pi-ov-mix-bar .m-task { background: var(--info-blue); }
.pi-ov-mix-bar .m-curio { background: var(--success); }
.pi-ov-mix-bar .m-topic { background: color-mix(in srgb, var(--accent) 62%, var(--info-blue)); }
.pi-ov-mix-tx { flex: none; white-space: nowrap; }
@media (max-width: 640px) {
  .pi-ov-topic-band { flex-wrap: wrap; }
  .pi-ov-topic-head { width: 100%; }
  .pi-ov-topic-all { margin-left: auto; }
  .pi-ov-mix { flex-wrap: wrap; }
  .pi-ov-mix-bar { order: 3; flex-basis: 100%; }
  .pi-ov-mix-tx { white-space: normal; }
  .pi-ov-topic-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
</style>
