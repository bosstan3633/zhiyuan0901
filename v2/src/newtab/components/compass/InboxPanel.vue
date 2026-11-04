<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import Icon from '@/shared/components/Icon.vue'
import EmptyState from '@/shared/components/EmptyState.vue'
import TaskDetailDrawer from './TaskDetailDrawer.vue'
import CuriosityPanel from './CuriosityPanel.vue'
import { showToast } from '@/shared/components/toast'
import { useAppStore } from '@/newtab/stores/app'
import { useInbox } from '@/newtab/composables/useInbox'
import { emitOpenDrawer } from '@/shared/utils/bus'
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
const online = ref(typeof navigator === 'undefined' ? true : navigator.onLine)
const taskDetailRef = ref<InstanceType<typeof TaskDetailDrawer> | null>(null)
const curiosityPanelRef = ref<InstanceType<typeof CuriosityPanel> | null>(null)

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

async function convert(item: CaptureItem, kind: CaptureConvertedKind): Promise<void> {
  if (converting.value || item.convertedKind || !inbox.connected.value || !online.value) return
  converting.value = item.id
  try {
    await inbox.convert(item, kind)
    showToast(`已转化为${kindLabel(kind)}，Inbox 会保留镜像入口`, {
      label: '查看分组',
      cb: () => { group.value = kind },
    })
  } catch (error) {
    showToast(`转化失败：${error instanceof Error ? error.message : String(error)}`)
  } finally {
    converting.value = ''
  }
}

async function remove(item: CaptureItem): Promise<void> {
  if (deleting.value || !inbox.connected.value || !online.value) return
  deleting.value = item.id
  try {
    await inbox.dismiss(item)
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
        <span class="inbox-badge" :class="{ muted: !inbox.connected.value }">{{ inbox.untransformedCount.value }}</span>
      </div>
      <div class="inbox-tools">
        <button type="button" :disabled="inbox.loading.value || !online" @click="inbox.refresh(true)">
          <Icon name="refresh" :size="13"/> {{ inbox.loading.value ? '刷新中…' : '刷新' }}
        </button>
        <button type="button" class="sort-btn" @click="sortOrder = sortOrder === 'desc' ? 'asc' : 'desc'">
          <Icon name="arrowupdown" :size="13"/> {{ sortOrder === 'desc' ? '最新在前' : '最早在前' }}
        </button>
      </div>
    </header>

    <div v-if="!inbox.connected.value || !online" class="inbox-offline">
      <Icon :name="online ? 'plug' : 'warn'" :size="16"/>
      <div>
        <b>{{ online ? '云端未连接' : '当前处于离线状态' }}</b>
        <span>{{ online ? 'Inbox 由云端账号承载。连接后可在这里盘点移动端采集。' : '可查看已缓存记录；转化和删除会在网络恢复后重新可用。' }}</span>
      </div>
      <button v-if="!inbox.connected.value" type="button" @click="$router.push('/settings?page=data')">去连接</button>
    </div>
    <div v-else-if="inbox.error.value" class="inbox-error">{{ inbox.error.value }}</div>

    <div class="inbox-groups" role="tablist" aria-label="Inbox 分组">
      <button v-for="item in groups" :key="item.key" type="button" role="tab"
        :aria-selected="group === item.key" :class="{ on: group === item.key }"
        @click="group = item.key">
        {{ item.label }} <span>{{ groupCount(item.key) }}</span>
      </button>
    </div>

    <div v-if="visibleItems.length" class="inbox-list">
      <article v-for="item in visibleItems" :key="item.id" class="inbox-row" v-pressable
        :class="{ converted: !!item.convertedKind }" :aria-disabled="!item.convertedKind"
        :aria-label="item.convertedKind ? `打开${kindLabel(item.convertedKind)}详情` : `${fixedName(item)}，尚未转化`"
        @click="openConverted(item)">
        <span class="inbox-leading" :class="item.contentKind">
          <Icon :name="item.contentKind === 'link' ? 'link' : 'filetext'" :size="15"/>
        </span>
        <div class="inbox-copy">
          <div class="inbox-row-head">
            <b>{{ fixedName(item) }}</b>
            <span class="inbox-time"><Icon name="clock" :size="11"/> {{ timeText(item.createdAt) }}</span>
            <span v-if="item.convertedKind" class="inbox-state">{{ kindLabel(item.convertedKind) }}镜像</span>
          </div>
          <p>{{ summary(item) }}</p>
          <div v-if="item.convertedKind && !localCard(item)" class="inbox-missing">目标卡暂不可用</div>
        </div>
        <div class="inbox-actions">
          <button v-for="option in conversionOptions" :key="option.kind" type="button"
            :class="{ on: item.convertedKind === option.kind }"
            :disabled="!!item.convertedKind || !!converting || !inbox.connected.value || !online"
            @click.stop="convert(item, option.kind)">
            {{ option.label }}
          </button>
          <button v-if="item.convertedKind" type="button" class="on" @click.stop="openConverted(item)">
            打开{{ kindLabel(item.convertedKind) }}
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
  </section>
</template>

<style scoped>
.inbox-panel { display: flex; flex-direction: column; gap: 14px; }
.inbox-head { display: flex; align-items: center; justify-content: space-between; gap: 14px; padding: 14px 16px; border: 1px solid var(--border); border-radius: 12px; background: linear-gradient(135deg, var(--surface), var(--surface-2)); }
.inbox-title-wrap { display: flex; align-items: center; gap: 11px; min-width: 0; }
.inbox-icon { width: 38px; height: 38px; flex: none; display: grid; place-items: center; border-radius: 11px; background: var(--accent-light); color: var(--accent-ink); }
.inbox-title-wrap h2 { margin: 0; font-size: var(--fs-title); }
.inbox-title-wrap p { margin: 2px 0 0; color: var(--text-3); font-size: var(--fs-caption); }
.inbox-badge { min-width: 24px; padding: 2px 8px; border-radius: 999px; background: var(--danger); color: #fff; text-align: center; font-size: var(--fs-caption); font-weight: 700; }
.inbox-badge.muted { background: var(--surface-3); color: var(--text-3); }
.inbox-tools { display: flex; gap: 7px; flex: none; }
.inbox-tools button, .inbox-actions button, .inbox-offline button { min-height: 30px; display: inline-flex; align-items: center; gap: 5px; padding: 5px 10px; border: 1px solid var(--border); border-radius: 7px; background: var(--surface); color: var(--text-2); font: inherit; font-size: var(--fs-caption); cursor: pointer; }
.inbox-tools button:hover, .inbox-actions button:hover:not(:disabled) { border-color: var(--accent); color: var(--accent); }
.inbox-tools button:disabled, .inbox-actions button:disabled { opacity: var(--opacity-disabled); cursor: not-allowed; }
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
.inbox-row.converted { cursor: pointer; }
.inbox-row.converted:hover { border-color: var(--accent); }
.inbox-leading { width: 31px; height: 31px; flex: none; display: grid; place-items: center; border-radius: 8px; background: var(--surface-2); color: var(--text-3); }
.inbox-leading.text { color: var(--accent-ink); background: var(--accent-light); }
.inbox-copy { flex: 1; min-width: 0; }
.inbox-row-head { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.inbox-row-head b { color: var(--text); font-size: var(--fs-sub); }
.inbox-time { display: inline-flex; align-items: center; gap: 3px; color: var(--text-3); font-size: var(--fs-micro); }
.inbox-state { padding: 1px 6px; border-radius: 999px; background: var(--accent-light); color: var(--accent-ink); font-size: var(--fs-micro); font-weight: 600; }
.inbox-copy p { margin: 5px 0 0; color: var(--text-2); font-size: var(--fs-caption); line-height: 1.55; word-break: break-word; }
.inbox-missing { margin-top: 5px; color: var(--warning); font-size: var(--fs-micro); }
.inbox-actions { display: flex; gap: 5px; flex-wrap: wrap; justify-content: flex-end; max-width: 290px; }
.inbox-actions button.on { border-color: var(--accent); background: var(--accent-light); color: var(--accent-ink); }
.inbox-actions button.danger { color: var(--danger); }
@media (max-width: 760px) {
  .inbox-head { align-items: flex-start; flex-direction: column; }
  .inbox-tools { width: 100%; }
  .inbox-tools button { flex: 1; justify-content: center; }
  .inbox-row { flex-wrap: wrap; }
  .inbox-copy { min-width: calc(100% - 45px); }
  .inbox-actions { width: 100%; max-width: none; justify-content: flex-start; padding-left: 42px; }
}
</style>
