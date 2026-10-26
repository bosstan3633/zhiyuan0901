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
import Icon from '@/shared/components/Icon.vue'
import { computed, onBeforeUnmount, ref } from 'vue'

export type ExportFmt = 'csv' | 'md' | 'png' | 'html'
const props = withDefaults(defineProps<{
  formats?: ExportFmt[]
  /** 菜单相对触发钮的对齐边。左上角入口用 start，避免向右溢出。 */
  align?: 'start' | 'end'
}>(), { formats: () => ['csv', 'md', 'png'], align: 'end' })
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
    <button class="dz-exp-trigger dz-btn sm" :aria-expanded="open" :title="`导出当前视图（${labels.join(' / ')}）`" @click="open = !open"><Icon name="download" :size="13"/> 导出</button>
    <div v-if="open" class="dz-exp-menu dz-exp" :class="props.align === 'start' ? 'align-start' : 'align-end'" role="menu">
      <button v-if="props.formats.includes('csv')" class="dz-exp-item" role="menuitem" @click="pick('csv')">▤ CSV 表格<span class="hint">Excel / Airtable 可开</span></button>
      <button v-if="props.formats.includes('md')" class="dz-exp-item" role="menuitem" @click="pick('md')">¶ 导出为 Markdown<span class="hint">贴进笔记即成形</span></button>
      <button v-if="props.formats.includes('png')" class="dz-exp-item" role="menuitem" @click="pick('png')">▦ PNG 图片<span class="hint">当前主题配色</span></button>
      <button v-if="props.formats.includes('html')" class="dz-exp-item" role="menuitem" @click="pick('html')">◈ 导出为 HTML<span class="hint">任何人浏览器打开即看</span></button>
    </div>
  </span>
</template>

<style scoped>
/* ExportMenu is hosted by task/curation/profile pages too. Keep its popup
   self-contained instead of relying on dashboard.css being imported. */
.dz-exp-trigger {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  min-height: 28px;
  padding: 3px 9px;
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-sm);
  background: var(--surface);
  color: var(--text-2);
  font: inherit;
  font-size: var(--fs-caption);
  cursor: pointer;
}
.dz-exp-trigger:hover {
  border-color: var(--accent);
  color: var(--accent);
}
.dz-exp-menu {
  position: absolute;
  top: calc(100% + 4px);
  z-index: 50;
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 208px;
  padding: 6px;
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-sm);
  background: var(--surface);
  box-shadow: var(--shadow);
}
.dz-exp-menu.align-end { right: 0; }
.dz-exp-menu.align-start { left: 0; }
.dz-exp-item {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
  padding: 7px 9px;
  border: 0;
  border-radius: var(--radius-xs);
  background: transparent;
  color: var(--text);
  font: inherit;
  font-size: var(--fs-sub);
  text-align: left;
  white-space: nowrap;
  cursor: pointer;
}
.dz-exp-item:hover {
  background: var(--surface-2);
  color: var(--accent-ink);
}
.dz-exp-item .hint {
  margin-left: auto;
  color: var(--text-4);
  font-size: var(--fs-caption);
}
</style>
