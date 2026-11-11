<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import Modal from '@/shared/components/Modal.vue'
import Icon from '@/shared/components/Icon.vue'
import { showToast } from '@/shared/components/toast'
import { useAppStore } from '@/newtab/stores/app'
import { addResourceFolderMirror, createResourceFolder, resourceFoldersOf } from '@/shared/storage/resourceFolders'

const props = defineProps<{
  open: boolean
  cardIds: string[]
}>()
const emit = defineEmits<{ (e: 'close'): void; (e: 'saved'): void }>()

const store = useAppStore()
const checked = ref<Set<string>>(new Set())
const newName = ref('')

const folders = computed(() => resourceFoldersOf(store.data!))

watch(() => [props.open, props.cardIds.join('|')], () => {
  if (!props.open) return
  checked.value = new Set()
  newName.value = ''
}, { immediate: true })

function toggle(folderId: string): void {
  const next = new Set(checked.value)
  if (next.has(folderId)) next.delete(folderId)
  else next.add(folderId)
  checked.value = next
}

function createInline(): void {
  if (!store.data) return
  const result = createResourceFolder(store.data, newName.value)
  if (!result.ok || !result.folder) {
    showToast(result.message)
    return
  }
  store.persist()
  checked.value = new Set([...checked.value, result.folder.id])
  newName.value = ''
  showToast(result.message)
}

function existingCount(folderId: string): number {
  const ids = new Set(props.cardIds)
  return (store.data?.resourceFolderMirrors || [])
    .filter(mirror => mirror.folderId === folderId && ids.has(mirror.resourceId)).length
}

function save(): void {
  if (!store.data || !checked.value.size || !props.cardIds.length) return
  let created = 0
  let skipped = 0
  for (const folderId of checked.value) {
    for (const cardId of props.cardIds) {
      const result = addResourceFolderMirror(store.data, folderId, cardId)
      if (result.created) created++
      else if (result.ok) skipped++
    }
  }
  if (created) {
    store.persist()
    showToast(`已新增 ${created} 条常用夹镜像${skipped ? `，跳过 ${skipped} 条已有镜像` : ''}`)
    emit('saved')
  } else {
    showToast('所选卡片已在目标常用夹内')
  }
  emit('close')
}
</script>

<template>
  <Modal :open="open" title="加入常用夹" width="min(520px, 94vw)" max-height="82vh" @close="emit('close')">
    <template #sub>
      <p class="rfb-sub">{{ cardIds.length }} 张资源卡将作为独立镜像加入。可以多选常用夹，也可以现场新建。</p>
    </template>
    <div v-if="folders.length" class="rfb-list">
      <label v-for="folder in folders" :key="folder.id" class="rfb-row">
        <input type="checkbox" :checked="checked.has(folder.id)" @change="toggle(folder.id)">
        <span class="rfb-folder"><Icon name="folder" :size="14" />{{ folder.name }}</span>
        <span v-if="existingCount(folder.id)" class="rfb-tag">已含 {{ existingCount(folder.id) }} 张</span>
      </label>
    </div>
    <div v-else class="rfb-empty">还没有常用夹，先在下方新建一个。</div>
    <div class="rfb-create">
      <input v-model="newName" maxlength="20" placeholder="新常用夹名称（最多 20 字）" @keydown.enter.prevent="createInline">
      <button type="button" :disabled="!newName.trim()" @click="createInline">新建并勾选</button>
    </div>
    <template #footer>
      <div class="rfb-foot">
        <span>加入常用夹不改变源卡；同一张卡可以进入多个常用夹和多个策展台。</span>
        <button type="button" class="rfb-btn" @click="emit('close')">取消</button>
        <button type="button" class="rfb-btn primary" :disabled="!checked.size" @click="save">
          <Icon name="check" :size="13" /> 确认加入
        </button>
      </div>
    </template>
  </Modal>
</template>

<style scoped>
.rfb-sub { margin: 0; color: var(--text-3); font-size: var(--fs-caption); line-height: 1.6; }
.rfb-list { display: flex; flex-direction: column; gap: 5px; }
.rfb-row { display: flex; align-items: center; gap: 9px; min-height: 38px; padding: 7px 9px; border: 1px solid var(--border); border-radius: var(--radius-sm); cursor: pointer; }
.rfb-row:hover { background: var(--surface-2); }
.rfb-folder { flex: 1; display: inline-flex; align-items: center; gap: 7px; min-width: 0; font-size: var(--fs-sub); font-weight: 600; }
.rfb-tag { flex: none; padding: 2px 7px; border-radius: 999px; background: var(--accent-light); color: var(--accent-ink); font-size: var(--fs-micro); }
.rfb-empty { padding: 24px 10px; text-align: center; color: var(--text-3); font-size: var(--fs-caption); }
.rfb-create { display: flex; gap: 7px; margin-top: 10px; padding-top: 10px; border-top: 1px solid var(--border); }
.rfb-create input { flex: 1; min-width: 0; padding: 6px 9px; border: 1px solid var(--border); border-radius: var(--radius-sm); background: var(--surface-2); color: var(--text); font: inherit; outline: none; }
.rfb-create input:focus { border-color: var(--accent); }
.rfb-create button, .rfb-btn { min-height: 30px; border: 1px solid var(--border); border-radius: var(--radius-sm); background: var(--surface); color: var(--text-2); padding: 5px 10px; font: inherit; font-size: var(--fs-caption); font-weight: 700; cursor: pointer; }
.rfb-create button:hover:not(:disabled), .rfb-btn:hover:not(:disabled) { border-color: var(--accent); color: var(--accent); }
.rfb-create button:disabled, .rfb-btn:disabled { opacity: var(--opacity-disabled); cursor: not-allowed; }
.rfb-btn.primary { display: inline-flex; align-items: center; gap: 5px; border-color: var(--accent); background: var(--accent-light); color: var(--accent-ink); }
.rfb-foot { width: 100%; display: flex; align-items: center; gap: 8px; }
.rfb-foot > span { flex: 1; color: var(--text-4); font-size: var(--fs-caption); }
@media (max-width: 600px) {
  .rfb-create, .rfb-foot { flex-wrap: wrap; }
  .rfb-foot > span { flex-basis: 100%; }
}
</style>
