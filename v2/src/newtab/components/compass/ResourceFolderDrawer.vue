<script setup lang="ts">
import { computed, ref } from 'vue'
import Drawer from '@/shared/components/Drawer.vue'
import Icon from '@/shared/components/Icon.vue'
import EmptyState from '@/shared/components/EmptyState.vue'
import { showToast } from '@/shared/components/toast'
import { useConfirm } from '@/shared/components/confirm'
import { useAppStore } from '@/newtab/stores/app'
import { toOpenableUrl, openExternalLink } from '@/shared/utils/link'
import { useResourceOpen } from '@/newtab/composables/useResourceOpen'
import {
  createResourceFolder,
  deleteResourceFolder,
  mirrorResourceOf,
  removeResourceFolderMirror,
  renameResourceFolder,
  resourceFolderMirrorsOf,
  resourceFoldersOf,
} from '@/shared/storage/resourceFolders'
import type { ResourceCard, ResourceFolder, ResourceFolderMirror } from '@/shared/models'
import ResourceFolderPicker from './ResourceFolderPicker.vue'

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ (e: 'close'): void }>()

const store = useAppStore()
const resourceData = computed(() => store.data!)
const { openResourceLink } = useResourceOpen({ store, d: resourceData })

const folders = computed(() => resourceFoldersOf(store.data!))
const mirrorTotal = computed(() => (store.data?.resourceFolderMirrors || []).length)
const newName = ref('')
const renamingId = ref('')
const renameDraft = ref('')
const pickerFolder = ref<ResourceFolder | null>(null)
const pickerOpen = computed({
  get: () => !!pickerFolder.value,
  set: (value: boolean) => { if (!value) pickerFolder.value = null },
})

function membersOf(folder: ResourceFolder): ResourceFolderMirror[] {
  return resourceFolderMirrorsOf(store.data!, folder.id)
}

function cardOf(mirror: ResourceFolderMirror): ResourceCard | null {
  return mirrorResourceOf(mirror, store.data?.resources || [])
}

function openableCards(folder: ResourceFolder): ResourceCard[] {
  const seen = new Set<string>()
  const out: ResourceCard[] = []
  for (const mirror of membersOf(folder)) {
    const card = cardOf(mirror)
    if (!card) continue
    const url = toOpenableUrl(card.linkType, card.link)
    if (!url || seen.has(url)) continue
    seen.add(url)
    out.push(card)
  }
  return out
}

function skippedCount(folder: ResourceFolder): number {
  return Math.max(0, membersOf(folder).length - openableCards(folder).length)
}

function createFolder(): void {
  if (!store.data) return
  const result = createResourceFolder(store.data, newName.value)
  if (!result.ok) {
    showToast(result.message)
    return
  }
  store.persist()
  newName.value = ''
  showToast(result.message)
}

function startRename(folder: ResourceFolder): void {
  renamingId.value = folder.id
  renameDraft.value = folder.name
}

function finishRename(): void {
  if (!store.data || !renamingId.value) return
  const result = renameResourceFolder(store.data, renamingId.value, renameDraft.value)
  if (!result.ok) {
    showToast(result.message)
    return
  }
  store.persist()
  renamingId.value = ''
  renameDraft.value = ''
  showToast(result.message)
}

async function removeFolder(folder: ResourceFolder): Promise<void> {
  if (!store.data) return
  const n = membersOf(folder).length
  if (!(await useConfirm({
    title: '删除常用夹',
    message: `确定删除「${folder.name}」？\n只会删除这个分组与其中 ${n} 条镜像关系，资源卡和策展台镜像都不会受影响。`,
    confirmText: '删除常用夹',
  }))) return
  const result = deleteResourceFolder(store.data, folder.id)
  if (!result.ok) return
  store.persist()
  showToast(`已删除常用夹「${folder.name}」，${result.mirrors} 条镜像关系已移出`)
}

function removeMirror(folder: ResourceFolder, mirror: ResourceFolderMirror): void {
  if (!store.data) return
  if (!removeResourceFolderMirror(store.data, mirror.id)) return
  store.persist()
  showToast(`已从「${folder.name}」移出镜像，源卡与策展台镜像都未改变`)
}

async function openAll(folder: ResourceFolder): Promise<void> {
  const cards = openableCards(folder)
  if (!cards.length) {
    showToast('这个常用夹里没有可打开的原链')
    return
  }
  if (cards.length > 15 && !(await useConfirm({
    title: '一键打开常用夹',
    message: `即将打开 ${cards.length} 个链接，确认继续？`,
    confirmText: '继续打开',
    danger: false,
  }))) return
  let opened = 0
  for (const card of cards) {
    const live = (store.data?.resources || []).find(resource => resource.id === card.id && !resource.deletedAt)
    if (live) {
      if (openResourceLink(live)) opened++
    } else {
      const url = toOpenableUrl(card.linkType, card.link)
      if (url && openExternalLink(url)) {
        opened++
      }
    }
  }
  if (store.persistHot) store.persistHot()
  const skipped = membersOf(folder).length - openableCards(folder).length
  showToast(`已打开 ${opened} 个链接${skipped ? `，跳过 ${skipped} 条无链接 / 重复地址` : ''}${opened > 1 ? '；若未全部出现，请允许弹出窗口' : ''}`)
}

function openMirror(mirror: ResourceFolderMirror): void {
  const card = cardOf(mirror)
  if (!card) {
    showToast('镜像快照缺失，无法打开原链')
    return
  }
  const live = (store.data?.resources || []).find(resource => resource.id === card.id && !resource.deletedAt)
  if (live) {
    openResourceLink(live)
    return
  }
  const url = toOpenableUrl(card.linkType, card.link)
  if (!url) {
    showToast('这张镜像没有可打开的原始链接')
    return
  }
  openExternalLink(url)
}

function displayLink(card: ResourceCard): string {
  const raw = (card.link || '').trim()
  if (!raw) return '无原始链接'
  try {
    const url = new URL(raw)
    return url.hostname || raw
  } catch {
    return raw.length > 48 ? `${raw.slice(0, 48)}…` : raw
  }
}
</script>

<template>
  <Drawer :open="open" title="常用夹" icon="folder" width="560px" :close-on-escape="!pickerOpen" @close="emit('close')">
    <div class="rfd-summary">
      <span><b>{{ folders.length }}</b> 个常用夹</span>
      <span><b>{{ mirrorTotal }}</b> 条资源镜像</span>
      <span>数量不限 · 源卡零影响</span>
    </div>
    <div class="rfd-create">
      <input v-model="newName" maxlength="20" placeholder="新建常用夹，例如：工作日启动组" @keydown.enter.prevent="createFolder">
      <button type="button" :disabled="!newName.trim()" @click="createFolder"><Icon name="plus" :size="13" /> 新建</button>
    </div>

    <EmptyState v-if="!folders.length" icon="folder" size="inline"
      title="还没有常用夹"
      hint="新建一个常用夹，再把经常一起打开的资源卡镜像进来。"
      action-label=""
      @action="createFolder" />

    <section v-for="folder in folders" :key="folder.id" class="rfd-folder">
      <header class="rfd-head">
        <span class="rfd-icon"><Icon name="folder" :size="16" /></span>
        <div v-if="renamingId !== folder.id" class="rfd-title">
          <b>{{ folder.name }}</b>
          <small>{{ membersOf(folder).length }} 张 · {{ openableCards(folder).length }} 个可打开<span v-if="skippedCount(folder)"> · {{ skippedCount(folder) }} 张跳过</span></small>
        </div>
        <div v-else class="rfd-rename">
          <input v-model="renameDraft" maxlength="20" @keydown.enter.prevent="finishRename" @keydown.esc="renamingId = ''">
          <button type="button" @click="finishRename">保存</button>
          <button type="button" @click="renamingId = ''">取消</button>
        </div>
      </header>
      <div class="rfd-actions">
        <button type="button" class="primary" :disabled="!openableCards(folder).length" @click="openAll(folder)">
          <Icon name="external" :size="13" /> 一键打开全部
        </button>
        <button type="button" @click="pickerFolder = folder"><Icon name="plus" :size="13" /> 添加卡片</button>
        <button type="button" @click="startRename(folder)">重命名</button>
        <button type="button" class="danger" @click="removeFolder(folder)">删除</button>
      </div>
      <div v-if="membersOf(folder).length" class="rfd-members">
        <article v-for="mirror in membersOf(folder)" :key="mirror.id" class="rfd-row">
          <span class="rfd-dot" :class="{ muted: !cardOf(mirror) }" />
          <div class="rfd-main">
            <b>{{ cardOf(mirror)?.title || '镜像快照缺失' }}</b>
            <small>{{ cardOf(mirror) ? displayLink(cardOf(mirror)!) : mirror.resourceId }}</small>
          </div>
          <button type="button" class="rfd-row-btn" :disabled="!cardOf(mirror) || !toOpenableUrl(cardOf(mirror)!.linkType, cardOf(mirror)!.link)"
            title="打开原链" @click="openMirror(mirror)">
            <Icon name="external" :size="13" />
          </button>
          <button type="button" class="rfd-row-btn remove" title="移出镜像（不删源卡）" @click="removeMirror(folder, mirror)">移出</button>
        </article>
      </div>
      <div v-else class="rfd-empty">还没有卡片。点击“添加卡片”把资源镜像放进这个常用夹。</div>
    </section>

    <template #footer>
      <span class="rfd-foot"><Icon name="mirror" :size="13" /> 常用夹成员是独立资源镜像；加入、移出或删除常用夹，都不会改变源卡和其他镜像。</span>
    </template>
  </Drawer>

  <ResourceFolderPicker :open="pickerOpen" :folder-id="pickerFolder?.id || ''" :folder-name="pickerFolder?.name || ''"
    @close="pickerFolder = null" @saved="pickerFolder = null" />
</template>

<style scoped>
.rfd-summary { display: flex; flex-wrap: wrap; gap: 8px 14px; padding: 10px 12px; border: 1px solid var(--border); border-radius: var(--radius-sm); background: var(--surface-2); color: var(--text-3); font-size: var(--fs-caption); }
.rfd-summary b { color: var(--text); font-variant-numeric: tabular-nums; }
.rfd-create { display: flex; gap: 7px; margin: 12px 0; }
.rfd-create input { flex: 1; min-width: 0; padding: 7px 10px; border: 1px solid var(--border); border-radius: var(--radius-sm); background: var(--surface); color: var(--text); font: inherit; outline: 0; }
.rfd-create input:focus { border-color: var(--accent); }
.rfd-create button { display: inline-flex; align-items: center; gap: 5px; padding: 6px 11px; border: 1px solid var(--accent); border-radius: var(--radius-sm); background: var(--accent-light); color: var(--accent-ink); font: inherit; font-size: var(--fs-caption); font-weight: 700; cursor: pointer; }
.rfd-create button:disabled { opacity: var(--opacity-disabled); cursor: not-allowed; }
.rfd-folder { margin-top: 12px; padding: 12px; border: 1px solid var(--border); border-radius: var(--radius-md); background: var(--surface); }
.rfd-head { display: flex; align-items: flex-start; gap: 9px; }
.rfd-icon { width: 30px; height: 30px; display: grid; place-items: center; border-radius: 8px; background: var(--accent-light); color: var(--accent-ink); flex: none; }
.rfd-title { flex: 1; min-width: 0; }
.rfd-title b, .rfd-title small { display: block; }
.rfd-title b { color: var(--text); font-size: var(--fs-body); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.rfd-title small { margin-top: 3px; color: var(--text-3); font-size: var(--fs-caption); }
.rfd-rename { flex: 1; display: flex; gap: 5px; }
.rfd-rename input { flex: 1; min-width: 0; padding: 5px 8px; border: 1px solid var(--accent); border-radius: 6px; background: var(--surface-2); color: var(--text); font: inherit; }
.rfd-rename button, .rfd-actions button, .rfd-row-btn { border: 1px solid var(--border); border-radius: 6px; background: var(--surface); color: var(--text-2); font: inherit; font-size: var(--fs-caption); cursor: pointer; }
.rfd-rename button { padding: 4px 7px; }
.rfd-actions { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 10px; }
.rfd-actions button { min-height: 28px; display: inline-flex; align-items: center; gap: 5px; padding: 4px 9px; font-weight: 600; }
.rfd-actions button:hover:not(:disabled), .rfd-row-btn:hover:not(:disabled) { border-color: var(--accent); color: var(--accent); }
.rfd-actions button.primary { border-color: var(--accent); background: var(--accent-light); color: var(--accent-ink); }
.rfd-actions button.danger { margin-left: auto; color: var(--danger); }
.rfd-actions button:disabled, .rfd-row-btn:disabled { opacity: var(--opacity-disabled); cursor: not-allowed; }
.rfd-members { margin-top: 10px; padding-top: 8px; border-top: 1px solid var(--border); max-height: 260px; overflow: auto; }
.rfd-row { display: flex; align-items: center; gap: 8px; min-height: 46px; padding: 6px 4px; border-bottom: 1px solid var(--border); }
.rfd-row:last-child { border-bottom: 0; }
.rfd-dot { width: 7px; height: 7px; border-radius: 50%; background: var(--success); flex: none; }
.rfd-dot.muted { background: var(--text-4); }
.rfd-main { flex: 1; min-width: 0; }
.rfd-main b, .rfd-main small { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.rfd-main b { font-size: var(--fs-sub); color: var(--text); }
.rfd-main small { margin-top: 3px; font-size: var(--fs-micro); color: var(--text-3); }
.rfd-row-btn { flex: none; min-height: 28px; padding: 4px 7px; }
.rfd-row-btn.remove { color: var(--text-3); }
.rfd-row-btn.remove:hover { border-color: var(--danger); color: var(--danger); }
.rfd-empty { margin-top: 9px; padding: 15px; border: 1px dashed var(--border); border-radius: var(--radius-sm); color: var(--text-3); font-size: var(--fs-caption); text-align: center; }
.rfd-foot { display: inline-flex; align-items: flex-start; gap: 6px; color: var(--text-3); font-size: var(--fs-caption); line-height: 1.55; }
@media (max-width: 600px) {
  .rfd-create { flex-wrap: wrap; }
  .rfd-create button { width: 100%; justify-content: center; }
  .rfd-actions button.danger { margin-left: 0; }
}
</style>
