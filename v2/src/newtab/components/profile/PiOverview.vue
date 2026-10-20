<script setup lang="ts">
/**
 * 画像洞察 · 首屏概览。
 *
 * 左栏先回答「这周精力放在哪里」，右栏回答「今天从哪三件事开始」。
 * 组件只消费宿主传入的数据；勾选、归位、空槽补位都通过事件回到宿主，保持单一写入出口。
 */
import Icon from '@/shared/components/Icon.vue'
import type { ConciseInsight } from '@/shared/utils/reviewReport'
import type { FocusRecommend, TodayRow } from './PiToday.vue'

const props = defineProps<{
  weekRange: string
  weekInsight: ConciseInsight
  todayInsight: ConciseInsight
  /** 页头四格读数的下钻入口：口径与 PiHero 完全同源，只是换到概览里承载。 */
  total: number
  kindCounts: { res: number; task: number; curio: number }
  entropy: number
  /** Top 3 高频标签（知识熵口径 tooltip，与下钻 toast 同源） */
  topTags: string[]
  supportRate: number
  focusShare: number
  rows: (TodayRow | null)[]
  recommend: FocusRecommend | null
  focusFilled: number
}>()

const emit = defineEmits<{
  (e: 'week-action', action: string): void
  (e: 'today-action', action: string): void
  (e: 'kpi-drill', k: 'total' | 'entropy' | 'support' | 'focus'): void
  (e: 'open-focus'): void
  (e: 'toggle', idx: number): void
  (e: 'bind', idx: number): void
  (e: 'fill', idx: number): void
  (e: 'open-project', projectId: string): void
}>()
</script>

<template>
  <div class="pi-overview">
    <section class="pi-ov-card" aria-labelledby="pi-week-overview-title">
      <div class="pi-ov-head">
        <div class="t">
          <span class="eyebrow">DIRECTION · THIS WEEK</span>
          <h2 id="pi-week-overview-title">这周，你把精力放在哪里</h2>
          <p>先看方向，再看节奏。数字只描述事实，不评价好坏。</p>
        </div>
        <span class="meta">{{ weekRange }}</span>
      </div>
      <div class="pi-ov-insight">
        <span class="ic"><Icon :name="weekInsight.warn ? 'warn' : 'bulb'" :size="14"/></span>
        <span class="body" v-html="weekInsight.html"></span>
        <button class="cta" :title="weekInsight.html" @click="emit('week-action', weekInsight.ctaAction)">
          {{ weekInsight.ctaLabel }}
        </button>
      </div>
      <div class="pi-ov-kpis">
        <button class="pi-ov-kpi"
          :title="`全库净资产 = 三类未删卡合计（回收站不计）· 资源 ${kindCounts.res} · 任务 ${kindCounts.task} · 好奇 ${kindCounts.curio} —— 点击看明细`"
          @click="emit('kpi-drill', 'total')">
          <span class="v">{{ total.toLocaleString() }}<small>张</small></span>
          <span class="l">全库净资产</span>
          <span class="d">资源 {{ kindCounts.res }} · 任务 {{ kindCounts.task }} · 好奇 {{ kindCounts.curio }}</span>
        </button>
        <button class="pi-ov-kpi"
          :title="`知识熵 ${entropy.toFixed(1)} bit = 卡片标签分布的离散度（越高铺得越散）· 高频标签：${topTags.length ? topTags.join(' · ') : '尚无带标签的卡片'} —— 点击看明细`"
          @click="emit('kpi-drill', 'entropy')">
          <span class="v">{{ entropy.toFixed(1) }}<small>bit</small></span>
          <span class="l">知识熵 · 聚焦度</span>
          <span class="d">越低越集中</span>
        </button>
        <button class="pi-ov-kpi"
          :title="`任务有证据支撑 ${supportRate}% = 有 ≥1 张支撑资源卡关联的未删任务 ÷ 未删任务总数 —— 点击看明细`"
          @click="emit('kpi-drill', 'support')">
          <span class="v">{{ supportRate }}<small>%</small></span>
          <span class="l">任务有证据支撑</span>
          <span class="d">显式关联，不是标签相似</span>
        </button>
        <button class="pi-ov-kpi pi-ov-kpi-bar"
          :title="`近 30 天精力落主攻 ${focusShare}% = 归属主攻项目任务的有效动作 ÷ 近 30 天总有效动作 —— 点击看明细`"
          @click="emit('kpi-drill', 'focus')">
          <span class="v">{{ focusShare }}<small>%</small></span>
          <span class="l">近 30 天精力落主攻</span>
          <span class="d">主攻由方向台设定</span>
          <span class="pi-ov-kpi-track" aria-hidden="true">
            <span class="pi-ov-kpi-fill" :style="{ width: Math.max(0, Math.min(100, props.focusShare)) + '%' }"></span>
          </span>
        </button>
      </div>
      <div class="pi-ov-foot">
        <span><b>本周</b> 是节奏与方向的主视图</span>
        <span>切到「本周」看完整分布与规则对照 ›</span>
      </div>
    </section>

    <section class="pi-ov-card" aria-labelledby="pi-today-overview-title">
      <div class="pi-ov-head">
        <div class="t">
          <span class="eyebrow">FOCUS · TODAY</span>
          <h2 id="pi-today-overview-title">今天，从哪三件事开始</h2>
          <p>只保留今天真正要推进的动作。</p>
        </div>
        <button class="pi-ov-link" @click="emit('open-focus')">去调度台 ›</button>
      </div>
      <div class="pi-ov-insight">
        <span class="ic"><Icon :name="todayInsight.warn ? 'warn' : 'bulb'" :size="14"/></span>
        <span class="body" v-html="todayInsight.html"></span>
        <button class="cta" :title="todayInsight.html" @click="emit('today-action', todayInsight.ctaAction)">
          {{ todayInsight.ctaLabel }}
        </button>
      </div>
      <div class="pi-ov-lines">
        <div v-for="(r, i) in rows" :key="r ? r.slot.id : 'ov-e' + i" class="pi-ov-line"
          :class="{ done: r && r.slot.done }">
          <button class="pi-ov-check" :class="{ done: r && r.slot.done }"
            :disabled="!r" :title="r ? (r.slot.done ? '取消完成' : '就地完成') : '空槽'"
            @click="r && emit('toggle', r.idx)">
            <Icon v-if="r && r.slot.done" name="check" :size="11"/>
          </button>
          <template v-if="r">
            <span class="title">{{ r.slot.text || '（空槽）' }}</span>
            <button v-if="r.focused && r.projectId" class="tag main" :title="`主攻项目：${r.projectName} · 查看项目`"
              @click="emit('open-project', r.projectId)">
              <Icon name="main-focus" :size="11"/> {{ r.projectName }}
            </button>
            <span v-else-if="r.hasProject" class="tag" :title="`所属项目：${r.projectName}`">
              <Icon name="folder" :size="11"/> {{ r.projectName }}
            </span>
            <span v-else class="tag">未挂项目</span>
            <button v-if="r.canBind" class="line-act" :title="`归入主攻并绑定 ${r.matchCount} 张支撑卡`"
              @click="emit('bind', r.idx)">归位 ›</button>
          </template>
          <template v-else>
            <span class="empty">空槽 · 从任务库选一件</span>
            <button v-if="recommend && recommend.idx === i" class="line-act" :title="recommend.why"
              @click="emit('fill', i)">＋ 填入</button>
            <button v-else class="line-act" @click="emit('open-focus')">打开 ›</button>
          </template>
        </div>
      </div>
      <div class="pi-ov-progress"><b>{{ focusFilled }} / 3</b> 今日焦点已排</div>
    </section>
  </div>
</template>
