<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import Icon from '@/shared/components/Icon.vue'
import EmptyState from '@/shared/components/EmptyState.vue'
import TaskDetailDrawer from './TaskDetailDrawer.vue'
import CuriosityPanel from './CuriosityPanel.vue'
import InboxCountBadge from './InboxCountBadge.vue'
import InboxCaptureDrawer from './InboxCaptureDrawer.vue'
import { showToast } from '@/shared/components/toast'
import { useConfirm } from '@/shared/components/confirm'
import { useAppStore } from '@/newtab/stores/app'
import { useInbox } from '@/newtab/composables/useInbox'
import { emitOpenDrawer } from '@/shared/utils/bus'
import { openExternalLink, toOpenableRawLink } from '@/shared/utils/link'
import type { CaptureConvertedKind, CaptureItem } from '@/shared/cloud/sync'

defineOptions({ name: 'InboxPanel' })

type Group = 'pending' | CaptureConvertedKind
type SortOrder = 'desc' | 'asc'

const store = useAppStore()
const inbox = useInbox()
const group = ref<Group>('pending')
const sortOrder = ref<SortOrder>('desc')
const converting = ref('')
const deleting = ref('')
const clearing = ref(false)
const detailId = ref('')
const highlightedId = ref('')
const successText = ref('')
const online = ref(typeof navigator === 'undefined' ? true : navigator.onLine)
const taskDetailRef = ref<InstanceType<typeof TaskDetailDrawer> | null>(null)
const curiosityPanelRef = ref<InstanceType<typeof CuriosityPanel> | null>(null)
let openItemTimer: number | null = null

const groups: { key: Group; label: string }[] = [
  { key: 'pending', label: '未转化' },
  { key: 'task', label: '转化为任务卡' },
  { key: 'curiosity', label: '转化为好奇心卡' },
  { key: 'resource', label: '转化为资源卡' },
]
const conversionOptions: { kind: CaptureConvertedKind; label: string }[] = [
  { kind: 'curiosity', label: '好奇心卡' },
  { kind: 'task', label: '任务卡' },
  { kind: 'resource', label: '资源卡' },
]

function itemGroup(item: CaptureItem): Group {
  return item.convertedKind || 'pending'
}

const visibleItems = computed(() => {
  const rows = inbox.items.value.filter(item => itemGroup(item) === group.value)
  return [...rows].sort((a, b) => sortOrder.value === 'desc' ? b.createdAt - a.createdAt : a.createdAt - b.createdAt)
})

function groupCount(key: Group): number {
  return inbox.items.value.filter(item => itemGroup(item) === key).length
}

function fixedName(item: CaptureItem): string {
  return item.contentKind === 'link' ? '链接采集' : '文本采集'
}

function summary(item: CaptureItem): string {
  const raw = item.title?.trim() || item.text?.trim() || item.url || '无标题'
  return raw.replace(/\s+/g, ' ').slice(0, 96)
}

function timeText(ts: number): string {
  return new Date(ts).toLocaleString('zh-CN', { hour12: false, month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
}

function kindLabel(kind: CaptureConvertedKind): string {
  return kind === 'task' ? '任务卡' : kind === 'curiosity' ? '好奇心卡' : '资源卡'
}

function localCard(item: CaptureItem): { id: string; kind: CaptureConvertedKind } | null {
  const data = store.data
  if (!data || !item.convertedCardId || !item.convertedKind) return null
  const exists = item.convertedKind === 'task'
    ? data.tasks.some(card => card.id === item.convertedCardId && !card.deletedAt)
    : item.convertedKind === 'curiosity'
      ? data.curiosities.some(card => card.id === item.convertedCardId && !card.deletedAt)
      : data.resources.some(card => card.id === item.convertedCardId && !card.deletedAt)
  return exists ? { id: item.convertedCardId, kind: item.convertedKind } : null
}

const detailItem = computed(() => inbox.items.value.find(item => item.id === detailId.value) || null)

function openItemNow(item: CaptureItem): void {
  if (item.convertedKind) {
    detailId.value = ''
    openConverted(item)
    return
  }
  detailId.value = item.id
}

/** Let dblclick cancel the pending single-click branch before it opens a drawer. */
function openItem(item: CaptureItem): void {
  if (openItemTimer) window.clearTimeout(openItemTimer)
  openItemTimer = window.setTimeout(() => {
    openItemTimer = null
    openItemNow(item)
  }, 220)
}

function openSource(item: CaptureItem): void {
  if (openItemTimer) {
    window.clearTimeout(openItemTimer)
    openItemTimer = null
  }
  const url = toOpenableRawLink(item.url)
  if (!url) {
    showToast(item.url ? '这条采集链接不可打开（请检查链接格式）' : '这条采集没有原始链接')
    return
  }
  openExternalLink(url)
}

async function convert(item: CaptureItem, kind: CaptureConvertedKind): Promise<void> {
  if (item.convertedKind) {
    group.value = item.convertedKind
    highlightedId.value = item.id
    showToast(`这条采集已经转化为${kindLabel(item.convertedKind)}`)
    return
  }
  if (converting.value) {
    showToast('上一条正在转化，请稍候')
    return
  }
  converting.value = item.id
  try {
    const result = await inbox.convert(item, kind)
    group.value = result.kind
    highlightedId.value = item.id
    successText.value = `已转化为${kindLabel(result.kind)}；目标卡已进入对应卡池，Inbox 只保留镜像入口。${inbox.connected.value && online.value ? '' : '转化状态会在联网后自动同步。'}`
    showToast(`已转化为${kindLabel(result.kind)}`)
    await nextTick()
    document.querySelector<HTMLElement>(`[data-capture-id="${CSS.escape(item.id)}"]`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  } catch (error) {
    showToast(`转化失败：${error instanceof Error ? error.message : String(error)}`)
  } finally {
    converting.value = ''
  }
}

async function remove(item: CaptureItem): Promise<void> {
  if (!inbox.connected.value) {
    showToast('请先连接云同步，再删除 Inbox 记录')
    return
  }
  if (!online.value) {
    showToast('当前处于离线状态，联网后再删除')
    return
  }
  if (deleting.value) return
  deleting.value = item.id
  try {
    await inbox.dismiss(item)
    if (detailId.value === item.id) detailId.value = ''
    const converted = !!item.convertedKind
    showToast(converted ? '已移除 Inbox 镜像入口，目标卡片仍保留' : '已从 Inbox 删除采集', {
      label: '撤销',
      cb: () => { void inbox.restore(item).catch(error => showToast(`撤销失败：${error instanceof Error ? error.message : String(error)}`)) },
    })
  } catch (error) {
    showToast(`删除失败：${error instanceof Error ? error.message : String(error)}`)
  } finally {
    deleting.value = ''
  }
}

async function convertFromDetail(kind: CaptureConvertedKind): Promise<void> {
  if (!detailItem.value) return
  await convert(detailItem.value, kind)
}

async function removeFromDetail(): Promise<void> {
  if (!detailItem.value) return
  await remove(detailItem.value)
}

function openTargetFromDetail(): void {
  if (!detailItem.value) return
  openItem(detailItem.value)
}

async function clearInbox(): Promise<void> {
  if (!inbox.connected.value) {
    showToast('请先连接云同步，再清空 Inbox')
    return
  }
  if (!online.value) {
    showToast('当前处于离线状态，联网后再清空')
    return
  }
  if (!inbox.items.value.length || clearing.value) return
  const converted = inbox.items.value.filter(item => !!item.convertedKind).length
  const ok = await useConfirm({
    title: '清空 Inbox',
    message: `确定清空 Inbox 里的全部 ${inbox.items.value.length} 条记录？${converted ? `\n其中 ${converted} 条已转化记录只会移除 Inbox 镜像入口，任务卡、好奇心卡、资源卡池中的目标卡都会保留。` : '\n已入池的目标卡不会受到任何影响。'}`,
    confirmText: '清空 Inbox',
  })
  if (!ok) return
  clearing.value = true
  try {
    const rows = await inbox.clearAll()
    detailId.value = ''
    showToast(`已清空 Inbox ${rows.length} 条记录，目标卡均已保留`, {
      label: '撤销',
      cb: () => {
        void inbox.restoreMany(rows).catch(error => showToast(`撤销失败：${error instanceof Error ? error.message : String(error)}`))
      },
    }, { duration: 5000, undoWindowMs: 5000 })
  } catch (error) {
    showToast(`清空失败：${error instanceof Error ? error.message : String(error)}`)
  } finally {
    clearing.value = false
  }
}

function openConverted(item: CaptureItem): void {
  if (!item.convertedKind) return
  const card = localCard(item)
  if (!card) { showToast('目标卡暂不可用（可能尚未同步到本机）'); return }
  if (card.kind === 'task') {
    const task = store.data?.tasks.find(row => row.id === card.id)
    if (task) taskDetailRef.value?.open(task)
  } else if (card.kind === 'curiosity') {
    curiosityPanelRef.value?.openDetail(card.id)
  } else {
    emitOpenDrawer({ kind: 'res', id: card.id })
  }
}

function onOnline(): void {
  online.value = true
  void inbox.refresh(true)
}

function onOffline(): void { online.value = false }

onMounted(() => {
  void inbox.refresh(true)
  window.addEventListener('online', onOnline)
  window.addEventListener('offline', onOffline)
})
onBeforeUnmount(() => {
  if (openItemTimer) {
    window.clearTimeout(openItemTimer)
    openItemTimer = null
  }
  window.removeEventListener('online', onOnline)
  window.removeEventListener('offline', onOffline)
})

defineExpose({ refresh: (force = true) => inbox.refresh(force) })
</script>

<template>
  <section class="inbox-panel">
    <header class="inbox-head">
      <div class="inbox-title-wrap">
        <span class="inbox-icon"><Icon name="inbox" :size="18"/></span>
        <div>
          <h2>Inbox</h2>
          <p>移动端先收进来，再在这里判断它该成为哪一种卡。</p>
        </div>
        <InboxCountBadge :count="inbox.untransformedCount.value" :cached="!inbox.connected.value" />
      </div>
      <div class="inbox-tools">
        <button type="button" :disabled="inbox.loading.value || !online" @click="inbox.refresh(true)">
          <Icon name="refresh" :size="13"/> {{ inbox.loading.value ? '刷新中…' : '刷新' }}
        </button>
        <button type="button" class="sort-btn" @click="sortOrder = sortOrder === 'desc' ? 'asc' : 'desc'">
          <Icon name="arrowupdown" :size="13"/> {{ sortOrder === 'desc' ? '最新在前' : '最早在前' }}
        </button>
        <button v-if="inbox.items.value.length" type="button" class="clear-btn"
          :disabled="clearing || !inbox.connected.value || !online" @click="clearInbox">
          <Icon name="trash" :size="13"/> {{ clearing ? '清空中…' : '清空 Inbox' }}
        </button>
      </div>
    </header>

    <div v-if="successText" class="inbox-success" role="status">
      <Icon name="check" :size="14"/>
      <span>{{ successText }}</span>
      <button type="button" @click="successText = ''">知道了</button>
    </div>

    <div v-if="!inbox.connected.value || !online" class="inbox-offline">
      <Icon :name="online ? 'plug' : 'warn'" :size="16"/>
      <div>
        <b>{{ online ? '云端未连接' : '当前处于离线状态' }}</b>
        <span>{{ online ? 'Inbox 由云端账号承载。当前可使用本机缓存转化，状态会在连接后补写。' : '可查看并转化本机缓存记录；转化状态会在网络恢复后自动同步。删除与清空需联网。' }}</span>
      </div>
      <button v-if="!inbox.connected.value" type="button" @click="$router.push('/settings?page=data')">去连接</button>
    </div>
    <div v-else-if="inbox.error.value" class="inbox-error">{{ inbox.error.value }}</div>

    <div class="inbox-groups" role="tablist" aria-label="Inbox 分组">
      <button v-for="item in groups" :key="item.key" type="button" role="tab"
        :aria-selected="group === item.key" :class="{ on: group === item.key }"
        @click="group = item.key; highlightedId = ''">
        {{ item.label }} <span>{{ groupCount(item.key) }}</span>
      </button>
    </div>

    <div v-if="visibleItems.length" class="inbox-list">
      <article v-for="item in visibleItems" :key="item.id" class="inbox-row"
        :class="{ converted: !!item.convertedKind, 'is-highlighted': highlightedId === item.id }"
        :data-capture-id="item.id">
        <button type="button" class="inbox-open"
          :aria-label="item.convertedKind ? `打开${kindLabel(item.convertedKind)}详情` : `打开${fixedName(item)}详情`"
          :title="item.url ? '单击查看采集详情，双击打开原始链接' : '单击查看采集详情'"
          @click="openItem(item)" @dblclick.prevent.stop="openSource(item)"
          @keydown.enter.prevent.stop="openSource(item)"
          @keydown.space.prevent.stop="openSource(item)">
          <span class="inbox-leading" :class="item.contentKind">
            <Icon :name="item.contentKind === 'link' ? 'link' : 'filetext'" :size="15"/>
          </span>
          <span class="inbox-copy">
            <span class="inbox-row-head">
              <b>{{ summary(item) }}</b>
              <span class="inbox-kind-tag">{{ fixedName(item) }}</span>
              <span class="inbox-time"><Icon name="clock" :size="11"/> {{ timeText(item.createdAt) }}</span>
              <span v-if="item.convertedKind" class="inbox-state">{{ kindLabel(item.convertedKind) }}镜像</span>
            </span>
            <span v-if="item.text && item.title" class="inbox-extra">{{ item.text.replace(/\s+/g, ' ').slice(0, 128) }}</span>
            <span v-if="item.convertedKind && !localCard(item)" class="inbox-missing">目标卡暂不可用</span>
          </span>
        </button>
        <div class="inbox-actions">
          <button v-for="option in conversionOptions" :key="option.kind" type="button"
            :class="{ on: item.convertedKind === option.kind }"
            :disabled="!!item.convertedKind || !!converting"
            :title="item.convertedKind ? `已转化为${kindLabel(item.convertedKind)}，其余类型不可再选` : converting ? '正在转化另一条记录' : `转化为${option.label}`"
            @click.stop="convert(item, option.kind)">
            {{ option.label }}
          </button>
          <button v-if="item.convertedKind" type="button" class="on" @click.stop="openConverted(item)">
            打开{{ kindLabel(item.convertedKind) }}
          </button>
          <button v-if="item.url" type="button" :title="`打开原始链接：${item.url}`" @click.stop="openSource(item)">
            <Icon name="external" :size="12"/> 打开链接
          </button>
          <button type="button" class="danger" :disabled="deleting === item.id || !inbox.connected.value || !online" @click.stop="remove(item)">
            <Icon name="trash" :size="12"/> 删除
          </button>
        </div>
      </article>
    </div>

    <EmptyState v-else-if="!inbox.loading.value" size="page" icon="inbox"
      :title="group === 'pending' ? 'Inbox 暂时没有未转化内容' : '这个分组还没有记录'"
      :desc="group === 'pending' ? '从移动端提交链接或文本后，会按采集时间出现在这里。' : '完成对应类型的转化后，记录会作为镜像入口保留。'"
      hint="默认最新在前，可切换为最早在前。" />

    <TaskDetailDrawer ref="taskDetailRef" />
    <CuriosityPanel ref="curiosityPanelRef" details-only />
    <InboxCaptureDrawer :open="!!detailItem" :item="detailItem"
      :busy="!!converting" :deleting="deleting === detailItem?.id"
      @close="detailId = ''"
      @convert="convertFromDetail"
      @remove="removeFromDetail"
      @open-source="detailItem && openSource(detailItem)"
      @open-target="openTargetFromDetail" />
  </section>
</template>

<style scoped>
.inbox-panel { display: flex; flex-direction: column; gap: 14px; }
.inbox-head { display: flex; align-items: center; justify-content: space-between; gap: 14px; padding: 14px 16px; border: 1px solid var(--border); border-radius: 12px; background: linear-gradient(135deg, var(--surface), var(--surface-2)); }
.inbox-success { display: flex; align-items: center; gap: 8px; padding: 9px 11px; border: 1px solid color-mix(in srgb, var(--success) 38%, var(--border)); border-radius: 9px; background: var(--success-bg-soft); color: var(--text-2); font-size: var(--fs-caption); }
.inbox-success span { flex: 1; min-width: 0; }
.inbox-success button { border: 0; background: transparent; color: var(--accent-ink); font: inherit; font-size: var(--fs-caption); font-weight: 600; cursor: pointer; }
.inbox-title-wrap { display: flex; align-items: center; gap: 11px; min-width: 0; }
.inbox-icon { width: 38px; height: 38px; flex: none; display: grid; place-items: center; border-radius: 11px; background: var(--accent-light); color: var(--accent-ink); }
.inbox-title-wrap h2 { margin: 0; font-size: var(--fs-title); }
.inbox-title-wrap p { margin: 2px 0 0; color: var(--text-3); font-size: var(--fs-caption); }
.inbox-tools { display: flex; gap: 7px; flex: none; }
.inbox-tools button, .inbox-actions button, .inbox-offline button { min-height: 30px; display: inline-flex; align-items: center; gap: 5px; padding: 5px 10px; border: 1px solid var(--border); border-radius: 7px; background: var(--surface); color: var(--text-2); font: inherit; font-size: var(--fs-caption); cursor: pointer; }
.inbox-tools button:hover, .inbox-actions button:hover:not(:disabled) { border-color: var(--accent); color: var(--accent); }
.inbox-tools button:disabled, .inbox-actions button:disabled { opacity: var(--opacity-disabled); cursor: not-allowed; }
.inbox-tools button.clear-btn { color: var(--danger); }
.inbox-offline { display: flex; align-items: center; gap: 10px; padding: 12px 14px; border: 1px solid var(--border); border-radius: 10px; background: var(--warning-bg-soft); color: var(--text-2); }
.inbox-offline > div { flex: 1; display: flex; flex-direction: column; gap: 2px; }
.inbox-offline b { font-size: var(--fs-sub); }
.inbox-offline span { color: var(--text-3); font-size: var(--fs-caption); }
.inbox-error { padding: 9px 11px; border-radius: 8px; background: var(--danger-bg-soft); color: var(--danger); font-size: var(--fs-caption); }
.inbox-groups { display: flex; gap: 6px; flex-wrap: wrap; }
.inbox-groups button { min-height: 34px; padding: 6px 11px; border: 1px solid var(--border); border-radius: 8px; background: var(--surface); color: var(--text-3); font: inherit; font-size: var(--fs-caption); cursor: pointer; }
.inbox-groups button span { margin-left: 4px; color: var(--text-2); font-weight: 700; }
.inbox-groups button.on { border-color: var(--accent); background: var(--accent-light); color: var(--accent-ink); }
.inbox-list { display: flex; flex-direction: column; gap: 8px; }
.inbox-row { display: flex; align-items: flex-start; gap: 11px; padding: 12px 13px; border: 1px solid var(--border); border-radius: 10px; background: var(--surface); }
.inbox-open { min-width: 0; flex: 1; display: flex; align-items: flex-start; gap: 11px; padding: 0; border: 0; border-radius: 0; background: transparent; color: inherit; font: inherit; text-align: left; cursor: pointer; }
.inbox-row:hover { border-color: var(--accent); }
.inbox-row.is-highlighted { border-color: var(--success); box-shadow: 0 0 0 2px var(--success-bg-soft); animation: inbox-highlight 2.2s ease-out; }
@keyframes inbox-highlight { 0% { background: var(--success-bg-soft); } 100% { background: var(--surface); } }
.inbox-leading { width: 31px; height: 31px; flex: none; display: grid; place-items: center; border-radius: 8px; background: var(--surface-2); color: var(--text-3); }
.inbox-leading.text { color: var(--accent-ink); background: var(--accent-light); }
.inbox-copy { flex: 1; min-width: 0; display: block; }
.inbox-row-head { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.inbox-row-head b { color: var(--text); font-size: var(--fs-sub); }
.inbox-kind-tag { padding: 1px 6px; border-radius: 999px; background: var(--surface-2); color: var(--text-3); font-size: var(--fs-micro); }
.inbox-time { display: inline-flex; align-items: center; gap: 3px; color: var(--text-3); font-size: var(--fs-micro); }
.inbox-state { padding: 1px 6px; border-radius: 999px; background: var(--accent-light); color: var(--accent-ink); font-size: var(--fs-micro); font-weight: 600; }
.inbox-extra { display: block; margin-top: 5px; color: var(--text-3); font-size: var(--fs-caption); line-height: 1.55; word-break: break-word; }
.inbox-missing { display: block; margin-top: 5px; color: var(--warning); font-size: var(--fs-micro); }
.inbox-actions { display: flex; gap: 5px; flex-wrap: wrap; justify-content: flex-end; max-width: 290px; }
.inbox-actions button.on { border-color: var(--accent); background: var(--accent-light); color: var(--accent-ink); }
.inbox-actions button.danger { color: var(--danger); }
@media (max-width: 760px) {
  .inbox-head { align-items: flex-start; flex-direction: column; }
  .inbox-tools { width: 100%; }
  .inbox-tools button { flex: 1; justify-content: center; }
  .inbox-row { flex-wrap: wrap; }
  .inbox-open { width: 100%; }
  .inbox-copy { min-width: calc(100% - 45px); }
  .inbox-actions { width: 100%; max-width: none; justify-content: flex-start; padding-left: 42px; }
}
</style>
