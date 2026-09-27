<script setup lang="ts">
/**
 * R172-T12（04-67 F39）：导出三件套菜单（复盘段与热力图段共用这一枚）。
 *
 * 两个细节是有原因的，不是顺手：
 *  · **右对齐锚定**（`right: 0`）：菜单出现在按钮正下方会顶出视口右缘（1440 / 1280 / 1100 三档实测），
 *     anchored 到右侧后最宽项也不越界 —— F39 的"不溢出视口"就是这么满足的；
 *  · **`v-if` 而非 `v-show`**：不开即零节点，不给仪表盘加常驻 DOM（R168-2 同一纪律）。
 */
import { onBeforeUnmount, ref } from 'vue'

const emit = defineEmits<{ pick: [fmt: 'csv' | 'md' | 'png'] }>()
const open = ref(false)

function pick(f: 'csv' | 'md' | 'png'): void {
  open.value = false
  emit('pick', f)
}
function onDoc(e: MouseEvent): void {
  if (!open.value) return
  if (!(e.target as HTMLElement).closest?.('.dz-exp-wrap')) open.value = false
}
function onKey(e: KeyboardEvent): void {
  if (e.key === 'Escape' && open.value) { open.value = false; e.stopPropagation() }
}
document.addEventListener('click', onDoc, true)
document.addEventListener('keydown', onKey, true)
onBeforeUnmount(() => {
  document.removeEventListener('click', onDoc, true)
  document.removeEventListener('keydown', onKey, true)
})
</script>

<template>
  <span class="dz-exp-wrap">
    <button class="dz-btn sm" :aria-expanded="open" title="导出当前视图（CSV / Markdown / PNG）" @click="open = !open">⬇ 导出</button>
    <div v-if="open" class="dz-exp" role="menu">
      <button role="menuitem" @click="pick('csv')">▤ CSV 表格<span class="hint">Excel / Airtable 可开</span></button>
      <button role="menuitem" @click="pick('md')">¶ Markdown 文档<span class="hint">贴进笔记即成形</span></button>
      <button role="menuitem" @click="pick('png')">▦ PNG 图片<span class="hint">当前主题配色</span></button>
    </div>
  </span>
</template>
