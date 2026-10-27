<script setup lang="ts">
/**
 * ★W17-C01（2026-10-20 用户拍板）「今天的状态」三行 → 中央只读明细弹窗。
 *
 * V3.9.25 用户修订：整行可点，资源卡优先直达原始链接；打不开时再由宿主回落详情抽屉。
 * V3.9.25 用户修订：整行右侧的箭头就是下钻入口，不再要求命中一个细小按钮。
 *
 * 三条硬约束：
 *   ① 行下钻——有 actionKind/actionId 的行整行可点；纯说明行保持可复制文本；
 *   ② 不跳路由——宿主点击三行只开本弹窗；具体卡片由宿主统一分流；
 *   ③ 数字与清单同源——明细条数必须与行内显示的数字一致（口径由宿主传入，本组件不自算）。
 */
import Modal from '@/shared/components/Modal.vue'

/** V3.9.18：新增 'in'（今日入台明细）与 'out'（今日调出明细）两键——
 *  口径按创建时间 / lastCalledAt 派生（宿主自算传入），与战报的事件日志口径不同源，note 里明示。 */
export type StatusDetailKey = 'focus' | 'unarchived' | 'reuse' | 'in' | 'out'

export interface StatusDetailItem {
  title: string
  /** 第二列说明（如所属项目 / 缺失项 / 调用次数） */
  meta?: string
  /** 第三列时间或计数 */
  extra?: string
  /** V3.9.14：可选的下一步动作。没有动作的条目保持纯只读。 */
  action?: string
  actionKind?: 'project' | 'task' | 'resource' | 'log'
  actionId?: string
}

const props = defineProps<{
  open: boolean
  kind: StatusDetailKey
  title: string
  /** 顶部口径说明（一句话，交代这张清单是什么维度） */
  note: string
  items: StatusDetailItem[]
  /** 空态文案（不同的入口空态不同） */
  emptyText: string
}>()
const emit = defineEmits<{
  (e: 'close'): void
  (e: 'item-action', item: StatusDetailItem): void
}>()
</script>

<template>
  <Modal :open="props.open" width="min(560px, 94vw)" max-height="82vh" @close="emit('close')">
    <template #title>{{ props.title }}</template>
    <template #sub><span class="sd-note">{{ props.note }}</span></template>

    <div v-if="props.items.length" class="sd-list">
      <div
        v-for="(it, i) in props.items"
        :key="i"
        class="sd-row"
        :class="{ actionable: !!(it.actionKind && it.actionId) }"
        :role="it.actionKind && it.actionId ? 'button' : 'listitem'"
        tabindex="0"
        :title="it.actionKind && it.actionId ? `${it.action || '打开'}：${it.title}` : undefined"
        @click="it.actionKind && it.actionId && emit('item-action', it)"
        @keydown.enter.prevent="it.actionKind && it.actionId && emit('item-action', it)"
        @keydown.space.prevent="it.actionKind && it.actionId && emit('item-action', it)"
      >
        <span class="sd-title" :title="it.title">{{ it.title }}</span>
        <span v-if="it.meta" class="sd-meta" :title="it.meta">{{ it.meta }}</span>
        <span v-if="it.extra" class="sd-extra">{{ it.extra }}</span>
        <span v-if="it.action" class="sd-action" aria-hidden="true">
          {{ it.action }} <span aria-hidden="true">›</span>
        </span>
      </div>
    </div>
    <div v-else class="sd-empty">{{ props.emptyText }}</div>

    <template #footer>
      <span class="sd-foot">点击任一行继续查看 · 资源卡优先打开原始链接</span>
      <button class="sd-btn" @click="emit('close')">关闭</button>
    </template>
  </Modal>
</template>

<style scoped>
.sd-note { font-size: var(--fs-caption); color: var(--text-4); line-height: 1.6; }
.sd-list { display: flex; flex-direction: column; }
.sd-row {
  display: flex; align-items: baseline; gap: 10px; padding: 9px 2px;
  border-top: 1px solid var(--border); font-size: var(--fs-sub); min-width: 0;
  cursor: text; user-select: text; border-radius: var(--radius-sm);
}
.sd-row:first-child { border-top: 0; }
.sd-row.actionable { padding: 9px 7px; cursor: pointer; user-select: none; transition: background var(--dur), color var(--dur); }
.sd-row.actionable:hover, .sd-row.actionable:focus-visible { background: var(--surface-2); outline: none; }
.sd-row.actionable:focus-visible { box-shadow: inset 0 0 0 2px var(--accent); }
.sd-title { flex: 1; min-width: 0; color: var(--text); overflow-wrap: anywhere; }
.sd-meta { flex: none; max-width: 42%; font-size: var(--fs-caption); color: var(--text-3); overflow-wrap: anywhere; }
.sd-extra { flex: none; font-size: var(--fs-caption); color: var(--text-4); font-variant-numeric: tabular-nums; }
.sd-action {
  flex: none; min-height: 28px; padding: 2px 7px;
  border: 1px solid var(--border); border-radius: var(--radius-xs);
  background: var(--surface); color: var(--text-3);
  display: inline-flex; align-items: center;
  font-size: var(--fs-micro); font-weight: 600;
}
.sd-row.actionable:hover .sd-action { border-color: var(--accent); color: var(--accent-ink); background: var(--accent-light); }
.sd-empty { padding: 18px 2px; font-size: var(--fs-caption); color: var(--text-4); line-height: 1.7; }
.sd-foot { flex: 1; min-width: 0; font-size: var(--fs-micro); color: var(--text-4); }
.sd-btn { border: 1px solid var(--border); background: var(--surface); color: var(--text-2); border-radius: var(--radius-sm); padding: 5px 14px; font-size: var(--fs-sub); font-weight: 600; font-family: inherit; cursor: pointer; }
.sd-btn:hover { border-color: var(--border-strong); color: var(--text); }
</style>
