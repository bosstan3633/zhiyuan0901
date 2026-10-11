<script setup lang="ts">
/**
 * R172-T12（04-67 F39）：导出菜单（复盘段与热力图段共用这一枚）。
 *
 * 两个细节是有原因的，不是顺手：
 *  · **右对齐锚定**（`right: 0`）：菜单出现在按钮正下方会顶出视口右缘（1440 / 1280 / 1100 三档实测），
 *     anchored 到右侧后最宽项也不越界 —— F39 的"不溢出视口"就是这么满足的；
 *  · **`v-if` 而非 `v-show`**：不开即零节点，不给仪表盘加常驻 DOM（R168-2 同一纪律）。
 *
 * W2（V3.8.2）：热力图整体迁调度台，导出口径收为「下载图片 + 分享 HTML」两项 ——
 * 复盘段仍是 CSV / Markdown / PNG 三件套（`formats` 默认值不变），热力图段传 `['png','html']`。
 * html 生成的是一份**自包含可分享页**（任何人浏览器打开即看这一年的热力图），见 exportView.heatmapShareHtml。
 */
import { computed, onBeforeUnmount, ref } from 'vue'

export type ExportFmt = 'csv' | 'md' | 'png' | 'html'
const props = withDefaults(defineProps<{ formats?: ExportFmt[] }>(), { formats: () => ['csv', 'md', 'png'] })
const emit = defineEmits<{ pick: [fmt: ExportFmt] }>()
const open = ref(false)
/** 按钮 title 用的中文名（只列本次真正提供的项，避免 title 多报一项） */
const LABELS: Record<ExportFmt, string> = { csv: 'CSV', md: 'Markdown', png: 'PNG', html: 'HTML' }
const labels = computed(() => props.formats.map(f => LABELS[f]))

function pick(f: ExportFmt): void {
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
    <button class="dz-btn sm" :aria-expanded="open" :title="`导出当前视图（${labels.join(' / ')}）`" @click="open = !open">⬇ 导出</button>
    <div v-if="open" class="dz-exp" role="menu">
      <button v-if="props.formats.includes('csv')" role="menuitem" @click="pick('csv')">▤ CSV 表格<span class="hint">Excel / Airtable 可开</span></button>
      <button v-if="props.formats.includes('md')" role="menuitem" @click="pick('md')">¶ Markdown 文档<span class="hint">贴进笔记即成形</span></button>
      <button v-if="props.formats.includes('png')" role="menuitem" @click="pick('png')">▦ PNG 图片<span class="hint">当前主题配色</span></button>
      <button v-if="props.formats.includes('html')" role="menuitem" @click="pick('html')">◈ HTML 分享页<span class="hint">任何人浏览器打开即看</span></button>
    </div>
  </span>
</template>
