<script setup lang="ts">
/**
 * V3.9.33（批 A 用户反馈）：策展模式 · 金字塔布局 = **隶属关系结构图**。
 * 愿景 → 使命 → 战略目标 → 项目 → 成功指标：五级 org-chart 连线（横轨 + 垂直落线），
 * 谁属于谁一眼可辨——不再只是「按层平铺」；任务明细切「树状」布局看。
 * 与树状布局消费同一棵 CurationTree（同源）；点击节点开只读抽屉。
 *
 * V3.9.33+（本次修复）：任务在金字塔上可拖拽——指标卡直接列出前 4 条任务（可拖）、
 * 未归档任务以列表呈现（可拖到任意指标卡上归位）；数据落盘沿用与方向台相同的
 * useTaskRelocationDnd 双写归属（task.metricId + metric.taskIds + updatedAt + 落盘回调）。
 * 仍守住「跨项目拒绝」红线。
 */
import { computed, reactive } from 'vue'
import type { CurationSel, CurationTree, CurationMetricNode } from '@/shared/utils/compassCurationModel'
import { useAppStore } from '@/newtab/stores/app'
import { useTaskRelocationDnd } from '@/newtab/views/useTaskRelocationDnd'
import type { TaskCard } from '@/shared/models'

const props = defineProps<{
  tree: CurationTree
  /** V3.9.34（需求拍板）：任务拖拽归位的落盘回调由宿主传入——本组件不直调 store 落盘，
   *  与「策展页零直写」红线（R189-4 重指口径）保持一致：所有写库只经 useTaskRelocationDnd。 */
  onTaskPersist: () => void
}>()

const emit = defineEmits<{ open: [sel: CurationSel] }>()

const allMetrics = computed(() =>
  props.tree.goals.flatMap(g => g.projects.flatMap(P => P.metrics)))
const allTasks = computed(() =>
  allMetrics.value.reduce((s, M) => s + M.totalCount, 0) + props.tree.orphans.length)

/* ===== 任务拖拽归位（与方向台同一套口径） ===== */
const appStore = useAppStore()
const dnd = reactive(useTaskRelocationDnd({ d: () => appStore.data!, persist: props.onTaskPersist }))

function onTaskDragStart(e: DragEvent, t: TaskCard) {
  e.stopPropagation()
  dnd.onTaskDragStart(e, t)
}
function onMetricDragOver(e: DragEvent, m: CurationMetricNode) {
  if (!dnd.dragTaskId) return
  e.preventDefault()
  e.stopPropagation()
  dnd.onLaneDragOver(e, m.metric.id)
}
function onMetricDragLeave(e: DragEvent, m: CurationMetricNode) {
  dnd.onLaneDragLeave(e, m.metric.id)
}
function onMetricDrop(e: DragEvent, m: CurationMetricNode) {
  e.preventDefault()
  e.stopPropagation()
  dnd.onLaneDrop(e, m.metric.id)
}
</script>

<template>
  <div class="cpl">
    <div class="tier">
      <div class="cv-card hero" role="button" tabindex="0" @click="emit('open', { kind: 'vision' })" @keydown.enter="emit('open', { kind: 'vision' })">
        <span class="k">愿景</span><p>{{ tree.vision || '尚未填写愿景' }}</p>
      </div>
    </div>
    <div class="vline" aria-hidden="true"></div>
    <div class="tier">
      <div class="cv-card hero" role="button" tabindex="0" @click="emit('open', { kind: 'mission' })" @keydown.enter="emit('open', { kind: 'mission' })">
        <span class="k">使命</span><p>{{ tree.mission || '尚未填写使命' }}</p>
      </div>
    </div>

    <!-- 隶属关系 org-chart：使命 → 战略目标 → 项目 → 成功指标，连线即归属 -->
    <div class="org" v-if="tree.goals.length">
      <ul class="org-lv">
        <li v-for="(g, gi) in tree.goals" :key="g.dir.id">
          <div class="cv-card node goal" role="button" tabindex="0"
            @click="emit('open', { kind: 'goal', goal: g })" @keydown.enter="emit('open', { kind: 'goal', goal: g })">
            <b>{{ gi + 1 }}. {{ g.dir.name || '未命名战略目标' }}</b>
            <small>{{ g.projects.length }} 项目 · {{ g.projects.reduce((s, P) => s + P.totalCount, 0) }} 任务</small>
          </div>
          <ul class="org-lv" v-if="g.projects.length">
            <li v-for="P in g.projects" :key="P.project.id">
              <div class="cv-card node proj" role="button" tabindex="0"
                @click="emit('open', { kind: 'project', node: P })" @keydown.enter="emit('open', { kind: 'project', node: P })">
                <div class="np"><b>{{ P.project.name || '未命名项目' }}</b><span v-if="P.project.isFocused" class="badge">主攻</span></div>
                <span class="bar"><span :style="{ width: P.progress + '%' }"></span></span>
                <small>{{ P.doneCount }}/{{ P.totalCount }} · {{ P.progress }}%<template v-if="P.stalled"> · ⚠停滞</template></small>
              </div>
              <ul class="org-lv" v-if="P.metrics.length">
                <li v-for="M in P.metrics" :key="M.metric.id">
                  <div class="cv-card node met" role="button" tabindex="0"
                    :class="{ 'drop-target': dnd.dropTip && dnd.dropTip.id === M.metric.id && dnd.dropTip.mode === 'in' }"
                    @click="emit('open', { kind: 'metric', node: M })" @keydown.enter="emit('open', { kind: 'metric', node: M })"
                    @dragover="onMetricDragOver($event, M)" @dragleave="onMetricDragLeave($event, M)" @drop="onMetricDrop($event, M)">
                    <b>{{ M.metric.title || '未命名指标' }}</b>
                    <small :class="{ warn: !M.totalCount }">{{ M.totalCount ? M.doneCount + '/' + M.totalCount + ' · ' + M.progress + '%' : '⚠ 缺任务' }}</small>
                    <small v-if="M.metric.target" class="target" :title="M.metric.target">{{ M.metric.target }}</small>
                    <!-- 挂载的任务列表（可拖拽改归属） -->
                    <template v-if="M.tasks.length">
                      <div class="met-tasks" @click.stop>
                        <div v-for="(tn, ti) in M.tasks.slice(0, 4)" :key="tn.task.id" class="met-task-item" draggable="true"
                          :class="{ dragging: dnd.dragTaskId === tn.task.id }"
                          @dragstart="onTaskDragStart($event, tn.task)" @dragend="dnd.onDragEnd()"
                          @click.stop="emit('open', { kind: 'task', node: tn })" :title="tn.task.title">
                          {{ ti + 1 }}. {{ tn.task.title }}
                        </div>
                        <div v-if="M.tasks.length > 4" class="met-more" @click.stop="emit('open', { kind: 'metric', node: M })">+{{ M.tasks.length - 4 }} 更多</div>
                      </div>
                    </template>
                  </div>
                </li>
              </ul>
            </li>
          </ul>
        </li>
      </ul>
    </div>

    <!-- 未归档任务区：明细罗列 + 可拖入上方任意指标卡归位 -->
    <div v-if="tree.orphans.length" class="tier">
      <div class="orph-drop-zone">
        <div class="orph-title" role="button" tabindex="0" @click="emit('open', { kind: 'orphans' })" @keydown.enter="emit('open', { kind: 'orphans' })">
          散叶 · 未归档任务 <span class="count">{{ tree.orphans.length }} 件 · 拖到上方指标卡即归位</span>
        </div>
        <div class="orph-tasks" role="list">
          <div v-for="(tn, ti) in tree.orphans" :key="tn.task.id" class="orph-task-item" draggable="true"
            role="listitem" :class="{ dragging: dnd.dragTaskId === tn.task.id }"
            @dragstart="onTaskDragStart($event, tn.task)" @dragend="dnd.onDragEnd()"
            @click="emit('open', { kind: 'task', node: tn })" :title="tn.task.title">
            {{ ti + 1 }}. {{ tn.task.title }}
          </div>
        </div>
      </div>
    </div>
    <p class="cap">连线即隶属：战略目标 → 项目 → 成功指标 · 任务 ×{{ allTasks }}（明细切「树状」）· 横向滚动查看全局 · 点击节点看只读详情</p>
  </div>
</template>

<style scoped>
.cpl { max-width: 100%; padding: 4px 0 40px; overflow-x: auto; overflow-y: hidden; }
.tier { display: flex; justify-content: center; margin: 0 0 6px; }
.cv-card { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-md, 10px); padding: 8px 12px; cursor: pointer; transition: border-color var(--dur-fast, 120ms), background var(--dur-fast, 120ms); white-space: normal; word-wrap: break-word; overflow-wrap: anywhere; }
.cv-card:hover { border-color: var(--accent); background: var(--surface-2); }
.cv-card:focus-visible { outline: 2px solid var(--accent); outline-offset: 1px; }
.hero { max-width: 460px; width: 100%; text-align: center; border-color: var(--border-strong); }
.hero .k { display: inline-block; font-size: var(--fs-caption); font-weight: 700; color: var(--accent-ink); letter-spacing: .1em; margin-bottom: 3px; }
.hero p { margin: 0; font-size: var(--fs-title); font-weight: 700; color: var(--text); overflow-wrap: anywhere; }
.vline { width: 1px; height: 26px; margin: 0 auto; background: var(--border-strong); }

/* ── org-chart 连线（经典 CSS 树）：横轨 + 垂直落线 + 父级中缝引用线 ── */
.org { padding: 0 12px; }
ul.org-lv { display: flex; justify-content: center; list-style: none; margin: 0; padding: 26px 0 0; position: relative; }
ul.org-lv::before { content: ''; position: absolute; top: 0; left: 50%; width: 0; height: 26px; border-left: 1px solid var(--border-strong); }
.org-lv li { display: flex; flex-direction: column; align-items: center; position: relative; padding: 26px 12px 0; }
.org-lv li::before, .org-lv li::after { content: ''; position: absolute; top: 0; right: 50%; width: 50%; height: 26px; border-top: 1px solid var(--border-strong); }
.org-lv li::after { right: auto; left: 50%; border-left: 1px solid var(--border-strong); }
.org-lv li:first-child::before { border-top: 0; }
.org-lv li:last-child::after { border-top: 0; }
.org-lv li:last-child::before { border-right: 1px solid var(--border-strong); border-radius: 0 8px 0 0; }
.org-lv li:first-child::after { border-radius: 8px 0 0 0; }
.org-lv li:only-child { padding-top: 26px; }
.org-lv li:only-child::before { display: none; }
.org-lv li:only-child::after { width: 0; border-top: 0; }

.node { display: flex; flex-direction: column; gap: 3px; min-width: 168px; max-width: 250px; }
.node.goal { border-left: 3px solid var(--accent); min-width: 200px; }
.node.goal b, .node.proj b, .node.met b { color: var(--text); font-size: var(--fs-body); overflow-wrap: anywhere; word-break: break-word; }
.node.proj .np { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.badge { flex: none; font-size: 10px; font-weight: 700; color: var(--accent-ink); border: 1px solid var(--accent); border-radius: 999px; padding: 0 7px; }
.node small { color: var(--text-3); font-size: var(--fs-caption); }
.node small.warn { color: var(--warning); }
.node .target { max-width: 220px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.node .bar { display: block; height: 3px; border-radius: 999px; background: var(--surface-3); overflow: hidden; }
.node .bar span { display: block; height: 100%; background: var(--accent); }
.orph { display: inline-flex; align-items: center; gap: 10px; border-style: dashed; }
.orph b { color: var(--text); font-size: var(--fs-body); }
.orph small { color: var(--text-3); font-size: var(--fs-caption); }
.cap { text-align: center; color: var(--text-4); font-size: var(--fs-caption); margin: 22px 0 0; }

/* ===== 成功指标下的任务列表与未归档任务拖拽区 ===== */
.met-tasks { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 3px; margin-top: 4px; }
.met-task-item, .orph-task-item { 
  font-size: var(--fs-caption); color: var(--text-3); 
  padding: 3px 5px; background: var(--surface-3); border-radius: 4px; 
  cursor: grab; overflow-wrap: break-word; word-break: break-word;
}
.met-task-item:hover, .orph-task-item:hover { background: var(--surface-4); }
.met-more { grid-column: 1 / -1; text-align: center; color: var(--text-3); font-size: var(--fs-micro); }

.orph-drop-zone { max-width: 800px; padding: 8px 12px; background: var(--surface-2); border-radius: var(--radius-sm); }
.orph-title { font-size: var(--fs-body); color: var(--text); font-weight: 600; margin-bottom: 6px; display: flex; align-items: center; gap: 6px; }
.orph-title .count { font-size: var(--fs-caption); color: var(--text-3); font-weight: normal; }
.orph-tasks { display: flex; gap: 6px; flex-wrap: wrap; }

/* 拖拽反馈：落点高亮 + 拖拽源半透明 */
.node.met.drop-target { border-color: var(--accent); background: var(--accent-light); box-shadow: 0 0 0 2px var(--accent-glow); }
.met-task-item.dragging, .orph-task-item.dragging { opacity: .4; }
.orph-task-item { max-width: 240px; }
</style>
