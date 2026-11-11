<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
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
import type { CaptureConvertedKind, CaptureItem, CapturePatch } from '@/shared/cloud/sync'

defineOptions({ name: 'InboxPanel' })

type SortOrder = 'desc' | 'asc'

const store = useAppStore()
const inbox = useInbox()
const sortOrder = ref<SortOrder>('desc')
const converting = ref('')
const deleting = ref('')
const saving = ref(false)
const clearing = ref(false)
const detailId = ref('')
const successText = ref('')
const successTarget = ref<{ kind: CaptureConvertedKind; id: string } | null>(null)
const online = ref(typeof navigator === 'undefined' ? true : navigator.onLine)
const taskDetailRef = ref<InstanceType<typeof TaskDetailDrawer> | null>(null)
const curiosityPanelRef = ref<InstanceType<typeof CuriosityPanel> | null>(null)
let openItemTimer: number | null = null

const visibleItems = computed(() => [...inbox.items.value].sort((a, b) =>
  sortOrder.value === 'desc' ? b.createdAt - a.createdAt : a.createdAt - b.createdAt,
))
const detailItem = computed(() => inbox.items.value.find(item => item.id === detailId.value) || null)

function fixedName(item: CaptureItem): string {
  return item.contentKind === 'link' ? '链接采集' : '文本采集'
}

function summary(item: CaptureItem): string {
  const raw = item.title?.trim() || item.text?.trim() || item.url || '无标题'
  return raw.replace(/\s+/g, ' ').slice(0, 110)
}

function timeText(ts: number): string {
  return new Date(ts).toLocaleString('zh-CN', {
    hour12: false,
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function kindLabel(kind: CaptureConvertedKind): string {
  return kind === 'task' ? '任务卡' : kind === 'curiosity' ? '好奇心卡' : '资源卡'
}

function openItemNow(item: CaptureItem): void {
  detailId.value = item.id
}

function openItem(item: CaptureItem): void {
  if (openItemTimer) window.clearTimeout(openItemTimer)
  openItemTimer = window.setTimeout(() => {
    openItemTimer = null
    openItemNow(item)
  }, 220)
}

function openSource(item: CaptureItem, overrideUrl?: string): void {
  if (openItemTimer) {
    window.clearTimeout(openItemTimer)
    openItemTimer = null
  }
  const raw = overrideUrl ?? item.url
  const url = toOpenableRawLink(raw)
  if (!url) {
    showToast(raw ? '这条采集链接不可打开（请检查链接格式）' : '这条采集没有原始链接')
    return
  }
  openExternalLink(url)
}

function openTarget(kind: CaptureConvertedKind, id: string): void {
  if (!id) return
  if (kind === 'task') {
    const task = store.data?.tasks.find(row => row.id === id && !row.deletedAt)
    if (task) taskDetailRef.value?.open(task)
    else showToast('目标任务卡暂不可用')
    return
  }
  if (kind === 'curiosity') {
    curiosityPanelRef.value?.openDetail(id)
    return
  }
  emitOpenDrawer({ kind: 'res', id })
}

function openSuccessTarget(): void {
  const target = successTarget.value
  if (!target) return
  openTarget(target.kind, target.id)
}

async function convert(item: CaptureItem, kind: CaptureConvertedKind): Promise<void> {
  if (converting.value) {
    showToast('上一条正在转化，请稍候')
    return
  }
  converting.value = item.id
  try {
    const result = await inbox.convert(item, kind)
    detailId.value = ''
    successTarget.value = result
    successText.value = `已转化为${kindLabel(result.kind)}，并已离开 Inbox。${inbox.connected.value && online.value ? '' : '云端转化状态会在联网后自动补写。'}`
    showToast(`已转化为${kindLabel(result.kind)}`, {
      label: '打开',
      cb: () => openTarget(result.kind, result.id),
    })
  } catch (error) {
    showToast(`转化失败：${error instanceof Error ? error.message : String(error)}`)
  } finally {
    converting.value = ''
  }
}

async function saveFromDetail(patch: CapturePatch): Promise<void> {
  const item = detailItem.value
  if (!item || saving.value) return
  saving.value = true
  try {
    await inbox.update(item, patch)
    showToast(inbox.error.value ? '已保存到本机，等待联网补写云端' : '采集修改已保存')
  } catch (error) {
    showToast(`保存失败：${error instanceof Error ? error.message : String(error)}`)
  } finally {
    saving.value = false
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
    showToast('已从 Inbox 删除采集', {
      label: '撤销',
      cb: () => {
        void inbox.restore(item).catch(error => {
          showToast(`撤销失败：${error instanceof Error ? error.message : String(error)}`)
        })
      },
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
  const ok = await useConfirm({
    title: '清空 Inbox',
    message: `确定清空 Inbox 里全部 ${inbox.items.value.length} 条未转化采集？已生成的任务卡、好奇心卡和资源卡不会受到影响。`,
    confirmText: '清空 Inbox',
  })
  if (!ok) return
  clearing.value = true
  try {
    const rows = await inbox.clearAll()
    detailId.value = ''
    showToast(`已清空 Inbox ${rows.length} 条记录`, {
      label: '撤销',
      cb: () => {
        void inbox.restoreMany(rows).catch(error => {
          showToast(`撤销失败：${error instanceof Error ? error.message : String(error)}`)
        })
      },
    }, { duration: 5000, undoWindowMs: 5000 })
  } catch (error) {
    showToast(`清空失败：${error instanceof Error ? error.message : String(error)}`)
  } finally {
    clearing.value = false
  }
}

function onOnline(): void {
  online.value = true
  void inbox.refresh(true)
}

function onOffline(): void {
  online.value = false
}

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
          <p>移动采集与待处理收件箱：先收进来，再决定它成为任务、好奇心还是资源。</p>
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
          <Icon name="trash" :size="13"/> {{ clearing ? '清空中…' : '全部清空' }}
        </button>
      </div>
    </header>

    <div v-if="successText" class="inbox-success" role="status">
      <Icon name="check" :size="14"/>
      <span>{{ successText }}</span>
      <button v-if="successTarget" type="button" @click="openSuccessTarget">打开{{ kindLabel(successTarget.kind) }}</button>
      <button type="button" @click="successText = ''">知道了</button>
    </div>

    <div v-if="!inbox.connected.value || !online" class="inbox-offline">
      <Icon :name="online ? 'plug' : 'warn'" :size="16"/>
      <div>
        <b>{{ online ? '云端未连接' : '当前处于离线状态' }}</b>
        <span>{{ online ? 'Inbox 由云端账号承载。当前可使用本机缓存编辑与转化，云端状态会在连接后补写。' : '可查看、编辑并转化本机缓存；删除与清空需联网，编辑会在联网后自动补写。' }}</span>
      </div>
      <button v-if="!inbox.connected.value" type="button" @click="$router.push('/settings?page=data')">去连接</button>
    </div>
    <div v-else-if="inbox.error.value" class="inbox-error">{{ inbox.error.value }}</div>

    <div v-if="visibleItems.length" class="inbox-list">
      <article v-for="item in visibleItems" :key="item.id" class="inbox-row" :data-capture-id="item.id">
        <button type="button" class="inbox-open"
          :aria-label="`打开${fixedName(item)}详情`"
          :title="item.url ? '单击查看并编辑详情，双击打开原始链接' : '单击查看并编辑详情'"
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
            </span>
            <span v-if="item.text && item.title" class="inbox-extra">{{ item.text.replace(/\s+/g, ' ').slice(0, 150) }}</span>
            <span v-else-if="item.note" class="inbox-extra">{{ item.note.replace(/\s+/g, ' ').slice(0, 150) }}</span>
            <span v-if="item.tags?.length" class="inbox-tags">
              <i v-for="tag in item.tags.slice(0, 6)" :key="tag">{{ tag }}</i>
            </span>
          </span>
          <span class="inbox-open-hint">查看详情 <Icon name="arrowright" :size="11"/></span>
        </button>
        <div class="inbox-actions" aria-label="Inbox 行内操作">
          <span class="inbox-actions-label">转为</span>
          <button type="button" :disabled="!!converting || deleting === item.id"
            title="把这条采集转化任务卡，转化后离开 Inbox"
            @click.stop="convert(item, 'task')"><Icon name="check" :size="12"/>任务卡</button>
          <button type="button" :disabled="!!converting || deleting === item.id"
            title="把这条采集转化为好奇心卡，转化后离开 Inbox"
            @click.stop="convert(item, 'curiosity')"><Icon name="bulb" :size="12"/>好奇心卡</button>
          <button type="button" :disabled="!!converting || deleting === item.id"
            title="把这条采集转化为资源卡，转化后离开 Inbox"
            @click.stop="convert(item, 'resource')"><Icon name="package" :size="12"/>资源卡</button>
          <span class="inbox-actions-spacer" />
          <button v-if="item.contentKind === 'link' && item.url" type="button"
            title="打开原始链接"
            @click.stop="openSource(item)"><Icon name="link" :size="12"/>打开</button>
          <button type="button" title="打开详情并编辑"
            @click.stop="openItemNow(item)"><Icon name="edit" :size="12"/>编辑</button>
          <button type="button" class="danger" :disabled="deleting === item.id || !inbox.connected.value || !online"
            :title="!inbox.connected.value ? '连接云同步后可删除' : !online ? '离线状态不可删除' : '删除这条采集'"
            @click.stop="remove(item)"><Icon name="trash" :size="12"/>{{ deleting === item.id ? '删除中…' : '删除' }}</button>
        </div>
      </article>
    </div>

    <EmptyState v-else-if="!inbox.loading.value" size="page" icon="inbox"
      title="Inbox 已经清空"
      desc="从移动端提交链接或文本后会按采集时间出现在这里；转化或删除后即离开本列表。"
      hint="默认最新在前，可切换为最早在前。" />

    <TaskDetailDrawer ref="taskDetailRef" />
    <CuriosityPanel ref="curiosityPanelRef" details-only />
    <InboxCaptureDrawer :open="!!detailItem" :item="detailItem"
      :busy="!!converting" :saving="saving" :deleting="deleting === detailItem?.id"
      @close="detailId = ''"
      @save="saveFromDetail"
      @convert="convertFromDetail"
      @remove="removeFromDetail"
      @open-source="detailItem && openSource(detailItem, $event)" />
  </section>
</template>

<style scoped>
.inbox-panel { display: flex; flex-direction: column; gap: 14px; }
.inbox-head { display: flex; align-items: center; justify-content: space-between; gap: 14px; padding: 14px 16px; border: 1px solid var(--border); border-radius: 12px; background: linear-gradient(135deg, var(--surface), var(--surface-2)); }
.inbox-success { display: flex; align-items: center; gap: 8px; padding: 9px 11px; border: 1px solid color-mix(in srgb, var(--success) 38%, var(--border)); border-radius: 9px; background: var(--success-bg-soft); color: var(--text-2); font-size: var(--fs-caption); }
.inbox-success span { flex: 1; min-width: 0; }
.inbox-success button { border: 0; background: transparent; color: var(--accent-ink); font: inherit; font-size: var(--fs-caption); font-weight: 650; cursor: pointer; }
.inbox-title-wrap { display: flex; align-items: center; gap: 11px; min-width: 0; }
.inbox-icon { width: 38px; height: 38px; flex: none; display: grid; place-items: center; border-radius: 11px; background: var(--accent-light); color: var(--accent-ink); }
.inbox-title-wrap h2 { margin: 0; font-size: var(--fs-title); }
.inbox-title-wrap p { margin: 2px 0 0; color: var(--text-3); font-size: var(--fs-caption); }
.inbox-tools { display: flex; gap: 7px; flex: none; }
.inbox-tools button, .inbox-offline button { min-height: 30px; display: inline-flex; align-items: center; gap: 5px; padding: 5px 10px; border: 1px solid var(--border); border-radius: 7px; background: var(--surface); color: var(--text-2); font: inherit; font-size: var(--fs-caption); cursor: pointer; }
.inbox-tools button:hover { border-color: var(--accent); color: var(--accent); }
.inbox-tools button:disabled { opacity: var(--opacity-disabled); cursor: not-allowed; }
.inbox-tools button.clear-btn { color: var(--danger); }
.inbox-offline { display: flex; align-items: center; gap: 10px; padding: 12px 14px; border: 1px solid var(--border); border-radius: 10px; background: var(--warning-bg-soft); color: var(--text-2); }
.inbox-offline > div { flex: 1; display: flex; flex-direction: column; gap: 2px; }
.inbox-offline b { font-size: var(--fs-sub); }
.inbox-offline span { color: var(--text-3); font-size: var(--fs-caption); }
.inbox-error { padding: 9px 11px; border-radius: 8px; background: var(--danger-bg-soft); color: var(--danger); font-size: var(--fs-caption); }
.inbox-list { display: flex; flex-direction: column; gap: 8px; }
.inbox-row { padding: 12px 13px; border: 1px solid var(--border); border-radius: 10px; background: var(--surface); transition: border-color var(--dur-fast), background var(--dur-fast); }
.inbox-open { width: 100%; min-width: 0; display: flex; align-items: flex-start; gap: 11px; padding: 0; border: 0; border-radius: 0; background: transparent; color: inherit; font: inherit; text-align: left; cursor: pointer; }
.inbox-row:hover { border-color: var(--accent); background: color-mix(in srgb, var(--accent-light) 25%, var(--surface)); }
.inbox-leading { width: 31px; height: 31px; flex: none; display: grid; place-items: center; border-radius: 8px; background: var(--surface-2); color: var(--text-3); }
.inbox-leading.text { color: var(--accent-ink); background: var(--accent-light); }
.inbox-copy { flex: 1; min-width: 0; display: block; }
.inbox-row-head { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.inbox-row-head b { color: var(--text); font-size: var(--fs-sub); }
.inbox-kind-tag { padding: 1px 6px; border-radius: 999px; background: var(--surface-2); color: var(--text-3); font-size: var(--fs-micro); }
.inbox-time { display: inline-flex; align-items: center; gap: 3px; color: var(--text-3); font-size: var(--fs-micro); }
.inbox-extra { display: block; margin-top: 5px; color: var(--text-3); font-size: var(--fs-caption); line-height: 1.55; word-break: break-word; }
.inbox-tags { display: flex; gap: 4px; flex-wrap: wrap; margin-top: 6px; }
.inbox-tags i { padding: 1px 6px; border-radius: 999px; background: var(--surface-2); color: var(--text-3); font-size: var(--fs-micro); font-style: normal; }
.inbox-open-hint { flex: none; align-self: center; display: inline-flex; align-items: center; gap: 3px; color: var(--text-3); font-size: var(--fs-micro); }
.inbox-row:hover .inbox-open-hint { color: var(--accent-ink); }
.inbox-actions { display: flex; align-items: center; gap: 5px; flex-wrap: wrap; margin-top: 10px; padding-top: 9px; border-top: 1px solid var(--border); }
.inbox-actions-label { margin-right: 1px; color: var(--text-2); font-size: var(--fs-micro); }
.inbox-actions button { min-height: 26px; display: inline-flex; align-items: center; gap: 4px; padding: 2px 8px; border: 1px solid var(--border); border-radius: 999px; background: var(--surface); color: var(--text-2); font: inherit; font-size: var(--fs-micro); cursor: pointer; }
.inbox-actions button:hover { border-color: var(--accent); color: var(--accent-ink); background: var(--accent-light); }
.inbox-actions button:focus-visible { outline: 2px solid var(--accent); outline-offset: 1px; }
.inbox-actions button:disabled { opacity: var(--opacity-disabled); cursor: not-allowed; border-color: var(--border); background: var(--surface); color: var(--text-2); }
.inbox-actions button.danger:hover { border-color: var(--danger-border); color: var(--danger); background: var(--danger-bg-soft); }
.inbox-actions-spacer { flex: 1; min-width: 8px; }
@media (max-width: 760px) {
  .inbox-head { align-items: flex-start; flex-direction: column; }
  .inbox-tools { width: 100%; }
  .inbox-tools button { flex: 1; justify-content: center; }
  .inbox-open-hint { display: none; }
  .inbox-actions-label, .inbox-actions-spacer { display: none; }
  .inbox-actions button { flex: 1 1 calc(33.333% - 5px); justify-content: center; }
  .inbox-panel { gap: 10px; }
}
</style>
