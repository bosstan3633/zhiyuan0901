<script setup lang="ts">
// R68-F6：显式实例名——KeepAlive include 四主视图缓存切台免重挂
defineOptions({ name: 'CompassShell' })
import Icon from '@/shared/components/Icon.vue'
/**
 * 方向台 · 一级工作区（R49 V2.22.0 三大系统页改版）
 * R117（04-61 C）结构收敛：模块化三块 → **「主航线 + 项目详情」两块**
 * - 原「模块三 · 项目总览」整块退役（拍板：整体项目情况已由上方主航线体现，不必再来一层总览卡墙）；
 * - 原「模块四 · 任务调度」整体迁入调度台底部 tab（CompassHome，与好奇心培育并列，默认任务调度）；
 * - **项目详情由二级提为一级**：本页直接内嵌 `ProjectCuration`（默认落在第一个项目），
 *   项目切换与项目目录仍由其实体左栏（📦 全部项目 + 📐 项目目录）承担；
 * - `?p=` 仍由内嵌的项目详情消费（router.replace 保参），深链定位口径不变。
 * 二级覆盖层：完整方向树（/compass/tree）；/compass/projects 保留为**聚焦态**深链（搜索/浮层直达）。
 */
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useCompass } from '../stores/compass'
import LighthousePanel from '../components/compass/LighthousePanel.vue'
import ProjectCuration from './ProjectCuration.vue'

const router = useRouter()
const route = useRoute()
const isChildActive = computed(() => route.matched.length > 1 && route.path !== '/compass')
const { d, allProjects, isProjectStalled, isProjectDone, showDone, toggleShowDone } = useCompass()

// R86（T0）：已完成项目显隐由 store 提供（showDone / toggleShowDone）——全站同一份实现
/** 项目显隐口径（R52-BUG-2：isProjectDone——手动 done/archived 或全任务完成派生） */
const visibleProjects = computed(() => allProjects().filter(p => showDone.value || !isProjectDone(p)))
const doneProjects = computed(() => allProjects().filter(p => isProjectDone(p)).length)

/** R99（D-D）：页头主线状态摘要——`X 目标 · Y 项目 · Z 主攻 · W 停滞`。
 *  项目/主攻/停滞口径随 showDone；停滞复用 projState 预计算（R83 红线：不在模板里逐项调判定函数）。 */
const focusCount = computed(() => visibleProjects.value.filter(p => p.isFocused).length)
const projState = computed(() => {
  const m = new Map<string, { stall: boolean; finished: boolean }>()
  for (const p of allProjects()) m.set(p.id, { stall: isProjectStalled(p), finished: isProjectDone(p) })
  return m
})
const stalledCount = computed(() => visibleProjects.value.filter(p => projState.value.get(p.id)?.stall).length)

/* ================= R86（D-B）/ R99（M8）主航线状态筛选 =================
 * 控件原为「主航线 + 项目总览」共用；R117 项目总览退役后**只剩主航线一处消费者**，
 * 但 `ovFilter` 仍由本组件持有（单一来源，v-model 传入），门控同旧口径：项目数 >12 才出现。
 */
const OV_TOOLS_MIN = 12
const showOverviewTools = computed(() => allProjects().length > OV_TOOLS_MIN)
const ovFilter = ref<'all' | 'active' | 'stalled' | 'done'>('all')

function openTree() {
  router.push('/compass/tree')
}
</script>

<template>
  <!-- R50-B1/B2：子路由激活时满宽渲染二级页（完整方向树），否则渲染「主航线 + 项目详情」两块 -->
  <RouterView v-if="isChildActive" />
  <div v-else class="page">
    <div class="page-head">
      <div class="crumb"><b>方向台</b><span class="sub">主航线与项目详情</span></div>
      <!-- R99（D-D）：主线状态摘要——方向台一眼读数 -->
      <span class="mainline-summary">{{ d.compass.directions.length }} 目标 · {{ visibleProjects.length }} 项目 · {{ focusCount }} 主攻 · {{ stalledCount }} 停滞</span>
      <div class="spacer" />
      <!-- R86（M7）：「已完成项目」开关**收敛到此处**；R117 项目总览退役后主航线是页内唯一消费者
           （完整方向树是独立页，保留它自己那一处；同一偏好，同一口径）。 -->
      <span class="done-toggle" :class="{ off: !showDone }" @click="toggleShowDone" title="已完成项目显示/隐藏——一处切换，主航线与项目详情同时生效（完整方向树另有同一开关）">👁 已完成项目：{{ showDone ? '显示' : '隐藏' }}<span v-if="doneProjects && showDone">（{{ doneProjects }}）</span></span>
      <button class="mini-btn" @click="openTree"><Icon name="branch" :size="13" /> 完整方向树</button>
    </div>

    <!-- 模块一 · 主航线（R55-D1：方向状态四格已迁调度台顶部）
         R117：ovFilter 仍由本组件持有、v-model 传入——主航线单处消费（项目数字筛选单处生效） -->
    <section class="module">
      <LighthousePanel v-model:ov-filter="ovFilter" :tools-gate="showOverviewTools" />
    </section>

    <!-- 模块二 · 项目详情（R117 拍板：原二级界面直接提为一级，默认落在第一个项目；
         项目切换 / 项目目录由左栏承担；改名走项目 Hero、删除走项目详情返回行） -->
    <section class="module module-project">
      <ProjectCuration embedded />
    </section>
  </div>
</template>

<style scoped>
/* R119：原型 .main-container / .page-header —— 1400 容器 + 16/24、页头 28px、标题 15px/700 + 副题 12.5px */
.page { max-width: 1400px; margin: 0 auto; padding: 16px 24px 40px; display: flex; flex-direction: column; gap: 16px; }
.page-head { display: flex; align-items: center; gap: 10px; height: 28px; margin-bottom: 14px; }
.page-head .crumb { display: flex; align-items: baseline; gap: 8px; font-size: 13px; color: var(--text-3); }
.page-head .crumb .sub { font-size: 12.5px; color: var(--text-3); }
.page-head .crumb b { color: var(--text); font-weight: 700; font-size: 15px; letter-spacing: -.01em; }
/* R99（D-D）：主线状态摘要——tabular-nums 数字稳定不跳动 */
.mainline-summary { font-size: 11.5px; color: var(--text-3); font-variant-numeric: tabular-nums; white-space: nowrap; }
.page-head .spacer { flex: 1; }
/* R86（M7）：已完成项目开关——**收敛到方向台页头这一处**（原主航线 .mr-tool 与项目总览 .ov-toggle 均已移除；
   完整方向树是独立页，保留它自己那一处）。一处切换，主航线与项目详情同时生效。 */
.done-toggle { font-size: 11.5px; color: var(--text-3); cursor: pointer; white-space: nowrap; padding: 3px 10px; border: 1px solid var(--border); border-radius: 99px; transition: all .15s; }
.done-toggle:hover { color: var(--accent); border-color: var(--accent); }
.done-toggle.off { opacity: .6; }
.mini-btn { display: inline-flex; align-items: center; gap: 5px; padding: 5px 12px; border-radius: 6px; font-size: 11.5px; cursor: pointer; border: 1px solid var(--border); background: var(--surface); color: var(--text-2); font-family: inherit; transition: all .15s; user-select: none; }
.mini-btn:hover { border-color: var(--accent); color: var(--accent); }

.module { margin-top: 18px; }
.module:first-of-type { margin-top: 0; }
/* R117：项目详情模块——内嵌视图自带左栏目录，模块本身不再包壳（保持满宽） */
.module-project { padding-top: 2px; }
</style>
