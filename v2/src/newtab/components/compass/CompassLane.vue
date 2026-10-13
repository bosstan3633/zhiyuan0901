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
import { computed } from 'vue'
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
  (e: 'addTask', metricId: string): void
  /** ★R141：任务行 ✕ = 解绑回任务调度模块（不删本体）—— 模板挂载点，删了能力就丢 */
  (e: 'unbind', taskId: string): void
  /** ★R135-4：任务层 AI 拆解入口 */
  (e: 'aiTask', metricId: string): void
  /** 指标名就地改名三件套（与树内 contenteditable 机制同源，事件冒泡给父组件统一处理） */
  (e: 'editTitle', metricId: string, ev: MouseEvent | undefined): void
  (e: 'saveTitle', metricId: string, ev: FocusEvent | KeyboardEvent): void
  (e: 'cancelTitle', metricId: string): void
}>()

const dotGlyph = computed(() => (props.m.dot === 'done' ? '✓' : props.m.dot === 'doing' ? '◐' : '○'))
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
        :class="{ editing: editing }"
        :data-edit="'metric-' + m.id"
        :contenteditable="editing"
        @click="$emit('editTitle', m.id, $event)"
        @blur="$emit('saveTitle', m.id, $event)"
        @keydown.enter.ctrl.prevent="$emit('saveTitle', m.id, $event)"
        @keydown.esc="$emit('cancelTitle', m.id)"
      >{{ m.title }}</h4>
      <span class="mc-count">{{ m.done }}/{{ m.total }}</span>
      <span class="mc-pct" :class="{ full: m.pct === 100 }">{{ m.pct }}%</span>
      <!-- 断链黄标：缺任务指标必须有，且不许被隐藏 -->
      <span v-if="m.orphanMetric" class="mc-flag warn" title="该指标下没有任何任务，线索断在这">⚠ 缺任务</span>
      <span v-else class="mc-flag">{{ m.target || '未写目标值' }}</span>
      <button class="mc-toggle" :aria-expanded="open" @click="emit('toggle', m.id)">
        {{ open ? '收起 ▾' : '展开 ▸' }}
      </button>
      <!-- ★R135-4（能力保留）：任务层 AI 入口 —— 六入口之一，删了判据红就是能力丢不是判据的问题 -->
      <button class="mc-ai" title="AI 依本成功指标拆解支撑步骤（查重后采纳才创建）" @click="emit('aiTask', m.id)">✦</button>
      <!-- ★R32-14（能力保留）：指标条目 ＋ 加任务 —— 断链空位之外也必须有一份常规出口，
           否则「指标下加任务」只剩断链时才出现的路径，等于能力退化。 -->
      <button class="mc-add" title="在本成功指标下添加支撑任务" @click="emit('addTask', m.id)">＋任务</button>
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
        ><span v-if="t.status === 'done'">✓</span></button>
        <span class="tk-title">{{ t.title }}</span>
        <!-- 归属路径：hover 浮现 -->
        <span class="tk-crumb" aria-hidden="true">{{ crumb }}</span>
        <span class="tk-tags">
          <span class="tk-pri" :class="t.priority">{{ taskGrade(t) }}</span>
          <button class="tk-grade" @click="emit('grade', t.id)">详情</button>
          <!-- ★R141 保留：✕ 只解绑（摘挂载），删本体走任务详情 —— 两语义不许混 -->
          <button class="tk-unbind" title="从本指标移除（解绑回任务调度模块；删除本体请进任务详情）" @click="emit('unbind', t.id)">✕</button>
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
.metric-card {
  background: var(--surface-2);
  border-radius: var(--radius-md);
  padding: 10px 12px 11px;
  position: relative;
}
.mc-head { display: flex; align-items: center; gap: 7px; flex-wrap: wrap; }
.mc-dot {
  width: 15px; height: 15px; border-radius: 50%; flex: none;
  border: 1.5px solid var(--border); background: var(--surface);
  color: var(--text-4); font-size: 9px; line-height: 1;
  display: flex; align-items: center; justify-content: center; cursor: pointer;
  transition: all var(--dur);
}
.mc-dot.doing { border-color: var(--warning); color: var(--warning); }
.mc-dot.done { background: var(--success); border-color: var(--success); color: #fff; }
.mc-title {
  font-size: var(--fs-sub); font-weight: 600; color: var(--text);
  flex: 1; min-width: 0; line-height: 1.4;
}
.mc-count { font-size: var(--fs-micro); color: var(--text-3); font-variant-numeric: tabular-nums; }
/* ★就地改名态：与树内 .node-title.editable 同一视觉（虚线下划 + 光标），四层节点改名手感一致 */
.mc-title.editable { cursor: text; border-bottom: 1px dashed transparent; }
.mc-title.editable:hover { border-bottom-color: var(--border-strong); }
.mc-title.editing { border-bottom-color: var(--accent); outline: none; }
/* ★判据 W11-5：进度数字绝不许大于指标名。这里 --fs-micro < --fs-sub 是硬性前提 */
.mc-pct { font-size: var(--fs-micro); color: var(--text-4); font-variant-numeric: tabular-nums; }
.mc-pct.full { color: var(--success); font-weight: 700; }
.mc-flag {
  font-size: var(--fs-micro); color: var(--text-3);
  background: var(--surface-3); padding: 1px 7px; border-radius: 999px;
  max-width: 160px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.mc-flag.warn { color: var(--warning); background: var(--warning-bg-soft); font-weight: 600; }
.mc-toggle {
  font-size: var(--fs-micro); color: var(--text-3);
  padding: 2px 6px; border-radius: 5px; cursor: pointer; transition: all var(--dur); flex: none;
}
.mc-toggle:hover { color: var(--text); background: var(--surface-3); }
.mc-add {
  font-size: var(--fs-micro); color: var(--text-3);
  padding: 2px 6px; border-radius: 5px; cursor: pointer; transition: all var(--dur); flex: none;
  border: 1px solid var(--border); background: var(--surface);
}
.mc-add:hover { color: var(--accent-ink); background: var(--accent-light); border-color: var(--accent-light); }
.mc-ai {
  font-size: var(--fs-micro); color: var(--text-3);
  width: 18px; height: 18px; border-radius: 6px; flex: none;
  display: flex; align-items: center; justify-content: center;
  cursor: pointer; transition: all var(--dur);
}
.mc-ai:hover { color: var(--accent-ink); background: var(--accent-light); }
.mc-acc {
  font-size: var(--fs-micro); color: var(--text-3); line-height: 1.65;
  margin-top: 5px; padding-left: 22px;
}
.mc-acc-l {
  color: var(--text-4); font-weight: 700; margin-right: 5px;
  letter-spacing: .04em;
}

/* ★归属竖轨：指标卡从项目色条分出的那条线——无内容容器，别删 */
.metric-list {
  list-style: none; margin: 8px 0 0; padding: 0 0 0 22px; position: relative;
}
.metric-list::before {
  content: ''; position: absolute; left: 8px; top: -2px; bottom: 8px;
  width: 2px; border-radius: 2px;
  background: linear-gradient(180deg, var(--hue), color-mix(in srgb, var(--hue) 25%, transparent));
}
.tk-row {
  display: flex; align-items: center; gap: 7px;
  padding: 4px 8px 4px 10px; border-radius: 6px;
  position: relative; transition: background var(--dur);
}
.tk-row:hover { background: color-mix(in srgb, var(--hue) 9%, transparent); }
/* ★分叉臂：任务从指标轨道分出的横线——同样是无内容容器 */
.tk-row::before {
  content: ''; position: absolute; left: -14px; top: 50%;
  width: 14px; height: 1px;
  background: color-mix(in srgb, var(--hue) 45%, transparent);
}
.tk-row.done .tk-title { color: var(--text-3); text-decoration: line-through; }
.tk-row.doing .tk-title { color: var(--text); font-weight: 600; }
.tk-box {
  width: 14px; height: 14px; border-radius: 4px; flex: none;
  border: 1.5px solid var(--border); background: var(--surface);
  color: transparent; font-size: 9px; line-height: 1;
  display: flex; align-items: center; justify-content: center; cursor: pointer;
  transition: all var(--dur);
}
.tk-box:hover { border-color: var(--hue); }
.tk-box.done { background: var(--success); border-color: var(--success); color: #fff; }
.tk-box.doing { border-color: var(--warning); }
.tk-title { font-size: var(--fs-body); color: var(--text-2); flex: 1; min-width: 0; line-height: 1.5; }
/* 归属路径：默认藏，hover 浮现 */
.tk-crumb {
  font-size: var(--fs-micro); color: var(--text-4);
  opacity: 0; transition: opacity var(--dur);
  max-width: 220px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: none;
}
.tk-row:hover .tk-crumb { opacity: 1; }
.tk-tags { display: flex; align-items: center; gap: 5px; flex: none; }
.tk-pri { font-size: var(--fs-micro); color: var(--text-3); background: var(--surface-3); padding: 1px 6px; border-radius: 999px; }
.tk-grade {
  font-size: var(--fs-micro); color: var(--text-4);
  padding: 1px 5px; border-radius: 4px; cursor: pointer;
}
.tk-grade:hover { color: var(--accent-ink); background: var(--accent-light); }
/* ★解绑钮：默认低调（不与勾选框争），hover 才显形 —— 误触成本高，不能做成随手可点 */
.tk-unbind {
  font-size: var(--fs-micro); color: var(--text-4);
  width: 16px; height: 16px; border-radius: 4px; line-height: 1;
  display: flex; align-items: center; justify-content: center;
  cursor: pointer; transition: all var(--dur); opacity: 0;
}
.tk-row:hover .tk-unbind { opacity: 1; }
.tk-unbind:hover { color: var(--danger); background: var(--danger-bg-soft); }

/* 断链空位：★用 surface-3 而不是低 alpha 底色——亮色主题下低 alpha 等于隐形（判据 W11-6） */
.mc-orphan {
  margin: 8px 0 0 22px; padding: 9px 11px;
  border: 1px dashed var(--warning-border); border-radius: 7px;
  background: var(--warning-bg-soft);
  min-height: 44px; display: flex; align-items: center; gap: 10px; flex-wrap: wrap;
}
.mo-t { font-size: var(--fs-micro); color: var(--text-2); flex: 1; min-width: 0; }
.mo-add {
  font-size: var(--fs-micro); font-weight: 600; color: var(--accent-ink);
  background: var(--accent-light); padding: 2px 8px; border-radius: 999px; cursor: pointer; flex: none;
}
.mc-collapsed {
  margin: 7px 0 0 22px; padding: 6px 11px;
  background: var(--surface-3); border-radius: 6px; min-height: 30px;
  display: flex; align-items: center; gap: 10px;
  font-size: var(--fs-micro); color: var(--text-4);
}
</style>