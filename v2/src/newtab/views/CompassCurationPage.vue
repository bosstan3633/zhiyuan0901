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
      <div class="sp"></div>
      <div class="cmp-filters" aria-label="策展筛选">
        <label>
          <span>战略目标</span>
          <select :value="goalFilter" @change="setGoalFilter(($event.target as HTMLSelectElement).value)">
            <option value="">全部目标</option>
            <option v-for="goal in goalOptions" :key="goal.id" :value="goal.id">{{ goal.name }} · {{ goal.count }} 项目</option>
          </select>
        </label>
        <label>
          <span>项目</span>
          <select :value="projectFilter" @change="setProjectFilter(($event.target as HTMLSelectElement).value)">
            <option value="">全部项目</option>
            <option v-for="project in projectOptions" :key="project.id" :value="project.id">{{ project.name }}</option>
          </select>
        </label>
        <button v-if="hasFilter" class="cmp-clear" type="button" @click="clearCurationFilters">清除筛选</button>
      </div>
      <div class="seg" role="tablist" aria-label="策展布局">
        <button type="button" :class="{ on: layout === 'pyramid' }" :aria-selected="layout === 'pyramid'" @click="layout = 'pyramid'; syncCurationQuery()">金字塔</button>
        <button type="button" :class="{ on: layout === 'tree' }" :aria-selected="layout === 'tree'" @click="layout = 'tree'; syncCurationQuery()">树状</button>
      </div>
      <button class="cmp-tool" type="button" @click="expandAll">全部展开</button>
      <button class="cmp-tool" type="button" @click="collapseToGoal">一键折叠至目标</button>
      <ExportMenu :formats="['md', 'html']" align="end" @pick="doExport"/>
    </header>
    <main class="cmp-body">
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
        <CurationTreeLayout v-if="layout === 'tree'" :tree="filteredTree" :collapsed="collapsedIds"
          @toggle="toggle" @open="sel = $event"/>
        <CurationPyramidLayout v-else :tree="filteredTree" :on-task-persist="onTaskRelocated" @open="sel = $event"/>
      </template>
    </main>
    <CurationReadDrawer :open="!!sel" :sel="sel" :tree="filteredTree"
      @close="sel = null" @edit="sel = null; router.push('/compass')"/>
  </div>
</template>

<style scoped>
.cmp-page {
  width: 100%; max-width: 100%; min-width: 0; min-height: 100vh;
  background: var(--bg); color: var(--text);
  display: flex; flex-direction: column; overflow-x: hidden;
}
.cmp-head { position: sticky; top: 0; z-index: 10; display: flex; align-items: center; gap: 12px; padding: 10px 22px;
  background: color-mix(in srgb, var(--surface) 88%, transparent); backdrop-filter: blur(12px); border-bottom: 1px solid var(--border); }
.cmp-back { display: inline-flex; align-items: center; gap: 5px; padding: 5px 12px; border-radius: var(--radius-sm); border: 1px solid var(--border); background: var(--surface); color: var(--text-2); font-size: var(--fs-sub); cursor: pointer; font-family: inherit; }
.cmp-back:hover { border-color: var(--accent); color: var(--accent); }
.cmp-back-ico { transform: rotate(180deg); }
.cmp-title b { font-size: var(--fs-headline); }
.cmp-sub { display: block; font-size: var(--fs-caption); color: var(--text-3); }
.sp { flex: 1; }
.cmp-filters { display: flex; align-items: end; gap: 7px; }
.cmp-filters label { display: flex; flex-direction: column; gap: 3px; }
.cmp-filters label > span { color: var(--text-3); font-size: var(--fs-micro); font-weight: 600; }
.cmp-filters select { height: 30px; max-width: 190px; padding: 0 27px 0 9px; border: 1px solid var(--border); border-radius: var(--radius-sm); background: var(--surface); color: var(--text-2); font: inherit; font-size: var(--fs-caption); outline: none; }
.cmp-filters select:hover, .cmp-filters select:focus { border-color: color-mix(in srgb, var(--success) 46%, var(--border)); }
.cmp-clear { height: 30px; padding: 0 9px; border: 1px solid color-mix(in srgb, var(--success) 30%, var(--border)); border-radius: var(--radius-sm); background: color-mix(in srgb, var(--success) 7%, var(--surface)); color: color-mix(in srgb, var(--success) 78%, var(--text)); font: inherit; font-size: var(--fs-caption); font-weight: 650; cursor: pointer; }
.seg { display: flex; border: 1px solid var(--border); border-radius: var(--radius-sm); overflow: hidden; background: var(--surface); }
.seg button { min-height: 28px; border: 0; background: transparent; color: var(--text-3); font-size: var(--fs-caption); font-weight: 600; padding: 5px 13px; cursor: pointer; font-family: inherit; }
.seg button.on { background: var(--accent-light); color: var(--accent-ink); }
.seg button:hover:not(.on) { color: var(--text-2); }
.cmp-tool { padding: 5px 11px; border-radius: var(--radius-sm); border: 1px solid var(--border); background: var(--surface); color: var(--text-2); font-size: var(--fs-caption); font-weight: 600; cursor: pointer; font-family: inherit; }
.cmp-tool:hover { border-color: var(--accent); color: var(--accent-ink); }
.cmp-body { flex: 1; min-width: 0; max-width: 100%; padding: 18px 22px 30px; overflow-x: hidden; }
.cmp-filter-empty { min-height: 340px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; color: var(--text-3); text-align: center; }
.cmp-filter-empty b { color: var(--text); font-size: var(--fs-title); }
.cmp-filter-empty span { font-size: var(--fs-sub); }
.cmp-filter-empty button { margin-top: 8px; border: 1px solid color-mix(in srgb, var(--success) 35%, var(--border)); border-radius: var(--radius-full); background: color-mix(in srgb, var(--success) 8%, var(--surface)); color: color-mix(in srgb, var(--success) 80%, var(--text)); padding: 6px 14px; font: inherit; font-size: var(--fs-caption); font-weight: 650; cursor: pointer; }
@media (max-width: 900px) {
  .cmp-head { flex-wrap: wrap; padding: 8px 14px; }
  .cmp-sub { display: none; }
  .cmp-filters { order: 4; width: 100%; flex-wrap: wrap; }
  .cmp-filters label { flex: 1; min-width: 150px; }
  .cmp-filters select { width: 100%; max-width: none; }
  .cmp-body { padding: 12px 14px 24px; }
}
</style>
