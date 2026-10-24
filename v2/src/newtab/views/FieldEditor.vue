<script setup lang="ts">
/**
 * 字段设计编辑器（B15 重写 · 第卌轮 REQ-049 目录化）
 * 标准模板绑定：显隐切换 / 拖拽排序 / 行内重命名 / 行内新增 / 删除确认。
 * - 第卌轮：删除手写 3 份×5 组常量（ICON_MAP/SYSTEM_KEYS/AUTO_KEYS/LOCKED_KEYS/REQUIRED_KEYS），
 *   系统字段存在性与规则改由 FIELD_CATALOG 单一目录推导（见 shared/models/catalog.ts）；
 * - 自定义字段（custom_*）跨三卡型共享：新增/重命名/删除自动同步到 crossFields 三区，
 *   保证「转卡无损 + 一张表管所有卡」的字段键与标签一致。
 */
import Icon from '@/shared/components/Icon.vue'
import { ref, computed } from 'vue'
import { useConfirm } from '@/shared/components/confirm'
import type { FieldDef } from '@/shared/models'
import { catalogMeta, type CardKind } from '@/shared/models/catalog'

const props = defineProps<{
  fields: FieldDef[]
  cardType: string
  /** 卡型分区引用（用于自定义字段跨型同步；R62-3 起 thesis 组可选） */
  crossFields?: Partial<Record<CardKind, FieldDef[]>>
}>()
const emit = defineEmits<{ change: []; notify: [string] }>()

const kind = computed<CardKind>(() => (props.cardType as CardKind) || 'resource')

const sorted = computed(() => [...props.fields].sort((a, b) => a.order - b.order))
const hintText = computed(() => props.cardType === 'resource'
  ? '标题与链接为必填基础字段；隐藏的字段在详情抽屉中仍可查看和编辑。字段顺序和显隐将同步应用于卡片、列表、看板三视图。'
  : '标题字段固定在第一位且不可隐藏；隐藏的字段在详情抽屉中仍可查看和编辑。')

function isCustom(f: FieldDef) { return f.key.startsWith('custom_') }
function catOf(f: FieldDef) { return isCustom(f) ? undefined : catalogMeta(kind.value, f.key) }

function fieldIcon(f: FieldDef) {
  if (isCustom(f)) return ''
  return catOf(f)?.icon || ''
}
function typeLabel(f: FieldDef) {
  if (f.key === 'description') return '长文本'
  const m: Record<string, string> = { text: '文本', select: '单选', date: '日期', tags: '多标签', number: '数字' }
  return m[f.type] || '文本'
}
function fieldCat(f: FieldDef): string {
  if (isCustom(f)) return 'custom'
  const cat = catOf(f)?.cat
  if (!cat) return 'optional'
  // locked 必填字段（标题/问题）以 required 呈现；其余按目录分类
  return cat
}
function catLabel(f: FieldDef) {
  const c = fieldCat(f)
  return c === 'required' ? '必填' : c === 'system' ? '系统' : c === 'auto' ? '自动' : c === 'custom' ? '自定义' : '可选'
}
function isLocked(f: FieldDef) { return !isCustom(f) && catOf(f)?.locked === true }
function canDelete(f: FieldDef) { if (isLocked(f)) return false; const c = fieldCat(f); return c !== 'system' && c !== 'auto' }
function canEdit(f: FieldDef) { return canDelete(f) }

/** 第卌轮：自定义字段同步目标数组 = 三卡型分区（无重复数组、不含 undefined） */
function crossArrays(): FieldDef[][] {
  if (!props.crossFields) return [props.fields]
  const arrs = Object.values(props.crossFields).filter(Boolean) as FieldDef[][]
  return arrs.length ? arrs : [props.fields]
}

// ---- 拖拽排序 ----
const dragIndex = ref(-1)
function onDragStart(i: number) { dragIndex.value = i }
function onDragOver(e: DragEvent) { e.preventDefault() }
function onDrop(i: number) {
  if (dragIndex.value < 0 || dragIndex.value === i) return
  if (isLocked(sorted.value[dragIndex.value])) return
  const list = sorted.value
  const [moved] = list.splice(dragIndex.value, 1)
  list.splice(i, 0, moved)
  list.forEach((f, idx) => { f.order = idx })
  dragIndex.value = -1
  emit('change'); emit('notify', '字段顺序已调整')
}
// ---- 显隐 ----
function toggleVisibility(f: FieldDef) {
  if (isLocked(f)) return
  f.visible = !f.visible
  emit('change'); emit('notify', f.visible ? `「${f.label}」已显示` : `「${f.label}」已隐藏`)
}
// ---- 行内新增（自定义字段跨三型共享） ----
const adding = ref(false)
const newName = ref('')
const newType = ref<'text' | 'tags' | 'date' | 'number' | 'select'>('text')
function startAdd() { adding.value = true; newName.value = ''; newType.value = 'text' }
function confirmAdd() {
  const name = newName.value.trim()
  if (!name) { adding.value = false; return }
  if (props.fields.some(f => f.label === name)) { emit('notify', '已存在同名字段'); return }
  const key = 'custom_' + Date.now().toString(36)
  for (const arr of crossArrays()) {
    if (arr.some(f => f.key === key)) continue
    const node: FieldDef = { key, label: name, type: newType.value, visible: true, order: arr.length }
    if (newType.value === 'select') node.options = ['是', '否']
    arr.push(node)
  }
  adding.value = false
  emit('change'); emit('notify', `已添加自定义字段「${name}」（三卡型共享）`)
}
// ---- 行内重命名（跨型同步 label） ----
const editingId = ref<string | null>(null)
const renameValue = ref('')
function startRename(f: FieldDef) {
  if (!canEdit(f)) return
  editingId.value = f.key
  renameValue.value = f.label
}
function confirmRename(f: FieldDef) {
  if (editingId.value !== f.key) return
  editingId.value = null
  const v = renameValue.value.trim()
  if (!v || v === f.label) return
  f.label = v
  for (const arr of crossArrays()) {
    const t = arr.find(x => x.key === f.key)
    if (t) t.label = v
  }
  emit('change'); emit('notify', '字段已重命名（三卡型同步）')
}
function cancelRename() { editingId.value = null }
// ---- 删除（跨型同步） ----
async function deleteField(f: FieldDef) {
  if (!canDelete(f)) return
  if (!(await useConfirm({ title: '删除字段', message: `确定删除字段「${f.label}」？将同步从三种卡片移除。`, confirmText: '确认删除' }))) return
  for (const arr of crossArrays()) {
    const idx = arr.findIndex(x => x.key === f.key)
    if (idx >= 0) arr.splice(idx, 1)
  }
  sorted.value.forEach((x, i) => { x.order = i })
  emit('change'); emit('notify', `字段「${f.label}」已删除（三卡型同步）`)
}
const vFocus = { mounted: (el: HTMLInputElement) => el.focus() }
</script>

<template>
  <div>
    <div class="gs-field-list">
      <div v-for="(f, i) in sorted" :key="f.key" class="gs-field-row"
        :class="{ dragging: dragIndex === i, locked: isLocked(f), editing: editingId === f.key }"
        :draggable="!isLocked(f) && editingId !== f.key"
        @dragstart="onDragStart(i)" @dragover.prevent="onDragOver($event)" @drop="onDrop(i)" @dragend="dragIndex = -1">
        <span class="gs-fr-drag" :class="{ disabled: isLocked(f) }">⋮⋮</span>
        <span class="gs-fr-icon">{{ fieldIcon(f) }}</span>
        <input v-if="editingId === f.key" v-model="renameValue" class="gs-fr-input" v-focus
          @keydown.enter.prevent="confirmRename(f)" @keydown.esc="cancelRename" @blur="confirmRename(f)">
        <span v-else class="gs-fr-name" :class="{ 'locked-title': isLocked(f) }"
          :title="canEdit(f) ? '双击重命名' : '系统字段不可重命名'" @dblclick="startRename(f)">{{ f.label }}</span>
        <span class="gs-fr-type" :class="fieldCat(f)">{{ typeLabel(f) }} · {{ catLabel(f) }}</span>
        <span class="gs-fr-visibility" v-pressable :aria-disabled="isLocked(f)" :class="[f.visible ? 'shown' : 'hidden', { disabled: isLocked(f) }]"
          :title="f.visible ? '点击隐藏' : '点击显示'" @click="toggleVisibility(f)"><Icon v-if="f.visible" name="eye" :size="13"/><Icon v-else name="eyeoff" :size="13"/></span>
        <span class="gs-fr-action" v-pressable :aria-disabled="!canEdit(f)" :class="{ disabled: !canEdit(f) }" title="重命名" @click="startRename(f)"><Icon name="edit" :size="13"/></span>
        <span class="gs-fr-action delete" v-pressable :aria-disabled="!canDelete(f)" :class="{ disabled: !canDelete(f) }" title="删除" @click="deleteField(f)"><Icon name="trash" :size="13"/></span>
      </div>
      <!-- 行内新增 -->
      <div v-if="adding" class="gs-field-row adding">
        <span class="gs-fr-icon"><Icon name="star" :size="13"/></span>
        <input v-model="newName" class="gs-fr-input" placeholder="字段名称" v-focus
          @keydown.enter.prevent="confirmAdd" @keydown.esc="adding = false">
        <select v-model="newType" class="gs-fr-select">
          <option value="text">文本</option>
          <option value="tags">多标签</option>
          <option value="date">日期</option>
          <option value="number">数字</option>
          <option value="select">单选</option>
        </select>
        <button class="gs-fr-btn confirm" @click="confirmAdd"><Icon name="check" :size="13"/> 确认</button>
        <button class="gs-fr-btn cancel" @click="adding = false">取消</button>
      </div>
      <div v-else class="gs-field-add" v-pressable @click="startAdd">＋ 添加自定义字段</div>
    </div>
    <div class="gs-field-hint"><Icon name="bulb" :size="13"/> {{ hintText }}</div>
  </div>
</template>

<style scoped>
.gs-fr-input { flex: 1; min-width: 0; border: 1px solid var(--accent); border-radius: 6px; padding: 5px 9px; font-size: var(--fs-body); font-family: inherit; outline: none; background: var(--surface); color: var(--text); box-shadow: 0 0 0 2px var(--accent-glow); }
.gs-fr-select { padding: 6px 10px; border-radius: 6px; border: 1px solid var(--border); background: var(--surface); font-size: var(--fs-sub); color: var(--text-2); cursor: pointer; outline: none; font-family: inherit; flex-shrink: 0; }
.gs-fr-btn { padding: 6px 14px; border-radius: 6px; border: 1px solid var(--border); background: var(--surface); font-size: var(--fs-sub); cursor: pointer; font-family: inherit; color: var(--text-2); flex-shrink: 0; }
.gs-fr-btn.confirm { background: var(--accent); color: #fff; border-color: var(--accent); }
.gs-fr-btn.confirm:hover { background: var(--accent-hover); }
.gs-fr-btn.cancel:hover { border-color: var(--border-strong); color: var(--text); }
.gs-field-row.editing { border-color: var(--accent); }
.gs-field-row.adding { border-color: var(--accent); background: var(--accent-light); }
.gs-fr-type.optional, .gs-fr-type.custom { background: var(--accent-light); color: var(--accent-ink); }
/* B18：迁入的字段行样式 */
.gs-field-list { display: flex; flex-direction: column; gap: 8px; }
/* D2R：模块化字段行（全宽卡片 + 右侧徽章操作簇） */
.gs-field-row { display: flex; align-items: center; gap: 12px; padding: 13px 18px; background: var(--surface); border: 1px solid var(--border); border-radius: 8px; box-shadow: 0 1px 2px rgba(0,0,0,.02); cursor: default; transition: all var(--dur); }
.gs-field-row:hover { border-color: color-mix(in srgb, var(--accent) 45%, var(--border)); box-shadow: 0 3px 12px color-mix(in srgb, var(--accent) 7%, transparent); transform: translateY(-1px); }
.gs-field-row.dragging { opacity: .4; border-style: dashed; transform: none; }
.gs-field-row.locked { background: var(--surface-2); }
.gs-fr-drag { color: var(--text-4); cursor: grab; font-size: var(--fs-body); flex-shrink: 0; width: 16px; text-align: center; line-height: 1; }
.gs-fr-drag.disabled { visibility: hidden; }
.gs-fr-icon { font-size: var(--fs-title); width: 22px; height: 22px; display: flex; align-items: center; justify-content: center; background: var(--surface-3); border-radius: 6px; flex-shrink: 0; }
.gs-fr-name { font-size: var(--fs-body); font-weight: 600; color: var(--text); flex: 1; min-width: 0; letter-spacing: .2px; }
.gs-fr-name.locked-title { color: var(--text); }
.gs-fr-type { font-size: var(--fs-caption); padding: 3px 10px; border-radius: 99px; background: var(--tag-neutral-bg); color: var(--tag-neutral-text); font-weight: 500; flex-shrink: 0; white-space: nowrap; }
.gs-fr-type.required { background: var(--tag-danger-bg); color: var(--tag-danger-text); }
.gs-fr-type.system { background: var(--tag-warn-bg); color: var(--tag-warn-text); }
.gs-fr-type.auto { background: var(--tag-info-bg); color: var(--tag-info-text); }
.gs-fr-visibility { width: 30px; height: 28px; display: flex; align-items: center; justify-content: center; border-radius: 6px; cursor: pointer; font-size: 14px; transition: all var(--dur); flex-shrink: 0; border: 1px solid transparent; }
.gs-fr-visibility.shown { color: var(--accent-ink); background: var(--accent-light); }
.gs-fr-visibility.hidden { color: var(--text-4); background: var(--surface-3); }
.gs-fr-visibility:hover { border-color: var(--accent); }
.gs-fr-visibility.disabled { cursor: not-allowed; opacity: .35; }
.gs-fr-action { width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; border-radius: 6px; cursor: pointer; font-size: var(--fs-body); color: var(--text-3); transition: all .1s; border: 1px solid transparent; }
.gs-fr-action:hover { background: var(--surface-3); color: var(--text); border-color: var(--border); }
.gs-fr-action.delete:hover { color: var(--danger); background: var(--tag-danger-bg); border-color: color-mix(in srgb, var(--danger) 30%, var(--border)); }
.gs-fr-action.disabled { opacity: .25; cursor: not-allowed; pointer-events: none; }
.gs-field-add { margin-top: 10px; padding: 14px; border: 1.5px dashed var(--border-strong); border-radius: 8px; text-align: center; cursor: pointer; font-size: var(--fs-body); color: var(--text-3); transition: all var(--dur); }
.gs-field-add:hover { border-color: var(--accent); color: var(--accent-ink); background: var(--accent-light); }
.gs-field-hint { margin-top: 12px; padding: 10px 14px; background: var(--accent-light); border-radius: 8px; font-size: var(--fs-sub); color: var(--accent-ink); line-height: 1.7; }

</style>
