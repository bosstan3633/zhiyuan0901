<script setup lang="ts">
/**
 * W11 · 攻坚项目舱（第 4 层）。
 *
 * 存在的理由：原型要解决的第一件事是**项目之间的区隔要明细**。
 * 旧版三列并排（.tree-columns-grid），项目之间只靠列边界，扫视时容易串行，
 * 归属靠"在哪一列"推断。这里改成纵向舱列：每舱独占容器 + 左侧 4px 色条 + 舱间大间距。
 *
 * 舱内是**归属轨道**（判据 W11-2）：项目色条 → 竖轨 → 各指标卡 → 各任务分叉，
 * 全程用线连起来，让"任务属于这个项目的这个指标"成为视觉事实。
 */
import { computed } from 'vue'
import CompassLane from './CompassLane.vue'
import type { Direction, Project, TaskCard } from '@/shared/models'
import type { ProjectMeta } from '../../views/compassMeta'

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
  (e: 'editProject'): void
  (e: 'aiMetric', projId: string): void
  (e: 'openPano', projId: string): void
  (e: 'bindOrphan', taskId: string, projId: string): void
  /* ★R54-5 / R91-5 能力保留：进项目详情**页**（不是抽屉）—— 详情页有面包屑/头部加任务/⋯ 菜单，
     抽屉装不下。改写菜单结构时曾一度换成 openPano（抽屉），那是能力降级，判据 R91-5 会红。 */
  (e: 'gotoDetail', projId: string): void
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
}>()

/** 断链模式下，没缺口的指标/项目一律隐藏 */
const shownMetrics = computed(() =>
  props.riskOnly ? props.meta.metrics.filter(m => m.orphanMetric || m.tasks.some(t => hasClue(t))) : props.meta.metrics
)
const shownOrphans = computed(() => props.meta.orphanTasks)
const hideWhole = computed(() => props.riskOnly && shownMetrics.value.length === 0 && shownOrphans.value.length === 0)

/**
 * 任务是否带「支撑任务（线索未开）」标记。
 * ★这个字段不在 TaskCard 模型里——它是 W11 新加的软提示，按可选扩展读。
 * 不为了一个提示去改 shared/models（会波及全库类型与「导入兼容」门禁）。
 */
function hasClue(t: TaskCard): boolean {
  return !!(t as TaskCard & { w?: string }).w
}

const ringR = 18
const ringC = 2 * Math.PI * ringR
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
    <header class="tw-head" @click="emit('openPano', proj.id)">
      <span class="tw-idx">{{ idx }}</span>
      <div class="tw-id">
        <h3 class="tw-name">
          <span class="tw-name-t editable" @click.stop="emit('editProject')">{{ proj.name }}</span>
          <span v-if="proj.isFocused" class="tw-badge focus" title="主攻项目">🚀 主攻</span>
          <span v-if="proj.pinned" class="tw-badge" title="已置顶">📌 置顶</span>
          <span v-if="meta.stall" class="tw-badge stall" title="近 14 天无推进/完成活动">⚠ 停滞</span>
          <span v-if="meta.risk > 0" class="tw-badge risk">{{ meta.risk }} 处断链</span>
        </h3>
        <!-- 归属面包屑：点任一段可跳回该层 -->
        <nav class="tw-crumb">
          <span class="tw-cr" @click.stop="emit('openPano', proj.id)">战略目标 · {{ dir.name }}</span>
          <span class="tw-cr-sep">›</span>
          <span class="tw-cr on">攻坚项目 · {{ proj.name }}</span>
          <span class="tw-cr-sep">›</span>
          <span class="tw-cr">{{ meta.metrics.length }} 指标 · {{ meta.total }} 任务</span>
        </nav>
      </div>

      <div class="tw-right" @click.stop>
        <div class="tw-ring" :title="`项目级完成度 ${meta.pct}%（跨全部指标聚合）`">
          <svg viewBox="0 0 42 42" width="42" height="42" aria-hidden="true">
            <circle cx="21" cy="21" :r="ringR" fill="none" stroke="var(--surface-3)" stroke-width="3" />
            <circle
              cx="21" cy="21" :r="ringR" fill="none"
              stroke="var(--hue)" stroke-width="3" stroke-linecap="round"
              :stroke-dasharray="ringC" :stroke-dashoffset="ringC * (1 - meta.pct / 100)"
            />
          </svg>
          <span class="tw-ring-v">{{ meta.pct }}%</span>
        </div>
        <div class="tw-num">
          <b>{{ meta.done }} / {{ meta.total }}</b>
          任务完成
        </div>
        <div class="tw-acts" @click.stop>
          <!-- ★拖拽手柄：只在同一战略目标内排序，跨目标不接受（改归属是另一件事，走项目详情） -->
          <span
            class="tw-grip"
            draggable="true"
            title="拖拽排序（仅同一战略目标内；主攻恒在前排）"
            @dragstart="emit('dragstart', dir.id, proj.id, $event)"
            @dragover.prevent="emit('dragover', dir.id, proj.id)"
            @dragleave="emit('dragleave', proj.id)"
            @drop.prevent="emit('drop', dir.id, proj.id)"
            @dragend="emit('dragleave', proj.id)"
          >⠿</span>
          <button class="tw-act" title="AI 依使命与本项目建议成功指标（查重后采纳才创建）" @click="emit('aiMetric', proj.id)">✦</button>
          <button class="tw-act" title="在本项目下添加成功指标" @click="emit('addMetric', proj.id)">＋指标</button>
          <button class="tw-act" :class="{ on: proj.pinned }" :title="proj.pinned ? '取消置顶' : '置顶到本目标前排'" @click="emit('pin', dir.id, proj.id)">📌</button>
          <button class="tw-act" :class="{ on: menuOn }" title="更多操作（设主攻 / 进详情 / 删除）" @click="emit('menu', proj.id)">▾</button>
          <!-- ★折叠必须双向：开与合都能点到（判据 W11-3） -->
          <button class="tw-fold" :aria-expanded="open" :title="open ? '收起本项目' : '展开本项目'" @click="emit('fold', proj.id)">
            {{ open ? '▾' : '▸' }}
          </button>
          <div v-if="menuOn" class="tw-menu" @click.stop>
            <button class="twm-item" @click="emit('menu', proj.id); emit('focus', proj.id)">
              {{ proj.isFocused ? '☆ 取消主攻' : '🚀 设为主攻' }}
            </button>
            <button class="twm-item" @click="emit('menu', proj.id); emit('pin', dir.id, proj.id)">
              {{ proj.pinned ? '☆ 取消置顶' : '📌 置顶到本目标前排' }}
            </button>
            <button class="twm-item" @click="emit('menu', proj.id); emit('addMetric', proj.id)">＋ 添加成功指标</button>
            <button class="twm-item" @click="emit('menu', proj.id); emit('gotoDetail', proj.id)">📄 进入项目详情页</button>
            <button class="twm-item danger" @click="emit('menu', proj.id); emit('del', proj.id)">🗑 删除项目</button>
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
        />
      </div>

      <!-- 无归属收容区：在舱内但没挂任何成功指标的任务 -->
      <div v-if="shownOrphans.length" class="tw-orphans">
        <span class="to-i">⚠</span>
        <span class="to-t">
          <b>{{ shownOrphans.length }} 条无归属任务</b> —— 在本舱内但未挂任何成功指标
        </span>
        <ul class="to-list">
          <li v-for="t in shownOrphans" :key="t.id" class="to-item">
            <span class="toi-t">{{ t.title }}</span>
            <button class="toi-bind" title="为它选一个成功指标" @click="emit('bindOrphan', t.id, proj.id)">＋ 挂指标</button>
          </li>
        </ul>
      </div>

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
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow);
  position: relative;
  overflow: hidden;
}
/* 左侧 4px 项目色条：舱身份的唯一标识 */
.tower::before {
  content: ''; position: absolute; left: 0; top: 0; bottom: 0;
  width: 4px; background: var(--hue);
}

.tw-head {
  display: flex; align-items: center; gap: 14px; flex-wrap: wrap;
  padding: 18px 22px 16px 24px;
  cursor: pointer; transition: background var(--dur);
}
.tw-head:hover { background: color-mix(in srgb, var(--hue) 6%, transparent); }
/* ★序号牌 34px：原型 .tw-idx 是舱的"身份印章"，22px 时与 12px 指标序号同量级、层级拉不开 */
.tw-idx {
  width: 34px; height: 34px; border-radius: 11px; flex: none;
  background: color-mix(in srgb, var(--hue) 22%, transparent);
  color: var(--text); font-size: var(--fs-sub); font-weight: 700;
  display: flex; align-items: center; justify-content: center;
}
.tw-id { flex: 1; min-width: 200px; }
.tw-name { display: flex; align-items: baseline; gap: 8px; flex-wrap: wrap; }
/* ★项目名 --fs-title(15px)：与指标 --fs-sub(12px) 拉开一档，不许抢焦点（愿景才是 display） */
.tw-name-t { font-size: var(--fs-title); font-weight: 700; color: var(--text); letter-spacing: -.01em; }
.tw-name-t.editable:hover { text-decoration: underline; text-decoration-style: dotted; }
.tw-badge {
  font-size: var(--fs-micro); color: var(--text-3);
  background: var(--surface-3); padding: 1px 7px; border-radius: 999px; white-space: nowrap;
}
.tw-badge.focus { color: var(--accent-ink); background: var(--accent-light); font-weight: 600; }
.tw-badge.stall { color: var(--warning); background: var(--warning-bg-soft); }
.tw-badge.risk { color: var(--danger); background: var(--danger-bg-soft); font-weight: 600; }

/* 归属面包屑 */
.tw-crumb { display: flex; align-items: center; gap: 6px; margin-top: 5px; flex-wrap: wrap; }
.tw-cr { font-size: var(--fs-micro); color: var(--text-4); cursor: pointer; transition: color var(--dur); }
.tw-cr:hover { color: var(--accent-ink); }
.tw-cr.on { color: var(--text-3); cursor: default; }
.tw-cr.on:hover { color: var(--text-3); }
.tw-cr-sep { font-size: var(--fs-micro); color: var(--text-4); opacity: .6; }

/* ★右侧区固定一块不换行：窄舱时按钮挤成两行是最刺眼的失真，flex-wrap 的容器里给 nowrap + min-width:0 */
.tw-right { display: flex; align-items: center; gap: 14px; flex: none; }
/* 原型 .ring 42px + 环上数字；24px 时光环细到看不出进度 */
.tw-ring { position: relative; width: 42px; height: 42px; flex: none; }
.tw-ring svg { transform: rotate(-90deg); }
.tw-ring-v {
  position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
  font-size: var(--fs-micro); font-weight: 700; color: var(--text-2);
}
/* ★原型 .tw-num 是两行块：完成数一行（--fs-sub）、"任务完成"一行（--fs-micro）。
   之前挤成一行 "0 / 5 任务完成"，与舱头 15px 标题同排就糊了。 */
.tw-num { font-size: var(--fs-micro); color: var(--text-3); line-height: 1.5; white-space: nowrap; }
.tw-num b { display: block; font-size: var(--fs-sub); color: var(--text-2); font-variant-numeric: tabular-nums; }
.tw-acts { display: flex; align-items: center; gap: 6px; position: relative; }
.tower.is-dragging { opacity: .5; }
/* ★落位指示用 inset box-shadow，绝不挤动版面（R3-B2 明令） */
.tower.drop-on { box-shadow: inset 0 3px 0 0 var(--hue); }
.tw-grip {
  font-size: var(--fs-sub); color: var(--text-4); cursor: grab;
  padding: 2px 4px; border-radius: 5px; line-height: 1; user-select: none;
}
.tw-grip:hover { color: var(--text-2); background: var(--surface-2); }
.tw-grip:active { cursor: grabbing; }
.tw-act.on { color: var(--accent-ink); background: var(--accent-light); }
/* ▾ 折叠菜单：设主攻 / 置顶 / 加指标 / 进详情 / 删除（删除仍走报数+确认+撤销，防呆不降级） */
.tw-menu {
  position: absolute; top: 100%; right: 0; z-index: 30; margin-top: 4px;
  min-width: 190px; background: var(--surface); border: 1px solid var(--border-strong);
  border-radius: var(--radius-sm); box-shadow: var(--shadow-lg); overflow: hidden;
}
.twm-item {
  display: block; width: 100%; text-align: left;
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
  padding: 3px 7px; border-radius: 6px; cursor: pointer; transition: all var(--dur); white-space: nowrap;
  /* ★W12(V3.8.12)真缺陷（theme-audit 100 图实跑抓到）：这条只给了 color/padding，
     没给 background 与 border ⇒ 浏览器默认 buttonface 白底透出来，在 linear/raycast
     深色主题下就是一排白块，文字被白底吃掉看着像"按钮坏了"（notion 下则是白底带框）。
     hover 时才设 background，所以静止态与 hover 态底色不一致，看着更怪。
     修法：显式给 transparent 底 + 透明边框，把 hover 态的 accent 底留给 hover。 */
  background: transparent; border: 1px solid transparent;
}
.tw-act:hover { color: var(--accent-ink); background: var(--accent-light); border-color: transparent; }
/* ★折叠必须双向：这里给的是"当前收起时显示展开箭头"，展开时显示收起箭头 */
.tw-fold {
  width: 20px; height: 20px; border-radius: 6px; flex: none;
  background: var(--surface-2); color: var(--text-3);
  font-size: 9px; display: flex; align-items: center; justify-content: center;
  cursor: pointer; transition: all var(--dur);
}
.tw-fold:hover { color: var(--text); background: var(--surface-3); }

/* ── 舱身：内边距与轨道缩进对齐原型 .tw-b / .mgrid ── */
.tw-body { padding: 2px 22px 22px 24px; }
.tw-rail { position: relative; padding-left: 22px; }
/* ★归属竖轨：从舱色条分下来的一条线，串起本舱所有指标 */
.tw-rail::before {
  content: ''; position: absolute; left: 7px; top: -10px; bottom: 20px;
  width: 2px; border-radius: 2px;
  background: linear-gradient(180deg, var(--hue), color-mix(in srgb, var(--hue) 22%, transparent));
}
.tw-rail > :deep(section) { margin-bottom: 12px; }
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

/* ── 无归属收容区 ── */
.tw-orphans {
  margin-top: 12px; margin-left: 22px;
  padding: 10px 13px; border-radius: 8px;
  border: 1px dashed var(--danger-border); background: var(--danger-bg-soft);
}
.to-i { font-size: var(--fs-micro); color: var(--danger); margin-right: 5px; }
.to-t { font-size: var(--fs-micro); color: var(--text-2); }
.to-t b { color: var(--danger); }
.to-list { list-style: none; margin: 7px 0 0; display: flex; flex-direction: column; gap: 5px; }
.to-item {
  display: flex; align-items: center; gap: 9px;
  background: var(--surface); border-radius: 6px; padding: 4px 9px;
}
.toi-t { font-size: var(--fs-micro); color: var(--text-2); flex: 1; min-width: 0; line-height: 1.5; }
.toi-bind {
  font-size: var(--fs-micro); font-weight: 600; color: var(--accent-ink);
  background: var(--accent-light); padding: 2px 8px; border-radius: 999px; cursor: pointer; flex: none;
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
  background: var(--accent-light); padding: 3px 10px; border-radius: 999px; cursor: pointer;
}
</style>