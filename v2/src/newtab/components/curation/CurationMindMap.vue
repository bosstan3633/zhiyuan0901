<script setup lang="ts">
/**
 * V3.9.8 策展画布：金字塔 / 树状共享同一份 Category 父子树。
 * 新建、同级、就地编辑、拖拽校验与持久化由 useCurationMindMap 收口。
 */
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import Icon from '@/shared/components/Icon.vue'
import EmptyState from '@/shared/components/EmptyState.vue'
import CurationMindNode from './CurationMindNode.vue'
import { setOverlayFsHost } from '@/shared/utils/overlayHost'
import type { Category, ResourceCard } from '@/shared/models'
import type { CurationCanvasLayout } from '@/newtab/composables/useCurationMindMap'

const props = defineProps<{
  layout: CurationCanvasLayout
  thesis: ResourceCard | null
  nodes: Category[]
  roots: Category[]
  selectedId: string
  editRequestId: string
  editRequestSeq: number
  cardsByCat: Map<string, ResourceCard[]>
  searchQuery: string
  selectedLabel: string
  selectedLevel: number
  selectedCardCount: number
  nodeCount: number
  linkedResourceCount: number
  keyboardDragHint: string
  keyboardDragSource: string
  keyboardDragTarget: string
  revealId: string
  fullscreen: boolean
  fullscreenFallback: boolean
}>()

const emit = defineEmits<{
  'update:layout': [layout: CurationCanvasLayout]
  select: [id: string]
  'create-child': [id: string]
  'create-sibling': [id: string]
  rename: [node: Category, value: string]
  'update-description': [node: Category, value: string]
  'link-resource': [node: Category]
  'unlink-resource': [nodeId: string, card: ResourceCard]
  'open-resource': [card: ResourceCard]
  'open-resource-link': [card: ResourceCard]
  'open-resource-context': [event: MouseEvent, card: ResourceCard]
  'open-thesis': []
  'open-create-thesis': []
  move: [sourceId: string, targetId: string]
  cut: [id: string]
  paste: [id: string]
  'keyboard-drag-start': [id: string]
  'keyboard-drag-target': [dir: -1 | 1]
  'keyboard-drag-confirm': []
  'keyboard-drag-cancel': []
  'remove-node': [id: string]
  'update:fullscreen': [payload: { on: boolean; fallback: boolean }]
}>()

const dragSource = ref('')
const dropTarget = ref('')
const dropInvalid = ref(false)
const dropHint = ref('')
const canvasRef = ref<HTMLElement | null>(null)
const shellRef = ref<HTMLElement | null>(null)
const localFallback = ref(false)

/* V3.9.14：树状连线改用真实节点坐标生成 SVG 正交折线。
   父子分支在 DOM 里是横向 flex，但父节点与子节点并非天然同高；用伪元素固定
   top: 50% 只能得到“差不多”，多级之后会出现断线或把隶属关系指错。这里在布局
   完成后读取父节点右缘与每个直接子节点左缘，画「父右 → 中线 → 子左」的 elbow，
   因此 L1–L4、节点高度变化、资源 chip 增减都会重新对齐。 */
interface Connector { d: string }
const connectors = ref<Connector[]>([])
const connectorSize = ref({ width: 0, height: 0 })
let connectorRaf = 0
let connectorObserver: ResizeObserver | null = null
let connectorStage: HTMLElement | null = null

function childrenOf(id: string): Category[] {
  return props.nodes.filter(n => (n.parentId || '') === id).sort((a, b) => a.order - b.order)
}

function levelOf(node: Category): number {
  let out = 2
  let cur = node
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

function subtreeHeight(id: string): number {
  const kids = childrenOf(id)
  return kids.length ? 1 + Math.max(...kids.map(k => subtreeHeight(k.id))) : 1
}

function validate(sourceId: string, targetId: string): { ok: boolean; message: string } {
  if (!sourceId || !targetId) return { ok: false, message: '请选择一个可移动分支' }
  if (sourceId === targetId) return { ok: false, message: '不能移动到自身' }
  const source = props.nodes.find(n => n.id === sourceId)
  if (!source) return { ok: false, message: '被拖分支不存在' }
  const descendants = new Set<string>()
  const collect = (id: string) => {
    for (const child of childrenOf(id)) {
      if (descendants.has(child.id)) continue
      descendants.add(child.id)
      collect(child.id)
    }
  }
  collect(sourceId)
  if (descendants.has(targetId)) return { ok: false, message: '不能移动到自己的子分支下' }
  const target = targetId === 'root' ? null : props.nodes.find(n => n.id === targetId)
  if (targetId !== 'root' && !target) return { ok: false, message: '目标分支不存在' }
  const targetLevel = target ? levelOf(target) : 1
  const deepest = targetLevel + subtreeHeight(sourceId)
  if (deepest > 4) return { ok: false, message: `移动后会到 L${deepest}，超过 4 级上限` }
  return { ok: true, message: targetId === 'root' ? '松手后升为一级分支' : `松手后挂到「${target?.name || '未命名分支'}」下` }
}

function onDragStart(id: string): void {
  dragSource.value = id
  emit('select', id)
}

function onDragOver(e: DragEvent, id: string): void {
  if (!dragSource.value) return
  const check = validate(dragSource.value, id)
  e.preventDefault()
  if (e.dataTransfer) e.dataTransfer.dropEffect = check.ok ? 'move' : 'none'
  dropTarget.value = id
  dropInvalid.value = !check.ok
  dropHint.value = check.message
}

function onDrop(e: DragEvent, id: string): void {
  e.preventDefault()
  const source = dragSource.value
  const check = validate(source, id)
  clearDrag()
  if (check.ok) emit('move', source, id)
}

function clearDrag(): void {
  dragSource.value = ''
  dropTarget.value = ''
  dropInvalid.value = false
  dropHint.value = ''
}

function onRootKeydown(e: KeyboardEvent): void {
  const target = e.target as HTMLElement | null
  const tag = target?.tagName || ''
  if (/^(INPUT|TEXTAREA|SELECT|BUTTON|A)$/.test(tag) || target?.isContentEditable) return
  if (['ArrowUp', 'ArrowDown', 'ArrowRight', 'Home', 'End'].includes(e.key)) {
    e.preventDefault()
    navigateMindNode(e.key, 'root')
    return
  }
  if (e.key === 'ArrowLeft') {
    e.preventDefault()
    return
  }
  if (e.key !== 'Tab' && e.key !== 'Enter') return
  e.preventDefault()
  emit('create-child', 'root')
}

/** 空间树导航只移动焦点，不改变 Tab/Enter 的建支语义。 */
function visibleMindNodes(): HTMLElement[] {
  return [...(canvasRef.value?.querySelectorAll<HTMLElement>('[data-mind-node]') || [])]
}

function focusMindNode(id: string): void {
  const node = canvasRef.value?.querySelector<HTMLElement>(`[data-mind-node="${CSS.escape(id)}"]`)
  if (!node) return
  node.focus({ preventScroll: true })
  node.scrollIntoView({ block: 'nearest', inline: 'nearest' })
}

function navigateMindNode(key: string, currentId: string): void {
  const nodes = visibleMindNodes()
  const current = nodes.findIndex(node => node.dataset.mindNode === currentId)
  if (current < 0) return
  if (key === 'Home') {
    focusMindNode(nodes[0]?.dataset.mindNode || 'root')
    return
  }
  if (key === 'End') {
    const last = nodes[nodes.length - 1]?.dataset.mindNode
    if (last) focusMindNode(last)
    return
  }
  if (key === 'ArrowUp' || key === 'ArrowDown') {
    const next = nodes[current + (key === 'ArrowUp' ? -1 : 1)]?.dataset.mindNode
    if (next) focusMindNode(next)
    return
  }
  if (currentId === 'root') {
    const firstChild = props.roots[0]?.id
    if (firstChild) focusMindNode(firstChild)
    return
  }
  const node = props.nodes.find(n => n.id === currentId)
  if (!node) return
  const firstChild = childrenOf(currentId)[0]?.id
  const target = key === 'ArrowRight' ? firstChild : (node.parentId || 'root')
  if (target) focusMindNode(target)
}

function onNodeFocusRequest(key: string, id: string): void {
  navigateMindNode(key, id)
}

watch(() => props.layout, () => {
  nextTick(() => canvasRef.value?.scrollTo({ top: 0, left: 0 }))
})

const layoutLabel = computed(() => props.layout === 'pyramid' ? '金字塔' : '树状')

function onCanvasKeydown(e: KeyboardEvent): void {
  // 节点已处理 Tab/Enter/剪切/粘贴时不再冒泡到画布执行第二遍。
  if (e.defaultPrevented) return
  if (e.key === 'Escape') {
    if (dragSource.value) {
      e.preventDefault()
      clearDrag()
      return
    }
    if (props.keyboardDragSource) {
      e.preventDefault()
      emit('keyboard-drag-cancel')
    }
    return
  }
  const target = e.target as HTMLElement | null
  if (target?.closest('input,textarea,select,[contenteditable="true"]')) return
  if (!(e.metaKey || e.ctrlKey)) return
  if (e.key.toLowerCase() === 'x' && props.selectedId !== 'root') {
    e.preventDefault()
    emit('cut', props.selectedId)
  } else if (e.key.toLowerCase() === 'v' && props.selectedId) {
    e.preventDefault()
    emit('paste', props.selectedId)
  }
}

function scheduleTreeConnectors(): void {
  cancelAnimationFrame(connectorRaf)
  connectorRaf = requestAnimationFrame(syncTreeConnectors)
}

function syncTreeConnectors(): void {
  if (props.layout !== 'tree') {
    connectors.value = []
    connectorSize.value = { width: 0, height: 0 }
    connectorObserver?.disconnect()
    connectorObserver = null
    connectorStage = null
    return
  }
  const stage = canvasRef.value?.querySelector<HTMLElement>('.mind-stage')
  if (!stage) return
  const sr = stage.getBoundingClientRect()
  const next: Connector[] = []
  const branches = [...stage.querySelectorAll<HTMLElement>('[data-mind-branch]')]

  for (const branch of branches) {
    const parent = branch.querySelector<HTMLElement>(':scope > .mind-node')
    const children = branch.querySelector<HTMLElement>(':scope > .mind-children')
    if (!parent || !children) continue
    const pr = parent.getBoundingClientRect()
    // 端点咬进节点 1px，抵消亚像素取整和抗锯齿造成的发丝缝。
    const px = pr.right - sr.left - 1
    const py = pr.top - sr.top + pr.height / 2
    for (const child of children.querySelectorAll<HTMLElement>(':scope > .mind-branch')) {
      const childNode = child.querySelector<HTMLElement>(':scope > .mind-node')
      if (!childNode) continue
      const cr = childNode.getBoundingClientRect()
      const cx = cr.left - sr.left + 1
      const cy = cr.top - sr.top + cr.height / 2
      const mx = px + Math.max(18, (cx - px) / 2)
      next.push({ d: `M ${px} ${py} H ${mx} V ${cy} H ${cx}` })
    }
  }

  connectors.value = next
  connectorSize.value = { width: Math.ceil(sr.width), height: Math.ceil(sr.height) }
  if (!connectorObserver || connectorStage !== stage) {
    connectorObserver?.disconnect()
    connectorObserver = new ResizeObserver(scheduleTreeConnectors)
    connectorStage = stage
    // 容器与每个节点都观察：标题换行、资源 chip 增减、搜索高亮都不改容器尺寸。
    for (const node of stage.querySelectorAll<HTMLElement>('.mind-node')) connectorObserver.observe(node)
    for (const childGroup of stage.querySelectorAll<HTMLElement>('.mind-children')) connectorObserver.observe(childGroup)
    connectorObserver.observe(stage)
  }
}

watch(
  () => [props.layout, props.nodes, props.cardsByCat, props.searchQuery, props.selectedId, props.editRequestSeq],
  () => nextTick(scheduleTreeConnectors),
  { deep: true }
)

function syncOverlayHost(): void {
  setOverlayFsHost(props.fullscreen ? shellRef.value : null)
}

async function enterFullscreen(): Promise<void> {
  const el = shellRef.value
  if (!el) return
  if (typeof el.requestFullscreen === 'function') {
    try {
      await el.requestFullscreen()
      localFallback.value = false
      emit('update:fullscreen', { on: true, fallback: false })
      return
    } catch { /* 浏览器策略拒绝时退化为覆盖层 */ }
  }
  localFallback.value = true
  emit('update:fullscreen', { on: true, fallback: true })
}

function exitFullscreen(): void {
  setOverlayFsHost(null)
  if (localFallback.value) {
    localFallback.value = false
    emit('update:fullscreen', { on: false, fallback: false })
    return
  }
  if (document.fullscreenElement) {
    void document.exitFullscreen().catch(() => emit('update:fullscreen', { on: false, fallback: false }))
  } else {
    emit('update:fullscreen', { on: false, fallback: false })
  }
}

function toggleFullscreen(): void {
  if (props.fullscreen) exitFullscreen()
  else void enterFullscreen()
}

function onFullscreenChange(): void {
  scheduleTreeConnectors()
  const on = !!document.fullscreenElement
  if (on) {
    localFallback.value = false
    emit('update:fullscreen', { on: true, fallback: false })
  } else if (!localFallback.value) {
    emit('update:fullscreen', { on: false, fallback: false })
  }
}

function onFallbackKeydown(e: KeyboardEvent): void {
  if (e.key === 'Escape' && props.fullscreen && props.fullscreenFallback) {
    e.preventDefault()
    exitFullscreen()
  }
}

watch(() => props.fullscreen, () => nextTick(syncOverlayHost))

function onViewportResize(): void { scheduleTreeConnectors() }

onMounted(() => {
  document.addEventListener('fullscreenchange', onFullscreenChange)
  document.addEventListener('keydown', onFallbackKeydown)
  window.addEventListener('resize', onViewportResize)
  if (document.fonts) void document.fonts.ready.then(scheduleTreeConnectors)
  nextTick(scheduleTreeConnectors)
})

onBeforeUnmount(() => {
  cancelAnimationFrame(connectorRaf)
  connectorObserver?.disconnect()
  connectorObserver = null
  document.removeEventListener('fullscreenchange', onFullscreenChange)
  document.removeEventListener('keydown', onFallbackKeydown)
  window.removeEventListener('resize', onViewportResize)
  connectorStage = null
  setOverlayFsHost(null)
  if (document.fullscreenElement) void document.exitFullscreen().catch(() => { /* 卸载后浏览器可能已退出 */ })
})
</script>

<template>
  <section ref="shellRef" class="mindmap-shell" :class="{ 'is-fullscreen': fullscreen, 'is-fs-fallback': fullscreenFallback }"
    aria-label="策展思维导图" @keydown="onCanvasKeydown">
    <div class="mindmap-bar">
      <div class="mindmap-title">
        <span class="mindmap-title-icon"><Icon name="tree" :size="15"/></span>
        <span>
          <b>策展画布</b>
          <small>中心论点 → 论据分支 → 资源证据</small>
        </span>
      </div>
      <div class="mindmap-bar-spacer"></div>
      <!-- 普通视图的布局入口唯一归页头行动条。画布进入真全屏后页头不可见，
           这里才补一个全屏专用切换，避免用户失去布局能力。 -->
      <div v-if="fullscreen" class="mindmap-layout" role="group" aria-label="切换画布布局">
        <button type="button" :class="{ on: layout === 'pyramid' }" title="金字塔：向下展开，适合阅读与演示"
          @click="$emit('update:layout', 'pyramid')"><Icon name="layers" :size="13"/> 金字塔</button>
        <button type="button" :class="{ on: layout === 'tree' }" title="树状：向右展开，适合密集整理"
          @click="$emit('update:layout', 'tree')"><Icon name="branch" :size="13"/> 树状</button>
      </div>
      <div class="mindmap-selection" :class="{ muted: selectedId === 'root' }" aria-live="polite">
        <span>当前</span>
        <b>L{{ selectedLevel }} · {{ selectedLabel }}</b>
        <span v-if="selectedId !== 'root'">{{ selectedCardCount }} 张资源</span>
        <span v-else>{{ nodeCount }} 个分支 · {{ linkedResourceCount }} 张已挂资源</span>
      </div>
      <button class="mindmap-action" type="button" :aria-pressed="fullscreen"
        :title="fullscreen ? '退出全屏（Esc）' : '全屏编辑策展画布'" @click="toggleFullscreen">
        <Icon name="fullscreen" :size="12"/> {{ fullscreen ? '退出全屏' : '全屏' }}
      </button>
    </div>
    <div class="mindmap-help" aria-label="思维导图快捷操作">
      <span><kbd>Tab</kbd> 创建子分支</span>
      <span><kbd>Enter</kbd> 创建同级</span>
      <span><kbd>拖拽</kbd> 移动整棵子树</span>
      <span><kbd>⌘/Ctrl+X</kbd> 剪切</span>
      <span><kbd>⌘/Ctrl+V</kbd> 粘贴为子级</span>
      <span><kbd>↑↓←→</kbd> 节点导航</span>
      <span><kbd>双击</kbd> 就地编辑</span>
      <span><kbd>↑↓ + M</kbd> 键盘移动</span>
      <span class="mindmap-help-spacer"></span>
      <span class="mindmap-layout-note">{{ layoutLabel }}布局 · 同一份论证结构</span>
    </div>
    <div v-if="keyboardDragHint" class="mindmap-keyboard-hint" role="status">
      <Icon name="arrowupdown" :size="12"/> {{ keyboardDragHint }}
    </div>
    <div ref="canvasRef" class="mindmap-canvas" :data-layout="layout" tabindex="-1" @dragend="clearDrag">
      <div class="mind-stage">
        <svg v-if="layout === 'tree'" class="mind-connectors" :width="connectorSize.width"
          :height="connectorSize.height" :viewBox="`0 0 ${connectorSize.width} ${connectorSize.height}`"
          aria-hidden="true" focusable="false">
          <path v-for="(line, i) in connectors" :key="i" :d="line.d" />
        </svg>
        <div class="mind-branch mind-root-branch" data-mind-branch="root">
          <article class="mind-node mind-root" :class="{ selected: selectedId === 'root' }" data-mind-node="root"
            tabindex="0" aria-label="L1 中心论点" @click="emit('select', 'root')"
            @keydown="onRootKeydown"
            @dragover="onDragOver($event, 'root')" @dragleave="dropTarget = ''" @drop="onDrop($event, 'root')">
            <div class="mind-node-head">
              <span class="mind-level">L1</span>
              <span class="mind-type">中心论点 · 论点卡</span>
              <span class="mind-drag root-lock" title="中心论点固定为根节点">
                <Icon name="landmark" :size="14"/>
              </span>
            </div>
            <template v-if="thesis">
              <button class="mind-title thesis-title-button" type="button" @click.stop="emit('open-thesis')">
                {{ thesis.title }}
              </button>
              <button v-if="thesis.description" class="mind-desc thesis-desc-button" type="button" @click.stop="emit('open-thesis')">
                {{ thesis.description }}
              </button>
              <p v-else class="mind-desc muted">点击打开论点卡，补一句核心判断的展开说明。</p>
            </template>
            <button v-else class="mind-thesis-empty" type="button" @click.stop="emit('open-create-thesis')">
              <Icon name="landmark" :size="15"/>
              <span><b>确立中心论点</b><small>先写结论，再长出支撑分支</small></span>
            </button>
            <div class="mind-node-foot">
              <button v-if="thesis" class="mind-add" type="button" @click.stop="emit('open-thesis')">
                <Icon name="filetext" :size="13"/> 论点卡详情
              </button>
              <span class="mind-foot-spacer"></span>
              <span class="mind-shortcut"><kbd>Tab</kbd> 创建二级分支</span>
            </div>
          </article>
          <div v-if="roots.length" class="mind-children">
            <CurationMindNode v-for="node in roots" :key="node.id" :node="node" :nodes="nodes"
              :selected-id="selectedId" :edit-request-id="editRequestId" :edit-request-seq="editRequestSeq"
              :cards-by-cat="cardsByCat" :search-query="searchQuery"
              :keyboard-drag-source="keyboardDragSource" :keyboard-drag-target="keyboardDragTarget"
              :reveal-id="revealId"
              :drop-target="dropTarget" :drop-invalid="dropInvalid" :drop-hint="dropHint"
              :drag-source="dragSource"
              @select="emit('select', $event)" @create-child="emit('create-child', $event)"
              @create-sibling="emit('create-sibling', $event)" @rename="(n, v) => emit('rename', n, v)"
              @update-description="(n, v) => emit('update-description', n, v)"
              @link-resource="emit('link-resource', $event)"
              @unlink-resource="(nodeId, card) => emit('unlink-resource', nodeId, card)"
              @open-resource="emit('open-resource', $event)"
              @open-resource-link="emit('open-resource-link', $event)"
              @open-resource-context="(e, card) => emit('open-resource-context', e, card)"
              @drag-start="onDragStart" @drag-over="onDragOver" @drag-leave="dropTarget = ''" @drop="onDrop"
              @keyboard-drag-start="emit('keyboard-drag-start', $event)"
              @keyboard-drag-target="emit('keyboard-drag-target', $event)"
              @keyboard-drag-confirm="emit('keyboard-drag-confirm')"
              @keyboard-drag-cancel="emit('keyboard-drag-cancel')"
              @focus-node="onNodeFocusRequest"
              @cut="emit('cut', $event)" @paste="emit('paste', $event)"
              @remove-node="emit('remove-node', $event)" />
          </div>
        </div>
      </div>
      <EmptyState v-if="thesis && !nodes.length" size="inline" icon="hexagon"
        title="中心论点下面还没有分支"
        desc="中心论点是结论，分支是支撑它的论据。"
        hint="选中中心论点后按 Tab，创建第一个二级分支。"
      />
      <EmptyState v-if="!thesis" icon="compass"
        title="先确立中心论点"
        desc="从一句可被反驳的判断出发，再把证据长成树。"
        hint="论点卡会固定为 L1，不参与拖拽。"
        action-label="＋ 写下中心论点" @action="emit('open-create-thesis')" />
    </div>
    <div class="mindmap-status">
      <span class="status-dot"></span>
      <span><b>{{ nodeCount }}</b> 个论证节点</span>
      <span><b>{{ linkedResourceCount }}</b> 张资源已挂到分支</span>
      <span class="mindmap-status-spacer"></span>
      <span>无资源叶节点会标为“缺证据”</span>
    </div>
  </section>
</template>

<style src="./curation.css"></style>
