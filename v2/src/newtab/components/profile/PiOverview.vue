<script setup lang="ts">
/**
 * 画像洞察 · 首屏状态双面板（★W17-C09 · 2026-10-20 用户拍板原型 profile-insights-review-v2.html）。
 *
 * 页面新定位：呈现「用户使用知源产品的状态」——产品使用状态 + 个人方向状态。
 *   左：知源产品使用状态（四格读数沿用既有口径 + 近 30 天使用构成条，可下钻）
 *   右：你的方向状态（使命主线完整呈现 + 主攻项目完整列表：全名 / 状态 / 进度条 / 点开详情抽屉）
 *
 * ★退役带备案：原右栏「今日焦点三行」整块退役——它与调度台首页重复，
 *   排三件事、勾选、归位、填空的能力唯一归调度台（用户 2026-10-20 拍板）。
 */
import Icon from '@/shared/components/Icon.vue'

export interface FocusProjectView {
  id: string
  name: string
  /** 0-100 */
  progress: number
  /** 停滞 / 已完成 / 推进中（由宿主按方向台同一口径判定） */
  state: 'active' | 'stalled' | 'done'
  /** 未完成任务数 */
  open: number
}

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
  /** 方向状态：使命主线（空串由本组件出轻引导） */
  missionText: string
  /** 主攻项目完整列表（≤3，项目名不截断） */
  focusProjects: FocusProjectView[]
}>()

const emit = defineEmits<{
  (e: 'kpi-drill', k: 'total' | 'entropy' | 'support' | 'focus'): void
  (e: 'topic-drill', k: 'topic-all' | 'topic-published' | 'topic-supported' | 'topic-month'): void
  (e: 'goto-compass'): void
  (e: 'open-project', projectId: string): void
}>()

const STATE_LABEL: Record<FocusProjectView['state'], string> = {
  active: '推进中', stalled: '停滞', done: '已完成'
}
/** 近 30 天使用构成（用三类在库占比作诚实近似；事件口径的 30 天窗口另见周期段） */
const mix = () => {
  const { res, task, curio, topic } = props.kindCounts
  const sum = res + task + curio + topic
  return { res, task, curio, topic, sum, resPct: sum ? Math.round(res / sum * 100) : 0, taskPct: sum ? Math.round(task / sum * 100) : 0, curioPct: sum ? Math.round(curio / sum * 100) : 0, topicPct: sum ? Math.round(topic / sum * 100) : 0 }
}
</script>

<template>
  <div class="pi-overview">
    <!-- 左：知源产品使用状态 -->
    <section class="pi-ov-card" aria-labelledby="pi-usage-title">
      <div class="pi-ov-head">
        <div class="t pi-ov-titleline">
          <span class="eyebrow">PRODUCT USAGE</span>
          <h2 id="pi-usage-title">知源产品使用状态</h2>
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

    <!-- 右：你的方向状态（使命 + 主攻项目完整呈现） -->
    <section class="pi-ov-card pi-ov-dir" aria-labelledby="pi-dir-title">
      <div class="pi-ov-head">
        <div class="t pi-ov-titleline">
          <span class="eyebrow">PERSONAL DIRECTION</span>
          <h2 id="pi-dir-title">你的方向状态</h2>
        </div>
      </div>
      <div class="pi-dir-mission">
        <span class="k">使命主线</span>
        <strong v-if="missionText" :title="missionText">{{ missionText }}</strong>
        <button v-else class="pi-dir-empty" @click="emit('goto-compass')">尚未设定使命愿景 —— 前往方向台设定 ›</button>
      </div>

      <div class="pi-dir-sub" title="项目名完整呈现 · 进度取自方向台">当前主攻项目</div>
      <!-- ★W18：主攻项目并排两列（C 布局）——单个项目时占满整行，不留半张空卡 -->
      <div v-if="focusProjects.length" class="pi-dir-cols" :class="{ single: focusProjects.length === 1 }">
        <button v-for="(p, i) in focusProjects" :key="p.id" class="pi-dir-item"
          :title="`${p.name} · ${STATE_LABEL[p.state]} · 进度 ${p.progress}% · 未完成 ${p.open} 项（点击项目可查看阶段目标与任务）`"
          @click="emit('open-project', p.id)">
          <span class="pi-dir-main">
            <span class="pi-dir-tag">主攻 {{ i + 1 }}</span>
            <span class="pi-dir-name">{{ p.name }}</span>
          </span>
          <span class="pi-dir-state" :class="p.state">{{ STATE_LABEL[p.state] }}</span>
          <span class="pi-dir-prog">
            <span class="pi-dir-track"><i :style="{ width: Math.max(0, Math.min(100, p.progress)) + '%' }"></i></span>
            <span class="pi-dir-pct">{{ p.progress }}%</span>
          </span>
        </button>
      </div>
      <div v-else class="pi-dir-none">
        还没有主攻项目。去方向台把最重要的 1-3 个项目标为主攻，这里就会显示它们的状态与进度。
        <button class="pi-dir-go" @click="emit('goto-compass')">前往方向台 ›</button>
      </div>
    </section>
  </div>
</template>

<style scoped>
/* ★V3.9.7：顶部两块面板按内容排布并同高。
   原先固定 440px 是为了对齐，但也把内容少的一侧拉出一大片空白；现在让同一行
   栅格自然取较高者的高度，两侧 stretch 对齐，内容直接向下接续。
   列宽由 pi-timeline.css 统一改为 1fr / 1fr。 */
.pi-overview { align-items: stretch; }
.pi-ov-card { height: auto; min-height: 0; display: flex; flex-direction: column; }
.pi-ov-card .pi-ov-kpis { margin-top: 0; }
.pi-ov-card .pi-ov-mix { margin-top: auto; }

/* ★W17-C09：右栏方向状态面板（使命完整 + 主攻项目完整呈现，项目名不截断） */
.pi-ov-dir { min-width: 0; overflow: hidden; border-color: color-mix(in srgb, var(--accent) 22%, var(--border)); }
.pi-ov-dir .pi-ov-head h2 { font-size: var(--fs-title); color: var(--accent-ink); }
.pi-dir-mission {
  display: flex; gap: 8px; align-items: center; min-width: 0;
  margin: 0; padding: 3px 0 3px 8px; box-shadow: inset 3px 0 0 var(--accent);
}
.pi-dir-mission .k { flex: none; font-size: var(--fs-micro); font-weight: 700; color: var(--text-4); letter-spacing: .06em; }
.pi-dir-mission strong { font-size: var(--fs-body); font-weight: 600; color: var(--text); line-height: 1.45; overflow-wrap: anywhere; }
.pi-dir-empty { background: none; border: 0; padding: 0; font: inherit; font-size: var(--fs-caption); font-weight: 600; color: var(--accent-ink); cursor: pointer; text-align: left; }
.pi-dir-empty:hover { text-decoration: underline; }
.pi-dir-sub { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; font-size: var(--fs-micro); font-weight: 700; color: var(--text-3); margin-bottom: 1px; }
/* C 布局：两个主攻项目并排；只有一个时独占整行（不留半张空卡） */
.pi-dir-cols { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 6px; align-content: start; }
.pi-dir-cols.single { grid-template-columns: minmax(0, 1fr); }
.pi-dir-item {
  display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 3px 6px; width: 100%; min-width: 0;
  padding: 6px 8px; border: 1px solid var(--border); border-radius: var(--radius-sm);
  background: var(--surface-2); text-align: left; font-family: inherit; cursor: pointer; transition: all var(--dur-fast);
}
.pi-dir-item:hover { border-color: color-mix(in srgb, var(--accent) 45%, var(--border)); background: var(--accent-light); }
.pi-dir-main { min-width: 0; display: flex; flex-direction: row; align-items: baseline; gap: 5px; flex-wrap: wrap; }
.pi-dir-tag { flex: none; font-size: var(--fs-micro); font-weight: 800; color: var(--accent-ink); letter-spacing: .04em; }
/* ★项目名不截断（C09 核心诉求）：允许换行、不设 max-width */
.pi-dir-name { min-width: 0; font-size: var(--fs-caption); font-weight: 700; color: var(--text); line-height: 1.4; overflow-wrap: anywhere; }
.pi-dir-state { align-self: center; flex: none; padding: 1px 6px; border-radius: 999px; border: 1px solid var(--border); font-size: var(--fs-micro); color: var(--text-3); background: var(--surface); white-space: nowrap; }
.pi-dir-state.stalled { color: var(--text-2); border-color: var(--border-strong); }
.pi-dir-state.done { color: var(--text-2); }
.pi-dir-prog { grid-column: 1 / -1; display: grid; grid-template-columns: minmax(0, 1fr) 30px; align-items: center; gap: 6px; }
.pi-dir-track { height: 3px; border-radius: 999px; background: var(--surface-3); overflow: hidden; }
.pi-dir-track i { display: block; height: 100%; border-radius: 999px; background: var(--accent); transition: width var(--dur-fast); }
.pi-dir-pct { text-align: right; font-size: var(--fs-micro); color: var(--text-3); font-variant-numeric: tabular-nums; }
.pi-dir-none { font-size: var(--fs-micro); color: var(--text-4); line-height: 1.6; padding: 4px 0; }
/* M6：文字链接视觉不变，盒子撑到 28px 下限，避免空态入口只有 19px 高。 */
.pi-dir-go { display: inline-flex; align-items: center; min-height: 28px; margin-top: 1px; border: 0; background: none; padding: 0 2px; font: inherit; font-size: var(--fs-micro); font-weight: 700; color: var(--accent-ink); cursor: pointer; }
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
/* 900px 以下（概览已折单列）与 640px 以下：自然排，不强行同高 */
@media (max-width: 900px) {
  .pi-ov-card { height: auto; }
  .pi-dir-cols { grid-template-columns: minmax(0, 1fr); }
}
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
