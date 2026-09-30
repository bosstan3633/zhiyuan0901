<script setup lang="ts">
/**
 * R3-Cc：三张卡（资源卡池 / 任务调度 / 好奇心培育）**批量栏的唯一实现**。
 *
 * 为什么只合这一条：R3-Cb 把选择与打标的语义收进 `useBatchSelect` 之后，三处批量栏的
 * 「已选 N · 全选 · 反选 · 标签输入 · 应用标签」已经是同一套 DOM，只差卡型专属动作按钮。
 * 留着三份的后果不是难看，是**会再漂回去**——C-b 修的那三条缺陷（假反选、退出不清空、
 * 先勾选才出栏）正是三份各写各的写出来的。
 *
 * 工具条那一排（搜索/视图/排序/筛选/列数/计数）**没有**收进来：三者的差异是值域不同
 * （任务有状态与分组下拉、好奇有状态胶囊计数、池有「待打标」），不是结构重复；
 * 强行一个组件只会把 `class` 变成动态绑定、让源码文本断言全部重指而实际重复没少。
 */
import { ref } from 'vue'

const props = withDefaults(defineProps<{
  size: number
  total: number
  allSelected: boolean
  unit?: string
  tagPh?: string
}>(), { unit: '项', tagPh: '加一个标签，回车应用' })

const emit = defineEmits<{
  (e: 'select-all'): void
  (e: 'invert'): void
  (e: 'apply-tag', tag: string): void
}>()

const draft = ref('')
function apply() {
  const t = draft.value.trim()
  if (!t || !props.size) return
  emit('apply-tag', t)
  draft.value = ''
}
defineExpose({ clearDraft: () => { draft.value = '' } })
</script>

<template>
  <div class="dkb-bar">
    <span class="dkb-count">已选 {{ size }} {{ unit }}</span>
    <button @click="emit('select-all')">{{ allSelected ? '取消全选' : '全选' }}</button>
    <button :disabled="!total" title="在当前过滤结果内反选" @click="emit('invert')">反选</button>
    <input v-model="draft" class="dkb-tagin" :placeholder="tagPh" @keydown.enter="apply">
    <button :disabled="!size" @click="apply">应用标签</button>
    <slot />
  </div>
</template>

<style scoped>
/* 底色取 accent-light：批量态要有"我在另一种模式里"的可见反馈（任务与好奇面板原本就是这档，池面板的 surface-2 与常态工具条同色、分不清） */
.dkb-bar { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; padding: 10px 14px; margin-bottom: 12px; border-radius: var(--radius-sm); background: var(--accent-light); color: var(--accent-ink); }
.dkb-count { font-size: var(--fs-sub); font-weight: 700; color: var(--accent); margin-right: 4px; font-variant-numeric: tabular-nums; }
.dkb-tagin { border: 1px solid var(--border); background: var(--surface); color: var(--text); border-radius: var(--radius-sm); padding: 4px 9px; font-size: var(--fs-sub); font-family: inherit; outline: none; width: 180px; }
.dkb-tagin:focus { border-color: var(--accent); }
/* 按钮样式自带而非走 btnClass 传面板类名：scoped 边界下父组件的 .mini-btn / .pcp-btn 根本选不到
   子组件模板里的节点，传类名只会得到一排浏览器默认按钮。这里按同一套令牌复刻，
   与槽内卡型动作按钮（父作用域，仍用 .mini-btn / .pcp-btn）外观一致。 */
.dkb-bar button { border: 1px solid var(--border); background: var(--surface); color: var(--text-2); border-radius: var(--radius-sm); padding: 4px 9px; font-size: var(--fs-caption); font-weight: 600; font-family: inherit; cursor: pointer; user-select: none; transition: all var(--dur); }
.dkb-bar button:hover:not(:disabled) { border-color: var(--accent); color: var(--accent); }
.dkb-bar button:disabled { opacity: var(--opacity-disabled); cursor: not-allowed; }
</style>
