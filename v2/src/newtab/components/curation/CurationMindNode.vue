<script setup lang="ts">
/** 策展画布递归节点：金字塔与树状共用；数据只读，写入经事件回宿主 composable。 */
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import Icon from '@/shared/components/Icon.vue'
import CurationMindNode from './CurationMindNode.vue'
import type { Category, ResourceCard } from '@/shared/models'

const props = defineProps<{
  node: Category
  nodes: Category[]
  selectedId: string
  editRequestId: string
  editRequestSeq: number
  cardsByCat: Map<string, ResourceCard[]>
  searchQuery: string
  keyboardDragSource: string
  keyboardDragTarget: string
  revealId: string
  dragSource: string
  dropTarget: string
  dropInvalid: boolean
  dropHint: string
}>()

const emit = defineEmits<{
  select: [id: string]
  'create-child': [id: string]
  'create-sibling': [id: string]
  rename: [node: Category, value: string]
  'update-description': [node: Category, value: string]
  'link-resource': [node: Category]
  'open-resource': [card: ResourceCard]
  'open-resource-link': [card: ResourceCard]
  'open-resource-context': [event: MouseEvent, card: ResourceCard]
  'drag-start': [id: string]
  'drag-over': [event: DragEvent, id: string]
  'drag-leave': []
  drop: [event: DragEvent, id: string]
  'keyboard-drag-start': [id: string]
  'keyboard-drag-target': [dir: -1 | 1]
  'keyboard-drag-confirm': []
  'keyboard-drag-cancel': []
  'remove-node': [id: string]
}>()

const editingField = ref<'' | 'title' | 'desc'>('')
const titleDraft = ref('')
const descDraft = ref('')
const titleRef = ref<HTMLInputElement | null>(null)
const descRef = ref<HTMLTextAreaElement | null>(null)
let resourceClickTimer: ReturnType<typeof setTimeout> | null = null

function children(): Category[] {
  return props.nodes
    .filter(n => (n.parentId || '') === props.node.id)
    .sort((a, b) => a.order - b.order)
}

function level(): number {
  let out = 2
  let cur = props.node
  const seen = new Set<string>()
  while (cur.parentId && !seen.has(cur.id)) {
    seen.add(cur.id)
    const parent = props.nodes.find(n => n.id === cur.parentId)
    if (!parent) break
    out++
    cur = parent
  }
  return out
}

function cards(): ResourceCard[] {
  return props.cardsByCat.get(props.node.id) || []
}

const SOURCE_LABELS: Record<string, string> = {
  official: '官方',
  academic: '学术',
  media: '媒体',
  personal: '个人',
  'ai-tool': 'AI 工具',
  'own-work': '个人成果',
}

function searchNeedle(): string {
  return props.searchQuery.trim().toLowerCase().replace(/^#/, '')
}

function cardMatches(card: ResourceCard): boolean {
  const q = searchNeedle()
  if (!q) return false
  return [
    card.title,
    card.description,
    ...(card.tags || []),
    SOURCE_LABELS[card.sourceType || ''] || '',
  ].join(' ').toLowerCase().includes(q)
}

function isHit(): boolean {
  const q = searchNeedle()
  return !!q && (`${props.node.name} ${props.node.description || ''}`.toLowerCase().includes(q)
    || cards().some(cardMatches))
}

function beginEdit(field: 'title' | 'desc'): void {
  emit('select', props.node.id)
  editingField.value = field
  if (field === 'title') titleDraft.value = props.node.name
  else descDraft.value = props.node.description || ''
  nextTick(() => {
    const el = field === 'title' ? titleRef.value : descRef.value
    el?.focus()
    el?.select()
  })
}

function commitEdit(): void {
  const field = editingField.value
  if (!field) return
  const value = field === 'title' ? titleDraft.value : descDraft.value
  editingField.value = ''
  if (field === 'title') emit('rename', props.node, value)
  else emit('update-description', props.node, value)
}

function cancelEdit(): void {
  editingField.value = ''
}

function onEditKeydown(e: KeyboardEvent): void {
  if (e.key === 'Escape') {
    e.preventDefault()
    cancelEdit()
    return
  }
  if (e.key === 'Tab') {
    e.preventDefault()
    commitEdit()
    emit('create-child', props.node.id)
    return
  }
  if (e.key === 'Enter' && !e.shiftKey && editingField.value === 'title') {
    e.preventDefault()
    commitEdit()
    emit('create-sibling', props.node.id)
  }
}

function onNodeKeydown(e: KeyboardEvent): void {
  if (editingField.value) return
  const target = e.target as HTMLElement | null
  const tag = target?.tagName || ''
  if (/INPUT|TEXTAREA|SELECT|BUTTON|A/.test(tag) || target?.closest('button,a,[role="button"]')) return
  if (e.key === 'F2') {
    e.preventDefault()
    beginEdit('title')
    return
  }
  if (e.key === 'Tab') {
    e.preventDefault()
    emit('create-child', props.node.id)
  } else if (e.key === 'Enter') {
    e.preventDefault()
    emit('create-sibling', props.node.id)
  }
}

function onDragHandleKeydown(e: KeyboardEvent): void {
  if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
    e.preventDefault()
    if (props.keyboardDragSource !== props.node.id) emit('keyboard-drag-start', props.node.id)
    emit('keyboard-drag-target', e.key === 'ArrowUp' ? -1 : 1)
  } else if ((e.key === 'm' || e.key === 'M') && props.keyboardDragSource === props.node.id) {
    e.preventDefault()
    emit('keyboard-drag-confirm')
  } else if (e.key === 'Escape' && props.keyboardDragSource === props.node.id) {
    e.preventDefault()
    emit('keyboard-drag-cancel')
  }
}

function dragStart(e: DragEvent): void {
  e.stopPropagation()
  e.dataTransfer?.setData('text/plain', props.node.id)
  if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move'
  emit('drag-start', props.node.id)
}

function onResourceClick(card: ResourceCard): void {
  if (resourceClickTimer) {
    clearTimeout(resourceClickTimer)
    resourceClickTimer = null
    return
  }
  resourceClickTimer = setTimeout(() => {
    resourceClickTimer = null
    emit('open-resource', card)
  }, 260)
}

function onResourceDblClick(card: ResourceCard): void {
  if (resourceClickTimer) {
    clearTimeout(resourceClickTimer)
    resourceClickTimer = null
  }
  emit('open-resource-link', card)
}

watch(() => props.editRequestSeq, () => {
  if (props.editRequestId !== props.node.id) return
  beginEdit('title')
})

// 新建分支在数据写入后才挂载：只看 seq 变化会漏掉首次挂载，用户还得再点一次才能输入。
onMounted(() => {
  if (props.editRequestId !== props.node.id) return
  nextTick(() => beginEdit('title'))
})

onBeforeUnmount(() => {
  if (resourceClickTimer) clearTimeout(resourceClickTimer)
})
</script>

<template>
  <div class="mind-branch" :data-mind-branch="node.id">
    <article class="mind-node"
      :class="{
        selected: selectedId === node.id,
        revealed: revealId === node.id,
        dragging: dragSource === node.id,
        'search-hit': isHit(),
        'drop-target': dropTarget === node.id && !dropInvalid,
        'drop-invalid': dropTarget === node.id && dropInvalid,
        'keyboard-target': keyboardDragSource && keyboardDragTarget === node.id
      }"
      :data-mind-node="node.id" tabindex="0" :aria-label="`L${level()} ${node.name}`"
      @click="emit('select', node.id)" @keydown="onNodeKeydown"
      @dragover="emit('drag-over', $event, node.id)" @dragleave="emit('drag-leave')"
      @drop="emit('drop', $event, node.id)">
      <div class="mind-node-head">
        <span class="mind-level">L{{ level() }}</span>
        <span class="mind-type">{{ children().length ? `${children().length} 个子分支` : '论证节点' }}</span>
        <span class="mind-drag" draggable="true" tabindex="0" role="button"
          :aria-label="`拖动「${node.name || '未命名分支'}」调整归属`"
          title="拖动调整归属；聚焦后 ↑/↓ 选目标，M 确认" @dragstart="dragStart" @keydown.stop="onDragHandleKeydown">
          <Icon name="arrowupdown" :size="13"/>
        </span>
      </div>
      <input v-if="editingField === 'title'" ref="titleRef" v-model="titleDraft" class="mind-edit-title"
        placeholder="分支标题" @click.stop @keydown="onEditKeydown" @blur="commitEdit" />
      <button v-else class="mind-title" type="button" @click.stop="beginEdit('title')"
        @dblclick.stop="beginEdit('title')" :title="`单击编辑标题；双击同样进入编辑（F2）`">
        {{ node.name || '未命名分支' }}
      </button>
      <textarea v-if="editingField === 'desc'" ref="descRef" v-model="descDraft" class="mind-edit-desc"
        rows="2" placeholder="解释这个分支为什么成立（可选）" @click.stop @keydown="onEditKeydown" @blur="commitEdit" />
      <button v-else class="mind-desc" :class="{ muted: !node.description }" type="button" @click.stop="beginEdit('desc')">
        {{ node.description || '点击补充分支说明' }}
      </button>
      <div class="mind-resources">
        <button v-for="card in cards().slice(0, 2)" :key="card.id" class="mind-resource"
          :class="{ 'search-hit': cardMatches(card) }" type="button"
          :data-rid="card.id"
          :title="card.title + '；单击打开详情，双击打开链接，右键打开卡片菜单'"
          @click.stop="onResourceClick(card)"
          @dblclick.stop="onResourceDblClick(card)"
          @contextmenu.prevent.stop="emit('open-resource-context', $event, card)">
          <span class="mind-resource-dot" :data-source="card.sourceType || 'personal'"></span>
          {{ card.title.length > 13 ? card.title.slice(0, 13) + '…' : card.title }}
        </button>
        <button v-if="cards().length > 2" class="mind-resource-more" type="button"
          @click.stop="emit('link-resource', node)">+{{ cards().length - 2 }}</button>
        <button v-if="!children().length && !cards().length" class="evidence-gap"
          type="button" @click.stop="emit('link-resource', node)">
          <Icon name="alert" :size="12"/> 缺证据 · 关联
        </button>
      </div>
      <div class="mind-node-foot">
        <button class="mind-add" type="button" @click.stop="emit('create-child', node.id)">
          <Icon name="plus" :size="13"/> 子分支
        </button>
        <button class="mind-add" type="button" @click.stop="emit('link-resource', node)">
          <Icon name="link" :size="13"/> 关联资源
        </button>
        <button v-if="selectedId === node.id" class="mind-add danger" type="button"
          :disabled="children().length > 0 || cards().length > 0"
          :title="children().length ? '先移走或删除子分支' : cards().length ? '先解除节点下的资源关联' : '删除这个空分支'"
          @click.stop="emit('remove-node', node.id)">
          <Icon name="trash" :size="13"/> 删除
        </button>
        <span class="mind-foot-spacer"></span>
        <span v-if="selectedId === node.id" class="mind-shortcut"><kbd>Tab</kbd> 子级 · <kbd>Enter</kbd> 同级</span>
      </div>
      <span v-if="dropTarget === node.id" class="mind-drop-hint" :class="{ invalid: dropInvalid }">{{ dropHint }}</span>
    </article>
    <div v-if="children().length" class="mind-children">
      <CurationMindNode v-for="child in children()" :key="child.id" :node="child" :nodes="nodes"
        :selected-id="selectedId" :edit-request-id="editRequestId" :edit-request-seq="editRequestSeq"
        :cards-by-cat="cardsByCat" :search-query="searchQuery"
        :keyboard-drag-source="keyboardDragSource" :keyboard-drag-target="keyboardDragTarget"
        :reveal-id="revealId"
        :drop-target="dropTarget" :drop-invalid="dropInvalid" :drop-hint="dropHint"
        :drag-source="dragSource"
        @select="emit('select', $event)" @create-child="emit('create-child', $event)"
        @create-sibling="emit('create-sibling', $event)" @rename="(n, v) => emit('rename', n, v)"
        @update-description="(n, v) => emit('update-description', n, v)"
        @link-resource="emit('link-resource', $event)" @open-resource="emit('open-resource', $event)"
        @open-resource-link="emit('open-resource-link', $event)"
        @open-resource-context="(e, card) => emit('open-resource-context', e, card)"
        @drag-start="emit('drag-start', $event)" @drag-over="(e, id) => emit('drag-over', e, id)"
        @drag-leave="emit('drag-leave')" @drop="(e, id) => emit('drop', e, id)"
        @keyboard-drag-start="emit('keyboard-drag-start', $event)"
        @keyboard-drag-target="emit('keyboard-drag-target', $event)"
        @keyboard-drag-confirm="emit('keyboard-drag-confirm')"
        @keyboard-drag-cancel="emit('keyboard-drag-cancel')"
        @remove-node="emit('remove-node', $event)" />
    </div>
  </div>
</template>
