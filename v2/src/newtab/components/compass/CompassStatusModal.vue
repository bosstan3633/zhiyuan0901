<script setup lang="ts">
/**
 * ★W17-C01（2026-10-20 用户拍板）「今天的状态」三行 → 中央只读明细弹窗。
 *
 * 用户原话：右上角模块，点击之后中央弹窗弹出对应的明细，明细只可以看，不可再点击。
 * 补充拍板：面板右上角「战报」入口保留原行为；明细里的项目名 / 卡片标题**支持复制**。
 *
 * 三条硬约束：
 *   ① 只读——明细行没有任何 @click / @dblclick / role="button" / tabindex，也不复用
 *      DrillCardList（它自带单击/双击下钻，与本条"只读"冲突）；
 *   ② 不跳路由——宿主点击三行只开本弹窗，不再 router.push；
 *   ③ 数字与清单同源——明细条数必须与行内显示的数字一致（口径由宿主传入，本组件不自算）。
 */
import Modal from '@/shared/components/Modal.vue'

export type StatusDetailKey = 'focus' | 'unarchived' | 'reuse'

export interface StatusDetailItem {
  title: string
  /** 第二列说明（如所属项目 / 缺失项 / 调用次数） */
  meta?: string
  /** 第三列时间或计数 */
  extra?: string
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
const emit = defineEmits<{ (e: 'close'): void }>()
</script>

<template>
  <Modal :open="props.open" width="min(560px, 94vw)" max-height="82vh" @close="emit('close')">
    <template #title>{{ props.title }}</template>
    <template #sub><span class="sd-note">{{ props.note }}</span></template>

    <div v-if="props.items.length" class="sd-list">
      <div v-for="(it, i) in props.items" :key="i" class="sd-row">
        <span class="sd-title" :title="it.title">{{ it.title }}</span>
        <span v-if="it.meta" class="sd-meta" :title="it.meta">{{ it.meta }}</span>
        <span v-if="it.extra" class="sd-extra">{{ it.extra }}</span>
      </div>
    </div>
    <div v-else class="sd-empty">{{ props.emptyText }}</div>

    <template #footer>
      <span class="sd-foot">只读明细 · 文本可选中复制 · 需要改动请去对应页面</span>
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
  /* 只读：不做 hover 反馈、不给手型（明细不是控件） */
  cursor: text; user-select: text;
}
.sd-row:first-child { border-top: 0; }
.sd-title { flex: 1; min-width: 0; color: var(--text); overflow-wrap: anywhere; }
.sd-meta { flex: none; max-width: 42%; font-size: var(--fs-caption); color: var(--text-3); overflow-wrap: anywhere; }
.sd-extra { flex: none; font-size: var(--fs-caption); color: var(--text-4); font-variant-numeric: tabular-nums; }
.sd-empty { padding: 18px 2px; font-size: var(--fs-caption); color: var(--text-4); line-height: 1.7; }
.sd-foot { flex: 1; min-width: 0; font-size: var(--fs-micro); color: var(--text-4); }
.sd-btn { border: 1px solid var(--border); background: var(--surface); color: var(--text-2); border-radius: var(--radius-sm); padding: 5px 14px; font-size: var(--fs-sub); font-weight: 600; font-family: inherit; cursor: pointer; }
.sd-btn:hover { border-color: var(--border-strong); color: var(--text); }
</style>
