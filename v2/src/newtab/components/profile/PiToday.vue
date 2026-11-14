<script setup lang="ts">
/**
 * PiToday —— 今天 · 使用概况（★W17-C09 重构 · 2026-10-20 用户拍板）。
 *
 * 两段式：
 *   ① `.strip4` 四格：今日入台 / 今日调出 / 今日焦点 (M/3) / 已备弹药
 *
 * ★退役带备案：原 ③ 紧凑三行对账区块（序号 + 勾选 + 标题 + 项目徽标 + 归位/填入）
 *   整块退役——它与调度台首页的「今日三件事」重复，用户明确要求画像页不再重复列出。
 *   排三件事 / 勾选 / 归位 / 空槽填入的能力唯一归调度台；本页「今日焦点」格只显示
 *   已排计数，点击跳回调度台。组件零取 store，数值全部由宿主传入。
 */
import Icon from '@/shared/components/Icon.vue'
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
  /** ★V3.9.6 双口径补齐：今日「导 N」= 今日被导入的卡数（导入继承原 createdAt，不混入新建数）。
   *  手册「新增/导入双口径（V2.21.3 起）」白纸黑字承诺过「导入的卡单独显示『导 Y』」，
   *  但 R48-5 判据只钉住了数据层（todayImportCount），界面那一半一直是**登记待接**的欠账。
   *  本轮补上：徽标挂在段头右缘（不是 strip4 里），因为它是**同一读数的另一个口径**，
   *  放进四格网格会挤掉一格既有读数并破坏「恰四枚 chip」的定版断言。
   *  0 时不渲染（没有导入就别占一格宽度）。 */
  todayImport: number
  /** 今日焦点 M/3（有内容的槽位数 / 3） */
  focusFilled: number
  /** 已备弹药 K：三件事所关联任务的 SupportLink 去重资源卡总数 */
  ammo: number
  /** 固定 3 槽（只用于分母口径，不再渲染行） */
  slotCount: number
}>()

const emit = defineEmits<{
  /** F8：入台 / 调出两格下钻（今日战报对应档） */
  (e: 'drill', k: 'd-in' | 'd-call' | 'd-ammo'): void
  (e: 'open-battle'): void
  /** 今日焦点格 = 只读计数 + 去调度台调整 */
  (e: 'open-focus'): void
}>()
</script>

<template>
  <section class="pi-mod" id="mod-now">
    <div class="pi-mod-h">
      <span class="pi-mod-ico i-now"><Icon name="barchart" :size="13"/></span>
      <div class="pi-mod-t">
        <h2>今天的使用情况<span class="en">TODAY</span></h2>
        <p>只陈列今天的使用事实与计划位状态；判断留给用户。</p>
      </div>
      <div class="pi-mod-acts">
        <!-- ★V3.9.6 双口径徽标：今日入台 N 张里，有 M 张是**导入**的（不是今天新建的）。
             放在段头右缘而非格内——它是「今日入台」这枚读数的口径拆分，不是第五个读数。 -->
        <span v-if="props.todayImport > 0" class="pi-imp-badge"
          :title="`今日入台 ${props.todayAdd} 张中，${props.todayImport} 张是导入的（导入继承原创建时间，不计入今天新建）`">
          <Icon name="upload" :size="13"/> 导 {{ props.todayImport }}
        </span>
        <button class="pi-btn line" @click="emit('open-battle')">打开战报</button>
      </div>
    </div>
    <div class="pi-mod-b">
      <!-- 唯一一行 4 等宽胶囊（F8） -->
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
