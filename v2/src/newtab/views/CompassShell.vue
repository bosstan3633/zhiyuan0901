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

/* ================= R86（D-B）/ R99（M8）主航线状态筛选 ================= */
const OV_TOOLS_MIN = 12
const showOverviewTools = computed(() => allProjects().length > OV_TOOLS_MIN)
const ovFilter = ref<'all' | 'active' | 'stalled' | 'done'>('all')

function openTree() {
  router.push('/compass/tree')
}
</script>

<template>
  <RouterView v-if="isChildActive" />
  <div v-else class="page">
    <div class="page-head">
      <div class="crumb"><b>方向台</b> · 主航线与项目全景<span class="mainline-summary">{{ d.compass.directions.length }} 目标 · {{ visibleProjects.length }} 项目 · {{ focusCount }} 主攻 · {{ stalledCount }} 停滞</span></div>
      <div class="spacer" />
      <span class="done-toggle" :class="{ off: !showDone }" @click="toggleShowDone" title="已完成项目显示/隐藏——一处切换，主航线与项目详情同时生效（完整方向树另有同一开关）">👁 已完成项目：{{ showDone ? '显示' : '隐藏' }}<span v-if="doneProjects && showDone">（{{ doneProjects }}）</span></span>
      <span class="tree-link" title="进入完整方向树" @click="openTree">完整方向树 ›</span>
    </div>

    <!-- 模块一 · 主航线（R121：3 列目标网格 + 项目行卡；选中联动下方展板） -->
    <section class="module">
      <LighthousePanel v-model:ov-filter="ovFilter" :tools-gate="showOverviewTools" :selected-id="selectedProjectId" @select-project="onSelectProject" />
    </section>

    <!-- 模块二 · 项目详情（R117 拍板：一级内嵌；R121：左栏按原型退役，切换由主航线联动） -->
    <section class="module module-project">
      <ProjectCuration embedded />
    </section>
  </div>
</template>

<style scoped>
.page { max-width: 1560px; margin: 0 auto; padding: 14px 24px 48px; }
.page-head { display: flex; align-items: center; gap: 10px; margin-bottom: 14px; padding-left: 22px; }
.page-head .crumb { font-size: 13px; color: var(--text-2); display: flex; align-items: baseline; gap: 8px; min-width: 0; }
.page-head .crumb b { color: var(--text); font-weight: 700; font-size: 16px; letter-spacing: .2px; }
/* R121：主线摘要并入副标题（原型：方向台 · 主航线与项目全景 · N 目标 · …） */
.mainline-summary { font-size: 12.5px; color: var(--text-3); font-variant-numeric: tabular-nums; white-space: nowrap; }
.page-head .spacer { flex: 1; }
.done-toggle { font-size: 11.5px; color: var(--text-3); cursor: pointer; white-space: nowrap; padding: 3px 10px; border: 1px solid var(--border); border-radius: 99px; transition: all .15s; }
.done-toggle:hover { color: var(--accent); border-color: var(--accent); }
.done-toggle.off { opacity: .6; }
.tree-link { font-size: 12.5px; color: var(--accent); font-weight: 600; cursor: pointer; white-space: nowrap; }
.tree-link:hover { text-decoration: underline; }

.module { margin-top: 18px; }
.module:first-of-type { margin-top: 0; }
.module-project { padding-top: 2px; }
</style>
