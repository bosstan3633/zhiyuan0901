<script setup lang="ts">
import { computed } from 'vue'
import Modal from '@/shared/components/Modal.vue'
import Icon from '@/shared/components/Icon.vue'
import EmptyState from '@/shared/components/EmptyState.vue'
import { showToast } from '@/shared/components/toast'
import { useConfirm } from '@/shared/components/confirm'
import { emitOpenDrawer } from '@/shared/utils/bus'
import { openExternalLink, toOpenableUrl } from '@/shared/utils/link'
import { useAppStore } from '@/newtab/stores/app'
import { useResourceOpen } from '@/newtab/composables/useResourceOpen'
import {
  mirrorResourceOf,
  removeResourceFolderMirror,
  resourceFolderMirrorsOf,
} from '@/shared/storage/resourceFolders'
import { CURATION_WS_ID, type ResourceCard, type ResourceFolderMirror } from '@/shared/models'

const props = defineProps<{
  open: boolean
  title: string
  kind: 'today' | 'folder'
  folderId?: string
  todayStart?: number
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'manage'): void
}>()

const store = useAppStore()
const resourceData = computed(() => store.data!)
const { openResourceLink } = useResourceOpen({ store, d: resourceData })

const members = computed<ResourceFolderMirror[]>(() => {
  if (!store.data || props.kind !== 'folder' || !props.folderId) return []
  return resourceFolderMirrorsOf(store.data, props.folderId)
})

const cards = computed<ResourceCard[]>(() => {
  if (!store.data) return []
  if (props.kind === 'today') {
    const start = props.todayStart || 0
    return (store.data.resources || [])
      .filter(card =>
        !card.deletedAt
        && card.workspaceId === CURATION_WS_ID
        && (card.createdAt || 0) >= start)
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
  }
  return members.value
    .map(mirror => mirrorResourceOf(mirror, store.data!.resources))
    .filter((card): card is ResourceCard => !!card && !card.deletedAt)
})

const openableCount = computed(() =>
  new Set(cards.value.map(card => toOpenableUrl(card.linkType, card.link)).filter(Boolean)).size)

function displayLink(card: ResourceCard): string {
  const raw = (card.link || '').trim()
  if (!raw) return '无原始链接，点击查看资源详情'
  try {
    const url = new URL(raw)
    return url.hostname || raw
  } catch {
    return raw.length > 52 ? `${raw.slice(0, 52)}…` : raw
  }
}

function openCard(card: ResourceCard): void {
  const live = (store.data?.resources || []).find(resource => resource.id === card.id && !resource.deletedAt)
  if (live && openResourceLink(live)) return
  emit('close')
  emitOpenDrawer({ kind: 'res', id: card.id })
}

async function openAll(): Promise<void> {
  const seen = new Set<string>()
  const targets = cards.value.filter(card => {
    const url = toOpenableUrl(card.linkType, card.link)
    if (!url || seen.has(url)) return false
    seen.add(url)
    return true
  })
  if (!targets.length) {
    showToast('这个文件夹里没有可打开的原链')
    return
  }
  if (targets.length > 15 && !(await useConfirm({
    title: '打开全部链接',
    message: `即将打开 ${targets.length} 个链接，确认继续？`,
    confirmText: '继续打开',
    danger: false,
  }))) return
  let opened = 0
  for (const card of targets) {
    const live = (store.data?.resources || []).find(resource => resource.id === card.id && !resource.deletedAt)
    const url = toOpenableUrl(card.linkType, card.link)
    if (live ? openResourceLink(live) : (url ? openExternalLink(url) : false)) opened++
  }
  if (store.persistHot) store.persistHot()
  showToast(`已打开 ${opened} 个链接${opened > 1 ? '；若未全部出现，请允许弹出窗口' : ''}`)
}

function removeCard(card: ResourceCard): void {
  if (!store.data || props.kind !== 'folder') return
  const mirror = members.value.find(row => row.resourceId === card.id)
  if (!mirror) {
    showToast('没有找到这张卡的文件夹镜像')
    return
  }
  if (!removeResourceFolderMirror(store.data, mirror.id)) return
  store.persist()
  showToast(`已从「${props.title}」移出，资源卡本体未删除`)
}
</script>

<template>
  <Modal
    :open="open"
    width="min(720px, 94vw)"
    max-height="min(82vh, 760px)"
    @close="emit('close')"
  >
    <template #title>{{ title }}</template>
    <template #sub>
      <span>{{ cards.length }} 张资源卡<template v-if="kind === 'today'"> · 按今日采集时间倒序</template><template v-else> · 镜像成员不会改变源卡</template></span>
    </template>

    <EmptyState
      v-if="!cards.length"
      icon="folder"
      size="inline"
      :title="kind === 'today' ? '今天还没有采集资源卡' : '这个常用夹还是空的'"
      :hint="kind === 'today' ? '从浏览器快捷键采集的资源卡会按自然日自动出现在这里。' : '回到常用夹管理，把经常一起使用的资源卡放进来。'"
      action-label=""
      @action="emit('close')"
    />

    <div v-else class="rfdm-list">
      <article v-for="card in cards" :key="card.id" class="rfdm-row">
        <span class="rfdm-icon"><Icon :name="card.linkType === 'file' ? 'filetext' : card.link ? 'link' : 'package'" :size="14" /></span>
        <button class="rfdm-main" type="button" @click="openCard(card)">
          <b>{{ card.title || '（无标题资源卡）' }}</b>
          <small>{{ displayLink(card) }}</small>
        </button>
        <span class="rfdm-actions">
          <button type="button" @click="openCard(card)"><Icon name="external" :size="12" /> 打开</button>
          <button v-if="kind === 'folder'" type="button" class="remove" @click="removeCard(card)">移出</button>
        </span>
      </article>
    </div>

    <template #footer>
      <div class="rfdm-foot">
        <span>{{ openableCount }} 个可打开链接</span>
        <span class="rfdm-foot-spacer" />
        <button v-if="kind === 'folder'" type="button" @click="emit('manage')"><Icon name="folder" :size="12" /> 管理常用夹</button>
        <button type="button" class="primary" :disabled="!openableCount" @click="openAll"><Icon name="external" :size="12" /> 打开全部</button>
      </div>
    </template>
  </Modal>
</template>

<style scoped>
.rfdm-list { display: flex; flex-direction: column; gap: 5px; }
.rfdm-row { display: grid; grid-template-columns: 30px minmax(0, 1fr) auto; align-items: center; gap: 9px; min-height: 52px; padding: 7px 8px; border: 1px solid transparent; border-radius: var(--radius-sm); }
.rfdm-row:hover { border-color: var(--border); background: var(--surface-2); }
.rfdm-icon { display: grid; place-items: center; width: 30px; height: 30px; border-radius: 8px; background: var(--surface-3); color: var(--text-2); }
.rfdm-main { display: flex; min-width: 0; flex-direction: column; gap: 2px; padding: 0; border: 0; background: transparent; color: inherit; font: inherit; text-align: left; cursor: pointer; }
.rfdm-main b { overflow: hidden; color: var(--text); font-size: var(--fs-sub); text-overflow: ellipsis; white-space: nowrap; }
.rfdm-main small { overflow: hidden; color: var(--text-3); font-size: var(--fs-micro); text-overflow: ellipsis; white-space: nowrap; }
.rfdm-actions { display: inline-flex; align-items: center; gap: 5px; }
.rfdm-actions button,
.rfdm-foot button { display: inline-flex; align-items: center; gap: 4px; min-height: 28px; padding: 0 8px; border: 1px solid var(--border); border-radius: var(--radius-xs); background: var(--surface); color: var(--text-2); font: inherit; font-size: var(--fs-micro); cursor: pointer; }
.rfdm-actions button:hover,
.rfdm-foot button:hover:not(:disabled) { border-color: var(--accent); color: var(--accent-ink); }
.rfdm-actions button.remove { color: var(--text-3); }
.rfdm-actions button.remove:hover { border-color: var(--danger-border); color: var(--danger); }
.rfdm-foot { display: flex; align-items: center; gap: 7px; width: 100%; color: var(--text-3); font-size: var(--fs-caption); }
.rfdm-foot-spacer { flex: 1; }
.rfdm-foot button.primary { border-color: var(--accent); background: var(--accent); color: #fff; }
.rfdm-foot button:disabled { opacity: var(--opacity-disabled); cursor: not-allowed; }
@media (max-width: 620px) {
  .rfdm-row { grid-template-columns: 28px minmax(0, 1fr); }
  .rfdm-actions { grid-column: 2; justify-content: flex-start; }
  .rfdm-foot { flex-wrap: wrap; }
  .rfdm-foot-spacer { display: none; }
}
</style>
