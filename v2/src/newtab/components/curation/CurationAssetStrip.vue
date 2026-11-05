<script setup lang="ts">
import { computed, ref } from 'vue'
import Icon from '@/shared/components/Icon.vue'
import CurationAssetThumb from './CurationAssetThumb.vue'
import type { AssetMeta } from '@/shared/models'

const props = withDefaults(defineProps<{
  assets: AssetMeta[]
  nodeId: string
  selected?: boolean
  maxVisible?: number
  remoteDownloader?: (meta: AssetMeta) => Promise<Blob | null>
}>(), {
  selected: false,
  maxVisible: 5,
  remoteDownloader: undefined,
})

const emit = defineEmits<{
  open: [asset: AssetMeta]
  remove: [asset: AssetMeta]
  ingest: [files: File[]]
}>()

const fileInput = ref<HTMLInputElement | null>(null)
const visible = computed(() => props.assets.slice(0, props.maxVisible))
const overflow = computed(() => Math.max(0, props.assets.length - visible.value.length))

function pickFiles(): void {
  fileInput.value?.click()
}

function onFilesChange(event: Event): void {
  const input = event.target as HTMLInputElement
  const files = Array.from(input.files || [])
  input.value = ''
  if (files.length) emit('ingest', files)
}

function onDrop(event: DragEvent): void {
  const files = Array.from(event.dataTransfer?.files || [])
  if (!files.length) return
  event.preventDefault()
  event.stopPropagation()
  emit('ingest', files)
}

function labelOf(asset: AssetMeta): string {
  return asset.kind === 'image' ? '图片' : asset.kind === 'pdf' ? 'PDF' : 'HTML'
}
</script>

<template>
  <div v-if="assets.length || selected" class="curation-asset-strip" :class="{ selected }"
    :data-node-id="nodeId" @dragover.prevent @drop="onDrop">
    <span class="cas-label"><Icon name="paperclip" :size="11"/> 附件</span>
    <div class="cas-thumbs">
      <span v-for="asset in visible" :key="asset.id" class="cas-item">
        <button class="cas-thumb" type="button"
          :class="[asset.kind, asset.uploadState || '']" :title="`${asset.name} · ${labelOf(asset)}${asset.lastError ? ` · ${asset.lastError}` : ''}`"
          @click.stop="emit('open', asset)">
          <CurationAssetThumb :asset="asset" :remote-downloader="remoteDownloader" />
          <span class="cas-kind">{{ labelOf(asset) }}</span>
          <span v-if="asset.uploadState === 'pending'" class="cas-sync pending" title="正在同步">↻</span>
          <span v-else-if="asset.uploadState === 'failed'" class="cas-sync failed" :title="asset.lastError || '上传失败'">!</span>
        </button>
        <button class="cas-remove" type="button" :aria-label="`删除${asset.name}`"
          @click.stop="emit('remove', asset)">×</button>
      </span>
      <span v-if="overflow" class="cas-overflow" :title="`还有 ${overflow} 个附件`">+{{ overflow }}</span>
    </div>
    <button v-if="selected" class="cas-add" type="button" title="添加图片、HTML 或 PDF" @click.stop="pickFiles">
      <Icon name="plus" :size="12"/> 添加
    </button>
    <input ref="fileInput" class="cas-file" type="file" multiple accept="image/*,.html,.htm,.pdf" @change="onFilesChange" />
  </div>
</template>

<style scoped>
.curation-asset-strip { display: flex; align-items: center; gap: 6px; min-width: 0; margin-top: 8px; padding: 6px 7px; border: 1px solid var(--border); border-radius: 8px; background: color-mix(in srgb, var(--surface-2) 72%, var(--surface)); }
.curation-asset-strip.selected { border-color: color-mix(in srgb, var(--accent) 34%, var(--border)); background: color-mix(in srgb, var(--accent-light) 52%, var(--surface)); }
.cas-label { flex: none; display: inline-flex; align-items: center; gap: 3px; color: var(--text-3); font-size: var(--fs-micro); font-weight: 600; }
.cas-thumbs { flex: 1; min-width: 0; display: flex; align-items: center; gap: 5px; overflow: hidden; }
.cas-item { position: relative; width: 46px; height: 38px; flex: none; }
.cas-thumb { position: relative; width: 46px; height: 38px; flex: none; padding: 0; overflow: hidden; border: 1px solid var(--border); border-radius: 6px; background: var(--surface); cursor: zoom-in; }
.cas-thumb:hover { border-color: var(--accent); box-shadow: 0 0 0 2px var(--accent-light); }
.cas-thumb:focus-visible { outline: var(--focus-ring); outline-offset: 1px; }
.cas-kind { position: absolute; left: 2px; bottom: 2px; z-index: 2; padding: 0 3px; border-radius: 3px; background: color-mix(in srgb, var(--surface) 88%, transparent); color: var(--text-3); font-size: 7px; line-height: 11px; font-weight: 700; }
.cas-sync { position: absolute; top: 2px; left: 2px; z-index: 2; width: 12px; height: 12px; display: grid; place-items: center; border-radius: 50%; background: var(--surface); font-size: 8px; font-weight: 800; }
.cas-sync.pending { color: var(--warning); }
.cas-sync.failed { color: var(--danger); }
.cas-remove { position: absolute; top: 1px; right: 1px; z-index: 3; width: 14px; height: 14px; display: grid; place-items: center; padding: 0; border: 0; border-radius: 4px; background: color-mix(in srgb, var(--surface) 92%, transparent); color: var(--text-2); font-size: 11px; line-height: 1; opacity: 0; cursor: pointer; transition: opacity var(--dur-fast); }
.cas-item:hover .cas-remove, .cas-remove:focus-visible { opacity: 1; }
.cas-remove:hover { color: var(--danger); background: var(--danger-bg-soft); }
.cas-overflow { flex: none; color: var(--text-3); font-size: var(--fs-micro); }
.cas-add { flex: none; min-height: 28px; display: inline-flex; align-items: center; gap: 3px; padding: 3px 7px; border: 1px dashed var(--border-strong); border-radius: 6px; background: transparent; color: var(--text-2); font: inherit; font-size: var(--fs-micro); cursor: pointer; }
.cas-add:hover { border-color: var(--accent); color: var(--accent-ink); background: var(--accent-light); }
.cas-file { display: none; }
</style>
