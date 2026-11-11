<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import Modal from '@/shared/components/Modal.vue'
import Icon from '@/shared/components/Icon.vue'
import { showToast } from '@/shared/components/toast'
import { useAppStore } from '@/newtab/stores/app'
import { CURATION_WS_ID, type ResourceCard } from '@/shared/models'
import { addResourceFolderMirror } from '@/shared/storage/resourceFolders'
import { resourceFolderMirrorsOf } from '@/shared/storage/resourceFolders'

const props = defineProps<{
  open: boolean
  folderId: string
  folderName: string
}>()
const emit = defineEmits<{ (e: 'close'): void; (e: 'saved'): void }>()

const store = useAppStore()
const query = ref('')
const selected = ref<Set<string>>(new Set())

const existingIds = computed(() =>
  new Set(resourceFolderMirrorsOf(store.data!, props.folderId).map(mirror => mirror.resourceId))
)

const candidates = computed<ResourceCard[]>(() => {
  const q = query.value.trim().toLowerCase()
  return (store.data?.resources || [])
    .filter(resource => !resource.deletedAt && resource.workspaceId === CURATION_WS_ID)
    .filter(resource => !q
      || resource.title.toLowerCase().includes(q)
      || (resource.tags || []).some(tag => tag.toLowerCase().includes(q)))
    .sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.updatedAt - a.updatedAt)
})

watch(() => [props.open, props.folderId], () => {
  if (!props.open) return
  query.value = ''
  selected.value = new Set()
}, { immediate: true })

function isExisting(resource: ResourceCard): boolean {
  return existingIds.value.has(resource.id)
}

function toggle(resource: ResourceCard): void {
  if (isExisting(resource)) return
  const next = new Set(selected.value)
  if (next.has(resource.id)) next.delete(resource.id)
  else next.add(resource.id)
  selected.value = next
}

function selectVisible(): void {
  const next = new Set(selected.value)
  const addable = candidates.value.filter(resource => !isExisting(resource))
  const allPicked = addable.length > 0 && addable.every(resource => next.has(resource.id))
  for (const resource of addable) {
    if (allPicked) next.delete(resource.id)
    else next.add(resource.id)
  }
  selected.value = next
}

function save(): void {
  if (!store.data || !selected.value.size) return
  let created = 0
  for (const resourceId of selected.value) {
    const result = addResourceFolderMirror(store.data, props.folderId, resourceId)
    if (result.created) created++
  }
  if (created) {
    store.persist()
    showToast(`已向「${props.folderName}」添加 ${created} 张资源镜像`)
    emit('saved')
  } else {
    showToast('没有新增资源镜像')
  }
  emit('close')
}

const visibleAddable = computed(() => candidates.value.filter(resource => !isExisting(resource)))
const allVisiblePicked = computed(() =>
  visibleAddable.value.length > 0 && visibleAddable.value.every(resource => selected.value.has(resource.id))
)
</script>

<template>
  <Modal :open="open" title="添加资源镜像" width="min(720px, 94vw)" max-height="86vh" height="100%" @close="emit('close')">
    <template #sub>
      <div class="rfp-sub">
        <span>加入「{{ folderName }}」</span>
        <span>镜像会保存当前快照，之后源卡变化不影响已加入的这一份。</span>
      </div>
    </template>
    <div class="rfp-tools">
      <label class="rfp-search">
        <Icon name="search" :size="13" />
        <input v-model="query" placeholder="搜索标题或标签..." />
      </label>
      <button type="button" class="rfp-btn" :disabled="!visibleAddable.length" @click="selectVisible">
        {{ allVisiblePicked ? '取消全选' : '全选可添加' }}
      </button>
      <span class="rfp-count">已选 {{ selected.size }} 张</span>
    </div>
    <div v-if="candidates.length" class="rfp-list">
      <button v-for="resource in candidates" :key="resource.id" type="button" class="rfp-row"
        :class="{ picked: selected.has(resource.id), existing: isExisting(resource) }"
        :disabled="isExisting(resource)" @click="toggle(resource)">
        <span class="rfp-check"><Icon v-if="selected.has(resource.id)" name="check" :size="12" /></span>
        <span class="rfp-main">
          <b>{{ resource.title }}</b>
          <small>{{ resource.link || '无链接' }}</small>
        </span>
        <span v-if="isExisting(resource)" class="rfp-tag">已在夹内</span>
        <span v-else-if="resource.tags?.length" class="rfp-tag">{{ resource.tags.slice(0, 2).join(' · ') }}</span>
      </button>
    </div>
    <div v-else class="rfp-empty">没有匹配的资源卡。</div>
    <template #footer>
      <div class="rfp-foot">
        <span>同一张卡可镜像到多个常用夹，也可同时镜像到多个策展台。</span>
        <button type="button" class="rfp-btn" @click="emit('close')">取消</button>
        <button type="button" class="rfp-btn primary" :disabled="!selected.size" @click="save">
          <Icon name="check" :size="13" /> 添加 {{ selected.size }} 张
        </button>
      </div>
    </template>
  </Modal>
</template>

<style scoped>
.rfp-sub { display: flex; flex-wrap: wrap; gap: 6px 12px; color: var(--text-3); font-size: var(--fs-caption); }
.rfp-tools { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; }
.rfp-search { flex: 1; min-width: 180px; display: flex; align-items: center; gap: 6px; padding: 6px 10px; border: 1px solid var(--border); border-radius: var(--radius-sm); background: var(--surface-2); color: var(--text-3); }
.rfp-search input { flex: 1; min-width: 0; border: 0; outline: 0; background: transparent; color: var(--text); font: inherit; }
.rfp-search:focus-within { border-color: var(--accent); }
.rfp-count { color: var(--text-3); font-size: var(--fs-caption); white-space: nowrap; }
.rfp-list { display: flex; flex-direction: column; gap: 6px; }
.rfp-row { width: 100%; min-height: 54px; display: flex; align-items: center; gap: 10px; padding: 8px 10px; border: 1px solid var(--border); border-radius: var(--radius-sm); background: var(--surface); color: var(--text); text-align: left; font: inherit; cursor: pointer; }
.rfp-row:hover:not(:disabled) { border-color: var(--accent); }
.rfp-row.picked { border-color: var(--accent); background: var(--accent-light); }
.rfp-row.existing { opacity: .55; cursor: not-allowed; }
.rfp-check { width: 18px; height: 18px; border: 1px solid var(--border-strong); border-radius: 5px; display: grid; place-items: center; color: var(--accent); flex: none; }
.rfp-main { flex: 1; min-width: 0; }
.rfp-main b, .rfp-main small { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.rfp-main b { font-size: var(--fs-sub); }
.rfp-main small { margin-top: 3px; color: var(--text-3); font-size: var(--fs-tiny); }
.rfp-tag { flex: none; max-width: 180px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; padding: 2px 7px; border-radius: 999px; background: var(--surface-3); color: var(--text-3); font-size: var(--fs-micro); }
.rfp-empty { padding: 36px 12px; text-align: center; color: var(--text-3); }
.rfp-foot { width: 100%; display: flex; align-items: center; gap: 8px; }
.rfp-foot > span { flex: 1; color: var(--text-4); font-size: var(--fs-caption); }
.rfp-btn { min-height: 30px; display: inline-flex; align-items: center; gap: 5px; border: 1px solid var(--border); border-radius: var(--radius-sm); background: var(--surface); color: var(--text-2); padding: 5px 10px; font: inherit; font-size: var(--fs-caption); font-weight: 700; cursor: pointer; }
.rfp-btn:hover:not(:disabled) { border-color: var(--accent); color: var(--accent); }
.rfp-btn.primary { border-color: var(--accent); background: var(--accent-light); color: var(--accent-ink); }
.rfp-btn:disabled { opacity: var(--opacity-disabled); cursor: not-allowed; }
@media (max-width: 600px) {
  .rfp-tools { flex-wrap: wrap; }
  .rfp-count { width: 100%; }
  .rfp-foot { flex-wrap: wrap; }
  .rfp-foot > span { flex-basis: 100%; }
}
</style>
