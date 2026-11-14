<script setup lang="ts">
import { computed, ref } from 'vue'
import Icon from '@/shared/components/Icon.vue'
import { useAppStore } from '../../stores/app'
import { CURATION_WS_ID, type ResourceCard, type ResourceFolder } from '@/shared/models'
import {
  mirrorResourceOf,
  resourceFolderMirrorsOf,
  resourceFoldersOf,
} from '@/shared/storage/resourceFolders'
import ResourceFolderDrawer from './ResourceFolderDrawer.vue'
import ResourceFolderDetailModal from './ResourceFolderDetailModal.vue'

const props = defineProps<{ todayStart: number }>()
const store = useAppStore()
const foldersOpen = ref(false)
const focusedFolderId = ref('')
const detailOpen = ref(false)
const detailKind = ref<'today' | 'folder'>('today')
const detailFolderId = ref('')
const detailTitle = ref('今日采集')

const poolResources = computed<ResourceCard[]>(() =>
  (store.data?.resources || [])
    .filter(card => !card.deletedAt && card.workspaceId === CURATION_WS_ID)
)
const todayResources = computed(() =>
  [...poolResources.value]
    .filter(card => (card.createdAt || 0) >= props.todayStart)
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
)
const folders = computed<ResourceFolder[]>(() =>
  store.data ? resourceFoldersOf(store.data) : []
)

interface FolderModule {
  folder: ResourceFolder
  count: number
  preview: ResourceCard[]
}

const folderModules = computed<FolderModule[]>(() => {
  const data = store.data
  if (!data) return []
  return folders.value.map(folder => {
    const mirrors = resourceFolderMirrorsOf(data, folder.id)
    const cards = mirrors
      .map(mirror => mirrorResourceOf(mirror, data.resources))
      .filter((card): card is ResourceCard => !!card)
    return {
      folder,
      count: mirrors.length,
      preview: cards.slice(0, 2),
    }
  })
})

function openFolders(folderId = ''): void {
  focusedFolderId.value = folderId
  foldersOpen.value = true
}

function openToday(): void {
  detailKind.value = 'today'
  detailFolderId.value = ''
  detailTitle.value = '今日采集'
  detailOpen.value = true
}

function openFolderDetail(folder: ResourceFolder): void {
  detailKind.value = 'folder'
  detailFolderId.value = folder.id
  detailTitle.value = folder.name
  detailOpen.value = true
}

function manageDetail(): void {
  detailOpen.value = false
  openFolders(detailFolderId.value)
}
</script>

<template>
  <div class="home-resource-folders">
    <div class="hrf-toolbar">
      <div>
        <b>常用文件夹</b>
        <span>按使用场景组织资源卡，源卡仍留在资源池</span>
      </div>
      <button type="button" @click="openFolders()">管理 <Icon name="arrowright" :size="12" /></button>
    </div>

    <div class="hrf-grid">
      <button class="hrf-folder is-today" type="button" @click="openToday">
        <span class="hrf-icon"><Icon name="calendar" :size="17" /></span>
        <span class="hrf-copy">
          <b>今日采集 <em>{{ todayResources.length }}</em></b>
          <small>{{ todayResources.length ? '今天新增的资源卡会自动收纳在这里' : '今天还没有新增资源卡' }}</small>
          <span v-if="todayResources.length" class="hrf-preview">
            <span v-for="card in todayResources.slice(0, 2)" :key="card.id">{{ card.title }}</span>
          </span>
        </span>
        <Icon name="arrowright" :size="13" class="hrf-arrow" />
      </button>

      <button
        v-for="item in folderModules"
        :key="item.folder.id"
        class="hrf-folder"
        type="button"
        @click="openFolderDetail(item.folder)"
      >
        <span class="hrf-icon"><Icon name="folder" :size="17" /></span>
        <span class="hrf-copy">
          <b>{{ item.folder.name }} <em>{{ item.count }}</em></b>
          <small>{{ item.count ? `${item.count} 张资源镜像` : '这个常用夹还是空的' }}</small>
          <span v-if="item.preview.length" class="hrf-preview">
            <span v-for="card in item.preview" :key="card.id">{{ card.title }}</span>
          </span>
        </span>
        <Icon name="arrowright" :size="13" class="hrf-arrow" />
      </button>

      <button class="hrf-folder is-create" type="button" @click="openFolders()">
        <span class="hrf-icon"><Icon name="plus" :size="17" /></span>
        <span class="hrf-copy">
          <b>{{ folders.length ? '管理常用夹' : '新建常用夹' }}</b>
          <small>{{ folders.length ? `已有 ${folders.length} 个常用夹` : '把经常一起使用的资源卡归到一组' }}</small>
        </span>
      </button>
    </div>

    <ResourceFolderDrawer
      :open="foldersOpen"
      :initial-folder-id="focusedFolderId"
      @close="foldersOpen = false"
    />
    <ResourceFolderDetailModal
      :open="detailOpen"
      :title="detailTitle"
      :kind="detailKind"
      :folder-id="detailFolderId"
      :today-start="todayStart"
      @close="detailOpen = false"
      @manage="manageDetail"
    />
  </div>
</template>

<style scoped>
.home-resource-folders { display: flex; min-width: 0; flex-direction: column; gap: 10px; }
.hrf-toolbar { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
.hrf-toolbar > div { display: flex; min-width: 0; flex-direction: column; gap: 2px; }
.hrf-toolbar b { color: var(--text-2); font-size: var(--fs-caption); }
.hrf-toolbar span { color: var(--text-3); font-size: var(--fs-micro); }
.hrf-toolbar button { display: inline-flex; align-items: center; gap: 4px; min-height: 28px; padding: 3px 8px; border: 0; border-radius: var(--radius-xs); background: transparent; color: var(--text-2); font: inherit; font-size: var(--fs-micro); font-weight: 650; cursor: pointer; }
.hrf-toolbar button:hover { background: var(--surface-2); color: var(--accent-ink); }
.hrf-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
.hrf-folder { display: grid; grid-template-columns: 34px minmax(0, 1fr) 16px; align-items: center; gap: 9px; min-height: 92px; padding: 10px; border: 1px solid var(--border); border-radius: var(--radius-sm); background: var(--surface); color: var(--text); font: inherit; text-align: left; cursor: pointer; transition: border-color var(--dur), background var(--dur), transform var(--dur); }
.hrf-folder:hover { border-color: var(--border-strong); background: var(--surface-2); transform: translateY(-1px); }
.hrf-folder:focus-visible { outline: 2px solid var(--accent); outline-offset: 1px; }
.hrf-folder.is-today { border-color: color-mix(in srgb, var(--accent) 26%, var(--border)); background: color-mix(in srgb, var(--accent-light) 48%, var(--surface)); }
.hrf-folder.is-create { border-style: dashed; background: var(--surface-2); }
.hrf-icon { display: grid; place-items: center; width: 34px; height: 34px; border-radius: 9px; background: var(--surface-3); color: var(--accent-ink); }
.is-today .hrf-icon { background: var(--accent-light); }
.hrf-copy { display: flex; min-width: 0; flex-direction: column; gap: 3px; }
.hrf-copy b { overflow: hidden; color: var(--text); font-size: var(--fs-sub); text-overflow: ellipsis; white-space: nowrap; }
.hrf-copy b em { display: inline-grid; min-width: 18px; height: 18px; place-items: center; margin-left: 4px; padding: 0 5px; border-radius: 99px; background: var(--surface-3); color: var(--text-3); font-size: var(--fs-micro); font-style: normal; vertical-align: 1px; }
.hrf-copy small { overflow: hidden; color: var(--text-3); font-size: var(--fs-micro); text-overflow: ellipsis; white-space: nowrap; }
.hrf-preview { display: flex; min-width: 0; flex-direction: column; gap: 1px; margin-top: 1px; }
.hrf-preview span { overflow: hidden; color: var(--text-3); font-size: var(--fs-micro); text-overflow: ellipsis; white-space: nowrap; }
.hrf-preview span::before { content: '·'; margin-right: 4px; color: var(--text-4); }
.hrf-arrow { color: var(--text-3); }
@media (max-width: 900px) {
  .hrf-grid { grid-template-columns: minmax(0, 1fr); }
}
</style>
