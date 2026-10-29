<script setup lang="ts">

// 第卌五轮 T-03：全域任务管理面板（自 CompassActions.vue 整体抽离，迁入「资源罗盘 → 好奇心培育」专区 Tab；V2.20.1 改名任务调度）
// 全量能力保留：批量管理 / 状态筛选 / 排序+方向 / 按项目分组 / 搜索 / 拖拽排序（跨组=改归属）/ 看板 / 右键菜单 / 键盘导航
// 第卌五轮新增：卡片视图（默认），与好奇心卡片视觉一致
// R129-B5：链接协议白名单与打开通道全站唯一实现
// R117（04-61 C3）：当日新增角标（自然日口径）——卡片 / 列表 / 看板三视图同一枚
// R147-d：任务行「知」AI 辅助菜单（与项目详情页同一组件）
// W6（V3.8.6）#3：卡片视图右上角 AI 入口 —— 点击直接跑补全（详情走单击卡片）
// R113-N2：LifecyclePanel / useLifecycle 移除——生命周期入口收敛到 设置→总览

const props = withDefaults(defineProps<{
  /** 独立二级页：隐藏所有新建入口；空态主行动改为清空筛选。 */
  secondaryMode?: boolean
}>(), { secondaryMode: false })
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAppStore } from '../../stores/app'
import { useCompass } from '../../stores/compass'
import { uid } from '@/shared/utils'
import { saveUIPrefs } from '@/shared/storage/repository'
import { onOpenDrawer } from '@/shared/utils/bus'
import ContextMenu from '@/shared/components/ContextMenu.vue'
import { useBatchSelect, addTagToCards } from '../../composables/useBatchSelect'
import DeckBatchBar from './DeckBatchBar.vue'
import DeckControls from './DeckControls.vue'
import { visibleFields, fieldValue } from '@/shared/utils/fields'
import type { TaskCard, Subtask, FieldDef } from '@/shared/models'
import { recordCardOpen } from '@/shared/storage/stats'
import { toOpenableRawLink, openExternalLink } from '@/shared/utils/link'
import { softDeleteTaskToTrash } from '@/shared/utils/taskLinks'
import { showToast } from '@/shared/components/toast'
import Icon from '@/shared/components/Icon.vue'
import EmptyState from '@/shared/components/EmptyState.vue'
import AssetBadge from '@/shared/components/AssetBadge.vue'
import MaturityBadge from '@/shared/components/MaturityBadge.vue'
import { taskMaturity } from '@/shared/utils/maturity'
import NewBadge from '@/shared/components/NewBadge.vue'
import ModuleCard from '@/shared/components/ModuleCard.vue'
import ColsPicker from '@/shared/components/ColsPicker.vue'
import { useCardCols } from '@/shared/utils/cardCols'
import TaskDetailDrawer from './TaskDetailDrawer.vue'
import TaskAiMenu from '@/newtab/components/TaskAiMenu.vue'
import TaskAiCorner from '@/newtab/components/TaskAiCorner.vue'
import SubtaskList from '@/shared/components/SubtaskList.vue'
import { useTaskManagerPanel, type TaskManagerPanelProps, type TaskFilter, type TaskGroupMode } from './useTaskManagerPanel'
const {
  route,
  router,
  store,
  d,
  allProjects,
  projectProgress,
  taskArchiveIssue,
  drawerRef,
  viewMode,
  taskCols,
  groupMode,
  groupByProject,
  sortBy,
  sortDir,
  savedFilter,
  filterBy,
  toggleSortDir,
  searchQuery,
  TASK_VIEWS,
  TASK_FILTERS,
  TASK_SORTS,
  TASK_GROUPS,
  batchMode,
  toggleBatchMode,
  applyTaskFilters,
  filteredTasks,
  totalTaskCount,
  archivedHintCount,
  clearTaskFilter,
  groupedTasks,
  todoTasks,
  doingTasks,
  doneTasks,
  pinnedTasks,
  normalTasks,
  collapsedGroups,
  isGroupCollapsed,
  toggleGroupCollapsed,
  allGroupsCollapsed,
  toggleAllGroups,
  listGroups,
  selectedTaskIds,
  allTasksSelected,
  toggleSelect,
  selectAll,
  invertSelect,
  clearSelection,
  setBatchMode,
  batchAddTag,
  batchDelete,
  batchSetStatus,
  batchSetPriority,
  mountModalOpen,
  mountProjId,
  mountMetId,
  mountProjectOptions,
  mountMetricOptions,
  openBatchMount,
  confirmBatchMount,
  setTaskStatusOf,
  cycleTaskStatus,
  deleteTask,
  createNewTask,
  projNameById,
  metricTitleById,
  projectName,
  metricName,
  subProgress,
  subExpanded,
  toggleSubExpand,
  writeSubtasks,
  draggedTask,
  onTaskDragStart,
  onTaskDrop,
  onTaskCardDrop,
  onKanbanDrop,
  kgDragOver,
  tgDragOver,
  tgHoverTimer,
  onGroupHeadDragOver,
  onGroupHeadDragLeave,
  onListGroupDrop,
  kanbanMap,
  kanbanGroups,
  onKanbanGroupDrop,
  tFields,
  tShow,
  T_SKELETON_KEYS,
  tListFields,
  taskAssetsOn,
  tVal,
  tShort,
  fmtCardDate,
  openCardLink,
  taskClickTimer,
  openTaskFromAi,
  onTaskRowClick,
  openDetail,
  onTaskRowDblClick,
  toggleTaskPin,
  toggleTaskStar,
  syncMetricTaskIds,
  highlightId,
  taskCtx,
  taskCtxItems,
  taskCtxTarget,
  openTaskCtx,
  taskDropAfter,
  taskDropKey,
  markTaskDrop,
  clearTaskDrop,
  taskNavIndex,
  onTaskNavKey,
} = useTaskManagerPanel(props)
defineExpose({ openDetail })
</script>

<template>
  <!-- R176（原型 1:1）：模块标题行退役（原型工作台面板直接以工具条开篇）；批量管理/新建任务移入工具条右端 -->
  <ModuleCard title="">

    <div class="mgr-body" :class="{batch: batchMode}">
      <!-- R3-Cc2：控制行收归 DeckControls——顺序与样式一份实现，任务的值域（三视图 / 五状态 / 三排序 / 三分组）以数据传入 -->
      <DeckControls panel="task" search :query="searchQuery" @search="searchQuery = $event"
        :filters="TASK_FILTERS" filter-kind="select" :filter="filterBy" @filter="filterBy = $event as TaskFilter" filter-title="状态筛选"
        :views="TASK_VIEWS" :view="viewMode" @view="viewMode = $event as 'card' | 'list' | 'kanban'"
        :sorts="TASK_SORTS" :sort="sortBy" @sort="sortBy = $event"
        :sort-dir="(sortBy === 'recent' || sortBy === 'priority') ? sortDir : ''"
        :sort-dir-titles="['当前倒序，点击切换正序', '当前正序，点击切换倒序']" @sort-dir="toggleSortDir"
        :groups="viewMode === 'list' ? TASK_GROUPS : []" :group="groupMode" @group="groupMode = $event as TaskGroupMode"
        :batch-on="batchMode" @batch="toggleBatchMode" :new-label="secondaryMode ? '' : '＋新建任务'" @create="createNewTask">
        <!-- R72：卡片视图横向列数（4/5/6/7，仅卡片视图出现） -->
        <ColsPicker v-if="viewMode === 'card'" v-model="taskCols" label="列数" />
        <!-- ★W17-C05：分组折叠全局开关（列表视图才出现；任一组展开时给「全部折叠」） -->
        <button v-if="viewMode === 'list' && listGroups.length" class="tg-allbtn" type="button"
          :title="allGroupsCollapsed ? '展开全部组' : '收起全部组，只看组头'" @click="toggleAllGroups">
          {{ allGroupsCollapsed ? '▾ 全部展开' : '▸ 全部折叠' }}
        </button>
        <template #count><span class="mgr-count"><span class="cur">{{ filteredTasks.length }} 条</span><span class="total" v-pressable :class="{ act: filterBy !== 'all' || searchQuery.trim() }" @click="clearTaskFilter" :title="filterBy !== 'all' || searchQuery.trim() ? '点击查看全部任务' : '全部任务数'">/ 全部 {{ totalTaskCount }}</span></span></template>
      </DeckControls>

      <!-- R110-LC（T3）：归档卡已从默认视图隐藏——降级提示（R113-N2 起点击跳 设置→总览·资源生命周期） -->
      <div v-if="archivedHintCount" class="tm-archived-hint" v-pressable @click="router.push('/profile#lifecycle')">
        <Icon name="package" :size="13"/> 另有 {{ archivedHintCount }} 张已归档任务未显示（点此在 设置 › 总览 · 资源生命周期 中查看 / 恢复）
      </div>

      <!-- R3-Cc：批量栏收归 DeckBatchBar（三张卡同一份「已选/全选/反选/打标」DOM） -->
      <DeckBatchBar v-if="batchMode" :size="selectedTaskIds.size" :total="filteredTasks.length" :all-selected="allTasksSelected"
        @select-all="selectAll" @invert="invertSelect" @apply-tag="batchAddTag">
        <button class="mini-btn" :disabled="!selectedTaskIds.size" @click="batchSetStatus('todo')">待开始</button>
        <button class="mini-btn" :disabled="!selectedTaskIds.size" @click="batchSetStatus('doing')">进行中</button>
        <button class="mini-btn" :disabled="!selectedTaskIds.size" @click="batchSetStatus('done')">已完成</button>
        <button class="mini-btn" :disabled="!selectedTaskIds.size" @click="batchSetPriority('high')"><Icon name="dot" :size="9" class="zy-dot zy-dot-hi"/> 高优</button>
        <button class="mini-btn" :disabled="!selectedTaskIds.size" @click="batchSetPriority('medium')"><Icon name="dot" :size="9" class="zy-dot zy-dot-mi"/> 中优</button>
        <button class="mini-btn" :disabled="!selectedTaskIds.size" @click="batchSetPriority('low')"><Icon name="dot" :size="9" class="zy-dot zy-dot-lo"/> 低优</button>
        <button class="mini-btn" :disabled="!selectedTaskIds.size" @click="openBatchMount"><Icon name="package" :size="13"/> 挂到项目›指标</button>
        <button class="mini-btn danger" :disabled="!selectedTaskIds.size" @click="batchDelete"><Icon name="trash" :size="13"/> 删除</button>
        <button class="mini-btn" @click="clearSelection()">取消选择</button>
      </DeckBatchBar>

      <!-- 卡片视图（第卌五轮新增 · 默认；R47-A3：置顶/非置顶分组区块渲染，与好奇心培育同款） -->
      <div v-if="viewMode==='card'" class="tm-grid" :style="{ '--grid-cols': String(taskCols) }">
        <div v-if="!filteredTasks.length" class="tm-grid-empty">
          <EmptyState icon="clipboard" title="没有匹配的任务"
            :hint="secondaryMode ? '当前搜索或筛选没有结果。清空筛选后可继续浏览全部任务。' : '新建统一走扩展快捷键；也可在方向树的成功指标下添加任务。'"
            :action-label="secondaryMode ? '清空筛选' : ''" @action="clearTaskFilter" />
        </div>
        <template v-if="pinnedTasks.length">
          <div class="tm-group-label"><Icon name="pin" :size="13"/> 已置顶 · {{ pinnedTasks.length }}</div>
          <div class="tm-grid-inner">
            <div v-for="task in pinnedTasks" :key="task.id" class="tm-card" v-pressable
              :class="{done: task.status==='done', selected: selectedTaskIds.has(task.id), flash: highlightId===task.id, 'drop-line-t': taskDropKey===task.id+'-t', 'drop-line-b': taskDropKey===task.id+'-b'}"
              :data-tid="task.id"
              draggable="true"
              @dragstart="onTaskDragStart($event, task)" @dragover.prevent="markTaskDrop($event, task.id)" @dragleave="clearTaskDrop" @drop.prevent.stop="onTaskDrop(task)"
              @click="onTaskRowClick(task)" @dblclick="onTaskRowDblClick(task)" @contextmenu.prevent="openTaskCtx($event, task)">
              <span v-if="batchMode" class="batch-check" v-pressable :class="{checked: selectedTaskIds.has(task.id)}" @click.stop="toggleSelect(task.id)"><Icon v-if="selectedTaskIds.has(task.id)" name="check" :size="12"/></span>
              <!-- R117（04-61 D）：状态胶囊受「状态」字段显隐控制（批量态仍让位给勾选框） -->
              <span v-else-if="tShow('status')" class="tm-status" :class="'st-'+task.status"><Icon :name="task.status==='done'?'check':task.status==='doing'?'half':'circle'" :size="12"/>{{ task.status==='done'?'已完成':task.status==='doing'?'进行中':'待开始' }}</span>
              <button class="tm-corner pin" :class="{on: task.pinned}" @click.stop="toggleTaskPin(task)" title="置顶"><Icon name="pin" :size="13"/></button>
              <button class="tm-corner star" :class="{on: task.starred}" @click.stop="toggleTaskStar(task)" title="星标"><Icon name="star" :size="13"/></button>
              <!-- W6 #3：卡片视图 AI 入口改右上角角标直跑补全（详情走单击卡片）；TaskAiMenu 菜单形态留列表/看板 -->
              <TaskAiCorner :task="task" />
              <div class="tm-title"><NewBadge :at="task.createdAt" /><span v-if="subProgress(task)" class="tm-sub" :title="'子任务 ' + subProgress(task) + ' 已完成（不进成熟度与周报计分）'"><Icon name="corner" :size="13"/> {{ subProgress(task) }}</span>{{ task.title }}</div>
              <!-- R117（04-61 D）：项目/指标/附件逐项受字段设置控制（原先无条件渲染） -->
              <div v-if="tShow('projectId') || tShow('metricId') || (taskAssetsOn && task.assets?.length)" class="tm-tags">
                <span v-if="tShow('projectId')" class="tag accent"><Icon name="package" :size="13"/> {{ projectName(task.projectId) }}</span>
                <span v-if="tShow('metricId') && task.metricId" class="tag warn"><Icon name="target" :size="13"/> {{ metricName(task.metricId) }}</span>
                <AssetBadge v-if="taskAssetsOn && task.assets?.length" :assets="task.assets" />
              <MaturityBadge :m="taskMaturity(task)" />
              </div>
              <div v-if="tListFields.length" class="tm-ext">
                <span v-for="f in tListFields" :key="f.key" class="tm-ext-item">{{ tShort(task, f) }}</span>
              </div>
              <!-- R117（04-61 D）：日期角标优先吃「截止时间」字段（任务卡字段池里没有 createdAt）；
                   截止时间不可见时回落创建时间（骨架兜底，避免卡片零日期信息） -->
              <div class="tm-meta">
                <span v-if="tShow('dueDate') && task.dueDate"><Icon name="calendar" :size="13"/> {{ fmtCardDate(task.dueDate) }}</span>
                <span v-else><Icon name="calendar" :size="13"/> {{ fmtCardDate(task.createdAt) }}</span>
                <button class="tm-del" @click.stop="deleteTask(task.id)" title="删除任务"><Icon name="trash" :size="13"/></button>
              </div>
            </div>
          </div>
          <div class="tm-group-label">全部任务 · {{ normalTasks.length }}</div>
          <div class="tm-grid-inner">
            <div v-for="task in normalTasks" :key="task.id" class="tm-card" v-pressable
              :class="{done: task.status==='done', selected: selectedTaskIds.has(task.id), flash: highlightId===task.id, 'drop-line-t': taskDropKey===task.id+'-t', 'drop-line-b': taskDropKey===task.id+'-b'}"
              :data-tid="task.id"
              draggable="true"
              @dragstart="onTaskDragStart($event, task)" @dragover.prevent="markTaskDrop($event, task.id)" @dragleave="clearTaskDrop" @drop.prevent.stop="onTaskDrop(task)"
              @click="onTaskRowClick(task)" @dblclick="onTaskRowDblClick(task)" @contextmenu.prevent="openTaskCtx($event, task)">
              <span v-if="batchMode" class="batch-check" v-pressable :class="{checked: selectedTaskIds.has(task.id)}" @click.stop="toggleSelect(task.id)"><Icon v-if="selectedTaskIds.has(task.id)" name="check" :size="12"/></span>
              <!-- R117（04-61 D）：状态胶囊受「状态」字段显隐控制（批量态仍让位给勾选框） -->
              <span v-else-if="tShow('status')" class="tm-status" :class="'st-'+task.status"><Icon :name="task.status==='done'?'check':task.status==='doing'?'half':'circle'" :size="12"/>{{ task.status==='done'?'已完成':task.status==='doing'?'进行中':'待开始' }}</span>
              <button class="tm-corner pin" :class="{on: task.pinned}" @click.stop="toggleTaskPin(task)" title="置顶"><Icon name="pin" :size="13"/></button>
              <button class="tm-corner star" :class="{on: task.starred}" @click.stop="toggleTaskStar(task)" title="星标"><Icon name="star" :size="13"/></button>
              <!-- W6 #3：卡片视图 AI 入口改右上角角标直跑补全（详情走单击卡片）；TaskAiMenu 菜单形态留列表/看板 -->
              <TaskAiCorner :task="task" />
              <div class="tm-title"><NewBadge :at="task.createdAt" /><span v-if="subProgress(task)" class="tm-sub" :title="'子任务 ' + subProgress(task) + ' 已完成（不进成熟度与周报计分）'"><Icon name="corner" :size="13"/> {{ subProgress(task) }}</span>{{ task.title }}</div>
              <!-- R117（04-61 D）：项目/指标/附件逐项受字段设置控制（原先无条件渲染） -->
              <div v-if="tShow('projectId') || tShow('metricId') || (taskAssetsOn && task.assets?.length)" class="tm-tags">
                <span v-if="tShow('projectId')" class="tag accent"><Icon name="package" :size="13"/> {{ projectName(task.projectId) }}</span>
                <span v-if="tShow('metricId') && task.metricId" class="tag warn"><Icon name="target" :size="13"/> {{ metricName(task.metricId) }}</span>
                <AssetBadge v-if="taskAssetsOn && task.assets?.length" :assets="task.assets" />
              <MaturityBadge :m="taskMaturity(task)" />
              </div>
              <div v-if="tListFields.length" class="tm-ext">
                <span v-for="f in tListFields" :key="f.key" class="tm-ext-item">{{ tShort(task, f) }}</span>
              </div>
              <!-- R117（04-61 D）：日期角标优先吃「截止时间」字段（任务卡字段池里没有 createdAt）；
                   截止时间不可见时回落创建时间（骨架兜底，避免卡片零日期信息） -->
              <div class="tm-meta">
                <span v-if="tShow('dueDate') && task.dueDate"><Icon name="calendar" :size="13"/> {{ fmtCardDate(task.dueDate) }}</span>
                <span v-else><Icon name="calendar" :size="13"/> {{ fmtCardDate(task.createdAt) }}</span>
                <button class="tm-del" @click.stop="deleteTask(task.id)" title="删除任务"><Icon name="trash" :size="13"/></button>
              </div>
            </div>
          </div>
        </template>
        <div v-else class="tm-grid-inner">
          <div v-for="task in normalTasks" :key="task.id" class="tm-card" v-pressable
            :class="{done: task.status==='done', selected: selectedTaskIds.has(task.id), flash: highlightId===task.id, 'drop-line-t': taskDropKey===task.id+'-t', 'drop-line-b': taskDropKey===task.id+'-b'}"
            :data-tid="task.id"
            draggable="true"
            @dragstart="onTaskDragStart($event, task)" @dragover.prevent="markTaskDrop($event, task.id)" @dragleave="clearTaskDrop" @drop.prevent.stop="onTaskDrop(task)"
            @click="onTaskRowClick(task)" @dblclick="onTaskRowDblClick(task)" @contextmenu.prevent="openTaskCtx($event, task)">
            <span v-if="batchMode" class="batch-check" v-pressable :class="{checked: selectedTaskIds.has(task.id)}" @click.stop="toggleSelect(task.id)"><Icon v-if="selectedTaskIds.has(task.id)" name="check" :size="12"/></span>
            <span v-else class="tm-status" :class="'st-'+task.status"><Icon :name="task.status==='done'?'check':task.status==='doing'?'half':'circle'" :size="12"/>{{ task.status==='done'?'已完成':task.status==='doing'?'进行中':'待开始' }}</span>
            <button class="tm-corner pin" :class="{on: task.pinned}" @click.stop="toggleTaskPin(task)" title="置顶"><Icon name="pin" :size="13"/></button>
            <button class="tm-corner star" :class="{on: task.starred}" @click.stop="toggleTaskStar(task)" title="星标"><Icon name="star" :size="13"/></button>
            <TaskAiCorner :task="task" />
            <div class="tm-title"><NewBadge :at="task.createdAt" /><span v-if="subProgress(task)" class="tm-sub" :title="'子任务 ' + subProgress(task) + ' 已完成（不进成熟度与周报计分）'"><Icon name="corner" :size="13"/> {{ subProgress(task) }}</span>{{ task.title }}</div>
            <div class="tm-tags">
              <span class="tag accent"><Icon name="package" :size="13"/> {{ projectName(task.projectId) }}</span>
              <span v-if="task.metricId" class="tag warn"><Icon name="target" :size="13"/> {{ metricName(task.metricId) }}</span>
              <AssetBadge v-if="taskAssetsOn && task.assets?.length" :assets="task.assets" />
              <MaturityBadge :m="taskMaturity(task)" />
            </div>
            <div v-if="tListFields.length" class="tm-ext">
              <span v-for="f in tListFields" :key="f.key" class="tm-ext-item" :class="{['status-'+task.status]: f.key==='status'}">{{ tShort(task, f) }}</span>
            </div>
            <div class="tm-meta">
              <span><Icon name="calendar" :size="13"/> {{ fmtCardDate(task.createdAt) }}</span>
              <button class="tm-del" @click.stop="deleteTask(task.id)" title="删除任务"><Icon name="trash" :size="13"/></button>
            </div>
          </div>
        </div>
      </div>

      <!-- 列表视图（R127：默认视图 · 三档分组 + 已完成沉底） -->
      <div v-else-if="viewMode==='list'" class="task-list">
        <div v-for="grp in listGroups" :key="grp.key" class="tgroup">
          <div class="tg-head" :class="{'drag-over': groupMode==='project' && tgDragOver === grp.key}"
            @dragover.prevent.stop="onGroupHeadDragOver(grp.key)"
            @dragleave="onGroupHeadDragLeave(grp.key)"
            @drop.stop="groupMode==='project' && onListGroupDrop($event, grp.key)">
            <button class="tg-name tg-toggle" :class="{none: grp.key==='__none__'}" :aria-expanded="!isGroupCollapsed(grp.key)"
              :title="isGroupCollapsed(grp.key) ? '展开该组' : '收起该组'" @click.stop="toggleGroupCollapsed(grp.key)">
              <span class="tg-ar">{{ isGroupCollapsed(grp.key) ? '▸' : '▾' }}</span>{{ grp.icon }} {{ grp.name }}
            </button>
            <span v-if="grp.pct >= 0" class="tg-pct">{{ grp.pct }}%</span>
            <span class="tg-count">{{ grp.tasks.length }} 任务</span>
          </div>
          <template v-if="!isGroupCollapsed(grp.key)">
          <div v-for="task in grp.tasks" :key="task.id" class="trow" v-pressable :class="{done: task.status==='done', selected: selectedTaskIds.has(task.id), flash: highlightId===task.id}"
            :data-tid="task.id"
            draggable="true" @dragstart="onTaskDragStart($event, task)" @dragover.prevent="markTaskDrop($event, task.id)" @dragleave="clearTaskDrop" @drop="onTaskDrop(task, true)" @click="onTaskRowClick(task)" @dblclick="onTaskRowDblClick(task)">
            <div v-if="batchMode" class="batch-check" v-pressable :class="{checked: selectedTaskIds.has(task.id)}" @click.stop="toggleSelect(task.id)"><Icon v-if="selectedTaskIds.has(task.id)" name="check" :size="12"/></div>
            <span v-else class="t-drag">⋮⋮</span>
            <div class="check-sm" v-pressable :class="{done: task.status==='done'}" @click.stop="cycleTaskStatus(task.id)"><Icon v-if="task.status==='done'" name="check" :size="11"/><template v-else>{{ task.status==='doing'?'◐':'' }}</template></div>
            <span class="tname"><NewBadge :at="task.createdAt" /><span v-if="subProgress(task)" class="tm-sub exp" v-pressable :title="'子任务 ' + subProgress(task) + ' · 点开就地勾选（不跳详情）'" @click.stop="toggleSubExpand(task.id)"><Icon name="corner" :size="13"/> {{ subProgress(task) }} {{ subExpanded.has(task.id) ? '▴' : '▾' }}</span>{{ task.title }}</span>
            <!-- F2：就地展开的子任务清单（浮层定位，不挤行高；勾选即写回本卡） -->
          <div v-if="subExpanded.has(task.id)" class="trow-subs">
            <SubtaskList :subtasks="task.subtasks || []" @update="writeSubtasks(task, $event)" />
          </div>
          <div class="row-tags">
              <span v-for="f in tListFields" :key="f.key" class="tag" :class="{'accent': f.key==='projectId', [ 'status-'+task.status ]: f.key==='status'}">{{ tShort(task, f) }}</span>
              <AssetBadge v-if="taskAssetsOn && task.assets?.length" :assets="task.assets" />
              <MaturityBadge :m="taskMaturity(task)" />
            </div>
            <button class="t-pin" :class="{on: task.pinned}" @click.stop="toggleTaskPin(task)" title="置顶"><Icon name="pin" :size="13"/></button>
            <button class="t-star" :class="{on: task.starred}" @click.stop="toggleTaskStar(task)" title="星标"><Icon name="star" :size="13"/></button>
            <TaskAiMenu :task="task" @detail="openTaskFromAi" />
            <button class="t-del" @click.stop="deleteTask(task.id)" title="删除任务"><Icon name="trash" :size="13"/></button>
          </div>
          </template>
        </div>
        <!-- G3（V3.8.27）：列表视图与卡片视图同构，不再一个 EmptyState 一个裸文本 -->
        <EmptyState v-if="!filteredTasks.length" class="list-empty" size="section" icon="clipboard"
          title="没有匹配的任务"
          :hint="secondaryMode ? '当前搜索或筛选没有结果。清空筛选后可继续浏览全部任务。' : '新建统一走扩展快捷键；也可在方向树的成功指标下添加任务。'"
          :action-label="secondaryMode ? '清空筛选' : ''" @action="clearTaskFilter" />
      </div>

      <!-- 看板视图（跨列改状态 · 列内按项目分组 · 拖拽改归属 O17） -->
      <div v-else class="kanban-board">
        <div class="kcol" @dragover.prevent @drop="onKanbanDrop('todo')">
          <div class="khead"><span>待开始</span><span class="kcount">{{ todoTasks.length }}</span></div>
          <template v-if="groupByProject">
            <div v-for="grp in kanbanGroups('todo')" :key="grp.key" class="kgroup"
              :class="{'drag-over': kgDragOver === 'todo-' + grp.key}"
              @dragover.prevent.stop="kgDragOver = 'todo-' + grp.key"
              @dragleave="kgDragOver === 'todo-' + grp.key && (kgDragOver = '')"
              @drop.stop="onKanbanGroupDrop($event, 'todo', grp.key)">
              <div class="kg-head">
                <span class="kg-name"><Icon name="package" :size="13"/> {{ grp.name }}</span>
                <span class="kg-count">{{ grp.tasks.length }}</span>
              </div>
              <div v-for="task in grp.tasks" :key="task.id" class="kcard" v-pressable :class="{done: task.status==='done', flash: highlightId===task.id, 'drop-line-t': taskDropKey===task.id+'-t', 'drop-line-b': taskDropKey===task.id+'-b'}" draggable="true" :data-tid="task.id"
                @dragstart="onTaskDragStart($event, task)" @dragover.prevent.stop="markTaskDrop($event, task.id)" @dragleave="clearTaskDrop" @drop.stop="onTaskCardDrop($event, task, groupByProject)" @click="onTaskRowClick(task)" @dblclick="onTaskRowDblClick(task)" @contextmenu.prevent="openTaskCtx($event, task)">
                <button class="k-pin" :class="{on: task.pinned}" @click.stop="toggleTaskPin(task)" title="置顶"><Icon name="pin" :size="13"/></button><button class="k-star" :class="{on: task.starred}" @click.stop="toggleTaskStar(task)" title="星标"><Icon name="star" :size="13"/></button><button class="k-del" @click.stop="deleteTask(task.id)" title="删除任务"><Icon name="trash" :size="12" /></button><div class="kt"><NewBadge :at="task.createdAt" />{{ task.title }}</div>
                <span class="tag accent">{{ projectName(task.projectId) }}</span> <AssetBadge v-if="taskAssetsOn && task.assets?.length" :assets="task.assets" class="kc-assets" />
              <MaturityBadge :m="taskMaturity(task)" />
              <TaskAiMenu :task="task" @detail="openTaskFromAi" />
              </div>
              <div v-if="!grp.tasks.length" class="kg-empty">拖入任务归到此项目</div>
            </div>
            <div v-if="!kanbanGroups('todo').length" class="kg-empty kg-empty-pad">暂无任务</div>
          </template>
          <template v-else>
            <div v-for="task in todoTasks" :key="task.id" class="kcard" v-pressable :class="{done: task.status==='done', flash: highlightId===task.id, 'drop-line-t': taskDropKey===task.id+'-t', 'drop-line-b': taskDropKey===task.id+'-b'}" draggable="true" :data-tid="task.id"
              @dragstart="onTaskDragStart($event, task)" @dragover.prevent.stop="markTaskDrop($event, task.id)" @dragleave="clearTaskDrop" @drop.stop="onTaskCardDrop($event, task, groupByProject)" @click="onTaskRowClick(task)" @dblclick="onTaskRowDblClick(task)" @contextmenu.prevent="openTaskCtx($event, task)">
              <button class="k-pin" :class="{on: task.pinned}" @click.stop="toggleTaskPin(task)" title="置顶"><Icon name="pin" :size="13"/></button><button class="k-star" :class="{on: task.starred}" @click.stop="toggleTaskStar(task)" title="星标"><Icon name="star" :size="13"/></button><button class="k-del" @click.stop="deleteTask(task.id)" title="删除任务"><Icon name="trash" :size="12" /></button><div class="kt"><NewBadge :at="task.createdAt" />{{ task.title }}</div>
              <span class="tag accent">{{ projectName(task.projectId) }}</span> <AssetBadge v-if="taskAssetsOn && task.assets?.length" :assets="task.assets" class="kc-assets" />
              <MaturityBadge :m="taskMaturity(task)" />
              <TaskAiMenu :task="task" @detail="openTaskFromAi" />
            </div>
          </template>
        </div>
        <div class="kcol" @dragover.prevent @drop="onKanbanDrop('doing')">
          <div class="khead"><span>进行中</span><span class="kcount">{{ doingTasks.length }}</span></div>
          <template v-if="groupByProject">
            <div v-for="grp in kanbanGroups('doing')" :key="grp.key" class="kgroup"
              :class="{'drag-over': kgDragOver === 'doing-' + grp.key}"
              @dragover.prevent.stop="kgDragOver = 'doing-' + grp.key"
              @dragleave="kgDragOver === 'doing-' + grp.key && (kgDragOver = '')"
              @drop.stop="onKanbanGroupDrop($event, 'doing', grp.key)">
              <div class="kg-head">
                <span class="kg-name"><Icon name="package" :size="13"/> {{ grp.name }}</span>
                <span class="kg-count">{{ grp.tasks.length }}</span>
              </div>
              <div v-for="task in grp.tasks" :key="task.id" class="kcard" v-pressable :class="{done: task.status==='done', flash: highlightId===task.id, 'drop-line-t': taskDropKey===task.id+'-t', 'drop-line-b': taskDropKey===task.id+'-b'}" draggable="true" :data-tid="task.id"
                @dragstart="onTaskDragStart($event, task)" @dragover.prevent.stop="markTaskDrop($event, task.id)" @dragleave="clearTaskDrop" @drop.stop="onTaskCardDrop($event, task, groupByProject)" @click="onTaskRowClick(task)" @dblclick="onTaskRowDblClick(task)" @contextmenu.prevent="openTaskCtx($event, task)">
                <button class="k-pin" :class="{on: task.pinned}" @click.stop="toggleTaskPin(task)" title="置顶"><Icon name="pin" :size="13"/></button><button class="k-star" :class="{on: task.starred}" @click.stop="toggleTaskStar(task)" title="星标"><Icon name="star" :size="13"/></button><button class="k-del" @click.stop="deleteTask(task.id)" title="删除任务"><Icon name="trash" :size="12" /></button><div class="kt"><NewBadge :at="task.createdAt" />{{ task.title }}</div>
                <span class="tag accent">{{ projectName(task.projectId) }}</span> <AssetBadge v-if="taskAssetsOn && task.assets?.length" :assets="task.assets" class="kc-assets" />
              <MaturityBadge :m="taskMaturity(task)" />
              <TaskAiMenu :task="task" @detail="openTaskFromAi" />
              </div>
              <div v-if="!grp.tasks.length" class="kg-empty">拖入任务归到此项目</div>
            </div>
            <div v-if="!kanbanGroups('doing').length" class="kg-empty kg-empty-pad">暂无任务</div>
          </template>
          <template v-else>
            <div v-for="task in doingTasks" :key="task.id" class="kcard" v-pressable :class="{done: task.status==='done', flash: highlightId===task.id, 'drop-line-t': taskDropKey===task.id+'-t', 'drop-line-b': taskDropKey===task.id+'-b'}" draggable="true" :data-tid="task.id"
              @dragstart="onTaskDragStart($event, task)" @dragover.prevent.stop="markTaskDrop($event, task.id)" @dragleave="clearTaskDrop" @drop.stop="onTaskCardDrop($event, task, groupByProject)" @click="onTaskRowClick(task)" @dblclick="onTaskRowDblClick(task)" @contextmenu.prevent="openTaskCtx($event, task)">
              <button class="k-pin" :class="{on: task.pinned}" @click.stop="toggleTaskPin(task)" title="置顶"><Icon name="pin" :size="13"/></button><button class="k-star" :class="{on: task.starred}" @click.stop="toggleTaskStar(task)" title="星标"><Icon name="star" :size="13"/></button><button class="k-del" @click.stop="deleteTask(task.id)" title="删除任务"><Icon name="trash" :size="12" /></button><div class="kt"><NewBadge :at="task.createdAt" />{{ task.title }}</div>
              <span class="tag accent">{{ projectName(task.projectId) }}</span> <AssetBadge v-if="taskAssetsOn && task.assets?.length" :assets="task.assets" class="kc-assets" />
              <MaturityBadge :m="taskMaturity(task)" />
              <TaskAiMenu :task="task" @detail="openTaskFromAi" />
            </div>
          </template>
        </div>
        <div class="kcol" @dragover.prevent @drop="onKanbanDrop('done')">
          <div class="khead"><span>已完成</span><span class="kcount">{{ doneTasks.length }}</span></div>
          <template v-if="groupByProject">
            <div v-for="grp in kanbanGroups('done')" :key="grp.key" class="kgroup"
              :class="{'drag-over': kgDragOver === 'done-' + grp.key}"
              @dragover.prevent.stop="kgDragOver = 'done-' + grp.key"
              @dragleave="kgDragOver === 'done-' + grp.key && (kgDragOver = '')"
              @drop.stop="onKanbanGroupDrop($event, 'done', grp.key)">
              <div class="kg-head">
                <span class="kg-name"><Icon name="package" :size="13"/> {{ grp.name }}</span>
                <span class="kg-count">{{ grp.tasks.length }}</span>
              </div>
              <div v-for="task in grp.tasks" :key="task.id" class="kcard" v-pressable :class="{done: task.status==='done', flash: highlightId===task.id, 'drop-line-t': taskDropKey===task.id+'-t', 'drop-line-b': taskDropKey===task.id+'-b'}" draggable="true" :data-tid="task.id"
                @dragstart="onTaskDragStart($event, task)" @dragover.prevent.stop="markTaskDrop($event, task.id)" @dragleave="clearTaskDrop" @drop.stop="onTaskCardDrop($event, task, groupByProject)" @click="onTaskRowClick(task)" @dblclick="onTaskRowDblClick(task)" @contextmenu.prevent="openTaskCtx($event, task)">
                <button class="k-pin" :class="{on: task.pinned}" @click.stop="toggleTaskPin(task)" title="置顶"><Icon name="pin" :size="13"/></button><button class="k-star" :class="{on: task.starred}" @click.stop="toggleTaskStar(task)" title="星标"><Icon name="star" :size="13"/></button><button class="k-del" @click.stop="deleteTask(task.id)" title="删除任务"><Icon name="trash" :size="12" /></button><div class="kt"><NewBadge :at="task.createdAt" />{{ task.title }}</div>
                <span class="tag accent">{{ projectName(task.projectId) }}</span> <AssetBadge v-if="taskAssetsOn && task.assets?.length" :assets="task.assets" class="kc-assets" />
              <MaturityBadge :m="taskMaturity(task)" />
              <TaskAiMenu :task="task" @detail="openTaskFromAi" />
              </div>
              <div v-if="!grp.tasks.length" class="kg-empty">拖入任务归到此项目</div>
            </div>
            <div v-if="!kanbanGroups('done').length" class="kg-empty kg-empty-pad">暂无任务</div>
          </template>
          <template v-else>
            <div v-for="task in doneTasks" :key="task.id" class="kcard" v-pressable :class="{done: task.status==='done', flash: highlightId===task.id, 'drop-line-t': taskDropKey===task.id+'-t', 'drop-line-b': taskDropKey===task.id+'-b'}" draggable="true" :data-tid="task.id"
              @dragstart="onTaskDragStart($event, task)" @dragover.prevent.stop="markTaskDrop($event, task.id)" @dragleave="clearTaskDrop" @drop.stop="onTaskCardDrop($event, task, groupByProject)" @click="onTaskRowClick(task)" @dblclick="onTaskRowDblClick(task)" @contextmenu.prevent="openTaskCtx($event, task)">
              <button class="k-pin" :class="{on: task.pinned}" @click.stop="toggleTaskPin(task)" title="置顶"><Icon name="pin" :size="13"/></button><button class="k-star" :class="{on: task.starred}" @click.stop="toggleTaskStar(task)" title="星标"><Icon name="star" :size="13"/></button><button class="k-del" @click.stop="deleteTask(task.id)" title="删除任务"><Icon name="trash" :size="12" /></button><div class="kt"><NewBadge :at="task.createdAt" />{{ task.title }}</div>
              <span class="tag accent">{{ projectName(task.projectId) }}</span> <AssetBadge v-if="taskAssetsOn && task.assets?.length" :assets="task.assets" class="kc-assets" />
              <MaturityBadge :m="taskMaturity(task)" />
              <TaskAiMenu :task="task" @detail="openTaskFromAi" />
            </div>
          </template>
        </div>
      </div>
    </div>

    <!-- ===== 批量挂载弹窗（O3） ===== -->
    <Transition name="fade">
      <div v-if="mountModalOpen" class="overlay" @click="mountModalOpen=false" />
    </Transition>
    <Transition name="modal">
      <div v-if="mountModalOpen" class="picker-modal tm-modal-mount">
        <div class="pm-head">
          <span><Icon name="package" :size="13"/> 挂载 {{ selectedTaskIds.size }} 个任务到项目›指标</span>
          <button class="pm-close" type="button" aria-label="关闭" @click="mountModalOpen=false">×</button>
        </div>
        <div class="pm-body">
          <div class="ts-label-pm"><Icon name="package" :size="13"/> 所属项目</div>
          <select v-model="mountProjId" class="ts-select-pm">
            <option value="">请选择项目…</option>
            <option v-for="p in mountProjectOptions" :key="p.id" :value="p.id">{{ p.name }}</option>
          </select>
          <div class="ts-label-pm tm-label-mount"><Icon name="target" :size="13"/> 成功指标（可选）</div>
          <select v-model="mountMetId" class="ts-select-pm" :disabled="!mountProjId">
            <option value="">暂不归属指标</option>
            <option v-for="m in mountMetricOptions" :key="m.id" :value="m.id">{{ m.title }}</option>
          </select>
          <div class="tm-modal-footer">
            <button class="mini-btn" @click="mountModalOpen=false">取消</button>
            <button class="mini-btn primary" @click="confirmBatchMount"><Icon name="check" :size="13"/> 确认挂载</button>
          </div>
        </div>
      </div>
    </Transition>

    <ContextMenu :state="taskCtx" :items="taskCtxItems" @close="taskCtx.open = false" />
    <TaskDetailDrawer ref="drawerRef" />
    <!-- R113-N2：生命周期面板移除——入口收敛到 设置→总览 -->
  </ModuleCard>
</template>

<style scoped src="./TaskManagerPanel.css"></style>
