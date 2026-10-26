<script setup lang="ts">
/**
 * W11 · 攻坚项目舱（第 4 层）。
 *
 * 项目舱：左侧 4px 色条 + 舱内归属轨道（项目 → 指标 → 任务），让归属成为视觉事实。
 */
import Icon from '@/shared/components/Icon.vue'
import './hotzone.css'
import { computed } from 'vue'
import CompassLane from './CompassLane.vue'
import CompassTowerNext from './CompassTowerNext.vue'
import CompassTowerOrphans from './CompassTowerOrphans.vue'
import CompassTowerStatus from './CompassTowerStatus.vue'
import type { Direction, Project, TaskCard } from '@/shared/models'
import type { ProjectMeta } from '../../views/compassMeta'
import type { ProjectDiagnosis } from '@/shared/ai/projectDiagnose'

const props = defineProps<{
  dir: Direction
  proj: Project
  meta: ProjectMeta
  /** 舱序号（第几个项目舱） */
  idx: number
  /** 舱色：六档派生之一 */
  hue: string
  open: boolean
  /** 展开的指标 id 集合 */
  openMetrics: Set<string>
  /** 断链模式下只留有缺口的部分 */
  riskOnly: boolean
  /** 正在被拖拽 */
  dragging?: boolean
  /** 本舱是当前落位目标 */
  dropOn?: boolean
  /** 更多菜单是否展开 */
  menuOn?: boolean
  /** 当前处于就地改名态的字段键（'metric-<id>'），由父组件单一真源驱动 */
  editingField?: string | null
  /** N2：本项目的 AI 诊断报告（会话缓存里的一份；null=还没生成过） */
  diag?: ProjectDiagnosis | null
  /** N2：报告指纹与当前数据重算的指纹不一致 → 标签进过期态（宿主算好，这里只显示） */
  diagStale?: boolean
}>()

const emit = defineEmits<{
  (e: 'fold', projId: string): void
  (e: 'toggleMetric', metricId: string): void
  (e: 'toggleTask', taskId: string): void
  (e: 'taskGrade', taskId: string): void
  /** ★W12-C 透传：任务标题单击开任务详情抽屉（此前项目塔同样无任何 emit 通到 detailRef.open） */
  (e: 'openDetail', taskId: string): void
  (e: 'addTask', metricId: string): void
  (e: 'addMetric', projId: string): void
  /** ★R141 透传：解绑（不删本体） */
  (e: 'unbind', taskId: string): void
  /** ★R135-4 透传：指标层 AI 拆解任务 */
  (e: 'aiTask', metricId: string): void
  /** 指标名就地改名三件套 */
  (e: 'editTitle', metricId: string, ev: MouseEvent | undefined): void
  (e: 'saveTitle', metricId: string, ev: FocusEvent | KeyboardEvent): void
  (e: 'cancelTitle', metricId: string): void
  (e: 'openMetric', metricId: string): void
  (e: 'editProject'): void
  (e: 'aiMetric', projId: string): void
  (e: 'openPano', projId: string): void
  (e: 'bindOrphan', taskId: string, projId: string): void
  /* ★W12-E gotoDetail 随舱内「📄 进入项目详情页」一并退役（用户 2026-10-13 拍板 C1「只删入口」）。
     emit 声明不留——没人 emit 的死通道等于骗人说这条路还通。/compass/projects 整页仍在，
     只是方向台不再把它当入口，⌘K 项目搜索等其它消费方未动。历史留档：
     R54-5/R91-5 当年要求「进项目详情是页不是抽屉」，那是**形态**约束；
     本轮退役的是**入口**不是形态——真要进详情页，⌘K 与深链仍可达。 */
  /* ★拖拽排序四件套：R3-B2 定案的"同目标内所见即所得"。重排后必须补回模板挂载点，
     否则函数成了死代码——能力等于丢了（判据 R3-B2 会红，不是判据的问题）。 */
  (e: 'dragstart', dirId: string, projId: string, ev: DragEvent): void
  (e: 'dragover', dirId: string, projId: string): void
  (e: 'dragleave', projId: string): void
  (e: 'drop', dirId: string, projId: string): void
  (e: 'pin', dirId: string, projId: string): void
  (e: 'menu', projId: string): void
  (e: 'focus', projId: string): void
  (e: 'del', projId: string): void
  /** ★F2：项目层模板导入（# 成功指标 / ## 任务 下移一级解析），弹窗在宿主 CompassTree */
  (e: 'importTemplate', projId: string): void
  /** ★F1：删除成功指标（走真源 removeMetricWithConfirm；本组件只透传，不实现删除） */
  (e: 'delMetric', metricId: string): void
  /** N2：还没报告 → 跑诊断（走 AI 抽屉，手动触发红线）；已有报告 → 打开中央弹窗 */
  (e: 'diagRun', projId: string): void
  (e: 'diagReport', projId: string): void
}>()

/** ★F5：整块舱头可拖（替代原独立 ⠿ 手柄）。舱头内的按钮/就地改名区不许起拖——
 *  按住它们是想点按或改名，不是拖排序（在 dragstart 里按目标拦截，比给每个子元素
 *  加 draggable=false 更省事且不漏）。 */
function onHeadDragStart(dirId: string, projId: string, ev: DragEvent) {
  const el = ev.target as HTMLElement | null
  if (el?.closest('button, [contenteditable="true"], input, .tw-menu')) { ev.preventDefault(); return }
  emit('dragstart', dirId, projId, ev)
}

/** 断链模式下，没缺口的指标/项目一律隐藏 */
const shownMetrics = computed(() =>
  props.riskOnly ? props.meta.metrics.filter(m => m.orphanMetric || m.tasks.some(t => hasClue(t))) : props.meta.metrics
)
const shownOrphans = computed(() => props.meta.orphanTasks)
/* N2 诊断标签组已拆进 CompassDiagBadge.vue，守住单组件 400 行上限。 */
const hideWhole = computed(() => props.riskOnly && shownMetrics.value.length === 0 && shownOrphans.value.length === 0)

/**
 * 任务是否带「支撑任务（线索未开）」标记。
 * ★这个字段不在 TaskCard 模型里——它是 W11 新加的软提示，按可选扩展读。
 * 不为了一个提示去改 shared/models（会波及全库类型与「导入兼容」门禁）。
 */
function hasClue(t: TaskCard): boolean {
  return !!(t as TaskCard & { w?: string }).w
}
</script>

<template>
  <!-- 断链模式下无缺口 ⇒ 整舱隐藏（判据：过滤必须收到舱级，否则会留一排空壳） -->
  <section
    v-if="!hideWhole"
    class="tower"
    :class="{ 'is-dragging': dragging, 'drop-on': dropOn }"
    :style="{ '--hue': hue }"
    :data-tower="proj.id"
  >
    <header
      class="tw-head"
      v-pressable
      draggable="true"
      title="拖动可排序（仅同一战略目标内）；点击展开/收起本项目内容"
      @click="emit('fold', proj.id)"
      @dragstart="onHeadDragStart(dir.id, proj.id, $event)"
      @dragover.prevent="emit('dragover', dir.id, proj.id)"
      @dragleave="emit('dragleave', proj.id)"
      @drop.prevent="emit('drop', dir.id, proj.id)"
      @dragend="emit('dragleave', proj.id)"
    >
      <span class="tw-idx">{{ idx }}</span>
      <div class="tw-id">
        <h3 class="tw-name">
          <span class="tw-name-t editable" v-pressable @click.stop="emit('editProject')">{{ proj.name }}</span>
          <span class="tw-signals">
            <span v-if="proj.isFocused" class="tw-badge focus" title="主攻项目"><Icon name="main-focus" :size="13"/> 主攻</span>
            <span v-if="proj.pinned" class="tw-badge" title="已置顶"><Icon name="pin" :size="13"/> 置顶</span>
            <span v-if="meta.stall" class="tw-badge stall" title="近 14 天无推进/完成活动"><Icon name="stall" :size="13"/> 停滞</span>
            <span v-if="meta.risk > 0" class="tw-badge risk">{{ meta.risk }} 处断链</span>
          </span>
        </h3>
        <!-- 归属面包屑：点任一段可跳回该层 -->
        <nav class="tw-crumb" aria-label="项目归属">
          <span class="tw-cr" v-pressable @click.stop="emit('openPano', proj.id)">战略目标 · {{ dir.name }}</span>
          <span class="tw-cr-sep">›</span>
          <span class="tw-cr on">攻坚项目 · {{ proj.name }}</span>
          <span class="tw-cr-sep">›</span>
          <span class="tw-cr">{{ meta.metrics.length }} 指标 · {{ meta.total }} 任务</span>
        </nav>
        <CompassTowerNext :step="meta.nextStep" :source="meta.nextStepSource" />
      </div>

      <div class="tw-right" data-a11y-container @click.stop>
        <!-- ★舱头只读侧整块外移：进度环 + 完成数 + N2 诊断标签组（W11-12 单组件 ≤400 行） -->
        <CompassTowerStatus
          :proj-id="proj.id"
          :hue="hue"
          :meta="meta"
          :diag="diag"
          :stale="diagStale"
          @diag-run="(id) => emit('diagRun', id)"
          @diag-report="(id) => emit('diagReport', id)"
        />
        <div class="tw-acts" data-a11y-container @click.stop>
          <!-- 舱头整块点击=展开/折叠后，「全景」落位为显式按钮（路由不丢，三处入口同走 openPano）。 -->
          <button class="tw-act tw-act-label" title="在本项目下添加成功指标" @click="emit('addMetric', proj.id)">＋指标</button>
          <button class="tw-act tw-act-label" title="横向泳道看这个项目的完整链路（指标 → 任务）" @click="emit('openPano', proj.id)">全景</button>
          <button class="tw-act menu" :class="{ on: menuOn }" title="更多操作（主攻 / 置顶 / AI 建议指标 / 导入模板 / 删除项目）" @click="emit('menu', proj.id)">⋯</button>
          <!-- ★折叠必须双向：开与合都能点到（判据 W11-3） -->
          <button class="tw-fold" :aria-expanded="open" :title="open ? '收起本项目' : '展开本项目'" @click="emit('fold', proj.id)">
          </button>
          <div v-if="menuOn" class="tw-menu" data-a11y-container @click.stop>
            <button class="twm-item" @click="emit('menu', proj.id); emit('focus', proj.id)">
              <Icon v-if="!proj.isFocused" name="main-focus" :size="13"/>{{ proj.isFocused ? '☆ 取消主攻' : '设为主攻' }}
            </button>
            <button class="twm-item" @click="emit('menu', proj.id); emit('pin', dir.id, proj.id)">
              <Icon v-if="!proj.pinned" name="pin" :size="13"/>{{ proj.pinned ? '☆ 取消置顶' : '置顶到本目标前排' }}
            </button>
            <button class="twm-item" @click="emit('menu', proj.id); emit('aiMetric', proj.id)"><Icon name="sparkle" :size="13"/> AI 建议指标</button>
            <button class="twm-item" @click="emit('menu', proj.id); emit('importTemplate', proj.id)"><Icon name="filetext" :size="13"/> 导入模板（指标与任务）</button>
            <!-- ★W12-E 退役带备案（用户 2026-10-13 拍板 C1「只删入口」）：舱头「全景」与项目塔
                 已能就地看全这个项目，这枚「进入项目详情页」随之退役；跨目标改归属一类动作
                 仍在项目塔的拖拽与骨架条里做（见文件头「改归属不跨目标」说明）。 -->
            <button class="twm-item danger" @click="emit('menu', proj.id); emit('del', proj.id)"><Icon name="trash" :size="13"/> 删除项目</button>
          </div>
        </div>
      </div>
    </header>

    <!-- 舱身：归属轨道从这里竖着分下去 -->
    <div v-show="open" class="tw-body">
      <!-- ★无内容容器：竖轨本体。别删——删了指标卡就失去"挂在项目下"的视觉证据（判据 W11-2） -->
      <div class="tw-rail">
        <CompassLane
          v-for="m in shownMetrics"
          :key="m.id"
          :m="m"
          :open="openMetrics.has(m.id)"
          :proj-name="proj.name"
          :dir-name="dir.name"
          :hue="hue"
          :editing="editingField === 'metric-' + m.id"
          @toggle="emit('toggleMetric', $event)"
          @task="emit('toggleTask', $event)"
          @grade="emit('taskGrade', $event)"
          @open-detail="emit('openDetail', $event)"
          @add-task="emit('addTask', $event)"
          @unbind="emit('unbind', $event)"
          @ai-task="emit('aiTask', $event)"
          @edit-title="(mid, ev) => emit('editTitle', mid, ev)"
          @save-title="(mid, ev) => emit('saveTitle', mid, ev)"
          @cancel-title="emit('cancelTitle', $event)"
          @open-metric="emit('openMetric', $event)"
          @del-metric="(mid) => emit('delMetric', mid)"
        />
      </div>

      <CompassTowerOrphans :tasks="shownOrphans" :proj-id="proj.id"
        @bind="(taskId) => emit('bindOrphan', taskId, proj.id)"
        @unbind="emit('unbind', $event)" />

      <div v-if="!shownMetrics.length && !shownOrphans.length" class="tw-empty">
        <span class="twe-t">暂无成功指标</span>
        <button class="twe-add" @click="emit('addMetric', proj.id)">＋ 添加第一条成功指标</button>
      </div>
    </div>
  </section>
</template>

<style scoped>
/* ── 舱体：区隔靠容器 + 色条 + 大间距，不靠列边界 ── */
/* 舱间大间距由 .tower-list 的 gap 承担（原型 --sp-8），这里不再叠一份 margin，
   否则两级间距相加成 80px，页面会被撑得比原型松散一倍 */
.tower {
  /* ★视觉聚焦（方向台优化）：舱体不再是一张"浮在画布上的卡"。
     原先 surface 底 + 边框，指标卡又是 surface-2、任务行再是 surface —— 三层容器叠加后读者先数框。
     改为无底色、只留发丝分隔线，区隔由左侧色条与舱间间距承担（判据 W11-1 的 gap 不变）。
     层级由色条、发丝线与间距承担；阴影只留给 hover/拖拽这类临时状态。 */
  background: transparent; border: 0; border-top: 1px solid var(--border);
  border-radius: var(--radius-lg); box-shadow: none;
  position: relative; overflow: hidden;
  transition: border-color var(--dur), box-shadow var(--dur);
}
.tower:hover { border-top-color: color-mix(in srgb, var(--hue) 30%, var(--border)); }
/* 左侧 4px 项目色条：舱身份的唯一标识 */
.tower::before {
  content: ''; position: absolute; left: 0; top: 0; bottom: 0;
  width: 4px; background: var(--hue);
}

.tw-head {
  display: flex; align-items: center; gap: 12px; flex-wrap: wrap;
  padding: 14px 20px 13px 22px;
  /* F5：整块舱头可拖；按钮/改名区在 dragstart 拦截。 */
  cursor: grab; transition: background var(--dur);
}
.tw-head:active { cursor: grabbing; }
.tw-head:hover { background: color-mix(in srgb, var(--hue) 6%, transparent); }
/* 序号牌：与指标序号拉开层级，但不与项目名争色。 */
.tw-idx {
  width: 30px; height: 30px; border-radius: 9px; flex: none;
  background: var(--surface-2);
  color: var(--text-3); font-size: var(--fs-sub); font-weight: 700;
  display: flex; align-items: center; justify-content: center;
}
.tw-id { flex: 1; min-width: 200px; }
.tw-name {
  display: flex; align-items: center; gap: 7px 10px; flex-wrap: wrap;
  margin: 0; line-height: 1.35;
}
/* ★项目名 --fs-title(15px)：与指标 --fs-sub(12px) 拉开一档，不许抢焦点（愿景才是 display） */
.tw-name-t { font-size: var(--fs-title); font-weight: 700; color: var(--text); letter-spacing: -.01em; }
.tw-name-t.editable:hover { text-decoration: underline; text-decoration-style: dotted; }
.tw-signals { display: inline-flex; align-items: center; gap: 5px; flex-wrap: wrap; }
.tw-badge {
  font-size: var(--fs-micro); color: var(--text-3);
  background: var(--surface-3); padding: 1px 7px; border-radius: var(--radius-full); white-space: nowrap;
}
.tw-badge.focus { color: var(--accent-ink); background: var(--accent-light); font-weight: 600; }
.tw-badge.stall { color: var(--warning); background: var(--warning-bg-soft); }
.tw-badge.risk { color: var(--danger); background: var(--danger-bg-soft); font-weight: 600; }

/* 归属面包屑 */
.tw-crumb { display: flex; align-items: center; gap: 5px; margin-top: 3px; flex-wrap: wrap; }
.tw-cr { font-size: var(--fs-tiny); color: var(--text-3); cursor: pointer; transition: color var(--dur); }
.tw-cr:hover { color: var(--accent-ink); }
.tw-cr.on { color: var(--text-3); cursor: default; }
.tw-cr.on:hover { color: var(--text-3); }
.tw-cr-sep { font-size: var(--fs-tiny); color: var(--text-4); opacity: .55; }
/* ★右侧区固定一块不换行：窄舱时按钮挤成两行是最刺眼的失真，flex-wrap 的容器里给 nowrap + min-width:0 */
.tw-right { display: flex; align-items: center; gap: 10px; flex: none; }
.tw-acts { display: flex; align-items: center; gap: 6px; position: relative; }
.tower.is-dragging { opacity: .5; }
/* ★落位指示用 inset box-shadow，绝不挤动版面（R3-B2 明令） */
.tower.drop-on { box-shadow: inset 0 3px 0 0 var(--hue); }
/* ★F5：原 .tw-grip 样式已随「⠿ 手柄退役、整块舱头可拖」一并删除——
   死 CSS 不删会被 dead-css-scan 判孤儿。 */
.tw-act.on { color: var(--accent-ink); background: var(--accent-light); }
/* ⋯ 菜单：主攻 / 置顶 / AI 建议指标 / 导入模板 / 删除（删除仍走报数+确认+撤销，防呆不降级） */
.tw-menu {
  position: absolute; top: 100%; right: 0; z-index: 30; margin-top: 4px;
  min-width: 190px; background: var(--surface); border: 1px solid var(--border-strong);
  border-radius: var(--radius-sm); box-shadow: var(--shadow-lg); overflow: hidden;
}
.twm-item {
  display: flex; align-items: center; gap: 6px; width: 100%; text-align: left;
  padding: 7px 11px; font-size: var(--fs-sub); color: var(--text-2);
  cursor: pointer; transition: background var(--dur);
  /* 同 .tw-act：button 默认白底必须显式压掉，否则深色主题下菜单项是一列白块 */
  background: transparent; border: none;
}
.twm-item:hover { background: var(--surface-2); color: var(--text); }
.twm-item.danger { color: var(--danger); border-top: 1px solid var(--border); }
.twm-item.danger:hover { background: var(--danger-bg-soft); }
.tw-act {
  font-size: var(--fs-micro); color: var(--text-3);
  min-height: 28px; padding: 3px 7px; border-radius: 6px; cursor: pointer; transition: all var(--dur); white-space: nowrap;
/* ★W12(V3.8.12)真缺陷（theme-audit 100 图实跑抓到）：这条只给了 color/padding，
   没给 background 与 border ⇒ 浏览器默认 buttonface 白底透出来，深色主题下就是一排白块。
   修法：显式给 transparent 底 + 透明边框，把 hover 态的 accent 底留给 hover。 */
  background: transparent; border: 1px solid transparent;
}
.tw-act:hover { color: var(--accent-ink); background: var(--accent-light); border-color: transparent; }
/* ★折叠必须双向：这里给的是"当前收起时显示展开箭头"，展开时显示收起箭头 */
.tw-fold {
  width: 28px; height: 28px; border-radius: 6px; flex: none;
  border: 1px solid transparent; background: transparent; color: var(--text-3);
  display: flex; align-items: center; justify-content: center;
  cursor: pointer; transition: background var(--dur), border-color var(--dur), color var(--dur);
}
.tw-fold::before {
  content: ''; width: 7px; height: 7px;
  border-right: 1.5px solid currentColor; border-bottom: 1.5px solid currentColor;
  transform: translateY(-2px) rotate(45deg); transition: transform var(--dur);
}
.tw-fold[aria-expanded="true"]::before { transform: translateY(-2px) rotate(225deg); }
.tw-fold:hover { color: var(--text); background: var(--surface-2); border-color: var(--border); }
.tw-fold:focus-visible { outline: 2px solid var(--accent); outline-offset: 1px; }

/* 窄屏：舱头从“左右两端对齐”切为上下两段，操作区换行但不压住项目名。
   ★V3.9.19（04-73 D-2 断点收敛）：480 档并入 800——项目名降一档/面包屑收紧/诊断标签
   允许换行三条窄屏细化升入本档；「＋指标」文字隐藏与轨道缩进细化（148 档专属）退役。 */
@media (max-width: 800px) {
  .tw-head { gap: 9px; padding: 12px 13px 11px 16px; }
  .tw-idx { width: 30px; height: 30px; }
  .tw-id { min-width: 0; }
  .tw-name-t { font-size: var(--fs-body); }
  .tw-crumb { gap: 4px; }
  .tw-right { width: 100%; justify-content: space-between; gap: 10px; flex-wrap: wrap; }
  .tw-right :deep(.tw-status) { flex-wrap: wrap; }
  .tw-acts { margin-left: auto; }
  .tw-body { padding: 2px 13px 14px 16px; }
}

/* ── 舱身：内边距与轨道缩进对齐原型 .tw-b / .mgrid ── */
.tw-body { padding: 1px 20px 16px 22px; }
.tw-rail { position: relative; padding-left: 20px; }
/* ★归属竖轨：从舱色条分下来的一条线，串起本舱所有指标 */
.tw-rail::before {
  content: ''; position: absolute; left: 7px; top: -10px; bottom: 20px;
  width: 2px; border-radius: 2px;
  background: linear-gradient(180deg, var(--hue), color-mix(in srgb, var(--hue) 22%, transparent));
}
/* ★V3.9.19（04-73 D-1(a) 密度接通）：指标卡之间的行距读 --card-gap（舒适 12 · 紧凑 8），
   原先 4px 字面量把密度档挡在舱外；轨/臂/铆钉的结构线全部不动。 */
.tw-rail > :deep(section) { margin-bottom: var(--card-gap); }
.tw-rail > :deep(section:last-child) { margin-bottom: 0; }
/* ★每张指标卡从竖轨分出一条横臂 —— 判据 W11-2 要求这条不许丢 */
.tw-rail > :deep(section)::before {
  content: ''; position: absolute; left: -15px; top: 24px;
  width: 15px; height: 2px; background: var(--hue); opacity: .55;
}
/* ★圆点：指标卡挂在轨上的"铆钉"（原型 .metric::after）。与横臂成对，缺一轨就只剩一条断头线 */
.tw-rail > :deep(section)::after {
  content: ''; position: absolute; left: 3px; top: 20px;
  width: 9px; height: 9px; border-radius: 50%;
  background: var(--surface); box-shadow: inset 0 0 0 2.5px var(--hue);
}

.tw-empty {
  margin-left: 22px; padding: 18px 12px; text-align: center;
  border: 1px dashed var(--border); border-radius: 8px;
  background: var(--surface-2); min-height: 76px;
  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px;
}
.twe-t { font-size: var(--fs-micro); color: var(--text-4); }
.twe-add {
  font-size: var(--fs-micro); font-weight: 600; color: var(--accent-ink);
  background: var(--accent-light); padding: 3px 10px; border-radius: var(--radius-full); cursor: pointer;
}
</style>
