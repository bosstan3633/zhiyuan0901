<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue'
import Icon from '@/shared/components/Icon.vue'
import type { AssetMeta } from '@/shared/models'
import { getAssetBlob, putAsset } from '@/shared/storage/assets'

const props = defineProps<{
  asset: AssetMeta
  remoteDownloader?: (meta: AssetMeta) => Promise<Blob | null>
}>()

const url = ref('')
const loading = ref(false)
const missing = ref(false)
let objectUrl = ''

function revoke(): void {
  if (objectUrl) {
    try { URL.revokeObjectURL(objectUrl) } catch { /* noop */ }
    objectUrl = ''
  }
  url.value = ''
}

async function load(): Promise<void> {
  revoke()
  loading.value = true
  missing.value = false
  try {
    let blob = await getAssetBlob(props.asset.id)
    if (!blob && props.remoteDownloader) {
      blob = await props.remoteDownloader(props.asset)
      if (blob) await putAsset(props.asset.id, blob).catch(() => {})
    }
    if (!blob) {
      missing.value = true
      return
    }
    objectUrl = URL.createObjectURL(blob)
    url.value = objectUrl
  } catch {
    missing.value = true
  } finally {
    loading.value = false
  }
}

watch(() => [props.asset.id, props.remoteDownloader], load, { immediate: true })
onBeforeUnmount(revoke)
</script>

<template>
  <span class="cat-thumb-visual" :data-kind="asset.kind">
    <img v-if="asset.kind === 'image' && url" :src="url" :alt="asset.name" loading="lazy" />
    <iframe v-else-if="asset.kind === 'html' && url" :src="url" title="" tabindex="-1"
      sandbox="" referrerpolicy="no-referrer" aria-hidden="true"></iframe>
    <embed v-else-if="asset.kind === 'pdf' && url" :src="url" type="application/pdf" />
    <span v-if="loading" class="cat-thumb-loading" aria-hidden="true"></span>
    <span v-if="!loading && (!url || asset.kind === 'pdf')" class="cat-thumb-fallback" aria-hidden="true">
      <Icon :name="asset.kind === 'pdf' ? 'book' : asset.kind === 'html' ? 'filetext' : 'image'" :size="16"/>
      <small>{{ asset.kind === 'pdf' ? 'PDF' : asset.kind === 'html' ? 'HTML' : missing ? '缺失' : '图片' }}</small>
    </span>
  </span>
</template>

<style scoped>
.cat-thumb-visual { position: absolute; inset: 0; display: block; overflow: hidden; background: var(--surface-2); }
.cat-thumb-visual img { width: 100%; height: 100%; display: block; object-fit: cover; }
.cat-thumb-visual iframe,
.cat-thumb-visual embed { width: 240%; height: 240%; border: 0; transform: scale(.4167); transform-origin: top left; pointer-events: none; background: #fff; }
.cat-thumb-visual[data-kind="html"]::after { content: ""; position: absolute; inset: 0; box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--border) 72%, transparent); pointer-events: none; }
.cat-thumb-fallback { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px; color: var(--text-3); background: linear-gradient(145deg, var(--surface), var(--surface-3)); }
.cat-thumb-fallback small { font-size: 8px; font-weight: 700; letter-spacing: .03em; }
.cat-thumb-loading { position: absolute; inset: 0; background: linear-gradient(100deg, transparent 18%, color-mix(in srgb, var(--surface) 58%, transparent) 46%, transparent 74%) 0 0 / 220% 100%; animation: cat-thumb-shimmer 1.1s linear infinite; }
@keyframes cat-thumb-shimmer { to { background-position: -220% 0; } }
@media (prefers-reduced-motion: reduce) { .cat-thumb-loading { animation: none; } }
</style>
