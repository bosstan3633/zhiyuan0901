<script setup lang="ts">
/**
 * W11 · 全景泳道（一根泳道 = 一条成功指标）。
 *
 * 为什么要独立成组件（不是"顺手拆一下"）：
 *  单文件超 400 行本身就是信号 —— 说明它承担了两件事。全景视图真有两块独立职责：
 *  ①「选谁」= 项目选择条 + 项目头 + 层级带（导航层）
 *  ②「看什么」= 一根根泳道（内容层）
 * 拆开后两块各自的判据能分别钉住：选择条钉"常驻可点、换主体不回首"，
 *  泳道钉"空位可见 / 收容道在最后 / 任务出口齐全"，不会因为改了导航样式就把内容判据一起拖红。
 *
 * 焦点纪律：★不得出现 font-size: var(--fs-display) / var(--fs-hero)（判据 W11-11 负锚）。
 * 层级：指标名 --fs-sub(12px)、任务 --fs-body，与项目名 --fs-title(15px) 严格拉开。
 */
import Icon from '@/shared/components/Icon.vue'
import { ref } from 'vue'
import type { TaskCard } from '@/shared/models'
import type { MetricMeta } from '../../views/compassMeta'
import { gradeColorVar } from '../../views/compassMeta'

const props = defineProps<{
  m: MetricMeta
  /** 泳道序号（从 1 起） */
  idx: number
  /** 当前项目 id（加任务要带出） */
  projId: string
  /** 单指标时铺满画布，避免只占左侧一半并留下整片空画布。 */
  single?: boolean
  /** 多泳道时标题最多两行，避免长指标名把整条泳道头撑高。 */
  dense?: boolean
}>()

const emit = defineEmits<{
  (e: 'toggleTask', taskId: string): void
  (e: 'taskGrade', taskId: string): void
  /** ★W12-C 补接线 + ★W12-E 并入：全景泳道的任务标题单击开任务详情抽屉。
   *  这条此前**从未接上**——泳道里任务标题只是个 div，点了没反应（W11-10 断言本轮重指时暴露）。
   *  与项目塔的 CompassLane 走同一出口 openDetail → 宿主 openTaskDetail → detailRef.open()。 */
  (e: 'openDetail', taskId: string): void
  /** V3.9.22：方向台任务行只解绑，不删除任务本体。 */
  (e: 'unbindTask', taskId: string): void
  (e: 'addTask', metricId: string, projId: string): void
  /** 打开指标详情（与项目塔指标卡同一出口） */
  (e: 'openMetric', metricId: string): void
  /** ★F1：泳道头删除本指标（走真源 removeMetricWithConfirm，这里只上抛） */
  (e: 'delMetric', metricId: string): void
}>()

/** ★F1：泳道头「⋯」菜单（当前只有删除一项，与 CompassLane 同语言） */
const menuFor = ref<string | null>(null)
function toggleMenu(id: string) { menuFor.value = menuFor.value === id ? null : id }

/** V3.9.12：验收标准默认只占一行，需要时再展开——泳道里先读到的是指标与进度，
 *  不是每根泳道都铺两行说明。 */
const accOpen = ref(false)
/** 只在焦点离开整个操作区时收菜单：pointerdown 若先卸载菜单，会吃掉随后的 click。 */
const menuRoot = ref<HTMLElement | null>(null)
function onMenuFocusout(e: FocusEvent) {
  const next = e.relatedTarget as Node | null
  if (!next || !menuRoot.value?.contains(next)) menuFor.value = null
}

/** 状态点：○ 空 / ◐ 进行中 / ✓ 全完成（与 CompassLane 同口径） */
function dotOf(m: MetricMeta): { cls: string; g: string } {
  return m.dot === 'done' ? { cls: 'done', g: '' } : m.dot === 'doing' ? { cls: 'doing', g: '◐' } : { cls: '', g: '○' }
}

/** 任务是否带「支撑任务（线索未开）」软提示（不在 TaskCard 模型里，按可选扩展读） */
function hasClue(t: TaskCard): boolean {
  return !!(t as TaskCard & { w?: string }).w
}
function clueOf(t: TaskCard): string {
  return (t as TaskCard & { w?: string }).w || ''
}
function gradeOf(t: TaskCard): string {
  return (t as TaskCard & { grade?: string }).grade || 'C'
}
function statusOf(t: TaskCard): string {
  return t.status === 'done' ? 'done' : t.status === 'doing' ? 'doing' : ''
}
const PRI_LABEL: Record<string, string> = { high: '高', mid: '中', low: '低' }
function priOf(t: TaskCard): string {
  return PRI_LABEL[t.priority] || PRI_LABEL.mid
}
</script>

<template>
  <section class="lane" :class="{ single: single, dense: dense }" :data-metric="m.id">
    <header class="lane-h">
      <div class="lane-top">
        <span class="lane-i">{{ idx }}</span>
        <span class="lane-n" :title="m.title">{{ m.title }}</span>
        <span class="lane-dot" :class="dotOf(m).cls" :title="`完成 ${m.done}/${m.total}`">{{ dotOf(m).g }}</span>
        <button class="lane-detail" title="打开指标详情：验收标准 / 目标值 / 支撑任务" @click="emit('openMetric', m.id)">详情 ›</button>
        <!-- ★F1：hover 🗑 + 「⋯」—— 与项目塔指标卡同一套删除语义（真源报数确认 + 撤销） -->
        <span ref="menuRoot" class="lane-ops" data-a11y-container @click.stop @focusout="onMenuFocusout">
          <button class="lo-del" title="删除本成功指标（其下任务转为未关联，可撤销）" @click="emit('delMetric', m.id)"><Icon name="trash" :size="13"/></button>
          <button class="lo-more" :class="{ on: menuFor === m.id }" title="指标更多操作" @click="toggleMenu(m.id)">⋯</button>
          <span v-if="menuFor === m.id" class="lo-menu" data-a11y-container @click.stop>
            <button class="lom-item danger" @click="menuFor = null; emit('delMetric', m.id)"><Icon name="trash" :size="13"/> 删除本指标</button>
          </span>
        </span>
      </div>
      <div class="lane-acc" :class="{ open: accOpen }">
        <span class="lane-acc-k">验收</span>
        <b>{{ m.acceptance || '未写验收标准' }}</b>
        <button
          v-if="(m.acceptance || '').length > 28"
          class="lane-acc-toggle"
          :aria-expanded="accOpen"
          @click="accOpen = !accOpen"
        >{{ accOpen ? '收起' : '展开' }}</button>
      </div>
      <div class="lane-bar">
        <span class="track"><span class="fill" :style="{ width: m.pct + '%' }" /></span>
        <span class="v">{{ m.pct }}% · {{ m.done }}/{{ m.total }}</span>
      </div>
    </header>

    <div class="lane-b">
      <template v-if="m.tasks.length">
        <!-- ★W12-F（用户 2026-10-13 拍板 C2）：项目 → 成功指标 → 任务的从属用一条**贯穿连接轨**印在结构上。
             原状泳道里指标头与任务行是各自独立的块，"这条任务属于哪个指标"只能靠"它们在同一条泳道里"
             推断——层级是排列出来的，不是连出来的。现给任务区加一条左轨 + 每行一个分支点，
             让归属成为视觉事实（与项目塔 W11 已有的「归属轨道」同一套语言）。 -->
        <div class="lane-spine" aria-hidden="true"></div>
        <div v-for="t in m.tasks" :key="t.id" class="ltask" :class="statusOf(t)" :data-task="t.id">
          <span class="ltask-node" aria-hidden="true"></span>
          <button
            class="ltask-box" :class="statusOf(t)"
            :aria-pressed="t.status === 'done'"
            :title="t.status === 'done' ? '点一下取消完成' : '点一下勾选完成'"
            @click="emit('toggleTask', t.id)"
          />
          <div class="ltask-main">
            <button class="ltask-t" title="打开任务详情抽屉" @click="emit('openDetail', t.id)">{{ t.title }}</button>
            <div v-if="hasClue(t)" class="ltask-clue" :title="clueOf(t)">
              <Icon name="warn" :size="12"/> {{ clueOf(t) }}
            </div>
          </div>
          <div class="ltask-ops">
            <span class="lb lb-pri">{{ priOf(t) }}</span>
            <button class="lb lb-g" :style="{ color: gradeColorVar(gradeOf(t)) }" :title="`成熟度等级 ${gradeOf(t)} · 点击看详情`" @click="emit('taskGrade', t.id)">{{ gradeOf(t) }}</button>
            <button class="lb-unbind" title="解除指标关联，任务回任务池（真删除请进任务详情）" aria-label="解除任务关联" @click.stop="emit('unbindTask', t.id)"><Icon name="x" :size="12"/></button>
          </div>
        </div>
      </template>
      <!-- ★空泳道也占位：让"缺任务"在全景里同样可见（判据 W11-8 钉它不许消失） -->
      <div v-else class="lane-empty">
        <span class="le-i" aria-hidden="true"><Icon name="warn" :size="13"/></span>
        <span class="le-t">零任务</span>
        <span class="le-d">验收标准已定<br />动作还没落</span>
        <button class="le-add" @click="emit('addTask', m.id, projId)">＋ 建第一条任务</button>
      </div>
    </div>

    <footer class="lane-foot">
      <button class="lane-add" :title="`在「${m.title}」下添加任务`" @click="emit('addTask', m.id, projId)">＋ 添加任务</button>
    </footer>
  </section>
</template>

<style scoped>
/* ★视觉聚焦（与项目塔同一把尺子）：泳道是"分组"不是"卡"。
   原来泳道是 surface 底 + lg 圆角 + 全局阴影，头部分 surface-2、任务再 surface-2 ——
   四层容器叠在一屏里，读者先数框。现在只留一条边界线（横向并排需要它），
   层级由指标名、验收行、进度条和连接轨承担。 */
.lane {
  /* 基础宽度给旧版静态锚点；父容器 .lanes-* 会按轨道数覆盖它。 */
  flex: 1 1 0; min-width: 280px; flex-direction: column; display: flex;
  background: transparent;
  /* 圆角与板/舱/列表同族（判据 C4-1）：去的是底色与阴影，不是形状语言 */
  border-radius: var(--radius-lg);
  border: 1px solid var(--border);
  box-shadow: none; overflow: hidden; max-height: 64vh;
}
/* 单指标宽度同样由父级轨道规则承担；保留类名作为语义钩子。 */
.lane.single { max-width: none; }
.lane-h {
  position: relative; padding: 10px 11px 9px 13px;
  border-bottom: 1px solid var(--border); background: transparent; flex: none;
}
.lane-h::before {
  content: ''; position: absolute; left: 0; top: 12px; bottom: 11px;
  width: 2px; border-radius: 1px; background: var(--hue); opacity: .7;
}
.lane-top { display: flex; align-items: center; gap: 7px; margin-bottom: 7px; }
.lane-i {
  width: 17px; height: 17px; border-radius: 6px; display: grid; place-items: center;
  font-size: var(--fs-micro); font-weight: 700; flex: none;
  /* 序号是刻度不是印章：泳道身份由连接轨与进度条同色承担 */
  background: var(--surface-2); color: var(--text-3);
}
.lane-n {
  font-size: var(--fs-sub); font-weight: 700; line-height: 1.45;
  flex: 1; min-width: 0; color: var(--text);
  overflow-wrap: anywhere;
}
/* 多泳道时标题固定最多两行；完整文本留在 title，避免用省略号吞掉判断依据。 */
.lane.dense .lane-n {
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  overflow: hidden;
  min-height: calc(2 * 1.45em);
  max-height: calc(2 * 1.45em);
}
.lane-dot {
  width: 15px; height: 15px; border-radius: 999px; display: grid; place-items: center;
  font-size: 9px; flex: none; background: var(--surface-3); color: var(--text-4);
}
.lane-dot.doing { background: var(--warning-bg-soft); color: var(--warning); }
.lane-dot.done { background: var(--success-bg-soft); color: var(--success); }
.lane-detail {
  flex: none; min-height: 28px; border: 1px solid var(--border); background: var(--surface);
  color: var(--text-3); font-family: inherit; font-size: var(--fs-micro); font-weight: 600;
  padding: 2px 7px; border-radius: 6px; cursor: pointer; transition: all var(--dur);
}
.lane-detail:hover { color: var(--accent-ink); border-color: var(--accent); background: var(--accent-light); }
/* ★F1：泳道头删除入口 —— hover 显形（与项目塔指标卡同语言），「⋯」下拉同款 */
.lane-ops { position: relative; display: inline-flex; align-items: center; gap: 2px; flex: none; }
.lo-del, .lo-more {
  display: inline-grid; place-items: center; width: 28px; height: 28px; padding: 0;
  font-size: var(--fs-micro); color: var(--text-3); opacity: 0;
  border-radius: 5px; cursor: pointer; transition: all var(--dur);
  border: 1px solid transparent; background: transparent;
}
.lane:hover .lo-del, .lane:hover .lo-more,
.lo-del:focus-visible, .lo-more:focus-visible { opacity: 1; }
.lo-del:hover, .lo-more:hover { color: var(--danger); background: var(--danger-bg-soft); }
.lo-more.on { opacity: 1; color: var(--accent-ink); background: var(--accent-light); }
.lo-menu {
  position: absolute; right: 0; top: calc(100% + 4px); z-index: 30; min-width: 148px;
  background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-md);
  box-shadow: none; padding: 4px; display: flex; flex-direction: column;
}
.lom-item {
  font-size: var(--fs-micro); font-weight: 600; color: var(--text-2); text-align: left;
  padding: 6px 9px; border-radius: 5px; cursor: pointer; font-family: inherit; border: 0; background: transparent;
}
.lom-item:hover { background: var(--surface-3); }
.lom-item.danger { color: var(--danger); }
.lom-item.danger:hover { background: var(--danger-bg-soft); }
.lane-acc {
  display: flex; align-items: baseline; gap: 5px; min-width: 0;
  font-size: var(--fs-tiny); color: var(--text-3); line-height: 1.55; margin-top: 4px;
}
.lane-acc-k {
  flex: none; font-size: var(--fs-tiny); font-weight: 700; letter-spacing: .04em;
  color: var(--text-4);
}
.lane-acc b {
  min-width: 0; color: var(--text-3); font-weight: 500;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.lane-acc.open b { white-space: normal; overflow: visible; }
.lane-acc-toggle {
  flex: none; min-height: 28px; padding: 6px 4px; margin: -6px -4px;
  border: 0; background: transparent;
  color: var(--text-3); font-family: inherit; font-size: var(--fs-tiny); cursor: pointer;
}
.lane-acc-toggle:hover { color: var(--accent-ink); }
.lane-bar { display: flex; align-items: center; gap: 7px; margin-top: 7px; }
/* ★W12-F：任务区是连接轨的定位上下文 */
.lane-b { position: relative; }
.lane-bar .track { flex: 1; height: 4px; border-radius: 2px; background: var(--surface-3); overflow: hidden; }
.lane-bar .fill { display: block; height: 4px; border-radius: 2px; background: var(--hue); }
.lane-bar .v { font-size: var(--fs-micro); font-weight: 700; color: var(--text-2); flex: none; }

.lane-b { padding: 7px; display: flex; flex-direction: column; gap: 4px; overflow-y: auto; flex: 1; min-height: 70px; }
/* ★W12-F 贯穿连接轨：一条从指标头垂到最后一个任务行的竖轨 + 每行一个分支点。
   轨道颜色取泳道主色 --hue，与进度条、序号牌同源 ⇒ "这条泳道属于这个指标"三处同一色。 */
.lane-spine {
  position: absolute; left: 15px; top: 0; bottom: 12px; width: 2px;
  background: linear-gradient(180deg, color-mix(in srgb, var(--hue) 55%, transparent), color-mix(in srgb, var(--hue) 14%, transparent));
  border-radius: 1px; pointer-events: none;
}
.ltask-node {
  position: absolute; left: 10px; top: 14px; width: 12px; height: 2px;
  background: color-mix(in srgb, var(--hue) 60%, transparent); pointer-events: none;
}
.ltask-node::after {
  content: ''; position: absolute; right: -2px; top: -2.5px; width: 7px; height: 7px; border-radius: 50%;
  background: var(--surface); border: 1.6px solid color-mix(in srgb, var(--hue) 75%, transparent);
}
.ltask {
  position: relative; display: grid; grid-template-columns: 28px minmax(0, 1fr) auto; gap: 5px 6px;
  align-items: center; padding: 5px 6px 5px 28px; border-radius: 0;
  /* 任务行从"小卡"退成"行"：保留左侧状态色与连接轨分支点，去掉底色与外边距 */
  background: transparent; transition: all var(--dur); border-left: 2px solid var(--hue);
  border-bottom: 1px solid var(--border);
}
.ltask:hover { background: color-mix(in srgb, var(--surface) 60%, transparent); }
.ltask.done { border-left-color: var(--success); }
.ltask.doing { border-left-color: var(--warning); }
/* ★V3.9.17 任务账本：完成 / 标题与线索 / 优先级、成熟度、删除固定三列。
   标题和线索占同一可读列，操作固定在行尾，扫读不再在每一行里寻找按钮。 */
.ltask-main { min-width: 0; display: flex; flex-direction: column; align-items: flex-start; }
.ltask-t {
  width: 100%; font-size: var(--fs-body); font-weight: 500; line-height: 1.5; color: var(--text);
  background: none; border: 0; margin: 0; font-family: inherit; text-align: left; cursor: pointer;
  border-radius: var(--radius-sm); min-height: 28px; min-width: 0;
  overflow-wrap: anywhere;
}
.ltask-t:hover { color: var(--accent-ink); text-decoration: underline; text-underline-offset: 3px; }
.ltask-t:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.ltask.done .ltask-t { color: var(--text-3); text-decoration: line-through; text-decoration-color: var(--text-4); }
.ltask.doing .ltask-t { font-weight: 700; }
.ltask-clue {
  max-width: 100%; margin-top: -2px; color: var(--warning); font-size: var(--fs-tiny);
  line-height: 1.45; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.ltask-box {
  grid-column: 1; grid-row: 1; position: relative; width: 28px; height: 28px;
  cursor: pointer; background: transparent; border: 0; padding: 0;
}
.ltask-box::before {
  content: ''; position: absolute; inset: 7px; border-radius: 4px;
  box-shadow: inset 0 0 0 1.5px var(--border-strong); transition: all var(--dur);
}
.ltask-box:hover::before { box-shadow: inset 0 0 0 2px var(--hue); }
.ltask-box.doing::before { box-shadow: inset 0 0 0 2px var(--warning); }
.ltask-box.done::before { background: var(--success); box-shadow: none; }
.ltask-box.done::after {
  content: ''; position: absolute; left: 10px; top: 11px; width: 7px; height: 4px;
  border-left: 1.8px solid var(--surface); border-bottom: 1.8px solid var(--surface);
  transform: rotate(-45deg);
}
.ltask-ops { grid-column: 3; grid-row: 1; display: flex; align-items: center; gap: 3px; flex: none; }
.lb { font-size: var(--fs-tiny); font-weight: 600; padding: 0 5px; border-radius: 3px; white-space: nowrap; }
.lb-pri { color: var(--text-3); background: var(--surface-3); }
.lb-g {
  background: var(--surface-3); border: 0; font-family: inherit; letter-spacing: .04em;
  cursor: pointer; min-height: 28px; min-width: 28px; padding: 4px 6px;
}
/* V3.9.22: task rows only expose unbind; .lb-unbind above owns that action. */

/* ★空泳道：缺任务也占位，"缺"必须在全景里同样可见。
   ★视觉聚焦：从"虚线告警框"改为"带色轨的行动提示"——虚线圈+圆角+底色叠起来像一块出错的卡，
   而它要说的只有一句：标准已定、缺一条动作，右边就是入口。 */
.lane-empty {
  flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px;
  padding: 20px 14px; border-radius: 0;
  border: 0; border-left: 2px solid var(--warning-border); background: var(--warning-bg-soft);
  min-height: 96px; text-align: center;
}
.le-i {
  width: 24px; height: 24px; border-radius: 8px; background: var(--warning-bg-soft);
  color: var(--warning); display: grid; place-items: center; font-size: 12px;
}
.le-t { font-size: var(--fs-micro); font-weight: 700; color: var(--warning); }
.le-d { font-size: var(--fs-micro); color: var(--text-3); line-height: 1.6; }
.le-add {
  font-size: var(--fs-micro); font-weight: 600; color: var(--accent-ink);
  background: var(--accent-light); border: 0; font-family: inherit;
  min-height: 28px; padding: 4px 10px; border-radius: 999px; cursor: pointer;
}
.le-add:hover { filter: brightness(1.08); }

.lane-foot { padding: 9px 11px; border-top: 1px solid var(--border); flex: none; background: transparent; }
.lane-add {
  display: flex; align-items: center; gap: 6px; width: 100%;
  min-height: 28px;
  font-size: var(--fs-micro); color: var(--text-2); cursor: pointer;
  padding: 5px 7px; border: 0; background: transparent; font-family: inherit;
  border-radius: var(--radius-xs); transition: all var(--dur); text-align: left;
}
.lane-add:hover { background: var(--surface-3); color: var(--accent-ink); }
</style>
