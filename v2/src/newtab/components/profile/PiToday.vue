<script setup lang="ts">
/**
 * W13-T3（2026-10-16 · 画像洞察极简认知版 D2/F7~F11）PiToday —— 三段式极简法则：
 *   ① #ins-today `.one-insight` 一句人话诊断条（三态由宿主确定性推导——**恒渲染，
 *      不再有 `todayAdd === 0` 时洞察区整体消失的静默分支**，W13-2 钉住）
 *   ② `.strip4` 唯一一行 4 等宽数字胶囊：今日入台 / 今日调出 / 今日焦点 (M/3) / 已备弹药 (K张)
 *      （★W13-D1 指标去重：连续打卡迁 PiYear 年度段，今日移出随 F8 四格定版退役出 strip；
 *       连续打卡 chip 的 open-drill 通道随迁，见 onTodayDrill 收窄注释）
 *   ③ `.f3-compact` 紧凑三行对账：序号 + 就地勾选 + 标题 + 项目徽标 + 支撑弹药数
 *      + 游离行「🔗 归入主攻 + 绑 N 张卡」（F10）+ 空槽「＋ 一键填入」推荐行（F11）
 *
 * 全部数值、行详情、洞察文案、空槽推荐由宿主 ProfileInsights 推导传入；本组件零取 store。
 */
import type { FocusSlot } from '@/shared/models'
import type { ConciseInsight } from '@/shared/utils/reviewReport'

export interface TodayRow {
  idx: number
  slot: FocusSlot
  /** 任务已挂项目 */
  hasProject: boolean
  /** 挂在主攻项目（isFocused 且未归档） */
  focused: boolean
  projectName: string
  /** ★W14-T1：所属项目 id —— 主攻/项目标签改可点开项目详情抽屉的载体（无项目时为 ''） */
  projectId: string
  /** 该任务支撑资源卡去重数 */
  supportCount: number
  /** 游离/无支撑时按标题关键词+标签预筛资源池的命中数（F10 按钮文案「绑 N 张卡」） */
  matchCount: number
  /** 未挂项目 或 0 支撑 → 显示 F10 归位绑卡按钮 */
  canBind: boolean
}
export interface FocusRecommend {
  idx: number
  title: string
  why: string
}

const props = defineProps<{
  todayAdd: number
  todayCalled: number
  /** 今日焦点 M/3（有内容的槽位数 / 3） */
  focusFilled: number
  /** 已备弹药 K：三件事所关联任务的 SupportLink 去重资源卡总数 */
  ammo: number
  /** ★W13-T7：诊断条改注入宿主 buildConciseInsights 的 today 段（形状 = ConciseInsight，组件不再自算文本） */
  insight: ConciseInsight
  /** 固定 3 槽：null = 空槽 */
  rows: (TodayRow | null)[]
  /** F11 空槽推荐（首个空槽显示；null = 无可推荐） */
  recommend: FocusRecommend | null
}>()

const emit = defineEmits<{
  /** F8：入台 / 调出两格下钻（今日战报对应档） */
  (e: 'drill', k: 'd-in' | 'd-call' | 'd-ammo'): void
  (e: 'open-battle'): void
  (e: 'open-focus'): void
  /** ★W14-T1（用户拍板 2026-10-16）：主攻项目标签可点开项目详情抽屉（与 Hero 胶囊同一出口） */
  (e: 'open-project', projectId: string): void
  /** F7 诊断条动作钮分发 */
  (e: 'insight-action', action: string): void
  /** F9 就地勾选（同步回 dailyFocus + 任务卡） */
  (e: 'toggle', idx: number): void
  /** F10 游离焦点任务一键归位 + 绑卡 */
  (e: 'bind', idx: number): void
  /** F11 空槽一键填入推荐任务 */
  (e: 'fill', idx: number): void
}>()
</script>

<template>
  <section class="pi-mod" id="mod-now">
    <div class="pi-mod-h">
      <span class="pi-mod-ico i-now">📊</span>
      <div class="pi-mod-t">
        <h2>今日战报<span class="en">DAILY REPORT</span><span class="tagline">DayDetail · 五段式</span></h2>
        <p>当天的四类记录，全部来自本机事件日志。点任一格 → 明细下钻（单击定位 · 双击开链接）。</p>
      </div>
      <div class="pi-mod-acts">
        <button class="pi-btn line" @click="emit('open-battle')">打开战报</button>
      </div>
    </div>
    <div class="pi-mod-b">
      <!-- ① 一句人话诊断条（F7 · 恒渲染 · ★W13-T7 文本与 CTA 由宿主 buildConciseInsights 注入） -->
      <div id="ins-today" class="one-insight" :class="props.insight.warn ? 'warn' : 'info'">
        <span class="oi-ic">{{ props.insight.warn ? '⚠️' : '💡' }}</span>
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
          <button class="pi-chip" title="今日焦点 · 已排任务槽位（点击去调度台调整）" @click="emit('open-focus')">
            <span class="v">{{ props.focusFilled }}/{{ props.rows.length }}<small>件</small></span><span class="l">今日焦点</span>
          </button>
          <!-- ★W15-T1：弹药格由死格改可点（四格不许有死格）——给出「三件事的支撑卡清单」 -->
          <button class="pi-chip ok" title="已备弹药 · 三件事关联任务的支撑资源卡去重总数（点击看清单）"
            @click="emit('drill', 'd-ammo')">
            <span class="v">{{ props.ammo }}<small>张</small></span><span class="l">已备弹药</span><span class="ar">▸</span>
          </button>
        </div>
      </div>

      <div class="pi-hair"></div>

      <!-- ③ 紧凑三行对账（F9/F10/F11） -->
      <div class="f3-compact">
        <div class="pi-sect"><span class="n">1</span><span class="t">今日三件事</span><span class="m">就地勾选 · 游离归位 · 空槽补位</span></div>

        <template v-for="(r, i) in props.rows" :key="r ? r.slot.id : 'e' + i">
          <!-- 实排行 -->
          <div v-if="r" class="f3-row" :class="{ done: r.slot.done }">
            <span class="f3-no">{{ String(i + 1).padStart(2, '0') }}</span>
            <button class="f3-ck" :class="{ done: r.slot.done }" :title="r.slot.done ? '点击取消完成' : '点击就地完成'"
              @click="emit('toggle', r.idx)">{{ r.slot.done ? '✓' : '' }}</button>
            <span class="f3-title" :class="{ done: r.slot.done }">{{ r.slot.text || '（空槽）' }}</span>
            <button v-if="r.focused && r.projectId" class="pi-tag ok as-btn"
              :title="`主攻项目：${r.projectName} · 点击查看项目详情`"
              @click="emit('open-project', r.projectId)">🚀 主攻：{{ r.projectName }}</button>
            <span v-else-if="r.focused" class="pi-tag ok" :title="`主攻项目：${r.projectName}`">🚀 主攻：{{ r.projectName }}</span>
            <span v-else-if="r.hasProject" class="pi-tag neutral" :title="`所属项目：${r.projectName}`">📁 {{ r.projectName }}</span>
            <span v-else class="pi-tag warn" title="未挂任何项目——点右侧按钮归入主攻">⚠️ 未挂项目 (游离)</span>
            <span class="f3-ammo" :class="{ zero: !r.supportCount }" :title="r.supportCount ? `已挂 ${r.supportCount} 张支撑卡` : '尚无支撑卡'">
              🛡 {{ r.supportCount }}
            </span>
            <button v-if="r.canBind" class="f3-bind"
              :title="`按标题关键词与标签预筛资源池（命中 ${r.matchCount} 张），一键归入主攻并批量写入支撑关联`"
              @click="emit('bind', r.idx)">
              {{ r.matchCount ? `🔗 归入主攻 + 绑 ${r.matchCount} 张卡 ›` : '🔗 归入主攻 ›' }}
            </button>
          </div>
          <!-- 空槽行（F11：未排满时给出推荐 + 一键填入） -->
          <div v-else class="f3-row empty">
            <span class="f3-no">{{ String(i + 1).padStart(2, '0') }}</span>
            <span class="f3-ck ghost"></span>
            <span class="f3-title muted">（空槽）</span>
            <template v-if="props.recommend && props.recommend.idx === i">
              <span class="f3-rec" :title="props.recommend.why">✦ {{ props.recommend.title }}</span>
              <button class="f3-fill" @click="emit('fill', i)">＋ 一键填入</button>
            </template>
            <span v-else class="f3-pending">去调度台排一排，晚上复盘会更清楚</span>
          </div>
        </template>
      </div>
    </div>
  </section>
</template>
