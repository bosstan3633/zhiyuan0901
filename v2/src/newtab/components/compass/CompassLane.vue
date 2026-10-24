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
import { computed, ref } from 'vue'
import type { MetricMeta } from '../../views/compassMeta'
import { gradeColorVar } from '../../views/compassMeta'

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

const emit = defineEmits<{
  (e: 'toggle', metricId: string): void
  (e: 'task', taskId: string): void
  (e: 'grade', taskId: string): void
  /** ★W12-C 任务详情抽屉：标题单击 = 打开右侧任务详情抽屉。
      此前全站没有任何一条 emit 通到 `CompassTree.detailRef.open()` —— 抽屉组件在位、
      唯独唯一调用点是「新建任务成功后」，于是任务行点了没反应（用户 2026-10-13 报 bug）。 */
  (e: 'openDetail', taskId: string): void
  (e: 'addTask', metricId: string): void
  /** ★R141：任务行 ✕ = 解绑回任务调度模块（不删本体）—— 模板挂载点，删了能力就丢 */
  (e: 'unbind', taskId: string): void
  /** V3.9.15：任务行直接软删进回收站，无需二次确认；解绑与删除保持两种语义。 */
  (e: 'deleteTask', taskId: string): void
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
}>()

/** ★F1：指标卡「⋯」菜单（当前只有删除一项；后续要放验收标准编辑等从这里长） */
const menuFor = ref<string | null>(null)
function toggleMenu(id: string) { menuFor.value = menuFor.value === id ? null : id }

const dotGlyph = computed(() => (props.m.dot === 'done' ? '' : props.m.dot === 'doing' ? '◐' : '○'))
const dotTitle = computed(() =>
  props.m.dot === 'done' ? '该指标下任务已全部完成'
    : props.m.dot === 'doing' ? '有任务进行中' : '任务尚未启动'
)

function taskGrade(t: { priority?: string }): string {
  return t.priority === 'high' ? '高优' : t.priority === 'low' ? '低优' : '中优'
}
/** 归属路径：只在 hover 时浮现，平时藏起来保持任务行的干净 */
const crumb = computed(() => `${props.dirName} › ${props.projName} › ${props.m.title}`)
</script>

<template>
  <section class="metric-card" :style="{ '--hue': hue }">
    <header class="mc-head">
      <button
        class="mc-dot"
        :class="m.dot"
        :title="dotTitle"
        :aria-label="dotTitle"
        @click="emit('toggle', m.id)"
      >{{ dotGlyph }}</button>
      <!-- ★指标名就地改名：与树里 战略目标/项目 同一套 contenteditable 机制（父组件 startEdit/saveEdit），
           不用 prompt —— prompt 会打断「连续改名」的手感，且四层节点的改名口径必须一致。 -->
      <h4
        class="mc-title editable"
        v-pressable
        :class="{ editing: editing }"
        :data-edit="'metric-' + m.id"
        :contenteditable="editing"
        @click="$emit('editTitle', m.id, $event)"
        @blur="$emit('saveTitle', m.id, $event)"
        @keydown.enter.ctrl.prevent="$emit('saveTitle', m.id, $event)"
        @keydown.esc="$emit('cancelTitle', m.id)"
      >{{ m.title }}</h4>
      <span v-if="m.orphanMetric" class="mc-flag warn" title="该指标下没有任何任务，线索断在这"><Icon name="warn" :size="13"/> 缺任务</span>
      <span v-else-if="m.target" class="mc-flag">{{ m.target }}</span>
      <!-- ★指标级进度条：原型 .m-bar 是「轨道 + 数字」一体、margin-left:auto 顶到行尾。
           之前只有一个裸百分数飘在行中，进度既不在固定位置也不成条，读起来像标签不是进度。 -->
      <span class="mc-bar" :title="`本指标完成度 ${m.pct}%（${m.done}/${m.total} 任务）`">
        <span class="mc-track"><i class="mc-fill" :style="{ width: m.pct + '%' }" /></span>
        <b class="mc-pct" :class="{ full: m.pct === 100 }">{{ m.done }}/{{ m.total }} · {{ m.pct }}%</b>
      </span>
      <button class="mc-toggle" :aria-expanded="open" @click="emit('toggle', m.id)">
        {{ open ? '收起 ▾' : '展开 ▸' }}
      </button>
      <button class="mc-detail" title="打开指标详情：验收标准 / 目标值 / 支撑任务" @click="emit('openMetric', m.id)">详情 ›</button>
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
        <button class="mc-del" title="删除本成功指标（其下任务转为未关联，可撤销）" @click="emit('delMetric', m.id)"><Icon name="trash" :size="13"/></button>
        <button class="mc-more" :class="{ on: menuFor === m.id }" title="指标更多操作" @click="toggleMenu(m.id)">⋯</button>
        <span v-if="menuFor === m.id" class="mc-menu" data-a11y-container @click.stop>
          <button class="mcm-item danger" @click="menuFor = null; emit('delMetric', m.id)"><Icon name="trash" :size="13"/> 删除本指标</button>
        </span>
      </span>
    </header>

    <p v-if="m.acceptance" class="mc-acc">
      <span class="mc-acc-l">验收</span>{{ m.acceptance }}
    </p>

    <!-- 任务列表：内嵌 + 分叉连线；★容器不可省（见文件头陷阱说明） -->
    <ul v-if="open && m.tasks.length" class="metric-list">
      <li v-for="t in m.tasks" :key="t.id" class="tk-row" :class="t.status" :title="`归属：${crumb}`">
        <button
          class="tk-box"
          :class="t.status"
          :aria-label="t.status === 'done' ? '标记未完成' : '标记完成'"
          @click="emit('task', t.id)"
        ><span v-if="t.status === 'done'"><Icon name="check" :size="13"/></span></button>
        <button class="tk-title" title="打开任务详情抽屉" @click="emit('openDetail', t.id)">{{ t.title }}</button>
        <!-- 归属路径：hover 浮现 -->
        <span class="tk-crumb" aria-hidden="true">{{ crumb }}</span>
        <span class="tk-tags">
          <span class="tk-pri" :class="t.priority">{{ taskGrade(t) }}</span>
          <!-- ★W12-C 正名：这枚按钮走的是 `emit('grade')` → showTaskGrade = 优先级成熟度弹层，
               从来不是任务详情抽屉；叫「详情」会把人引到错的去处（用户 2026-10-13 报 bug 的另一半）。
               改叫「成熟度」并补 title，真正的详情入口是左侧任务标题。 -->
          <button class="tk-grade" title="看这条任务的优先级成熟度依据" @click="emit('grade', t.id)">成熟度</button>
          <!-- ★R141 保留：✕ 只解绑（摘挂载），删本体走任务详情 —— 两语义不许混 -->
          <button class="tk-unbind" title="从本指标移除（解绑回任务调度模块；删除本体请进任务详情）" @click="emit('unbind', t.id)"><Icon name="x" :size="13"/></button>
          <button class="tk-del" title="删除任务（进回收站，可在回收站恢复）" aria-label="删除任务" @click.stop="emit('deleteTask', t.id)"><Icon name="trash" :size="13"/></button>
        </span>
      </li>
    </ul>

    <!-- 断链显性化：零任务指标给虚线空位，让"缺"在版面上可见（判据 W11-6） -->
    <div v-else-if="m.orphanMetric" class="mc-orphan">
      <span class="mo-t">验收标准已定，动作未落 —— 先拆出第一条支撑任务</span>
      <button class="mo-add" @click="emit('addTask', m.id)">＋ 建第一条任务</button>
    </div>

    <div v-else class="mc-collapsed">
      <span>{{ m.total }} 条任务已收起 · 点击「展开 ▸」查看</span>
      <button class="mo-add" @click="emit('toggle', m.id)">展开 ▸</button>
    </div>
  </section>
</template>

<style scoped>
/* ★视觉聚焦（方向台优化）：指标从"卡"退成"分组"。
   原来指标卡是 surface-2 底 + 圆角，任务行又是 surface 白卡，再套在项目舱卡里 ——
   同一屏三层容器，边框与底色把注意力从"这条指标要交付什么"上拽走。
   现在指标只用一条发丝线与序号定位，层级由字号与留白承担；
   hover 不再加描边环（那是"框"的语言），改为极淡的底色提示。 */
.metric-card {
  background: transparent;
  border-radius: 0;
  border-top: 1px solid var(--border);
  padding: 10px 4px 11px 14px;
  position: relative;
  transition: background var(--dur);
}
.metric-card:hover { background: color-mix(in srgb, var(--surface) 55%, transparent); }
.mc-head { display: flex; align-items: center; gap: 7px; flex-wrap: wrap; }
.mc-dot {
  color: var(--text-4); font-size: 9px; line-height: 1;
  display: flex; align-items: center; justify-content: center; cursor: pointer;
  transition: all var(--dur);
}
.mc-dot.doing { color: var(--warning); }
.mc-dot.done { color: #fff; }
.mc-title {
  font-size: var(--fs-sub); font-weight: 700; color: var(--text);
  flex: 1; min-width: 0; line-height: 1.45;
}
/* ★就地改名态：与树内 .node-title.editable 同一视觉（虚线下划 + 光标），四层节点改名手感一致 */
.mc-title.editable { cursor: text; border-bottom: 1px dashed transparent; }
.mc-title.editable:hover { border-bottom-color: var(--border-strong); }
.mc-title.editing { border-bottom-color: var(--accent); outline: none; }
.mc-flag {
  font-size: var(--fs-micro); color: var(--text-3);
  background: var(--surface-3); padding: 2px 8px; border-radius: 999px;
  max-width: 160px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.mc-flag.warn { color: var(--warning); background: var(--warning-bg-soft); font-weight: 600; }
/* ★指标级进度：轨道 56px + 数字并排，顶到行尾（原型 .m-bar 的 margin-left:auto）
   —— 判据 W11-5：进度数字绝不许大于指标名，这里 --fs-micro < --fs-sub 是硬性前提 */
.mc-bar {
  margin-left: auto; display: flex; align-items: center; gap: 7px; flex: none;
}
.mc-track {
  width: 56px; height: 4px; border-radius: 2px;
  background: var(--surface-3); overflow: hidden; flex: none;
}
.mc-fill { display: block; height: 100%; border-radius: 2px; background: var(--hue); transition: width var(--dur); }
.mc-pct {
  font-size: var(--fs-micro); color: var(--text-3);
  font-variant-numeric: tabular-nums; white-space: nowrap;
}
.mc-pct.full { color: var(--success); font-weight: 700; }
.mc-toggle {
  font-size: var(--fs-micro); color: var(--text-3);
  padding: 2px 6px; border-radius: 5px; cursor: pointer; transition: all var(--dur); flex: none;
  /* ★W12(V3.8.12)真缺陷（theme-audit 深色主题实跑抓到）：button 没给 background/border
     ⇒ 浏览器默认 buttonface 白底透出来，在 linear/raycast 下是一排白块、文字被吃掉。
     与 CompassTower 的 .tw-act / .twm-item 同根因，同批修。 */
  background: transparent; border: 1px solid transparent;
}
.mc-toggle:hover { color: var(--text); background: var(--surface-3); }
.mc-detail {
  flex: none; border: 1px solid var(--border); background: var(--surface);
  color: var(--text-3); font-family: inherit; font-size: var(--fs-micro); font-weight: 600;
  padding: 2px 7px; border-radius: 6px; cursor: pointer; transition: all var(--dur);
}
.mc-detail:hover { color: var(--accent-ink); border-color: var(--accent); background: var(--accent-light); }
/* ★W12：AI / 加任务 两枚操作钮 hover 才显形，让指标名先被读到（能力未删，见模板注释）
   ★F1：删除 🗑 与「⋯」并入同一套 hover 显形 —— 不新增常驻位，指标头不因删除入口变挤 */
.mc-add, .mc-ai, .mc-del, .mc-more {
  font-size: var(--fs-micro); color: var(--text-3);
  padding: 2px 7px; border-radius: 5px; cursor: pointer; transition: all var(--dur); flex: none;
  opacity: 0; border: 1px solid transparent; background: transparent;
}
.mc-add { border: 1px solid var(--border); background: var(--surface); }
.metric-card:hover .mc-add, .metric-card:hover .mc-ai, .metric-card:hover .mc-del, .metric-card:hover .mc-more,
.mc-add:focus-visible, .mc-ai:focus-visible, .mc-del:focus-visible, .mc-more:focus-visible { opacity: 1; }
.mc-add:hover { color: var(--accent-ink); background: var(--accent-light); border-color: var(--accent-light); }
.mc-ai:hover { color: var(--accent-ink); background: var(--accent-light); }
.mc-del:hover, .mc-more:hover { color: var(--danger); background: var(--danger-bg-soft); }
.mc-more.on { opacity: 1; color: var(--accent-ink); background: var(--accent-light); }
/* ★F1 指标「⋯」菜单：与项目舱菜单同一套下拉语言（绝对定位 + surface 卡） */
.mc-ops { position: relative; display: inline-flex; align-items: center; gap: 2px; flex: none; }
.mc-menu {
  position: absolute; right: 0; top: calc(100% + 4px); z-index: 30; min-width: 148px;
  background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-md);
  box-shadow: none; padding: 4px; display: flex; flex-direction: column;
}
.mcm-item {
  font-size: var(--fs-micro); font-weight: 600; color: var(--text-2); text-align: left;
  padding: 6px 9px; border-radius: 5px; cursor: pointer; font-family: inherit; border: 0; background: transparent;
}
.mcm-item:hover { background: var(--surface-3); }
.mcm-item.danger { color: var(--danger); }
.mcm-item.danger:hover { background: var(--danger-bg-soft); }
.mc-acc {
  font-size: var(--fs-tiny); color: var(--text-3); line-height: 1.55;
  margin-top: 4px; padding-left: 24px;
}
.mc-acc-l {
  color: var(--text-4); font-weight: 700; margin-right: 5px;
  letter-spacing: .04em;
}

/* ★归属竖轨：指标卡从项目色条分出的那条线——无内容容器，别删 */
.metric-list {
  list-style: none; margin: 7px 0 0; padding: 0 0 0 24px; position: relative;
}
.metric-list::before {
  content: ''; position: absolute; left: 9px; top: -4px; bottom: 14px;
  width: 2px; border-radius: 2px;
  background: color-mix(in srgb, var(--hue) 34%, transparent);
}
/* ★任务行：保留白底行（W12-5 判据）与 hover 位移（手感），但去掉圆角与卡间距 ——
   圆角 + 外边距会让每一行都像一张独立小卡，一屏十几条就是十几张卡；
   改成"表格行"形态后，任务读起来是同一个列表里的连续条目。 */
.tk-row {
  display: flex; align-items: center; gap: 8px;
  padding: 7px 10px; border-radius: 0; margin-bottom: 0;
  border-bottom: 1px solid var(--border);
  background: var(--surface);
  position: relative; transition: all var(--dur); cursor: default;
}
.tk-row:last-child { margin-bottom: 0; border-bottom: 0; }
.tk-row:hover {
  background: color-mix(in srgb, var(--surface) 66%, var(--bg));
  transform: none;
}
/* ★分叉臂：任务从指标轨道分出的横线——同样是无内容容器 */
.tk-row::before {
  content: ''; position: absolute; left: -12px; top: 50%;
  width: 12px; height: 2px;
  background: color-mix(in srgb, var(--hue) 42%, transparent);
}
.tk-row.done .tk-title { color: var(--text-3); text-decoration: line-through; text-decoration-color: var(--text-4); }
.tk-row.doing .tk-title { color: var(--text); font-weight: 600; }
.tk-box {
  /* ★V3.9.6：视觉尺寸与点击盒子已拆到 hotzone.css（本体 28px 透明 + ::before 画 16px 方块），
     本条只留**非尺寸**属性（尺寸写在 hotzone.css，否则本条 scoped 的特异性会盖掉它）。 */
  border-radius: 5px; flex: none;
  color: transparent; font-size: 9px; line-height: 1;
  display: flex; align-items: center; justify-content: center; cursor: pointer;
  transition: all var(--dur);
}
.tk-box.done { color: #fff; }
/* 触控：任务标题是下钻入口，窄屏给整行最小热区，避免只能点中文字。 */
@media (max-width: 800px) {
  .mc-head { gap: 6px; }
  .mc-bar { margin-left: 0; }
  .mc-detail { order: 8; }
  .tk-row { min-height: 40px; padding: 8px 9px; }
  .tk-title { min-height: 24px; }
}
@media (max-width: 480px) {
  .metric-card { padding: 12px 12px 12px 14px; }
  .mc-title { flex-basis: calc(100% - 26px); }
  .mc-bar { width: 100%; margin-top: 2px; }
  .mc-track { flex: 1; width: auto; }
  .mc-toggle, .mc-detail { min-height: 30px; }
}
/* ★W12-C：任务标题从 <span> 改成 <button>（单击开任务详情抽屉）。
   补齐按钮态归零——只给交互态（hover / focus）加反馈，不改变任何既有字号字色。 */
.tk-title {
  font-size: var(--fs-body); color: var(--text-2); flex: 1; min-width: 0; line-height: 1.5;
  background: none; border: 0; padding: 0; margin: 0; font-family: inherit; text-align: left;
  cursor: pointer; border-radius: var(--radius-sm); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.tk-title:hover { color: var(--accent-ink); text-decoration: underline; text-underline-offset: 3px; }
.tk-title:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
/* 归属路径：默认藏，hover 浮现 */
.tk-crumb {
  font-size: var(--fs-tiny); color: var(--text-4);
  opacity: 0; transition: opacity var(--dur);
  max-width: 220px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: none;
}
.tk-row:hover .tk-crumb { opacity: 1; }
.tk-tags { display: flex; align-items: center; gap: 5px; flex: none; }
.tk-pri { font-size: var(--fs-micro); color: var(--text-3); background: var(--surface-3); padding: 1px 6px; border-radius: 999px; }
/* ★W12-G 可读性（用户 2026-10-13 反馈 6「不同主题下按钮看不清」）：
   原来用最淡的 --text-4（notion 主题下是 30% 不透明度的深色，对 surface-2 约 2:1，远低于 4.5），
   这枚带文字标签的按钮在极简白主题下基本隐形。提到 --text-2（可读档），弱化交给 hover。 */
.tk-grade {
  font-size: var(--fs-micro); color: var(--text-2);
  padding: 1px 5px; border-radius: 4px; cursor: pointer;
  background: transparent; border: 1px solid transparent;
}
.tk-grade:hover { color: var(--accent-ink); background: var(--accent-light); }
/* ★解绑钮：默认低调（不与勾选框争），hover 才显形 —— 误触成本高，不能做成随手可点 */
.tk-unbind {
  font-size: var(--fs-micro); color: var(--text-4);
  /* ★V3.9.6：视觉尺寸与点击盒子已拆到 hotzone.css（本体 28px 透明 + ::before 画 16px）。 */
  border-radius: 4px; line-height: 1;
  display: flex; align-items: center; justify-content: center;
  cursor: pointer; transition: all var(--dur); opacity: 0;
  background: transparent; border: 1px solid transparent;
}
.tk-row:hover .tk-unbind { opacity: 1; }
.tk-unbind:hover { color: var(--danger); background: var(--danger-bg-soft); }
.tk-del {
  display: flex; align-items: center; justify-content: center;
  width: 28px; height: 28px; padding: 0; border: 1px solid transparent; border-radius: 4px;
  background: transparent; color: var(--text-2); cursor: pointer;
  opacity: .55; transition: all var(--dur);
}
.tk-row:hover .tk-del, .tk-del:focus-visible { opacity: 1; }
.tk-del:hover { color: var(--danger); background: var(--danger-bg-soft); }

/* 断链空位：★视觉聚焦 —— 从"虚线告警框"改为"带色轨的行动提示"。
   虚线圈 + 圆角 + 底色三者叠加时，它看起来像一块"出错的卡"；而它真正要说的只有一句：
   标准已定、缺一条动作，右边就是建任务的入口。 */
.mc-orphan {
  margin: 9px 0 0 26px; padding: 9px 12px;
  border: 0; border-left: 2px solid var(--warning-border); border-radius: 0;
  background: var(--warning-bg-soft);
  min-height: 44px; display: flex; align-items: center; gap: 10px; flex-wrap: wrap;
}
.mo-t { font-size: var(--fs-micro); color: var(--text-2); flex: 1; min-width: 0; }
.mo-add {
  font-size: var(--fs-micro); font-weight: 600; color: var(--accent-ink);
  background: var(--accent-light); padding: 2px 8px; border-radius: 999px; cursor: pointer; flex: none;
}
.mc-collapsed {
  margin: 9px 0 0 26px; padding: 7px 12px;
  background: var(--surface-3); border-radius: 7px; min-height: 30px;
  display: flex; align-items: center; gap: 10px;
  font-size: var(--fs-micro); color: var(--text-4);
}
</style>
