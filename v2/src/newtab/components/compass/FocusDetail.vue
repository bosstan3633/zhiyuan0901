<script setup lang="ts">
/**
 * ★W12-D（V3.8.16）FocusDetail —— 今日三件事「选中项全貌」常驻模块。
 * ★V3.8.18（N1）曾改为「三栏横排 + 固定 4 行子任务区」（实测约 470px）。
 * ★V3.8.21（P4 · 2026-10-15 用户拍板）：**整块删全貌，改单行三个子任务**（实测恒高 54px）。
 *
 * 为什么删：三栏那一版把「属于哪 / 走过什么 / 下一步 / 属性带」压在首屏里，
 * 真正要看的「三张卡」被顶出一屏之外 —— 于是"看选中项"反而挡住了"选下一件事"。
 *
 * 删掉的能力去哪了（逐条核对，属迁移不属丢）：
 *  - 属于哪（六层链）→ 上方卡片已有 🏷 项目/指标，抽屉里有完整六层链；
 *  - 走过什么（事件流水）→ 抽屉里本来就有历史；
 *  - 属性带（状态/优先/成熟/截止/预估/支撑/标签）→ 卡片徽章 + 抽屉全有；
 *  - 下一步（本地规则建议）→ D4 拍板**整体退役**（不进抽屉）：判断已由 AI 诊断与卡片停滞标承担。
 *
 * 保留与新增：
 *  - 保留：单击选中 / 双击滑出抽屉两条交互、四种非任务槽的引导态（压成同一行文案）；
 *  - D1 只摆前 3 条 + 溢出徽标 +N（点开抽屉），不横向滚动；
 *  - D2 单击子任务条目 = 就地勾选完成/取消（emit 上抛宿主，与抽屉同一条 done 落库路径）；
 *  - D5 空态给「＋ 拆分」直达按钮（开抽屉并聚焦子任务输入框）。
 *
 * 纯只读纪律不变：组件本体不调 store.persist，勾选与拆分都 emit 上抛。
 */
import Icon from '@/shared/components/Icon.vue'
import { computed } from 'vue'
import type { AppData, TaskCard } from '@/shared/models'

const props = defineProps<{
  /** 当前选中的任务（null = 未选中 / 选中的是空槽） */
  task: TaskCard | null
  /** 空槽引导态用：这一格是不是被选中了的空槽（true 时显示「这个位置还空着」） */
  emptySlot: boolean
  /** 这一格*不是*任务时也要说清它是什么（源卡已删 / 装的是资源卡 / 是一句自由文本 / 什么都没装） */
  slotKind: 'none' | 'stale' | 'nonTask' | 'text'
  /** 非任务槽的快照文本（用于自由文本槽与源卡已删时的回显） */
  slotText?: string
  data: AppData
}>()

const emit = defineEmits<{
  (e: 'edit', task: TaskCard): void
  /** D2：就地勾选子任务 —— 宿主 toggleSlotSub 落 done/doneAt 并持久化 */
  (e: 'toggleSub', taskId: string, subId: string): void
  /** D5 / S2：「＋ 拆分」「＋子任务」直达 —— 宿主开抽屉并聚焦子任务输入框 */
  (e: 'split', task: TaskCard): void
}>()

/** D1：一行只摆前 3 条，超出的折叠 +N（不滚动 —— 一屏多卡的布局里滚动条最容易被忽略） */
const VISIBLE_MAX = 3
const subtasks = computed(() => props.task?.subtasks || [])
const visibleSubs = computed(() => subtasks.value.slice(0, VISIBLE_MAX))
const overflow = computed(() => Math.max(0, subtasks.value.length - VISIBLE_MAX))
const subDone = computed(() => subtasks.value.filter(s => s.done).length)
const subTotal = computed(() => subtasks.value.length)
const pct = computed(() => (subTotal.value ? Math.round((subDone.value / subTotal.value) * 100) : 0))

function onToggleSub(subId: string) {
  if (!props.task) return
  emit('toggleSub', props.task.id, subId)
}
function openDetail() {
  if (props.task) emit('edit', props.task)
}
function onSplit() {
  if (props.task) emit('split', props.task)
}
</script>

<template>
  <div class="fd-body">
    <!-- S6 路 选中的不是任务：四种引导态压成同一行（文案沿用 N1 版，一字未改，只是不再各占一大块） -->
    <div v-if="!task && emptySlot" class="fd-row empty">
      <div class="sr-l"><span class="lab">子任务</span></div>
      <div class="em"><b>！ 这个位置还空着</b><s>点上方那一格的「＋ 从任务库选取」把它填上</s></div>
    </div>

    <div v-else-if="!task && slotKind === 'stale'" class="fd-row empty">
      <div class="sr-l"><span class="lab">子任务</span></div>
      <div class="em"><b><Icon name="warn" :size="13"/> 源任务已失效</b><s>点上方那一格「重新选取」换一件</s></div>
    </div>

    <div v-else-if="!task && slotKind === 'nonTask'" class="fd-row empty">
      <div class="sr-l"><span class="lab">子任务</span></div>
      <div class="em"><b><Icon name="package" :size="13"/> 这一格装的是卡片，不是任务</b><s>{{ slotText || '全貌只对任务展开 —— 双击卡片可看它自己的详情' }}</s></div>
    </div>

    <div v-else-if="!task && slotKind === 'text'" class="fd-row empty">
      <div class="sr-l"><span class="lab">子任务</span></div>
      <div class="em"><b><Icon name="check" :size="13"/> 这一格是你自己写的一句话</b><s>{{ slotText || '自由文本不参与六层链 —— 要跟踪的话换成一条任务' }}</s></div>
    </div>

    <div v-else-if="!task" class="fd-row empty">
      <div class="sr-l"><span class="lab">子任务</span></div>
      <div class="em"><b><Icon name="sparkle" :size="13"/> 点上面任意一件，看它的全貌</b><s>单击选中 · 双击右侧滑出任务详情</s></div>
    </div>

    <!-- S1～S5 路 单行子任务：恒高 54px，与条数、标题长度都无关 -->
    <div v-else class="fd-row">
      <div class="sr-l">
        <span class="lab">子任务</span>
        <span class="cnt" :class="{ all: subTotal > 0 && subDone === subTotal }">{{ subDone }}<i>/{{ subTotal }}</i></span>
        <span class="bar"><span :style="{ width: pct + '%' }"></span></span>
      </div>

      <!-- S5 路 没有子任务：一行话 + 一键拆分（比旧版 140px 空盒子有信息量，且给出去处） -->
      <div v-if="!subTotal" class="em">
        <b>这件事还没有步骤</b>
        <s>如果它要分几步做，先拆出来 —— 做完一件划一件更有手感。</s>
      </div>

      <div v-else class="sr-mid">
        <div
          v-for="st in visibleSubs" :key="st.id"
          class="sitem" :class="{ done: st.done }"
          :title="st.title + (st.done ? '（已完成，单击取消）' : '（单击标记完成）')"
          @click="onToggleSub(st.id)"
        >
          <span class="bx"><Icon v-if="st.done" name="check" :size="12"/></span>
          <span class="tx">{{ st.title }}</span>
        </div>
      </div>

      <div class="sr-r">
        <!-- D1 路 溢出徽标：点开抽屉看全 -->
        <button v-if="overflow > 0" class="more" :title="`另有 ${overflow} 条子任务，点开详情看全`" @click="openDetail">+{{ overflow }}</button>
        <!-- D5 / S2 路 没拆分就给去处；S2（不足 3 条）也给「＋子任务」，能力不减 -->
        <button class="plus" @click="onSplit">{{ subTotal ? '＋子任务' : '＋ 拆分' }}</button>
        <button class="go" title="双击上方任务也能开" @click="openDetail">双击详情 ›</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.fd-body { padding: 0; }

/* ── 单行：恒高 54px（子任务数量与标题长度都不影响它） ── */
.fd-row {
  display: flex; align-items: center; gap: 12px;
  min-height: 54px; padding: 9px 14px;
  background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-md);
  transition: border-color var(--dur);
}
.fd-row:hover { border-color: var(--border-strong); }
.fd-row.empty { border-style: dashed; background: transparent; }

.sr-l { display: flex; align-items: baseline; gap: 8px; flex: none; }
.sr-l .lab { font-size: var(--fs-micro); font-weight: 700; color: var(--text-2); letter-spacing: .5px; }
.sr-l .cnt {
  font-size: var(--fs-body); font-weight: 800; color: var(--accent-ink);
  font-variant-numeric: tabular-nums;
}
.sr-l .cnt.all { color: var(--success); }
.sr-l .cnt i { font-style: normal; color: var(--text-4); font-weight: 600; }
.sr-l .bar { width: 64px; height: 5px; border-radius: 999px; background: var(--surface-3); overflow: hidden; flex: none; }
.sr-l .bar span { display: block; height: 100%; background: var(--success); border-radius: 999px; }

/* 中段：只摆前 3 条，均分宽度，长标题截断不换行 */
.sr-mid { display: flex; align-items: center; gap: 8px; flex: 1; min-width: 0; }
.sitem {
  display: flex; align-items: center; gap: 8px; min-width: 0; flex: 1 1 0;
  background: var(--surface-2); border: 1px solid var(--border); border-radius: 8px;
  padding: 7px 11px; cursor: pointer;
  transition: background var(--dur), border-color var(--dur);
}
.sitem:hover { background: var(--surface-3); border-color: var(--border-strong); }
.sitem .bx {
  flex: none; width: 15px; height: 15px; border-radius: 50%;
  border: 1.5px solid var(--text-4); display: flex; align-items: center; justify-content: center;
  font-size: 10px; color: transparent; transition: all var(--dur);
}
.sitem .tx { font-size: var(--fs-caption); color: var(--text-2); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.sitem.done .bx { background: var(--success); border-color: var(--success); color: #06281d; font-weight: 900; }
.sitem.done .tx { color: var(--text-4); text-decoration: line-through; }

/* 引导性空态的中段文案（压成一行：粗体一句 + 灰色一句） */
.em { display: flex; align-items: center; gap: 10px; min-width: 0; flex: 1; font-size: var(--fs-caption); color: var(--text-3); }
.em b { color: var(--text-2); font-size: var(--fs-body); font-weight: 700; white-space: nowrap; }
.em s { text-decoration: none; color: var(--text-4); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

.sr-r { display: flex; align-items: center; gap: 8px; flex: none; }
.sr-r button {
  font-size: var(--fs-micro); font-family: inherit; cursor: pointer; white-space: nowrap;
  border-radius: 7px; padding: 5px 11px; line-height: 1.4;
}
.more {
  font-weight: 700; color: var(--accent-ink); background: var(--accent-light);
  border: 1px solid color-mix(in srgb, var(--accent) 40%, transparent);
  border-radius: 999px; padding: 3px 10px;
}
.more:hover { background: color-mix(in srgb, var(--accent) 28%, transparent); }
.plus {
  font-size: var(--fs-caption); color: var(--accent-ink);
  border: 1px dashed color-mix(in srgb, var(--accent) 50%, transparent);
  background: var(--accent-light);
}
.plus:hover { background: color-mix(in srgb, var(--accent) 26%, transparent); }
.go {
  font-size: var(--fs-caption); color: var(--text-3);
  border: 1px solid var(--border); background: transparent;
}
.go:hover { color: var(--text); border-color: var(--border-strong); background: var(--surface-2); }
</style>
