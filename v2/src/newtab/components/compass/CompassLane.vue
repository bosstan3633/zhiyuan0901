<script setup lang="ts">
/**
 * W11 · 成功指标卡 + 任务行（第 5 层 / 第 6 层）。
 *
 * 原型的核心价值就在这两层的**贴合度**：任务内嵌在指标卡里（缩进 26px + 分叉连线），
 * 而不是平铺成一张列表——这样"这条任务属于哪个指标"从推断变成视觉事实。
 *
 * ★移植陷阱（本项目 V3.8.7 已踩过一次，判据 W11-2 专门钉它）：
 * 归属竖轨（.metric-list::before）与分叉臂（.tk-row::before）都是**无内容容器**，
 * 肉眼看不见作用、最容易被删。删了元素还在、CSS 全合法，但父方向一变语义就反。
 * 判据要求 ::before / ::after **三条同时存在**，别只判"元素在不在"。
 *
 * 焦点纪律：任务标题最高 --fs-body，**不许用 --fs-title 及以上**（会与指标名争层级）。
 */
import Icon from '@/shared/components/Icon.vue'
import './hotzone.css'
import './taskdnd.css'
import { computed, inject, ref } from 'vue'
import CompassLevelTag from './CompassLevelTag.vue'
import CompassMetricTitle from './CompassMetricTitle.vue'
import type { MetricMeta } from '../../views/compassMeta'
import { TASK_DND_KEY } from '../../views/useTaskRelocationDnd'
import { useCompass } from '../../stores/compass'
import { isTopicDone, topicStatusOf } from '@/shared/utils/topicStatus'
import { isTaskDone, taskStatusOf } from '@/shared/utils/taskStatus'

const props = defineProps<{
  m: MetricMeta
  /** 指标是否展开（折叠双向：指标收起后自身信息仍在，只是任务不显示） */
  open: boolean
  /** 项目名（用于任务 hover 的归属路径） */
  projName: string
  /** 战略目标名 */
  dirName: string
  /** 舱色（派生自 accent 的六档之一） */
  hue: string
  /** 是否处于就地改名态（由父组件的 editingField 单一真源驱动） */
  editing?: boolean
}>()

const taskDnd = inject(TASK_DND_KEY, null)
const { d } = useCompass()
function taskBucket(t: import('@/shared/models').TaskCard): string {
  return taskStatusOf(d.value, t)?.bucket || 'todo'
}
function taskDone(t: import('@/shared/models').TaskCard): boolean {
  return isTaskDone(d.value, t)
}

const emit = defineEmits<{
  (e: 'toggle', metricId: string): void
  (e: 'task', taskId: string): void
  /** ★W12-C 任务详情抽屉：标题单击 = 打开右侧任务详情抽屉。
      此前全站没有任何一条 emit 通到 `CompassTree.detailRef.open()` —— 抽屉组件在位、
      唯独唯一调用点是「新建任务成功后」，于是任务行点了没反应（用户 2026-10-13 报 bug）。 */
  (e: 'openDetail', taskId: string): void
  /** V4.5：选题卡以“成果”呈现，点击打开选题详情。 */
  (e: 'openTopic', topicId: string): void
  (e: 'addTask', metricId: string): void
  /** ★R141：任务行 ✕ = 解绑回任务调度模块（不删本体）—— 模板挂载点，删了能力就丢 */
  (e: 'unbind', taskId: string): void
  /** ★R135-4：任务层 AI 拆解入口 */
  (e: 'aiTask', metricId: string): void
  /** 指标名就地改名三件套（与树内 contenteditable 机制同源，事件冒泡给父组件统一处理） */
  (e: 'editTitle', metricId: string, ev: MouseEvent | undefined): void
  (e: 'saveTitle', metricId: string, ev: FocusEvent | KeyboardEvent): void
  (e: 'cancelTitle', metricId: string): void
  /** 打开指标详情：标题单击仍保留就地改名，详情用独立按钮，不改变既有编辑习惯 */
  (e: 'openMetric', metricId: string): void
  /** ★F1：删除成功指标（走真源 removeMetricWithConfirm —— 报数确认 + 撤销，本组件只上抛） */
  (e: 'delMetric', metricId: string): void
  /** V4.4.0：项目内整组排序（指标连同其下任务一起移动） */
  (e: 'reorderMetric', dragId: string, targetId: string, mode: 't' | 'b'): void
}>()

/** ★F1：指标卡「⋯」菜单 */
const menuFor = ref<string | null>(null)
function toggleMenu(id: string) { menuFor.value = menuFor.value === id ? null : id }
const metricDragging = ref(false)
const metricDropMode = ref<'' | 't' | 'b'>('')
const METRIC_MIME = 'application/x-zhiyuan-metric'

function onMetricDragStart(e: DragEvent) {
  const target = e.target as HTMLElement | null
  if (target?.closest('button, input, [contenteditable="true"], .mc-menu')) {
    e.preventDefault()
    return
  }
  metricDragging.value = true
  e.dataTransfer?.setData(METRIC_MIME, props.m.id)
  if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move'
}

function onMetricDragOver(e: DragEvent) {
  if (!e.dataTransfer?.types.includes(METRIC_MIME)) return
  e.preventDefault()
  e.stopPropagation()
  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
  metricDropMode.value = e.clientY - rect.top > rect.height / 2 ? 'b' : 't'
}

function onMetricDrop(e: DragEvent) {
  const dragId = e.dataTransfer?.getData(METRIC_MIME) || ''
  const mode = metricDropMode.value || 't'
  metricDropMode.value = ''
  metricDragging.value = false
  if (!dragId || dragId === props.m.id) return
  e.preventDefault()
  e.stopPropagation()
  emit('reorderMetric', dragId, props.m.id, mode)
}

function clearMetricDrag() {
  metricDragging.value = false
  metricDropMode.value = ''
}

const dotGlyph = computed(() => (props.m.dot === 'done' ? '' : props.m.dot === 'doing' ? '◐' : '○'))
const dotTitle = computed(() =>
  props.m.dot === 'done' ? '该指标下任务已全部完成'
    : props.m.dot === 'doing' ? '有任务进行中' : '任务尚未启动'
)

/** 归属路径：只在 hover 时浮现，平时藏起来保持任务行的干净 */
const crumb = computed(() => `${props.dirName} › ${props.projName} › ${props.m.title}`)
function topicStatusName(topicId: string): string {
  const topic = props.m.topics.find(row => row.id === topicId)
  return topicStatusOf(d.value, topic?.statusId)?.name || '构思中'
}
function topicStatusColor(topicId: string): string {
  const topic = props.m.topics.find(row => row.id === topicId)
  return topicStatusOf(d.value, topic?.statusId)?.color || 'var(--accent)'
}
function topicDone(topicId: string): boolean {
  return isTopicDone(d.value, props.m.topics.find(row => row.id === topicId))
}
</script>

<template>
  <section
    class="metric-card"
    :class="{
      'dnd-tip-in': taskDnd && taskDnd.dropTip?.id === m.id && taskDnd.dropTip.mode === 'in',
      'metric-dragging': metricDragging,
      'metric-drop-t': metricDropMode === 't',
      'metric-drop-b': metricDropMode === 'b',
    }"
    :style="{ '--hue': hue }"
    :data-metric="m.id"
    @dragover.prevent="taskDnd?.onLaneDragOver($event, m.id)"
    @dragleave="taskDnd?.onLaneDragLeave($event, m.id)"
    @drop.prevent="taskDnd?.onLaneDrop($event, m.id)"
  >
    <header class="mc-head" draggable="true" title="拖动指标标题可整组排序（仅项目内）"
      @dragstart="onMetricDragStart" @dragover="onMetricDragOver" @drop="onMetricDrop" @dragend="clearMetricDrag">
      <span class="mc-grip" aria-hidden="true" title="拖动整组排序">⋮⋮</span>
      <button
        class="mc-dot"
        :class="m.dot"
        :title="dotTitle"
        :aria-label="dotTitle"
        @click="emit('toggle', m.id)"
      >{{ dotGlyph }}</button>
      <CompassLevelTag :level="5" kind="metric" icon="target" label="指标" />
      <CompassMetricTitle class="mc-title" v-pressable :title="m.title" :metric-id="m.id" variant="tower" :editing="!!editing"
        @edit="emit('editTitle', m.id, $event)" @save="emit('saveTitle', m.id, $event)"
        @cancel="emit('cancelTitle', m.id)" />
      <span v-if="m.orphanMetric" class="mc-flag warn" title="该指标下没有任何任务，线索断在这"><Icon name="warn" :size="13"/> 缺任务</span>
      <span v-else-if="m.target" class="mc-flag">{{ m.target }}</span>
      <!-- ★指标级进度条：原型 .m-bar 是「轨道 + 数字」一体、margin-left:auto 顶到行尾。
           之前只有一个裸百分数飘在行中，进度既不在固定位置也不成条，读起来像标签不是进度。 -->
      <span class="mc-bar" :title="`本指标完成度 ${m.pct}%（${m.done}/${m.total} 任务）`">
        <span class="mc-track"><i class="mc-fill" :style="{ width: m.pct + '%' }" /></span>
        <b class="mc-pct" :class="{ full: m.pct === 100 }">{{ m.done }}/{{ m.total }} · {{ m.pct }}%</b>
      </span>
      <button class="mc-detail" title="打开指标详情：目标值 / 进度 / 支撑任务" @click="emit('openMetric', m.id)">详情 ›</button>
      <!-- ★R135-4（能力保留）：任务层 AI 入口 —— 六入口之一，删了判据红就是能力丢不是判据的问题 -->
      <button class="mc-ai" title="AI 依本成功指标拆解支撑步骤（查重后采纳才创建）" @click="emit('aiTask', m.id)"><Icon name="sparkle" :size="13"/></button>
      <!-- ★R32-14（能力保留）：指标条目 ＋ 加任务 —— 断链空位之外也必须有一份常规出口，
           否则「指标下加任务」只剩断链时才出现的路径，等于能力退化。
           ★W12：这两枚按钮改为 hover 才显形 —— 指标头一行要塞 状态点/名称/标签/进度条/折叠，
           常驻两枚操作钮会把标题挤到换行，正是实际截图里"指标名后面跟一排小方块"的成因。
           能力没删（判据 R32-14 守的是 @监听挂载点，不是视觉常驻），只是让位给读。 -->
      <button class="mc-add" title="在本成功指标下添加支撑任务" @click="emit('addTask', m.id)">＋任务</button>
      <!-- ★F1：hover 🗑 + 「⋯」菜单 —— 与「＋任务」「✦」同一套 hover 显形。
           删除走真源 removeMetricWithConfirm（报数确认→任务转未关联→撤销），这里只上抛。 -->
      <span class="mc-ops" data-a11y-container @click.stop>
        <button class="mc-more" :class="{ on: menuFor === m.id }" title="指标更多操作" @click="toggleMenu(m.id)">⋯</button>
        <span v-if="menuFor === m.id" class="mc-menu" data-a11y-container @click.stop>
          <button class="mcm-item" @click="menuFor = null; emit('editTitle', m.id, undefined)"><Icon name="edit" :size="13"/> 重命名指标</button>
          <button class="mcm-item danger" @click="menuFor = null; emit('delMetric', m.id)"><Icon name="trash" :size="13"/> 删除本指标</button>
        </span>
      </span>
      <!-- 收起 / 展开固定在指标行最右侧；删除收在「更多」里，不占主行。 -->
      <button class="mc-toggle" :aria-expanded="open" @click="emit('toggle', m.id)">
        {{ open ? '收起 ▾' : '展开 ▸' }}
      </button>
    </header>

    <!-- 任务与成果选题：都内嵌在指标下，但用不同语义呈现。选题不参与任务完成率。 -->
    <div v-if="open && (m.tasks.length || m.topics.length)" class="metric-list">
      <ul v-if="m.tasks.length" class="tk-list">
        <li v-for="t in m.tasks" :key="t.id" class="tk-row" :data-task="t.id" :title="`归属：${crumb}`" :draggable="taskDnd ? true : undefined"
          :class="[taskBucket(t), { 'tk-drag': taskDnd && taskDnd.dragTaskId === t.id, 'dnd-tip-t': taskDnd && taskDnd.dropTip?.id === t.id && taskDnd.dropTip.mode === 't', 'dnd-tip-b': taskDnd && taskDnd.dropTip?.id === t.id && taskDnd.dropTip.mode === 'b' }]"
          @dragstart="taskDnd?.onTaskDragStart($event, t)" @dragover.stop.prevent="taskDnd?.onRowDragOver($event, t)"
          @drop.stop.prevent="taskDnd?.onRowDrop($event, t, m.id)" @dragend="taskDnd?.onDragEnd()">
          <button
            class="tk-box"
            :class="taskBucket(t)"
            :aria-label="taskDone(t) ? '标记未完成' : '标记完成'"
            @click="emit('task', t.id)"
          ><span v-if="taskDone(t)"><Icon name="check" :size="13"/></span></button>
          <button class="tk-title" title="打开任务详情抽屉" @click="emit('openDetail', t.id)">{{ t.title }}</button>
          <!-- 归属路径：hover 浮现 -->
          <span class="tk-crumb" aria-hidden="true">{{ crumb }}</span>
          <span class="tk-tags">
            <!-- V3.9.22：方向台只保留解绑；真删除只在任务详情与任务卡池行末常驻入口。 -->
            <button class="tk-unbind" title="解除指标关联，任务回任务池（真删除请进任务详情）" aria-label="解除任务关联" @click="emit('unbind', t.id)"><Icon name="x" :size="13"/></button>
          </span>
        </li>
      </ul>
      <ul v-if="m.topics.length" class="topic-result-list">
        <li v-for="topic in m.topics" :key="topic.id" class="topic-result-row" :style="{ '--topic-status': topicStatusColor(topic.id) }" :data-topic="topic.id">
          <button class="topic-result-title" type="button" title="打开选题卡详情" @click="emit('openTopic', topic.id)">
            <span class="topic-result-tag">成果</span>
            <span class="topic-result-copy" :class="{ done: topicDone(topic.id) }">{{ topic.title }}</span>
          </button>
          <span class="topic-result-status">{{ topicStatusName(topic.id) }}</span>
          <span class="topic-result-go" aria-hidden="true">›</span>
        </li>
      </ul>
    </div>

    <!-- 断链显性化：零任务指标给虚线空位，让"缺"在版面上可见（判据 W11-6） -->
    <div v-else-if="m.orphanMetric" class="mc-orphan">
      <span class="mo-ico"><Icon name="target" :size="14"/></span>
      <span class="mo-copy">
        <b>指标已就位，下一步先落一个动作</b>
        <small>新建一条可执行任务，让这条指标开始产生进展。</small>
      </span>
      <button class="mo-add" @click="emit('addTask', m.id)">＋ 新建任务</button>
    </div>

    <div v-else class="mc-collapsed">
      <span>{{ m.total }} 条任务已收起 · 点击「展开 ▸」查看</span>
      <button class="mo-add" @click="emit('toggle', m.id)">展开 ▸</button>
    </div>
  </section>
</template>

<style scoped src="./CompassLane.css"></style>
