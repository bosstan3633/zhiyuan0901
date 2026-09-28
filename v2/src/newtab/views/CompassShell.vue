<script setup lang="ts">
// R68-F6：显式实例名——KeepAlive include 四主视图缓存切台免重挂
defineOptions({ name: 'CompassShell' })
import Icon from '@/shared/components/Icon.vue'
/**
 * 方向台 · 一级工作区（R49 V2.22.0 三大系统页改版）
 * R117（04-61 C）结构收敛：模块化三块 → **「主航线 + 项目详情」两块**
 * R121（V2.89.0 方向台 UI 迭代，对齐原型）：
 * - 页头副标题合并主线摘要（「主航线与项目全景 · N 目标 · N 项目 · N 主攻 · N 停滞」）
 * - **选中联动**：主攻条 chip / 主航线项目行卡 单击 → `?p=` 更新（不发页面跳转）→ 下方展板联动；
 *   双击 → 进入项目详情页（/compass/projects 深链保留，供搜索定位）
 * - 项目详情左栏（📦全部项目/📐项目目录）按原型退役；其能力收敛进项目行卡右键菜单与展板内
 * - `?p=` 仍为唯一选中口径（刷新/前进后退不变）；无 `?p` 默认落第一个项目（与展板同口径）
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

/** 项目显隐口径（R52-BUG-2：isProjectDone——手动 done/archived 或全任务完成派生） */
const visibleProjects = computed(() => allProjects().filter(p => showDone.value || !isProjectDone(p)))
const doneProjects = computed(() => allProjects().filter(p => isProjectDone(p)).length)

/** 页头主线状态摘要——`X 目标 · Y 项目 · Z 主攻 · W 停滞` */
const focusCount = computed(() => visibleProjects.value.filter(p => p.isFocused).length)
const projState = computed(() => {
  const m = new Map<string, { stall: boolean; finished: boolean }>()
  for (const p of allProjects()) m.set(p.id, { stall: isProjectStalled(p), finished: isProjectDone(p) })
  return m
})
const stalledCount = computed(() => visibleProjects.value.filter(p => projState.value.get(p.id)?.stall).length)

/** R121：当前选中项目（?p= 为准；无/无效则落第一个项目——与展板默认口径一致） */
const selectedProjectId = computed(() => {
  const pid = typeof route.query.p === 'string' ? route.query.p : ''
  if (pid && allProjects().some(p => p.id === pid)) return pid
  return allProjects()[0]?.id || ''
})
/** R121：单击项目 = 仅更新 ?p（不发页面跳转）→ 主航线选中态 + 下方展板联动 */
function onSelectProject(id: string) {
  if (route.query.p === id) return
  router.replace({ path: '/compass', query: { p: id } })
}

/* ================= R86（D-B）/ R99（M8）主航线状态筛选 =================
   R177：M8 的 >12 门控退役（其存在理由「与项目总览可见性分裂」已随 R117 项目总览退役消失），
   筛选常态显示（原型 lh-filter-group 常驻口径），分段形态见 LighthousePanel。 */
const ovFilter = ref<'all' | 'active' | 'stalled' | 'done'>('all')

function openTree() {
  router.push('/compass/tree')
}
</script>

<template>
  <!-- R148-P1a：子路由（项目详情 / 完整方向树）同样缓存——两页都是重计算首屏，此前每次进都重挂 -->
  <router-view v-if="isChildActive" v-slot="{ Component }">
    <keep-alive include="ProjectCurationView,CompassTreeView"><component :is="Component" /></keep-alive>
  </router-view>
  <div v-else class="page">
    <div class="page-head">
      <div class="crumb"><b>方向台</b> · 主航线与项目全景<span class="mainline-summary">战略目标 <b>{{ d.compass.directions.length }}</b> · 推进项目 <b>{{ visibleProjects.length }}</b> · 🚀 主攻 <b>{{ focusCount }}</b> · ⚠ 停滞 <b>{{ stalledCount }}</b></span></div>
      <div class="spacer" />
      <!-- R177（原型 done-toggle-label）：checkbox 开关形态（一处切换，主航线与项目详情同时生效） -->
      <label class="done-toggle-label" title="已完成项目显示/隐藏——一处切换，主航线与项目详情同时生效（完整方向树另有同一开关）">
        <input type="checkbox" :checked="showDone" @change="toggleShowDone" />
        <span>显示已完成项目<template v-if="doneProjects && showDone">（{{ doneProjects }}）</template></span>
      </label>
      <span class="tree-link" title="进入完整方向树" @click="openTree">完整方向树 ›</span>
    </div>

    <!-- 模块一 · 主航线（R121：3 列目标网格 + 项目行卡；选中联动下方展板） -->
    <section class="module">
      <LighthousePanel v-model:ov-filter="ovFilter" :tools-gate="true" :selected-id="selectedProjectId" @select-project="onSelectProject" />
    </section>

    <!-- 模块二 · 项目详情（R117 拍板：一级内嵌；R121：左栏按原型退役，切换由主航线联动） -->
    <section class="module module-project">
      <ProjectCuration embedded />
    </section>
  </div>
</template>

<style scoped>
.page { max-width: 1440px; margin: 0 auto; padding: 20px 36px 64px; }
.page-head { display: flex; align-items: center; gap: 10px; margin-bottom: 14px; padding-left: 22px; }
.page-head .crumb { font-size: var(--fs-body); color: var(--text-2); display: flex; align-items: baseline; gap: 8px; min-width: 0; }
.page-head .crumb b { color: var(--text); font-weight: 700; font-size: 16px; letter-spacing: .2px; }
/* R121：主线摘要并入副标题 ｜ R177（原型 cph-summary-badge）：标签+粗值格式 */
.mainline-summary { font-size: var(--fs-body); color: var(--text-3); font-variant-numeric: tabular-nums; white-space: nowrap; display: inline-flex; align-items: baseline; gap: 8px; }
.mainline-summary b { color: var(--text); font-weight: 700; }
.page-head .spacer { flex: 1; }
/* R177（原型 done-toggle-label）：checkbox 开关形态 */
.done-toggle-label { display: inline-flex; align-items: center; gap: 6px; font-size: var(--fs-sub); color: var(--text-2); cursor: pointer; user-select: none; white-space: nowrap; }
.done-toggle-label input { accent-color: var(--accent); cursor: pointer; }
.done-toggle-label:hover { color: var(--text); }
/* R177（原型 ghost-action-btn）：accent-light 底 ghost 钮 */
.tree-link { font-size: var(--fs-caption); color: var(--accent-ink); background: var(--accent-light); padding: 3px 9px; border-radius: var(--radius-xs); font-weight: 600; cursor: pointer; white-space: nowrap; transition: background var(--dur); }
.tree-link:hover { background: color-mix(in srgb, var(--accent) 15%, transparent); text-decoration: none; }

.module { margin-top: 18px; }
.module:first-of-type { margin-top: 0; }
.module-project { padding-top: 2px; }
</style>
