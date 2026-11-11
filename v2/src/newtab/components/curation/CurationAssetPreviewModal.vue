<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import Modal from '@/shared/components/Modal.vue'
import Icon from '@/shared/components/Icon.vue'
import type { AssetMeta } from '@/shared/models'
import { getAssetBlob, putAsset } from '@/shared/storage/assets'
import { showToast } from '@/shared/components/toast'

const props = defineProps<{
  open: boolean
  asset: AssetMeta | null
  assets?: AssetMeta[]
  remoteDownloader?: (meta: AssetMeta) => Promise<Blob | null>
}>()
const emit = defineEmits<{ close: [] }>()

const url = ref('')
const loading = ref(false)
const failed = ref('')
const currentIndex = ref(0)
const zoom = ref(1)
const stageRef = ref<HTMLElement | null>(null)
const fullscreen = ref(false)
const fullscreenFallback = ref(false)
const panX = ref(0)
const panY = ref(0)
const dragging = ref(false)
let dragStartX = 0
let dragStartY = 0
let dragOriginX = 0
let dragOriginY = 0
let objectUrl = ''

const imageAssets = computed(() => (props.assets || []).filter(asset => asset.kind === 'image'))
const activeAsset = computed(() => {
  if (props.asset?.kind === 'image' && imageAssets.value.length) {
    return imageAssets.value[currentIndex.value] || props.asset
  }
  return props.asset
})
const canStep = computed(() => props.asset?.kind === 'image' && imageAssets.value.length > 1)

function fmtSize(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / 1024 / 1024).toFixed(1)} MB`
}

function revoke(): void {
  if (objectUrl) {
    try { URL.revokeObjectURL(objectUrl) } catch { /* noop */ }
    objectUrl = ''
  }
  url.value = ''
}

async function load(): Promise<void> {
  revoke()
  failed.value = ''
  const asset = activeAsset.value
  if (!props.open || !asset) return
  loading.value = true
  try {
    let blob = await getAssetBlob(asset.id)
    if (!blob && props.remoteDownloader) {
      blob = await props.remoteDownloader(asset)
      if (blob) await putAsset(asset.id, blob).catch(() => {})
    }
    if (!blob) {
      failed.value = '附件本体缺失，可能尚未同步到本机'
      return
    }
    objectUrl = URL.createObjectURL(blob)
    url.value = objectUrl
  } catch (error) {
    failed.value = error instanceof Error ? error.message : String(error)
  } finally {
    loading.value = false
  }
}

watch(() => [props.open, activeAsset.value?.id], load, { immediate: true })
watch(() => [props.open, props.asset?.id, props.assets?.map(asset => asset.id).join('|')], () => {
  const index = imageAssets.value.findIndex(asset => asset.id === props.asset?.id)
  currentIndex.value = index >= 0 ? index : 0
  zoom.value = 1
  panX.value = 0
  panY.value = 0
}, { immediate: true })

watch(() => [props.open, activeAsset.value?.id], () => {
  zoom.value = 1
  panX.value = 0
  panY.value = 0
  if (!props.open) {
    fullscreen.value = false
    fullscreenFallback.value = false
  }
}, { immediate: true })

function step(delta: number): void {
  if (!canStep.value) return
  const total = imageAssets.value.length
  currentIndex.value = (currentIndex.value + delta + total) % total
  zoom.value = 1
  panX.value = 0
  panY.value = 0
}

function setZoom(next: number): void {
  zoom.value = Math.min(4, Math.max(0.5, Math.round(next * 100) / 100))
  if (zoom.value <= 1) {
    panX.value = 0
    panY.value = 0
  }
}

function zoomIn(): void { setZoom(zoom.value + 0.25) }
function zoomOut(): void { setZoom(zoom.value - 0.25) }
function resetZoomAndPan(): void {
  zoom.value = 1
  panX.value = 0
  panY.value = 0
}
function resetZoom(): void { resetZoomAndPan() }

function onImagePointerDown(event: PointerEvent): void {
  if (zoom.value <= 1) return
  dragging.value = true
  dragStartX = event.clientX
  dragStartY = event.clientY
  dragOriginX = panX.value
  dragOriginY = panY.value
  ;(event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId)
  event.preventDefault()
}

function onImagePointerMove(event: PointerEvent): void {
  if (!dragging.value) return
  panX.value = dragOriginX + event.clientX - dragStartX
  panY.value = dragOriginY + event.clientY - dragStartY
}

function onImagePointerUp(event: PointerEvent): void {
  if (!dragging.value) return
  dragging.value = false
  ;(event.currentTarget as HTMLElement).releasePointerCapture?.(event.pointerId)
}

function syncFullscreen(): void {
  fullscreen.value = !!document.fullscreenElement && document.fullscreenElement === stageRef.value
  if (!document.fullscreenElement) fullscreenFallback.value = false
}

async function toggleFullscreen(): Promise<void> {
  if (!stageRef.value || !props.open) return
  if (document.fullscreenElement === stageRef.value) {
    await document.exitFullscreen().catch(() => {})
    return
  }
  if (typeof stageRef.value.requestFullscreen !== 'function') {
    fullscreenFallback.value = !fullscreenFallback.value
    fullscreen.value = fullscreenFallback.value
    return
  }
  try {
    await stageRef.value.requestFullscreen()
    fullscreen.value = true
  } catch {
    fullscreenFallback.value = !fullscreenFallback.value
    fullscreen.value = fullscreenFallback.value
  }
}

function onKeydown(event: KeyboardEvent): void {
  if (!props.open) return
  if (event.key === 'Escape' && fullscreenFallback.value) {
    fullscreenFallback.value = false
    fullscreen.value = false
    return
  }
  if (event.key === '+' || event.key === '=') {
    event.preventDefault(); zoomIn(); return
  }
  if (event.key === '-' || event.key === '_') {
    event.preventDefault(); zoomOut(); return
  }
  if (event.key === '0') {
    event.preventDefault(); resetZoom(); return
  }
  if (event.key.toLowerCase() === 'f') {
    event.preventDefault(); void toggleFullscreen(); return
  }
  if (!canStep.value) return
  if (event.key === 'ArrowLeft') {
    event.preventDefault()
    step(-1)
  } else if (event.key === 'ArrowRight') {
    event.preventDefault()
    step(1)
  }
}

onMounted(() => {
  window.addEventListener('keydown', onKeydown)
  document.addEventListener('fullscreenchange', syncFullscreen)
})
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown)
  document.removeEventListener('fullscreenchange', syncFullscreen)
  if (document.fullscreenElement === stageRef.value) void document.exitFullscreen().catch(() => {})
  revoke()
})

function openExternal(): void {
  if (!url.value) return
  window.open(url.value, '_blank', 'noopener,noreferrer')
}

function download(): void {
  if (!url.value || !activeAsset.value) return
  const a = document.createElement('a')
  a.href = url.value
  a.download = activeAsset.value.name || 'attachment'
  a.click()
}

function copyName(): void {
  if (!activeAsset.value) return
  void navigator.clipboard?.writeText(activeAsset.value.name).then(
    () => showToast('附件名已复制'),
    () => showToast('复制失败'),
  )
}
</script>

<template>
  <Modal :open="open" width="min(1120px, 94vw)" height="88vh" @close="emit('close')">
    <template #title>
      <Icon :name="activeAsset?.kind === 'image' ? 'image' : activeAsset?.kind === 'pdf' ? 'book' : 'filetext'" :size="15"/>
      <span class="capm-name">{{ activeAsset?.name || '附件预览' }}</span>
    </template>
    <template #title-extra>
      <span v-if="canStep" class="capm-counter">{{ currentIndex + 1 }} / {{ imageAssets.length }}</span>
      <span v-if="activeAsset" class="capm-meta">{{ activeAsset.kind === 'image' ? '图片' : activeAsset.kind === 'pdf' ? 'PDF' : 'HTML' }} · {{ fmtSize(activeAsset.size) }}</span>
      <template v-if="activeAsset?.kind === 'image'">
        <button type="button" class="capm-tool icon-only" title="缩小（-）" aria-label="缩小" @click="zoomOut"><Icon name="minus" :size="12"/></button>
    <button type="button" class="capm-tool icon-only" title="重置为适应窗口（0）" aria-label="重置缩放" @click="resetZoomAndPan">{{ Math.round(zoom * 100) }}%</button>
        <button type="button" class="capm-tool icon-only" title="放大（+）" aria-label="放大" @click="zoomIn"><Icon name="plus" :size="12"/></button>
        <button type="button" class="capm-tool icon-only" :title="fullscreen ? '退出全屏（Esc）' : '全屏浏览（F）'" :aria-pressed="fullscreen" @click="toggleFullscreen"><Icon name="fullscreen" :size="12"/></button>
      </template>
      <button type="button" class="capm-tool" :disabled="!url" @click="openExternal"><Icon name="external" :size="12"/> 新标签打开</button>
      <button type="button" class="capm-tool" :disabled="!url" @click="download"><Icon name="download" :size="12"/> 下载</button>
      <button type="button" class="capm-tool" :disabled="!activeAsset" @click="copyName"><Icon name="copy" :size="12"/> 复制文件名</button>
    </template>
    <div ref="stageRef" class="capm-stage" :class="{ 'is-fullscreen': fullscreen || fullscreenFallback, 'is-zoomed': zoom !== 1 }" :data-kind="activeAsset?.kind">
      <div v-if="loading" class="capm-state">正在读取附件…</div>
      <div v-else-if="failed" class="capm-state error">{{ failed }}</div>
      <div v-else-if="activeAsset?.kind === 'image' && url" class="capm-image-canvas"
        :class="{ 'is-dragging': dragging, 'can-drag': zoom > 1 }"
        @pointerdown="onImagePointerDown" @pointermove="onImagePointerMove" @pointerup="onImagePointerUp" @pointercancel="onImagePointerUp">
        <img :src="url" :alt="activeAsset.name" draggable="false" :style="{ transform: `translate(${panX}px, ${panY}px) scale(${zoom})` }" />
      </div>
      <iframe v-else-if="activeAsset?.kind === 'html' && url" :src="url" :title="activeAsset.name"
        sandbox="allow-scripts" referrerpolicy="no-referrer"></iframe>
      <iframe v-else-if="activeAsset?.kind === 'pdf' && url" :src="url" :title="activeAsset.name"></iframe>
      <button v-if="canStep" type="button" class="capm-step prev" title="上一张（←）" @click="step(-1)">
        <Icon name="arrowleft" :size="18"/>
      </button>
      <button v-if="canStep" type="button" class="capm-step next" title="下一张（→）" @click="step(1)">
        <Icon name="arrowright" :size="18"/>
      </button>
    </div>
  </Modal>
</template>

<style scoped>
.capm-name { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.capm-meta { color: var(--text-3); font-size: var(--fs-caption); white-space: nowrap; }
.capm-counter { padding: 2px 7px; border-radius: 999px; background: var(--accent-light); color: var(--accent-ink); font-size: var(--fs-micro); font-variant-numeric: tabular-nums; font-weight: 700; white-space: nowrap; }
.capm-tool { min-height: 28px; display: inline-flex; align-items: center; gap: 4px; padding: 4px 8px; border: 1px solid var(--border); border-radius: 6px; background: var(--surface); color: var(--text-2); font: inherit; font-size: var(--fs-caption); cursor: pointer; }
.capm-tool:hover:not(:disabled) { border-color: var(--accent); color: var(--accent-ink); }
.capm-tool:disabled { opacity: var(--opacity-disabled); cursor: not-allowed; }
.capm-tool.icon-only { min-width: 28px; justify-content: center; padding-inline: 6px; font-variant-numeric: tabular-nums; }
.capm-stage { position: relative; min-height: 360px; height: 100%; display: flex; align-items: center; justify-content: center; overflow: auto; border: 1px solid var(--border); border-radius: 10px; background: var(--surface-2); }
.capm-image-canvas { width: 100%; height: 100%; min-height: 360px; display: flex; align-items: center; justify-content: center; overflow: auto; padding: 18px; }
.capm-image-canvas img { display: block; max-width: 100%; max-height: 100%; object-fit: contain; transition: transform .16s ease; transform-origin: center; }
.capm-image-canvas.can-drag { cursor: grab; touch-action: none; }
.capm-image-canvas.is-dragging { cursor: grabbing; }
.capm-image-canvas.is-dragging img { transition: none; }
.capm-stage.is-fullscreen { position: fixed; inset: 0; z-index: calc(var(--z-modal) + 5); width: 100vw; height: 100vh; max-height: 100vh; border-radius: 0; border: 0; background: #111; }
.capm-stage.is-fullscreen .capm-image-canvas { min-height: 100%; }
.capm-stage.is-fullscreen .capm-image-canvas img { max-width: calc(100vw - 36px); max-height: calc(100vh - 36px); }
.capm-stage iframe { display: block; width: 100%; height: 100%; min-height: 560px; border: 0; background: #fff; }
.capm-state { padding: 40px; color: var(--text-3); font-size: var(--fs-body); text-align: center; }
.capm-state.error { color: var(--danger); }
.capm-step { position: absolute; top: 50%; z-index: 2; width: 38px; height: 52px; display: grid; place-items: center; transform: translateY(-50%); border: 1px solid var(--border); border-radius: 10px; background: color-mix(in srgb, var(--surface) 90%, transparent); color: var(--text); box-shadow: var(--shadow-sm); cursor: pointer; backdrop-filter: blur(8px); }
.capm-step:hover { border-color: var(--accent); color: var(--accent-ink); background: var(--accent-light); }
.capm-step.prev { left: 12px; }
.capm-step.next { right: 12px; }
</style>
