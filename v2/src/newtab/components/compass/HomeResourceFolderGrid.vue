<script setup lang="ts">
import { computed, onDeactivated, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
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
import PoolCardsPanel from './PoolCardsPanel.vue'
import Drawer from '@/shared/components/Drawer.vue'

const props = defineProps<{ todayStart: number }>()
const store = useAppStore()
const foldersOpen = ref(false)
const focusedFolderId = ref('')
const detailOpen = ref(false)
const detailKind = ref<'today' | 'folder'>('today')
const detailFolderId = ref('')
const detailTitle = ref('今日采集')
const allOpen = ref(false)
const route = useRoute()

/** V4.7：/deck/resource 旧深链统一落到一级资源页签，并自动展开「全部资源卡」抽屉；
 *  带 hl 的检索定位也让 PoolCardsPanel 在抽屉里接手高亮。 */
watch(() => route.query, (query) => {
  if (query.all === '1' || typeof query.hl === 'string') allOpen.value = true
}, { immediate: true })
/* 调度台由 KeepAlive 缓存，切到方向台/策展台时组件只失活不卸载；
   抽屉又 Teleport 到 body，若不在这里收口会把遮罩与高层抽屉一路带到下一模块。 */
onDeactivated(() => {
  allOpen.value = false
  detailOpen.value = false
  foldersOpen.value = false
})

const poolResources = computed<ResourceCard[]>(() =>
  (store.data?.resources || [])
    .filter(card => !card.deletedAt && card.workspaceId === CURATION_WS_ID)
)
const todayResources = computed(() =>
  [...poolResources.value]
    .filter(card => (card.createdAt || 0) >= props.todayStart)
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
)
const folders = computed<ResourceFolder[]>(() => store.data ? resourceFoldersOf(store.data) : [])

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

/** V4.7.1：资源页「查看全部」由宿主经 ref 调用，直接展开全部资源卡抽屉。 */
function openAll(): void {
  allOpen.value = true
}
defineExpose({ openAll })
</script>

<template>
  <div class="home-resource-folders">
    <section class="hrf-section hrf-system" aria-labelledby="hrfSystemTitle">
      <div class="hrf-section-head">
        <div class="hrf-section-title"><b id="hrfSystemTitle">系统夹</b><span>固定视图 · 始终保留</span></div>
      </div>
      <div class="hrf-system-grid">
        <button class="hrf-folder is-all hrf-system-folder" type="button" @click="openAll">
          <span class="hrf-icon"><Icon name="layers" :size="15" /></span>
          <span class="hrf-copy"><b>全部资源卡 <em>{{ poolResources.length }}</em></b><small>右侧抽屉 · 批量、镜像与右键保持不变</small></span>
          <Icon name="arrowright" :size="12" class="hrf-arrow" />
        </button>
        <button class="hrf-folder is-today hrf-system-folder" type="button" @click="openToday">
          <span class="hrf-icon"><Icon name="calendar" :size="15" /></span>
          <span class="hrf-copy"><b>今日采集 <em>{{ todayResources.length }}</em></b><small>{{ todayResources.length ? '今天新增的资源卡自动收纳' : '今天还没有新增资源卡' }}</small></span>
          <Icon name="arrowright" :size="12" class="hrf-arrow" />
        </button>
      </div>
    </section>

    <section class="hrf-section hrf-custom" aria-labelledby="hrfCustomTitle">
      <div class="hrf-section-head">
        <div class="hrf-section-title"><b id="hrfCustomTitle">我的常用夹</b><span>只存镜像 · 源卡仍在资源池</span></div>
        <div class="hrf-section-actions">
          <button type="button" @click="openFolders()">管理</button>
          <button class="is-primary" type="button" @click="openFolders()">＋ 新建常用夹</button>
        </div>
      </div>
      <div v-if="folderModules.length" class="hrf-grid">
        <button
          v-for="item in folderModules"
          :key="item.folder.id"
          class="hrf-folder hrf-custom-folder"
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
      </div>
      <div v-else class="hrf-empty">
        <span class="hrf-empty-ico"><Icon name="folder" :size="16" /></span>
        <div><b>还没有自建常用夹</b><small>系统夹不受影响；新建后可按场景归组资源镜像。</small></div>
        <button type="button" @click="openFolders()">新建常用夹</button>
      </div>
    </section>

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
    <Drawer :open="allOpen" width="960px" title="全部资源卡" icon="layers" @close="allOpen = false">
      <PoolCardsPanel hide-folder-entry />
    </Drawer>
  </div>
</template>

<style scoped>
.home-resource-folders { display: flex; min-width: 0; flex-direction: column; gap: 14px; }
.hrf-section { display: flex; min-width: 0; flex-direction: column; gap: 8px; }
.hrf-section-head { display: flex; align-items: flex-end; justify-content: space-between; gap: 12px; }
.hrf-section-title { display: flex; min-width: 0; flex-direction: column; gap: 2px; }
.hrf-section-title b { color: var(--text-2); font-size: var(--fs-caption); }
.hrf-section-title span { color: var(--text-3); font-size: var(--fs-micro); }
.hrf-section-actions { display: flex; align-items: center; gap: 5px; flex-shrink: 0; }
.hrf-section-actions button, .hrf-empty button { display: inline-flex; align-items: center; justify-content: center; gap: 4px; min-height: 28px; padding: 3px 8px; border: 1px solid transparent; border-radius: var(--radius-xs); background: transparent; color: var(--text-2); font: inherit; font-size: var(--fs-micro); font-weight: 650; cursor: pointer; }
.hrf-section-actions button:hover, .hrf-empty button:hover { background: var(--surface-2); color: var(--accent-ink); }
.hrf-section-actions .is-primary { border-color: color-mix(in srgb, var(--accent) 32%, var(--border)); background: var(--accent-light); color: var(--accent-ink); }
.hrf-system-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
.hrf-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
.hrf-folder { display: grid; grid-template-columns: 34px minmax(0, 1fr) 16px; align-items: center; gap: 9px; min-height: 92px; padding: 10px; border: 1px solid var(--border); border-radius: var(--radius-sm); background: var(--surface); color: var(--text); font: inherit; text-align: left; cursor: pointer; transition: border-color var(--dur), background var(--dur), transform var(--dur); }
.hrf-folder:hover { border-color: var(--border-strong); background: var(--surface-2); transform: translateY(-1px); }
.hrf-folder:focus-visible { outline: 2px solid var(--accent); outline-offset: 1px; }
.hrf-system-folder { position: relative; overflow: hidden; grid-template-columns: 28px minmax(0, 1fr) 14px; gap: 8px; min-height: 68px; padding: 8px 10px; }
.hrf-system-folder::before { content: ''; position: absolute; inset: 10px auto 10px 0; width: 3px; border-radius: 0 3px 3px 0; background: var(--accent); }
.hrf-system-folder.is-all { border-color: color-mix(in srgb, var(--accent) 28%, var(--border)); background: color-mix(in srgb, var(--accent-light) 56%, var(--surface)); }
.hrf-system-folder.is-today { border-color: color-mix(in srgb, var(--accent) 22%, var(--border)); background: color-mix(in srgb, var(--accent-light) 34%, var(--surface)); }
.hrf-system-folder .hrf-icon { width: 28px; height: 28px; border-radius: 8px; background: var(--accent-light); }
.hrf-system-folder .hrf-copy b { font-size: var(--fs-caption); }
.hrf-icon { display: grid; place-items: center; width: 34px; height: 34px; border-radius: 9px; background: var(--surface-3); color: var(--accent-ink); }
.hrf-copy { display: flex; min-width: 0; flex-direction: column; gap: 3px; }
.hrf-copy b { overflow: hidden; color: var(--text); font-size: var(--fs-sub); text-overflow: ellipsis; white-space: nowrap; }
.hrf-copy b em { display: inline-grid; min-width: 18px; height: 18px; place-items: center; margin-left: 4px; padding: 0 5px; border-radius: 99px; background: var(--surface-3); color: var(--text-3); font-size: var(--fs-micro); font-style: normal; vertical-align: 1px; }
.hrf-copy small { overflow: hidden; color: var(--text-3); font-size: var(--fs-micro); text-overflow: ellipsis; white-space: nowrap; }
.hrf-preview { display: flex; min-width: 0; flex-direction: column; gap: 1px; margin-top: 1px; }
.hrf-preview span { overflow: hidden; color: var(--text-3); font-size: var(--fs-micro); text-overflow: ellipsis; white-space: nowrap; }
.hrf-preview span::before { content: '·'; margin-right: 4px; color: var(--text-4); }
.hrf-empty { display: flex; align-items: center; gap: 10px; padding: 12px 14px; border: 1px dashed var(--border); border-radius: var(--radius-sm); background: var(--surface-2); color: var(--text-3); font-size: var(--fs-micro); }
.hrf-empty > div { display: flex; min-width: 0; flex: 1; flex-direction: column; gap: 2px; }
.hrf-empty b { color: var(--text-2); font-size: var(--fs-caption); }
.hrf-empty-ico { display: grid; place-items: center; width: 30px; height: 30px; flex-shrink: 0; border-radius: 8px; background: var(--surface); color: var(--text-3); }
.hrf-arrow { color: var(--text-3); }
@media (max-width: 900px) {
  .hrf-grid { grid-template-columns: minmax(0, 1fr); }
  .hrf-section-head { align-items: flex-start; }
}
</style>
