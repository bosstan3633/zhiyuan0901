<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue'
import Modal from '@/shared/components/Modal.vue'
import Icon from '@/shared/components/Icon.vue'
import type { AssetMeta } from '@/shared/models'
import { getAssetBlob, putAsset } from '@/shared/storage/assets'
import { showToast } from '@/shared/components/toast'

const props = defineProps<{
  open: boolean
  asset: AssetMeta | null
  remoteDownloader?: (meta: AssetMeta) => Promise<Blob | null>
}>()
const emit = defineEmits<{ close: [] }>()

const url = ref('')
const loading = ref(false)
const failed = ref('')
let objectUrl = ''

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
  if (!props.open || !props.asset) return
  loading.value = true
  try {
    let blob = await getAssetBlob(props.asset.id)
    if (!blob && props.remoteDownloader) {
      blob = await props.remoteDownloader(props.asset)
      if (blob) await putAsset(props.asset.id, blob).catch(() => {})
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

watch(() => [props.open, props.asset?.id], load, { immediate: true })
onBeforeUnmount(revoke)

function openExternal(): void {
  if (!url.value) return
  window.open(url.value, '_blank', 'noopener,noreferrer')
}

function download(): void {
  if (!url.value || !props.asset) return
  const a = document.createElement('a')
  a.href = url.value
  a.download = props.asset.name || 'attachment'
  a.click()
}

function copyName(): void {
  if (!props.asset) return
  void navigator.clipboard?.writeText(props.asset.name).then(
    () => showToast('附件名已复制'),
    () => showToast('复制失败'),
  )
}
</script>

<template>
  <Modal :open="open" width="min(1120px, 94vw)" height="88vh" @close="emit('close')">
    <template #title>
      <Icon :name="asset?.kind === 'image' ? 'image' : asset?.kind === 'pdf' ? 'book' : 'filetext'" :size="15"/>
      <span class="capm-name">{{ asset?.name || '附件预览' }}</span>
    </template>
    <template #title-extra>
      <span v-if="asset" class="capm-meta">{{ asset.kind === 'image' ? '图片' : asset.kind === 'pdf' ? 'PDF' : 'HTML' }} · {{ fmtSize(asset.size) }}</span>
      <button type="button" class="capm-tool" :disabled="!url" @click="openExternal"><Icon name="external" :size="12"/> 新标签打开</button>
      <button type="button" class="capm-tool" :disabled="!url" @click="download"><Icon name="download" :size="12"/> 下载</button>
      <button type="button" class="capm-tool" :disabled="!asset" @click="copyName"><Icon name="copy" :size="12"/> 复制文件名</button>
    </template>
    <div class="capm-stage" :data-kind="asset?.kind">
      <div v-if="loading" class="capm-state">正在读取附件…</div>
      <div v-else-if="failed" class="capm-state error">{{ failed }}</div>
      <img v-else-if="asset?.kind === 'image' && url" :src="url" :alt="asset.name" />
      <iframe v-else-if="asset?.kind === 'html' && url" :src="url" :title="asset.name"
        sandbox="allow-scripts" referrerpolicy="no-referrer"></iframe>
      <iframe v-else-if="asset?.kind === 'pdf' && url" :src="url" :title="asset.name"></iframe>
    </div>
  </Modal>
</template>

<style scoped>
.capm-name { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.capm-meta { color: var(--text-3); font-size: var(--fs-caption); white-space: nowrap; }
.capm-tool { min-height: 28px; display: inline-flex; align-items: center; gap: 4px; padding: 4px 8px; border: 1px solid var(--border); border-radius: 6px; background: var(--surface); color: var(--text-2); font: inherit; font-size: var(--fs-caption); cursor: pointer; }
.capm-tool:hover:not(:disabled) { border-color: var(--accent); color: var(--accent-ink); }
.capm-tool:disabled { opacity: var(--opacity-disabled); cursor: not-allowed; }
.capm-stage { min-height: 360px; height: 100%; display: flex; align-items: center; justify-content: center; overflow: auto; border: 1px solid var(--border); border-radius: 10px; background: var(--surface-2); }
.capm-stage img { display: block; max-width: 100%; max-height: 100%; object-fit: contain; }
.capm-stage iframe { display: block; width: 100%; height: 100%; min-height: 560px; border: 0; background: #fff; }
.capm-state { padding: 40px; color: var(--text-3); font-size: var(--fs-body); text-align: center; }
.capm-state.error { color: var(--danger); }
</style>
