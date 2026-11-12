<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import Modal from '@/shared/components/Modal.vue'
import Icon from '@/shared/components/Icon.vue'
import { useConfirm } from '@/shared/components/confirm'
import { showToast } from '@/shared/components/toast'
import type { CloudSyncReceipt, SyncManifestDiffRow } from '@/shared/cloud/sync'
import { syncDirectionLabel, syncFieldLabel, syncTypeLabel } from '@/shared/cloud/syncDisplay'
import type { CloudSyncReceiptAction } from '@/shared/cloud/syncActions'
import { useAppStore } from '@/newtab/stores/app'
import { useCloudSync } from '@/newtab/composables/useCloudSync'
import CloudSyncChangeTable from './CloudSyncChangeTable.vue'

const props = defineProps<{
  open: boolean
  receipt: CloudSyncReceipt | null
}>()
const emit = defineEmits<{ close: [] }>()
const store = useAppStore()
const cloud = useCloudSync()
const actions = ref<CloudSyncReceiptAction[]>([])
const actionsLoading = ref(false)
const actionsError = ref('')
const detailRow = ref<SyncManifestDiffRow | null>(null)
const detailOpen = ref(false)
const applying = ref(false)
const actionMessage = ref('')

const total = computed(() => props.receipt
  ? props.receipt.added + props.receipt.changed + props.receipt.removed
  : 0)
const atText = computed(() => props.receipt?.at
  ? new Date(props.receipt.at).toLocaleString('zh-CN', { hour12: false })
  : '—')
const triggerLabel = computed(() => {
  if (props.receipt?.trigger === 'auto') return '自动同步'
  if (props.receipt?.trigger === 'topbar') return '顶栏同步'
  if (props.receipt?.trigger === 'shortcut') return '浏览器快捷键'
  return '设置中心'
})
const actionByKey = computed(() => new Map(actions.value.map(row => [row.key, row])))
const detailAction = computed(() => detailRow.value ? actionByKey.value.get(detailRow.value.key) || null : null)
const canOperate = computed(() => !!detailAction.value
  && detailAction.value.status === 'available'
  && detailAction.value.operation !== 'readonly')
const operationLabel = computed(() => {
  const operation = detailAction.value?.operation
  if (operation === 'delete') return '删除本机记录'
  if (operation === 'restore') return '恢复到本机'
  if (operation === 'rollback') return '回退到同步前'
  return '仅可查看'
})

function actionStatusLabel(action: CloudSyncReceiptAction | null): string {
  if (!action) return '只读'
  const labels: Record<CloudSyncReceiptAction['status'], string> = {
    available: '可处理',
    deleted: '已删除',
    restored: '已恢复',
    rolled_back: '已回退',
    conflict: '记录已再次变化',
    expired: '动作载荷已过期',
    readonly: '系统记录只读',
  }
  return labels[action.status]
}

function formatValue(value: unknown): string {
  if (value === undefined || value === null) return '无'
  if (typeof value === 'string') return value || '空'
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  try {
    const text = JSON.stringify(value, null, 2)
    return text.length > 1600 ? `${text.slice(0, 1600)}\n…（详情过长已截断显示）` : text
  } catch {
    return String(value)
  }
}

function fieldValues(field: string): { before: string; after: string } {
  const action = detailAction.value
  const before = action?.before && typeof action.before === 'object'
    ? (action.before as Record<string, unknown>)[field]
    : undefined
  const after = action?.after && typeof action.after === 'object'
    ? (action.after as Record<string, unknown>)[field]
    : undefined
  return { before: formatValue(before), after: formatValue(after) }
}

async function loadActions(): Promise<void> {
  if (!props.receipt?.id) {
    actions.value = []
    return
  }
  actionsLoading.value = true
  actionsError.value = ''
  try {
    actions.value = await cloud.loadReceiptActions(props.receipt.id)
  } catch (error) {
    actionsError.value = error instanceof Error ? error.message : String(error)
  } finally {
    actionsLoading.value = false
  }
}

function openDetail(row: SyncManifestDiffRow): void {
  detailRow.value = row
  actionMessage.value = ''
  detailOpen.value = true
}

async function runAction(): Promise<void> {
  if (!props.receipt || !detailRow.value || !detailAction.value || !canOperate.value || applying.value) return
  const operation = detailAction.value.operation
  const ok = await useConfirm({
    title: operationLabel.value,
    message: operation === 'delete'
      ? '这条记录会从本机业务列表中删除，并标记为待同步；不会自动覆盖云端。'
      : operation === 'restore'
        ? '将按同步前载荷恢复到本机，保留原记录 ID，并把更新时间写为当前时刻；不会自动上传。'
        : '只有在记录指纹仍与本次同步一致时才会回退；回退只改本机，不会自动覆盖云端。',
    confirmText: operationLabel.value,
  })
  if (!ok) return
  applying.value = true
  actionMessage.value = ''
  try {
    const result = await cloud.applyReceiptAction(store, props.receipt.id, detailRow.value.key)
    actionMessage.value = result.message
    await loadActions()
    if (result.ok) {
      showToast(result.message)
      window.dispatchEvent(new CustomEvent('zy:sync-action-completed', {
        detail: { receiptId: props.receipt.id, key: detailRow.value.key, status: result.status },
      }))
    }
  } catch (error) {
    actionMessage.value = error instanceof Error ? error.message : String(error)
  } finally {
    applying.value = false
  }
}

watch(
  () => [props.open, props.receipt?.id] as const,
  ([open]) => {
    if (!open) {
      detailOpen.value = false
      detailRow.value = null
      return
    }
    void loadActions()
  },
  { immediate: true },
)
</script>

<template>
  <Modal :open="open" title="本次同步明细" width="min(1040px, 96vw)" max-height="88vh" @close="emit('close')">
    <template #title><Icon name="refresh" :size="16" /> 本次同步明细</template>
    <div v-if="receipt" class="csrm" data-testid="cloud-sync-receipt-modal">
      <div class="csrm-hero">
        <span class="csrm-mark" :class="receipt.direction"><Icon :name="receipt.direction === 'upload' ? 'arrowup' : receipt.direction === 'download' ? 'arrowdown' : receipt.direction === 'merge' ? 'refresh' : 'check'" :size="18" /></span>
        <div>
          <h2>{{ syncDirectionLabel(receipt.direction) }}</h2>
          <p>{{ total ? `本次共有 ${total} 条记录变化` : '本次没有记录变化，本机与云端已是最新一致状态' }}</p>
        </div>
        <div class="csrm-when">
          <span>{{ triggerLabel }}</span>
          <time>{{ atText }}</time>
        </div>
      </div>
      <p class="csrm-scope">本次只处理卡片、策展台、方向树、今日三件事与资源镜像关系；主题、页面布局、抽屉宽窄、筛选与排序偏好不会进入云端。</p>
      <div class="csrm-summary">
        <div><span>新增</span><b>{{ receipt.added }}</b></div>
        <div><span>修改</span><b>{{ receipt.changed }}</b></div>
        <div><span>删除</span><b>{{ receipt.removed }}</b></div>
        <div><span>修订范围</span><b>{{ receipt.fromRevision }} → {{ receipt.toRevision }}</b></div>
      </div>
      <div v-if="actionsError" class="csrm-error">{{ actionsError }}</div>
      <CloudSyncChangeTable :rows="receipt.rows" :actions="actions" empty-text="本次同步没有记录变化，已是最新状态" @open="openDetail" />
      <p class="csrm-note">
        点击任一条记录可查看同步前后值并继续处理。恢复所需的最小私有载荷只保存在本机，最长 30 天；不同步令牌、凭据或附件本体到云端。
        <span v-if="actionsLoading">正在读取本机动作载荷…</span>
      </p>
    </div>
  </Modal>

  <Modal :open="detailOpen" title="同步记录详情" width="min(760px, 94vw)" max-height="88vh" @close="detailOpen = false">
    <template #title><Icon name="filetext" :size="16" /> 同步记录详情</template>
    <div v-if="detailRow" class="csrd" data-testid="cloud-sync-record-detail">
      <div class="csrd-head">
        <span class="csrd-type">{{ syncTypeLabel(detailRow.type) }}</span>
        <div>
          <h3>{{ detailRow.title || detailRow.id }}</h3>
          <code>{{ detailRow.id }}</code>
        </div>
        <span class="csrd-state" :class="detailAction?.status || 'readonly'">{{ actionStatusLabel(detailAction) }}</span>
      </div>

      <div class="csrd-facts">
        <div><span>同步方向</span><b>{{ receipt ? syncDirectionLabel(receipt.direction) : '—' }}</b></div>
        <div><span>变更状态</span><b>{{ detailRow.status === 'added' ? '新增' : detailRow.status === 'removed' ? '删除' : '修改' }}</b></div>
        <div><span>记录时间</span><b>{{ detailRow.updatedAt ? new Date(detailRow.updatedAt).toLocaleString('zh-CN', { hour12: false }) : '无' }}</b></div>
        <div><span>建议动作</span><b>{{ operationLabel }}</b></div>
      </div>

      <section v-if="detailRow.fields?.length" class="csrd-section">
        <div class="csrd-section-h"><b>字段差异</b><small>同步前后取值只在本机展示</small></div>
        <div class="csrd-diff-head"><span>字段</span><span>同步前</span><span>同步后</span></div>
        <div v-for="field in detailRow.fields" :key="field" class="csrd-diff-row">
          <span>{{ syncFieldLabel(field) }}</span>
          <pre>{{ fieldValues(field).before }}</pre>
          <pre>{{ fieldValues(field).after }}</pre>
        </div>
      </section>
      <section v-else class="csrd-section">
        <div class="csrd-section-h"><b>记录内容</b><small>本次为整条记录级变化</small></div>
        <div class="csrd-code">
          <div>
            <span>同步前</span>
            <pre>{{ formatValue(detailAction?.before) }}</pre>
          </div>
          <div>
            <span>同步后</span>
            <pre>{{ formatValue(detailAction?.after) }}</pre>
          </div>
        </div>
      </section>

      <p v-if="actionMessage" class="csrd-result" :class="{ ok: detailAction?.status !== 'conflict' }">{{ actionMessage }}</p>
      <p v-if="!canOperate" class="csrd-readonly">
        {{ detailAction?.status === 'expired' ? '动作载荷已过期，当前只能查看摘要与已保存的差异。' : detailAction?.status === 'readonly' ? '系统、事件、统计、偏好与附件元数据记录默认只读。' : '当前状态不可继续操作；记录不会再次变化后，可在下一次同步回执中重新处理。' }}
      </p>
    </div>
    <template #footer>
      <button class="csrd-btn" type="button" @click="detailOpen = false">关闭</button>
      <button v-if="canOperate" class="csrd-btn primary" type="button" :disabled="applying" @click="runAction">
        <Icon :name="detailAction?.operation === 'delete' ? 'trash' : 'refresh'" :size="13" />
        {{ applying ? '处理中…' : operationLabel }}
      </button>
    </template>
  </Modal>
</template>

<style scoped>
.csrm { display: flex; flex-direction: column; gap: 12px; }
.csrm-hero { display: flex; align-items: center; gap: 11px; padding: 13px 14px; border: 1px solid var(--border); border-radius: 11px; background: linear-gradient(120deg, var(--surface-2), var(--surface)); }
.csrm-mark { width: 38px; height: 38px; flex: none; display: grid; place-items: center; border-radius: 10px; background: var(--accent-light); color: var(--accent-ink); }
.csrm-mark.download { background: var(--tag-info-bg); color: var(--tag-info-text); }
.csrm-mark.latest { background: var(--success-bg-soft); color: var(--success); }
.csrm-mark.merge { background: var(--warning-bg-soft); color: var(--warning); }
.csrm-hero > div:nth-child(2) { flex: 1; min-width: 0; }
.csrm-hero h2 { margin: 0; color: var(--text); font-size: var(--fs-title); }
.csrm-hero p { margin: 3px 0 0; color: var(--text-3); font-size: var(--fs-caption); }
.csrm-when { flex: none; display: flex; flex-direction: column; align-items: flex-end; gap: 3px; color: var(--text-3); font-size: var(--fs-micro); }
.csrm-when time { font-variant-numeric: tabular-nums; }
.csrm-summary { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 7px; }
.csrm-summary div { padding: 9px 10px; border: 1px solid var(--border); border-radius: 8px; background: var(--surface); }
.csrm-summary span { display: block; color: var(--text-3); font-size: var(--fs-micro); }
.csrm-summary b { display: block; margin-top: 2px; color: var(--text); font-size: var(--fs-body); }
.csrm-scope { margin: 0; padding: 8px 10px; border-radius: 7px; background: var(--surface-2); color: var(--text-3); font-size: var(--fs-micro); line-height: 1.5; }
.csrm-note { margin: 0; padding: 8px 10px; border-radius: 7px; background: var(--surface-2); color: var(--text-3); font-size: var(--fs-micro); line-height: 1.55; }
.csrm-note span { display: block; margin-top: 3px; color: var(--accent-ink); }
.csrm-error { padding: 8px 10px; border-radius: 8px; background: var(--danger-bg-soft); color: var(--danger); font-size: var(--fs-caption); }
.csrd { display: flex; flex-direction: column; gap: 12px; }
.csrd-head { display: flex; align-items: flex-start; gap: 10px; padding: 12px; border: 1px solid var(--border); border-radius: 10px; background: var(--surface-2); }
.csrd-type { flex: none; padding: 3px 7px; border-radius: 6px; background: var(--surface); color: var(--text-3); font-size: var(--fs-micro); }
.csrd-head > div { flex: 1; min-width: 0; }
.csrd-head h3 { margin: 0; overflow: hidden; color: var(--text); font-size: var(--fs-title); text-overflow: ellipsis; white-space: nowrap; }
.csrd-head code { display: block; margin-top: 3px; overflow: hidden; color: var(--text-3); font-family: var(--font-mono); font-size: 10px; text-overflow: ellipsis; white-space: nowrap; }
.csrd-state { flex: none; padding: 3px 7px; border-radius: 999px; background: var(--surface); color: var(--text-3); font-size: var(--fs-micro); }
.csrd-state.available { background: var(--accent-light); color: var(--accent-ink); }
.csrd-state.restored, .csrd-state.rolled_back { background: var(--success-bg-soft); color: var(--success); }
.csrd-state.deleted, .csrd-state.conflict { background: var(--danger-bg-soft); color: var(--danger); }
.csrd-facts { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 7px; }
.csrd-facts div { padding: 8px 9px; border: 1px solid var(--border); border-radius: 8px; }
.csrd-facts span { display: block; color: var(--text-3); font-size: var(--fs-micro); }
.csrd-facts b { display: block; margin-top: 2px; color: var(--text-2); font-size: var(--fs-caption); }
.csrd-section { overflow: hidden; border: 1px solid var(--border); border-radius: 10px; }
.csrd-section-h { display: flex; align-items: baseline; justify-content: space-between; gap: 10px; padding: 9px 11px; background: var(--surface-2); }
.csrd-section-h b { color: var(--text); font-size: var(--fs-sub); }
.csrd-section-h small { color: var(--text-3); font-size: var(--fs-micro); }
.csrd-diff-head, .csrd-diff-row { display: grid; grid-template-columns: 110px minmax(0, 1fr) minmax(0, 1fr); gap: 8px; padding: 7px 10px; }
.csrd-diff-head { color: var(--text-3); font-size: var(--fs-micro); }
.csrd-diff-row { border-top: 1px solid var(--border); }
.csrd-diff-row > span { color: var(--text-2); font-size: var(--fs-caption); font-weight: 650; }
.csrd-diff-row pre { max-height: 120px; margin: 0; overflow: auto; color: var(--text-2); font-family: var(--font-mono); font-size: 10px; line-height: 1.45; white-space: pre-wrap; overflow-wrap: anywhere; }
.csrd-code { display: grid; grid-template-columns: 1fr 1fr; gap: 1px; background: var(--border); }
.csrd-code > div { min-width: 0; padding: 9px; background: var(--surface); }
.csrd-code span { color: var(--text-3); font-size: var(--fs-micro); }
.csrd-code pre { max-height: 220px; margin: 5px 0 0; overflow: auto; color: var(--text-2); font-family: var(--font-mono); font-size: 10px; line-height: 1.45; white-space: pre-wrap; overflow-wrap: anywhere; }
.csrd-result { margin: 0; padding: 9px 10px; border-radius: 8px; background: var(--danger-bg-soft); color: var(--danger); font-size: var(--fs-caption); }
.csrd-result.ok { background: var(--success-bg-soft); color: var(--success); }
.csrd-readonly { margin: 0; padding: 9px 10px; border-radius: 8px; background: var(--surface-2); color: var(--text-3); font-size: var(--fs-caption); line-height: 1.55; }
.csrd-btn { min-height: 31px; display: inline-flex; align-items: center; gap: 5px; padding: 5px 11px; border: 1px solid var(--border); border-radius: 7px; background: var(--surface); color: var(--text-2); font: inherit; font-size: var(--fs-caption); cursor: pointer; }
.csrd-btn.primary { border-color: var(--accent); background: var(--accent); color: #fff; font-weight: 650; }
.csrd-btn:disabled { opacity: var(--opacity-disabled); cursor: wait; }
@media (max-width: 720px) {
  .csrm-hero { align-items: flex-start; flex-wrap: wrap; }
  .csrm-when { width: 100%; align-items: flex-start; padding-left: 49px; }
  .csrm-summary { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .csrd-facts { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .csrd-head { flex-wrap: wrap; }
  .csrd-state { margin-left: 0; }
  .csrd-diff-head { display: none; }
  .csrd-diff-row { grid-template-columns: 1fr; gap: 4px; }
  .csrd-code { grid-template-columns: 1fr; }
}
</style>
