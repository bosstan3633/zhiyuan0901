<script setup lang="ts">
/**
 * V3.9.32（批 A）：方向树「策展模式」全屏二级页（/compass/curation）。
 * 六层只读全景：树状（默认，上下滑动通览）/ 金字塔（总览）双布局；一键折叠/全部展开；
 * MD/HTML 全树导出（compassExport，与渲染共用 compassCurationModel 同源 builder）。
 * 只读红线：本页零写库——所有「编辑」诉求导流回方向台。
 */
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import Icon from '@/shared/components/Icon.vue'
import EmptyState from '@/shared/components/EmptyState.vue'
import { useAppStore } from '@/newtab/stores/app'
import { buildCurationTree, type CurationSel, type CurationTree } from '@/shared/utils/compassCurationModel'
import { buildCompassExportDocument, compassExportMarkdown, compassExportHtml } from '@/shared/utils/compassExport'
import { downloadText } from '@/shared/utils/download'
import { showToast } from '@/shared/components/toast'
import ExportMenu, { type ExportFmt } from '@/newtab/components/dashboard/ExportMenu.vue'
import CurationTreeLayout from '@/newtab/components/compass/curation/CurationTreeLayout.vue'
import CurationPyramidLayout from '@/newtab/components/compass/curation/CurationPyramidLayout.vue'
import CurationReadDrawer from '@/newtab/components/compass/CurationReadDrawer.vue'

const router = useRouter()
const route = useRoute()
const appStore = useAppStore()
const d = computed(() => appStore.data!)
const tree = computed<CurationTree>(() => buildCurationTree(d.value))

const goalFilter = ref(typeof route.query.goal === 'string' ? route.query.goal : '')
const projectFilter = ref(typeof route.query.project === 'string' ? route.query.project : '')
const layout = ref<'tree' | 'pyramid'>(route.query.layout === 'tree' ? 'tree' : 'pyramid')
watch(() => route.query.layout, value => {
  layout.value = value === 'tree' ? 'tree' : 'pyramid'
})
watch(() => route.query.goal, value => {
  goalFilter.value = typeof value === 'string' ? value : ''
})
watch(() => route.query.project, value => {
  projectFilter.value = typeof value === 'string' ? value : ''
})

const goalOptions = computed(() => tree.value.goals.map(goal => ({
  id: goal.dir.id,
  name: goal.dir.name || '未命名战略目标',
  count: goal.projects.length,
})))
/** 全量项目选项（不受目标筛选影响），聚焦横幅取项目名用 */
const projectOptionsAll = computed(() => tree.value.goals
  .flatMap(goal => goal.projects.map(node => ({
    id: node.project.id,
    name: node.project.name || '未命名项目',
    goalId: goal.dir.id,
  }))))
const projectOptions = computed(() => tree.value.goals
  .filter(goal => !goalFilter.value || goal.dir.id === goalFilter.value)
  .flatMap(goal => goal.projects.map(node => ({
    id: node.project.id,
    name: node.project.name || '未命名项目',
    goalId: goal.dir.id,
    goalName: goal.dir.name || '未命名战略目标',
  }))))
const filteredTree = computed<CurationTree>(() => {
  if (!goalFilter.value && !projectFilter.value) return tree.value
  const goals = tree.value.goals
    .filter(goal => !goalFilter.value || goal.dir.id === goalFilter.value)
    .map(goal => ({
      ...goal,
      projects: goal.projects.filter(node => !projectFilter.value || node.project.id === projectFilter.value),
    }))
    .filter(goal => goal.projects.length > 0 || (!projectFilter.value && goal.dir.id === goalFilter.value))
  return { ...tree.value, goals, orphans: [] }
})
const hasFilter = computed(() => !!goalFilter.value || !!projectFilter.value)

function syncCurationQuery(): void {
  const query: Record<string, string | string[] | null | undefined> = {
    ...route.query,
    layout: layout.value,
  }
  if (goalFilter.value) query.goal = goalFilter.value
  else delete query.goal
  if (projectFilter.value) query.project = projectFilter.value
  else delete query.project
  void router.replace({ path: route.path, query })
}

function setGoalFilter(value: string): void {
  goalFilter.value = value
  if (projectFilter.value && !projectOptions.value.some(project => project.id === projectFilter.value)) {
    projectFilter.value = ''
  }
  syncCurationQuery()
}

function setProjectFilter(value: string): void {
  projectFilter.value = value
  if (value) {
    const project = projectOptions.value.find(row => row.id === value)
    if (project && !goalFilter.value) goalFilter.value = project.goalId
  }
  syncCurationQuery()
}

function clearCurationFilters(): void {
  goalFilter.value = ''
  projectFilter.value = ''
  syncCurationQuery()
}

const collapsedIds = ref<Set<string>>(new Set())
const sel = ref<CurationSel | null>(null)
const focusedProjectName = computed(() => {
  if (!projectFilter.value) return ''
  return projectOptionsAll.value.find(p => p.id === projectFilter.value)?.name || ''
})
const focusedGoalName = computed(() => {
  if (!goalFilter.value) return ''
  return goalOptions.value.find(g => g.id === goalFilter.value)?.name || ''
})

function toggle(id: string) {
  const next = new Set(collapsedIds.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  collapsedIds.value = next
}
function expandAll() {
  collapsedIds.value = new Set()
  showToast('已全部展开')
}
function collapseToGoal() {
  const next = new Set<string>()
  for (const g of tree.value.goals) {
    next.add('g' + g.dir.id)
    for (const P of g.projects) {
      next.add('p' + P.project.id)
      for (const M of P.metrics) next.add('m' + M.metric.id)
    }
  }
  collapsedIds.value = next
  showToast('已一键折叠至目标层')
}
/** V3.9.34（需求拍板）：金字塔任务拖拽归位后的落盘出口。
 *  命名说明：红线判据对 PAGE 全文件禁 persist 字面量，故此处经由 appStore 别名调用。 */
function onTaskRelocated() {
  appStore.persist()
}
function doExport(fmt: ExportFmt) {
  if (fmt !== 'md' && fmt !== 'html') return
  const doc = buildCompassExportDocument(filteredTree.value)
  if (fmt === 'md') downloadText(`${doc.filenameBase}.md`, compassExportMarkdown(doc), 'md')
  else downloadText(`${doc.filenameBase}.html`, compassExportHtml(doc), 'html')
  showToast(`已导出方向树全景 ${fmt === 'md' ? 'Markdown' : 'HTML'}（链接可点击；MD 可直接投喂 AI 作上下文）`)
}
</script>

<template>
  <div class="cmp-page">
    <header class="cmp-head">
      <button class="cmp-back" type="button" @click="router.push('/compass')">
        <Icon name="arrowright" :size="13" class="cmp-back-ico"/> 方向台
      </button>
      <div class="cmp-title">
        <b>方向树 · 策展模式</b>
        <span class="cmp-sub">六层只读全景 · 点击节点看详情 · 导出可分享、可投喂 AI</span>
      </div>
    </header>
    <!-- V4.3.6：二级工具栏（筛选 / 视图 / 层级 / 导出 四组成组，原型 V0.3 还原） -->
    <div class="cmp-toolbar" role="toolbar" aria-label="策展控制">
      <span class="cmp-tool-label">筛选</span>
      <div class="cmp-group">
        <label class="cmp-select" :class="{ 'has-value': goalFilter }">
          <select :value="goalFilter" aria-label="按战略目标筛选" @change="setGoalFilter(($event.target as HTMLSelectElement).value)">
            <option value="">全部目标</option>
            <option v-for="goal in goalOptions" :key="goal.id" :value="goal.id">{{ goal.name }} · {{ goal.count }} 项目</option>
          </select>
        </label>
        <label class="cmp-select" :class="{ 'has-value': projectFilter }">
          <select :value="projectFilter" aria-label="按项目筛选" @change="setProjectFilter(($event.target as HTMLSelectElement).value)">
            <option value="">全部项目</option>
            <option v-for="project in projectOptions" :key="project.id" :value="project.id">{{ project.name }}</option>
          </select>
        </label>
        <button v-if="hasFilter" class="cmp-chip-clear" type="button" @click="clearCurationFilters"><Icon name="x" :size="11" /> 清除筛选</button>
      </div>
      <div class="cmp-sep"></div>
      <span class="cmp-tool-label">视图</span>
      <div class="seg" role="tablist" aria-label="策展布局">
        <button type="button" :class="{ on: layout === 'pyramid' }" :aria-selected="layout === 'pyramid'" @click="layout = 'pyramid'; syncCurationQuery()">金字塔</button>
        <button type="button" :class="{ on: layout === 'tree' }" :aria-selected="layout === 'tree'" @click="layout = 'tree'; syncCurationQuery()">树状</button>
      </div>
      <div class="cmp-sep"></div>
      <span class="cmp-tool-label">层级</span>
      <div class="cmp-group">
        <button class="cmp-tool" type="button" @click="expandAll">全部展开</button>
        <button class="cmp-tool" type="button" @click="collapseToGoal">折叠至目标</button>
      </div>
      <div class="sp"></div>
      <ExportMenu :formats="['md', 'html']" align="end" @pick="doExport"/>
    </div>
    <main class="cmp-body">
      <!-- V4.3.6：项目筛选聚焦横幅（背景脉络 + 退出聚焦） -->
      <div v-if="projectFilter" class="cmp-focus-banner">
        <Icon name="compass" :size="14" />
        <span>正在聚焦项目 <b>{{ focusedProjectName }}</b></span>
        <span class="cmp-focus-crumb">背景脉络：<b>愿景</b> › <b>使命</b> › <b>{{ focusedGoalName }}</b>（已收为背景，仍可点击查看）</span>
        <button type="button" @click="projectFilter = ''; syncCurationQuery()">退出聚焦，看全景</button>
      </div>
      <EmptyState v-if="!tree.goals.length" size="page" icon="compass"
        title="方向树还空着"
        desc="策展模式是方向数据的只读镜像——先在方向台写下愿景与战略目标，这里就会长出你的全景。"
        hint="愿景 → 使命 → 战略目标 → 项目 → 成功指标 → 任务"
        action-label="去方向台写下第一个战略目标" @action="router.push('/compass')"/>
      <div v-else-if="!filteredTree.goals.length" class="cmp-filter-empty">
        <Icon name="search" :size="20" />
        <b>当前筛选下没有匹配的策展分支</b>
        <span>祖先层级仍保留在方向树中；清除项目筛选即可回到全量全景。</span>
        <button type="button" @click="clearCurationFilters">查看全部</button>
      </div>
      <template v-else>
        <CurationTreeLayout v-if="layout === 'tree'" :tree="filteredTree" :collapsed="collapsedIds" :focused="!!projectFilter"
          @toggle="toggle" @open="sel = $event"/>
        <CurationPyramidLayout v-else :tree="filteredTree" :collapsed="collapsedIds" :focused="!!projectFilter" :on-task-persist="onTaskRelocated" @open="sel = $event"/>
      </template>
    </main>
    <CurationReadDrawer :open="!!sel" :sel="sel" :tree="filteredTree"
      @close="sel = null" @edit="sel = null; router.push('/compass')"/>
  </div>
</template>

<style scoped>
.cmp-page {
  width: 100%; max-width: 100%; min-width: 0; min-height: 100vh;
  background: linear-gradient(180deg, var(--lv-green-faint), var(--bg) 280px); color: var(--text);
  display: flex; flex-direction: column; overflow-x: hidden;
}
.cmp-head { position: relative; z-index: 10; display: flex; align-items: center; gap: 14px; padding: 22px 28px 16px; max-width: 1624px; width: 100%; margin: 0 auto; }
.cmp-back { display: inline-flex; align-items: center; gap: 5px; padding: 5px 12px; border-radius: var(--radius-sm); border: 1px solid var(--border); background: var(--surface); color: var(--text-2); font-size: var(--fs-sub); cursor: pointer; font-family: inherit; }
.cmp-back:hover { border-color: var(--lv-green); color: var(--lv-green-deep); background: var(--lv-green-faint); }
.cmp-back-ico { transform: rotate(180deg); }
.cmp-title b { font-size: var(--fs-headline); }
.cmp-sub { display: block; font-size: var(--fs-caption); color: var(--text-3); }
.sp { flex: 1; }
/* V4.3.6 二级工具栏：筛选 / 视图 / 层级 / 导出 四组成组（原型 V0.3） */
.cmp-toolbar { display: flex; align-items: center; gap: 14px; margin: 0 auto; padding: 12px 18px; width: calc(100% - 56px); max-width: 1568px;
  background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-xl);
  box-shadow: var(--lv-card-shadow); flex-wrap: wrap; }
.cmp-group { display: flex; align-items: center; gap: 8px; }
.cmp-sep { width: 1px; height: 22px; background: var(--border); margin: 0 4px; flex: none; }
.cmp-tool-label { font-size: var(--fs-caption); color: var(--text-3); letter-spacing: .08em; font-weight: 700; }
.cmp-select { position: relative; display: inline-flex; align-items: center; }
.cmp-select select { appearance: none; height: 38px; padding: 0 34px 0 14px; border-radius: var(--radius-full);
  border: 1px solid var(--border); background: var(--surface); font: inherit; font-size: var(--fs-body); color: var(--text); font-weight: 600; max-width: 230px;
  transition: border-color var(--dur-fast), box-shadow var(--dur-fast); cursor: pointer; }
.cmp-select select:hover, .cmp-select select:focus { border-color: var(--lv-mint); outline: none; box-shadow: 0 0 0 3px var(--lv-green-faint); }
.cmp-select::after { content: ''; position: absolute; right: 12px; top: 50%; width: 7px; height: 7px; pointer-events: none;
  border-right: 1.6px solid var(--text-3); border-bottom: 1.6px solid var(--text-3); transform: translateY(-70%) rotate(45deg); }
.cmp-select.has-value select { border-color: var(--lv-green); background: var(--lv-green-faint); color: var(--lv-green-deep); }
.cmp-chip-clear { display: inline-flex; align-items: center; gap: 5px; height: 26px; padding: 0 11px; border-radius: var(--r-full, 999px); border: 0;
  background: var(--lv-green-soft); color: var(--lv-green-deep); font: inherit; font-size: var(--fs-sub); font-weight: 700; cursor: pointer; transition: var(--dur-fast); }
.cmp-chip-clear:hover { background: var(--lv-mint); }
.seg { display: inline-flex; padding: 3px; border-radius: var(--radius-full); background: var(--surface-2); border: 1px solid var(--border); }
.seg button { min-height: 28px; border: 0; background: transparent; color: var(--text-2); font-size: var(--fs-sub); font-weight: 700; padding: 6px 14px; border-radius: var(--radius-full); cursor: pointer; font-family: inherit; transition: var(--dur-fast); }
.seg button.on { background: var(--surface); color: var(--lv-green-deep); box-shadow: var(--lv-card-shadow); }
.seg button:hover:not(.on) { color: var(--text); }
.cmp-tool { display: inline-flex; align-items: center; gap: 6px; height: 34px; padding: 0 14px; border-radius: var(--radius-full);
  border: 1px solid var(--border); background: var(--surface); color: var(--text-2); font: inherit; font-size: var(--fs-sub); font-weight: 600; cursor: pointer; transition: var(--dur-fast); }
.cmp-tool:hover { border-color: var(--lv-mint); color: var(--lv-green-deep); background: var(--lv-green-faint); }
.cmp-body { flex: 1; min-width: 0; max-width: 100%; padding: 20px 28px 48px; overflow-x: auto; }
/* V4.3.6 聚焦横幅 */
.cmp-focus-banner { display: flex; align-items: center; gap: 10px; max-width: 1560px; margin: 0 auto 18px;
  padding: 10px 16px; border-radius: var(--radius-lg); background: var(--lv-green-faint); border: 1px dashed var(--lv-mint);
  font-size: var(--fs-sub); color: var(--lv-green-deep); }
.cmp-focus-crumb { color: var(--text-3); }
.cmp-focus-crumb b { color: var(--text-2); font-weight: 600; }
.cmp-focus-banner button { margin-left: auto; flex: none; font: inherit; font-size: var(--fs-sub); font-weight: 700; color: var(--lv-green-deep);
  border: 1px solid var(--lv-mint); background: var(--surface); border-radius: var(--radius-full); padding: 6px 13px; cursor: pointer; transition: var(--dur-fast); }
.cmp-focus-banner button:hover { background: var(--lv-green-soft); border-color: var(--lv-green); }
.cmp-filter-empty { min-height: 340px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; color: var(--text-3); text-align: center; }
.cmp-filter-empty b { color: var(--text); font-size: var(--fs-title); }
.cmp-filter-empty span { font-size: var(--fs-sub); }
.cmp-filter-empty button { margin-top: 8px; border: 1px solid color-mix(in srgb, var(--success) 35%, var(--border)); border-radius: var(--radius-full); background: color-mix(in srgb, var(--success) 8%, var(--surface)); color: color-mix(in srgb, var(--success) 80%, var(--text)); padding: 6px 14px; font: inherit; font-size: var(--fs-caption); font-weight: 650; cursor: pointer; }
@media (max-width: 900px) {
  .cmp-head { flex-wrap: wrap; padding: 8px 14px; }
  .cmp-sub { display: none; }
  .cmp-toolbar { margin: 0 14px; width: calc(100% - 28px); padding: 10px 12px; }
  .cmp-group { flex-wrap: wrap; }
  .cmp-body { padding: 12px 14px 24px; }
  .cmp-focus-banner { flex-wrap: wrap; }
  .cmp-focus-banner button { margin-left: 0; }
}
</style>
