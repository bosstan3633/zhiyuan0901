<script setup lang="ts">
import { computed } from 'vue'
import Drawer from '@/shared/components/Drawer.vue'
import Icon from '@/shared/components/Icon.vue'
import AssetManager from '@/shared/components/AssetManager.vue'
import type { AssetMeta, Category, ResourceCard } from '@/shared/models'

const props = defineProps<{
  open: boolean
  nodeId: string
  nodeName: string
  level: number
  assets: AssetMeta[]
  ownerId: string
  remoteDownloader?: (meta: AssetMeta) => Promise<Blob | null>
}>()

const emit = defineEmits<{
  close: []
  'update:assets': [assets: AssetMeta[]]
  'retry-asset': [asset: AssetMeta]
}>()

const counts = computed(() => {
  const image = props.assets.filter(a => a.kind === 'image').length
  const html = props.assets.filter(a => a.kind === 'html').length
  const pdf = props.assets.filter(a => a.kind === 'pdf').length
  return { image, html, pdf }
})
</script>

<template>
  <Drawer :open="open" width="520px" @close="emit('close')">
    <template #title><Icon name="paperclip" :size="15"/> 节点附件</template>
    <div class="cna-head">
      <span class="cna-level">L{{ level }}</span>
      <div>
        <b>{{ nodeName }}</b>
        <small>图片 {{ counts.image }}/9 · HTML {{ counts.html }}/1 · PDF {{ counts.pdf }}/1</small>
      </div>
    </div>
    <div class="cna-drop-tip">
      <Icon name="paperclip" :size="13"/>
      支持选择或拖入图片、HTML、PDF；在画布选中节点后可直接粘贴截图。
    </div>
    <AssetManager :model-value="assets" :owner-id="ownerId" :remote-downloader="remoteDownloader"
      defer-blob-deletion confirm-doc-replace
      @update:model-value="emit('update:assets', $event)"
      @retry="emit('retry-asset', $event)" />
  </Drawer>
</template>

<style scoped>
.cna-head { display: flex; align-items: center; gap: 10px; padding: 10px 12px; margin-bottom: 12px; border: 1px solid var(--border); border-radius: 9px; background: var(--surface-2); }
.cna-head > div { min-width: 0; display: flex; flex-direction: column; gap: 3px; }
.cna-head b { color: var(--text); font-size: var(--fs-body); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.cna-head small { color: var(--text-3); font-size: var(--fs-caption); }
.cna-level { flex: none; padding: 2px 7px; border-radius: 999px; background: var(--accent-light); color: var(--accent-ink); font-size: var(--fs-micro); font-weight: 700; }
.cna-drop-tip { display: flex; align-items: flex-start; gap: 6px; margin-bottom: 12px; padding: 9px 10px; border: 1px dashed var(--border-strong); border-radius: 8px; color: var(--text-3); font-size: var(--fs-caption); line-height: 1.55; }
</style>
