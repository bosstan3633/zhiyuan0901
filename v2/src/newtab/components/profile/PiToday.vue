<script setup lang="ts">
/**
 * PiToday —— 今天 · 使用概况（★W17-C09 重构 · 2026-10-20 用户拍板）。
 *
 * 两段式：
 *   ① #ins-today 一句人话诊断条（恒渲染；文案与 CTA 由宿主 buildConciseInsights 注入）
 *   ② `.strip4` 四格：今日入台 / 今日调出 / 今日焦点 (M/3) / 已备弹药
 *
 * ★退役带备案：原 ③ 紧凑三行对账区块（序号 + 勾选 + 标题 + 项目徽标 + 归位/填入）
 *   整块退役——它与调度台首页的「今日三件事」重复，用户明确要求画像页不再重复列出。
 *   排三件事 / 勾选 / 归位 / 空槽填入的能力唯一归调度台；本页「今日焦点」格只显示
 *   已排计数，点击跳回调度台。组件零取 store，数值全部由宿主传入。
 */
import Icon from '@/shared/components/Icon.vue'
import type { ConciseInsight } from '@/shared/utils/reviewReport'
import type { FocusSlot } from '@/shared/models'

/** 今日焦点行的宿主侧形状——★W17-C09 起本组件不再渲染三件事行，但宿主诊断口径仍消费该类型。 */
export interface TodayRow {
  idx: number
  slot: FocusSlot
  hasProject: boolean
  focused: boolean
  projectName: string
  projectId: string
  supportCount: number
  matchCount: number
  canBind: boolean
}

const props = defineProps<{
  todayAdd: number
  todayCalled: number
  /** 今日焦点 M/3（有内容的槽位数 / 3） */
  focusFilled: number
  /** 已备弹药 K：三件事所关联任务的 SupportLink 去重资源卡总数 */
  ammo: number
  /** 固定 3 槽（只用于分母口径，不再渲染行） */
  slotCount: number
  /** ★W13-T7：诊断条改注入宿主 buildConciseInsights 的 today 段（形状 = ConciseInsight） */
  insight: ConciseInsight
}>()

const emit = defineEmits<{
  /** F8：入台 / 调出两格下钻（今日战报对应档） */
  (e: 'drill', k: 'd-in' | 'd-call' | 'd-ammo'): void
  (e: 'open-battle'): void
  /** 今日焦点格 = 只读计数 + 去调度台调整 */
  (e: 'open-focus'): void
  /** F7 诊断条动作钮分发 */
  (e: 'insight-action', action: string): void
}>()
</script>

<template>
  <section class="pi-mod" id="mod-now">
    <div class="pi-mod-h">
      <span class="pi-mod-ico i-now"><Icon name="barchart" :size="13"/></span>
      <div class="pi-mod-t">
        <h2>今天的使用情况<span class="en">TODAY</span></h2>
        <p>当天的四类记录，全部来自本机事件日志。排三件事请去调度台——本页只呈现使用状态。</p>
      </div>
      <div class="pi-mod-acts">
        <button class="pi-btn line" @click="emit('open-battle')">打开战报</button>
      </div>
    </div>
    <div class="pi-mod-b">
      <!-- ① 一句人话诊断条（恒渲染） -->
      <div id="ins-today" class="one-insight" :class="props.insight.warn ? 'warn' : 'info'">
        <span class="oi-ic"><Icon v-if="props.insight.warn" name="warn" :size="15"/><Icon v-else name="bulb" :size="15"/></span>
        <span class="oi-text" v-html="props.insight.html"></span>
        <button class="act-link" :title="props.insight.html" @click="emit('insight-action', props.insight.ctaAction)">
          {{ props.insight.ctaLabel }}
        </button>
      </div>

      <!-- ② 唯一一行 4 等宽胶囊（F8） -->
      <div class="pi-strip">
        <span class="pi-strip-lab">今日</span>
        <div class="strip4">
          <button class="pi-chip up" title="今日入台 · action=create（含导入）" @click="emit('drill', 'd-in')">
            <span class="v">{{ props.todayAdd }}<small>张</small></span><span class="l">今日入台</span><span class="ar">▸</span>
          </button>
          <button class="pi-chip acc" title="今日调出 · action=call（被打开的卡片）" @click="emit('drill', 'd-call')">
            <span class="v">{{ props.todayCalled }}<small>次</small></span><span class="l">今日调出</span><span class="ar">▸</span>
          </button>
          <button class="pi-chip" title="今日焦点 · 已排任务槽位（只读计数；点击去调度台调整）" @click="emit('open-focus')">
            <span class="v">{{ props.focusFilled }}/{{ props.slotCount }}<small>件</small></span><span class="l">今日焦点</span><span class="ar">▸</span>
          </button>
          <button class="pi-chip ok" title="已备弹药 · 三件事关联任务的支撑资源卡去重总数（点击看清单）"
            @click="emit('drill', 'd-ammo')">
            <span class="v">{{ props.ammo }}<small>张</small></span><span class="l">已备弹药</span><span class="ar">▸</span>
          </button>
        </div>
      </div>
    </div>
  </section>
</template>
