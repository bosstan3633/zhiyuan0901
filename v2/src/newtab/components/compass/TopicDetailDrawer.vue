<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, shallowRef } from 'vue'
import { useRouter } from 'vue-router'
import Drawer from '@/shared/components/Drawer.vue'
import Icon from '@/shared/components/Icon.vue'
import TagPicker from '@/shared/components/TagPicker.vue'
import AssetManager from '@/shared/components/AssetManager.vue'
import AssetBadge from '@/shared/components/AssetBadge.vue'
import ArmDeleteButton from '@/shared/components/ArmDeleteButton.vue'
import AiEntryButton from '@/shared/components/AiEntryButton.vue'
import { AiDrawer } from '../lazyAiDrawer'
import { useAppStore } from '../../stores/app'
import { useCompass } from '../../stores/compass'
import { showToast } from '@/shared/components/toast'
import { recordCardOpen } from '@/shared/storage/stats'
import { consumePendingDrawer, emitDrawerClosed, emitOpenDrawer, onOpenDrawer, type DrawerPayload } from '@/shared/utils/bus'
import { attachTopicToMetric, softDeleteTopicToTrash } from '@/shared/utils/topicLinks'
import { addTopicResourceLink, removeTopicResourceLink, topicResourcesOf } from '@/shared/utils/topicResourceLinks'
import { isTopicDone, setTopicStatus, sortedTopicStatuses, toggleTopicDone, topicStatusOf } from '@/shared/utils/topicStatus'
import { openExternalLink } from '@/shared/utils/link'
import { normalizeTopicOutcome, topicOutcomeLink } from '@/shared/utils/topicOutcome'
import { addManualTopicFocus } from '@/shared/utils/focusSuggest'
import { clearedFocusSlot, detachFocusTopicFromDate, normalizedFocusSlots } from '@/shared/utils/focusSlots'
import type { AiJob } from '@/shared/ai/job'
import type { AssetMeta, ResourceCard, TopicCard } from '@/shared/models'
import { planEventsOf, scheduleCardDate } from '@/shared/storage/planSchedule'
import { buildFocusUsage, focusUsageOfCard } from '@/shared/analytics/focusUsage'
import { hasUsableResourceLink } from '@/shared/analytics/cardInventory'
import PlanScheduleHistory from './PlanScheduleHistory.vue'
import CardResourcePickerModal from './CardResourcePickerModal.vue'
import CardFocusHistory from './CardFocusHistory.vue'

const router = useRouter()
const store = useAppStore()
const { d, allProjects } = useCompass()
const emit = defineEmits<{ (e: 'closed'): void }>()

const open = ref(false)
const topic = ref<TopicCard | null>(null)
const titleDraft = ref('')
const projectId = ref('')
const metricId = ref('')
const resourcePickerOpen = ref(false)
const aiJob = shallowRef<AiJob | null>(null)
const aiBusy = ref(false)
type DetailFocus = 'all' | 'plan' | 'focus' | 'owner' | 'resources'
const detailFocus = ref<DetailFocus>('all')

function openFromId(id: string): void {
  const live = (d.value.topics || []).find(row => row.id === id && !row.deletedAt)
  if (!live) {
    showToast('选题卡已删除或不存在')
    return
  }
  topic.value = live
  titleDraft.value = live.title
  projectId.value = live.projectId || ''
  metricId.value = live.metricId || ''
  detailFocus.value = 'all'
  recordCardOpen(d.value, live)
  store.persistHot()
  open.value = true
}

function onBus(payload: DrawerPayload): void {
  if (payload.kind === 'topic' && payload.id) openFromId(payload.id)
}

function close(): void {
  const payload = topic.value ? { kind: 'topic' as const, id: topic.value.id } : null
  open.value = false
  topic.value = null
  aiJob.value = null
  emit('closed')
  if (payload) emitDrawerClosed(payload)
}

defineExpose({ openFromId, close })

let unsubscribe: (() => void) | null = null
onMounted(() => {
  unsubscribe = onOpenDrawer(onBus)
  const pending = consumePendingDrawer('topic')
  if (pending) onBus(pending)
})
onUnmounted(() => { unsubscribe?.() })

const projects = computed(() => allProjects())
const metrics = computed(() => projects.value.find(project => project.id === projectId.value)?.metrics || [])
const statuses = computed(() => sortedTopicStatuses(d.value))
const status = computed(() => topic.value ? topicStatusOf(d.value, topic.value.statusId) : undefined)
const done = computed(() => isTopicDone(d.value, topic.value || undefined))
const outcome = computed(() => topic.value ? topicOutcomeLink(topic.value) : null)
const resourceRows = computed(() => topic.value ? topicResourcesOf(d.value, topic.value.id) : [])
const effectiveResourceIds = computed(() =>
  new Set((d.value.resources || [])
    .filter(resource => !resource.deletedAt && hasUsableResourceLink(resource))
    .map(resource => resource.id)))
const effectiveSupportCount = computed(() =>
  new Set(resourceRows.value
    .filter(row => effectiveResourceIds.value.has(row.resource.id))
    .map(row => row.resource.id)).size)
const focusUsage = computed(() => {
  if (!topic.value) return { count: 0, doneCount: 0, lastDate: '' }
  return focusUsageOfCard(buildFocusUsage(d.value), 'topic', topic.value.id)
})
const planChanges = computed(() =>
  topic.value ? planEventsOf(d.value, topic.value.id, 'topic').length : 0)

function touch(): void {
  if (!topic.value) return
  topic.value.updatedAt = Date.now()
  store.persist()
}

function saveTitle(): void {
  if (!topic.value) return
  const value = titleDraft.value.trim()
  if (!value) {
    titleDraft.value = topic.value.title
    showToast('选题标题不能为空')
    return
  }
  if (value === topic.value.title) return
  topic.value.title = value
  touch()
}

function saveOutcomeLink(): void {
  if (!topic.value) return
  if (!String(topic.value.link || '').trim()) {
    topic.value.link = undefined
    topic.value.linkType = undefined
    touch()
    return
  }
  if (!normalizeTopicOutcome(topic.value)) {
    showToast('成果链接仅支持 http(s)://、obsidian:// 或完整域名')
    touch()
    return
  }
  touch()
}

function openOutcomeLink(): void {
  const link = outcome.value
  if (!link) {
    showToast('请先填写可打开的网页或 Obsidian 成果链接')
    return
  }
  openExternalLink(link.url)
}

async function copyOutcomeLink(): Promise<void> {
  const link = outcome.value
  if (!link) {
    showToast('请先填写成果链接')
    return
  }
  try {
    await navigator.clipboard.writeText(link.url)
    showToast('成果链接已复制')
  } catch {
    showToast('复制失败，请手动选中链接')
  }
}

function saveAndClose(): void {
  saveTitle()
  close()
}

function changeProject(): void {
  metricId.value = ''
  if (!topic.value) return
  attachTopicToMetric(d.value, topic.value, projectId.value, undefined)
  store.persist()
}

function changeMetric(): void {
  if (!topic.value) return
  attachTopicToMetric(d.value, topic.value, projectId.value, metricId.value)
  store.persist()
}

function changeStatus(statusId: string): void {
  if (!topic.value || !setTopicStatus(d.value, topic.value, statusId)) return
  store.persist()
}

function toggleDone(): void {
  if (!topic.value) return
  toggleTopicDone(d.value, topic.value)
  store.persist()
}

function localTodayKey(): string {
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

function updateDueDate(value: string): void {
  if (!topic.value) return
  if (value === localTodayKey()) {
    const result = addManualTopicFocus(d.value, value, topic.value.id)
    if (result.status === 'full') {
      showToast('今日三件事已满；请先在调度台移出一项')
      return
    }
    store.persist()
    showToast('已排到今日，并同步进入今日三件事')
    return
  }
  removeTopicFromToday()
  scheduleCardDate(d.value, topic.value, value, { source: 'detail' })
  store.persist()
  if (!value) showToast('已取消排期，选题回到未落图列表')
}

function removeTopicFromToday(): void {
  if (!topic.value) return
  const key = localTodayKey()
  const cells = normalizedFocusSlots(d.value.dailyFocus?.[key])
  const index = cells.findIndex(slot => !!slot && !slot.cleared
    && slot.sourceType === 'topic' && slot.sourceId === topic.value?.id)
  if (index < 0) return
  detachFocusTopicFromDate(d.value, key, topic.value.id)
  cells[index] = clearedFocusSlot(index, cells[index])
  d.value.dailyFocus[key] = cells.map((slot, slotIndex) => slot || clearedFocusSlot(slotIndex))
}

async function addToToday(): Promise<void> {
  if (!topic.value) return
  const key = localTodayKey()
  const result = addManualTopicFocus(d.value, key, topic.value.id)
  if (result.status === 'exists') {
    store.persist()
    showToast('这张选题已经在今天的三件事里')
    return
  }
  if (result.status === 'full') {
    showToast('今日三件事已满；请先在调度台移出一项')
    return
  }
  if (result.status === 'invalid') {
    showToast('已完成的选题不能加入今日三件事')
    return
  }
  store.persist()
  showToast('已设为今日重点，并同步落图到今天')
}

function mountResources(resources: ResourceCard[]): void {
  if (!topic.value) return
  let added = 0
  for (const resource of resources) {
    const result = addTopicResourceLink(d.value, { topic: topic.value, resource, from: 'manual' })
    if (!result.dup) added += 1
  }
  resourcePickerOpen.value = false
  if (!added) {
    showToast('所选资源都已经关联过了')
    return
  }
  store.persist()
  showToast(`已挂载 ${added} 张资源卡`)
}

function unlinkResource(linkId: string): void {
  if (!removeTopicResourceLink(d.value, linkId)) return
  store.persist()
  showToast('已解除关联，资源卡本体不受影响')
}

function openResource(resource: ResourceCard): void {
  emitOpenDrawer({ kind: 'res', id: resource.id })
}

async function runAiSupport(): Promise<void> {
  if (!topic.value || aiBusy.value) return
  aiBusy.value = true
  try {
    const [{ loadAiConfig, aiReady, aiConfig }] = await Promise.all([import('@/shared/ai/config')])
    await loadAiConfig()
    if (!aiReady.value) {
      showToast('请先在 设置 → AI 助手 完成接入（地址/Key/模型）')
      return
    }
    const { buildTopicSupportJob } = await import('@/shared/ai/topicSupport')
    const job = buildTopicSupportJob({
      d: d.value,
      depth: aiConfig.value.depth,
      persist: () => store.persist(),
      topicId: topic.value.id,
      personaId: aiConfig.value.defaultPersona,
    })
    if (!job) {
      showToast('选题卡已不存在')
      return
    }
    aiJob.value = job
  } finally {
    aiBusy.value = false
  }
}

function onAssetsChange(assets: AssetMeta[]): void {
  if (!topic.value) return
  topic.value.assets = assets
  touch()
}

function deleteTopic(): void {
  if (!topic.value) return
  const removed = topic.value
  softDeleteTopicToTrash(d.value, removed)
  store.persist()
  close()
  showToast(`已删除「${removed.title.slice(0, 20)}」`)
}

function goProjectPano(): void {
  if (!topic.value?.projectId) return
  void router.push({
    path: '/compass',
    query: {
      pano: '1',
      proj: topic.value.projectId,
      ...(topic.value.metricId ? { m: topic.value.metricId } : {}),
    },
  })
  close()
}

function fmt(ts?: number): string {
  return ts ? new Date(ts).toLocaleString('zh-CN', { hour12: false }) : '—'
}
</script>

<template>
  <Drawer :open="open && !!topic" width="540px" width-storage-key="topic" :close-on-escape="!aiJob" @close="close">
    <template v-if="topic" #title>
      <div class="topic-title-wrap">
        <div class="topic-title-row">
          <button class="topic-done" :class="{ done }" type="button" :aria-label="done ? '恢复选题' : '标记完成'" @click="toggleDone">
            <Icon v-if="done" name="check" :size="16" />
          </button>
          <textarea v-model="titleDraft" class="topic-title" rows="3" placeholder="写下这个选题最完整的对外表达…" @blur="saveTitle" />
        </div>
        <div class="topic-kicker">
          <span class="topic-kind">选题卡</span>
          <span class="topic-status-pill" :style="{ '--topic-color': status?.color || 'var(--accent)' }">{{ status?.name || '构思中' }}</span>
          <AssetBadge v-if="topic.assets?.length" :assets="topic.assets" />
        </div>
      </div>
    </template>

    <div v-if="topic" class="topic-body">
      <div class="topic-detail-summary" aria-label="选题详情汇总">
        <button type="button" data-detail-filter="plan" :class="{ on: detailFocus === 'plan' }" @click="detailFocus = detailFocus === 'plan' ? 'all' : 'plan'">
          <strong>{{ planChanges }}</strong><span>计划变更</span>
        </button>
        <button type="button" data-detail-filter="focus" :class="{ on: detailFocus === 'focus' }" @click="detailFocus = detailFocus === 'focus' ? 'all' : 'focus'">
          <strong>{{ focusUsage.count }}</strong><span>进入三件事</span>
        </button>
        <button type="button" data-detail-filter="resources" :class="{ on: detailFocus === 'resources' }" @click="detailFocus = detailFocus === 'resources' ? 'all' : 'resources'">
          <strong>{{ effectiveSupportCount }}</strong><span>有效资源</span>
        </button>
        <button type="button" data-detail-filter="owner" :class="{ on: detailFocus === 'owner' }" @click="detailFocus = detailFocus === 'owner' ? 'all' : 'owner'">
          <strong>{{ projectId || metricId ? '已归属' : '未归属' }}</strong><span>项目 / 指标</span>
        </button>
      </div>
      <div v-if="detailFocus !== 'all'" class="topic-detail-filter">
        <span>当前只展开对应明细</span>
        <button type="button" @click="detailFocus = 'all'">显示全部</button>
      </div>

      <!-- V4.7.1：选题与任务同构——安排历程是首屏主模块，日期/状态与今日重点收进同一条编辑行。 -->
      <section v-show="detailFocus === 'all' || detailFocus === 'plan'" class="topic-plan topic-plan-hero">
        <PlanScheduleHistory :card-id="topic.id" card-kind="topic" :current-date="topic.dueDate" />
        <div class="topic-plan-edit">
          <label class="topic-field">
            <span><Icon name="calendar" :size="12" /> 调整计划</span>
            <input type="date" :value="topic.dueDate || ''" @change="updateDueDate(($event.target as HTMLInputElement).value)">
          </label>
          <label class="topic-field">
            <span><Icon name="circle" :size="12" /> 状态</span>
            <select :value="topic.statusId" @change="changeStatus(($event.target as HTMLSelectElement).value)">
              <option v-for="item in statuses" :key="item.id" :value="item.id">{{ item.name }}</option>
            </select>
          </label>
          <button v-if="topic.dueDate" class="topic-plan-clear" type="button" @click="updateDueDate('')">
            <Icon name="x" :size="12" /> 取消排期
          </button>
          <button class="topic-focus-link" type="button" @click="addToToday">
            <Icon name="target" :size="12" /> 设为今日重点
          </button>
        </div>
      </section>

      <section v-show="detailFocus === 'all' || detailFocus === 'focus'" class="topic-focus-section">
        <CardFocusHistory :card-id="topic.id" card-kind="topic" />
      </section>

      <section v-show="detailFocus === 'all'" class="topic-outcome" :class="{ empty: !outcome }">
        <header>
          <div>
            <span class="topic-outcome-kicker"><Icon name="external" :size="13" /> 成果出口</span>
            <b>发布 / 成果链接</b>
          </div>
          <span v-if="outcome" class="topic-outcome-kind">{{ outcome.label }}</span>
          <span v-else class="topic-outcome-kind empty">待补充</span>
        </header>
        <div class="topic-outcome-row">
          <input
            v-model="topic.link"
            type="text"
            placeholder="https://… 或 obsidian://open?vault=…"
            aria-label="发布或成果链接"
            @blur="saveOutcomeLink"
            @keydown.enter.prevent="saveOutcomeLink"
          >
          <button class="topic-outcome-open" type="button" :disabled="!outcome" @click="openOutcomeLink">
            <Icon name="external" :size="13" /> {{ outcome?.kind === 'obsidian' ? '打开 Obsidian' : '打开成果' }}
          </button>
          <button class="topic-outcome-copy" type="button" :disabled="!outcome" title="复制链接" aria-label="复制成果链接" @click="copyOutcomeLink">
            <Icon name="copy" :size="13" />
          </button>
        </div>
        <small>双击选题卡可直接打开这里；支持互联网链接与本地 Obsidian URI。</small>
      </section>

      <section v-show="detailFocus === 'all' || detailFocus === 'owner'" class="topic-owner">
        <label class="topic-field">
          <span><Icon name="package" :size="13" /> 项目</span>
          <select v-model="projectId" @change="changeProject">
            <option value="">未关联项目</option>
            <option v-for="project in projects" :key="project.id" :value="project.id">{{ project.name }}</option>
          </select>
        </label>
        <label class="topic-field">
          <span><Icon name="target" :size="13" /> 成功指标</span>
          <select v-model="metricId" :disabled="!projectId" @change="changeMetric">
            <option value="">暂不归属指标</option>
            <option v-for="metric in metrics" :key="metric.id" :value="metric.id">{{ metric.title }}</option>
          </select>
        </label>
      </section>

      <button v-show="detailFocus === 'all' || detailFocus === 'owner'" class="topic-pano-link" type="button" :disabled="!projectId" @click="goProjectPano">
        <Icon name="compass" :size="13" /> 查看项目全景
      </button>

      <section v-show="detailFocus === 'all' || detailFocus === 'resources'" class="topic-resource-core">
        <header class="topic-section-head">
          <div>
            <b><Icon name="compass" :size="14" /> 关联资源卡</b>
            <span>选题的素材、证据与可复用资产</span>
          </div>
          <button class="topic-pick-resource" type="button" @click="resourcePickerOpen = true">
            <Icon name="plus" :size="12" /> 从资源卡池挂载
          </button>
        </header>

        <div v-if="resourceRows.length" class="topic-resource-list">
          <div v-for="row in resourceRows" :key="row.link.id" class="topic-resource-row">
            <button class="topic-resource-main" type="button" @click="openResource(row.resource)">
              <b>{{ row.resource.title }}</b>
              <small>{{ row.link.why || row.resource.description || '打开资源卡详情' }}</small>
            </button>
            <span v-if="row.link.from === 'ai'" class="topic-ai-tag">AI</span>
            <button class="topic-unlink" type="button" title="解除关联" aria-label="解除资源关联" @click="unlinkResource(row.link.id)"><Icon name="x" :size="12" /></button>
          </div>
        </div>
        <div v-else class="topic-resource-empty">还没有关联资源。从资源卡池多选挂载，或让 AI 先筛一轮候选。</div>
        <div class="topic-resource-actions">
          <button class="topic-ai-inline" type="button" :disabled="aiBusy" @click="runAiSupport">
            <AiEntryButton variant="inline" label="AI 找资源" :spin="aiBusy" />
          </button>
        </div>
      </section>

      <section class="topic-note">
        <label>
          <span>说明 <small>可选上下文</small></span>
          <textarea v-model="topic.description" rows="2" placeholder="补充选题边界、目标读者或制作约束…" @blur="touch" />
        </label>
      </section>

      <section class="topic-tags">
        <TagPicker v-model="topic.tags" />
      </section>

      <section class="topic-meta">
        <span>创建 {{ fmt(topic.createdAt) }}</span>
        <span>更新 {{ fmt(topic.updatedAt) }}</span>
      </section>

      <details class="topic-assets">
        <summary>
          <span><Icon name="paperclip" :size="13" /> 附件 <em v-if="topic.assets?.length">{{ topic.assets.length }}</em></span>
          <span>图片 / HTML / PDF</span>
        </summary>
        <AssetManager v-model="topic.assets" :owner-id="topic.id" @update:model-value="onAssetsChange" />
      </details>
    </div>

    <template v-if="topic" #footer>
      <div class="topic-foot">
        <ArmDeleteButton @confirm="deleteTopic" />
        <button class="topic-save" type="button" @click="saveAndClose">
          <Icon name="check" :size="13" /> 完成并关闭
        </button>
      </div>
    </template>
  </Drawer>

  <CardResourcePickerModal
    :open="resourcePickerOpen"
    :resources="d.resources || []"
    :linked-ids="resourceRows.map(row => row.resource.id)"
    title="为选题挂载资源卡"
    @close="resourcePickerOpen = false"
    @confirm="mountResources"
  />
  <AiDrawer v-if="aiJob" :job="aiJob" @close="aiJob = null" />
</template>

<style scoped>
.topic-title-wrap { display: flex; width: 100%; min-width: 0; flex-direction: column; gap: 8px; }
.topic-title-row { display: flex; align-items: flex-start; gap: 10px; min-width: 0; }
.topic-done { width: 24px; height: 24px; flex: none; margin-top: 3px; border: 2px solid var(--border-strong); border-radius: 7px; background: var(--surface); color: var(--on-accent); cursor: pointer; }
.topic-done.done { border-color: var(--success); background: var(--success); }
.topic-title { flex: 1; min-width: 0; min-height: 62px; resize: none; border: 0; outline: 0; background: transparent; color: var(--text); font-family: inherit; font-size: 18px; font-weight: 700; line-height: 1.55; }
.topic-kicker { display: flex; align-items: center; gap: 7px; flex-wrap: wrap; padding-left: 34px; }
.topic-kind { padding: 2px 7px; border-radius: var(--radius-full); background: color-mix(in srgb, var(--accent) 12%, var(--surface)); color: var(--accent-ink); font-size: var(--fs-micro); font-weight: 700; }
.topic-status-pill { padding: 2px 8px; border: 1px solid color-mix(in srgb, var(--topic-color) 48%, var(--border)); border-radius: var(--radius-full); background: color-mix(in srgb, var(--topic-color) 12%, var(--surface)); color: var(--topic-color); font-size: var(--fs-micro); font-weight: 650; }
.topic-body { display: flex; flex-direction: column; gap: 16px; }
.topic-detail-summary { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 1px; overflow: hidden; border: 1px solid var(--border); border-radius: var(--radius-md); background: var(--border); }
.topic-detail-summary button { min-width: 0; min-height: 54px; display: flex; flex-direction: column; justify-content: center; align-items: flex-start; gap: 1px; padding: 7px 9px; border: 0; background: var(--surface-2); color: inherit; font: inherit; text-align: left; cursor: pointer; }
.topic-detail-summary button:hover { background: color-mix(in srgb, var(--accent-light) 32%, var(--surface)); }
.topic-detail-summary button.on { background: var(--accent-light); box-shadow: inset 0 -2px 0 var(--accent); }
.topic-detail-summary button:focus-visible,
.topic-detail-filter button:focus-visible { outline: 2px solid var(--accent); outline-offset: -2px; }
.topic-detail-summary strong { max-width: 100%; overflow: hidden; color: var(--text); font-size: var(--fs-sub); line-height: 1.2; font-variant-numeric: tabular-nums; text-overflow: ellipsis; white-space: nowrap; }
.topic-detail-summary span { color: var(--text-3); font-size: var(--fs-micro); white-space: nowrap; }
.topic-detail-filter { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-top: -10px; color: var(--text-4); font-size: var(--fs-micro); }
.topic-detail-filter button { padding: 2px 0; border: 0; background: transparent; color: var(--accent-ink); font: inherit; font-size: var(--fs-micro); font-weight: 650; cursor: pointer; }
.topic-detail-filter button:hover { text-decoration: underline; }
.topic-focus-section { padding: 13px 14px; border: 1px solid var(--border); border-radius: var(--radius-lg); background: color-mix(in srgb, var(--surface-2) 68%, var(--surface)); }
.topic-outcome { padding: 14px; border: 1px solid color-mix(in srgb, var(--accent) 42%, var(--border)); border-radius: var(--radius-xl); background: linear-gradient(135deg, color-mix(in srgb, var(--accent-light) 72%, var(--surface)), var(--surface)); box-shadow: 0 10px 28px color-mix(in srgb, var(--accent) 10%, transparent); }
.topic-outcome.empty { border-color: var(--border); background: var(--surface-2); box-shadow: none; }
.topic-outcome header { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
.topic-outcome header > div { display: flex; flex-direction: column; gap: 3px; }
.topic-outcome-kicker { display: inline-flex; align-items: center; gap: 5px; color: var(--accent-ink); font-size: var(--fs-micro); font-weight: 750; letter-spacing: .08em; }
.topic-outcome header b { color: var(--text); font-size: var(--fs-title); }
.topic-outcome-kind { flex: none; padding: 3px 8px; border-radius: var(--radius-full); background: var(--accent); color: var(--on-accent); font-size: var(--fs-micro); font-weight: 700; }
.topic-outcome-kind.empty { background: var(--surface-3); color: var(--text-3); }
.topic-outcome-row { display: grid; grid-template-columns: minmax(0, 1fr) auto 36px; gap: 7px; margin-top: 11px; }
.topic-outcome-row input { min-width: 0; min-height: 40px; padding: 8px 11px; border: 1px solid color-mix(in srgb, var(--accent) 38%, var(--border)); border-radius: 10px; outline: 0; background: var(--surface); color: var(--text); font-family: inherit; font-size: var(--fs-sub); }
.topic-outcome-row input:focus { border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-glow); }
.topic-outcome-open, .topic-outcome-copy { display: inline-flex; min-height: 40px; align-items: center; justify-content: center; gap: 5px; padding: 0 12px; border: 1px solid var(--accent); border-radius: 10px; background: var(--accent); color: var(--on-accent); font-family: inherit; font-size: var(--fs-caption); font-weight: 700; cursor: pointer; }
.topic-outcome-copy { width: 36px; padding: 0; border-color: var(--border); background: var(--surface); color: var(--text-2); }
.topic-outcome-open:disabled, .topic-outcome-copy:disabled { opacity: var(--opacity-disabled); cursor: not-allowed; }
.topic-outcome small { display: block; margin-top: 7px; color: var(--text-3); font-size: var(--fs-micro); }
.topic-owner { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
.topic-field { display: flex; min-width: 0; flex-direction: column; gap: 5px; color: var(--text-3); font-size: var(--fs-caption); }
.topic-field > span { display: inline-flex; align-items: center; gap: 5px; }
.topic-field select, .topic-field input { width: 100%; min-width: 0; min-height: 36px; padding: 7px 9px; border: 1px solid var(--border); border-radius: 9px; outline: none; background: var(--surface-2); color: var(--text); font-family: inherit; font-size: var(--fs-sub); }
.topic-field select:focus, .topic-field input:focus { border-color: var(--accent); }
.topic-field select:disabled { opacity: var(--opacity-disabled); }
.topic-pano-link { align-self: flex-start; display: inline-flex; align-items: center; gap: 5px; padding: 0; border: 0; background: none; color: var(--accent); font-family: inherit; font-size: var(--fs-caption); cursor: pointer; }
.topic-pano-link:disabled { color: var(--text-4); cursor: not-allowed; }
.topic-plan { display: flex; flex-direction: column; gap: 10px; }
.topic-plan-hero {
  padding: 12px;
  border: 1px solid color-mix(in srgb, var(--accent) 26%, var(--border));
  border-radius: var(--radius-lg);
  background:
    radial-gradient(420px 130px at 0% 0%, color-mix(in srgb, var(--accent) 9%, transparent), transparent 72%),
    var(--surface-2);
}
.topic-plan-edit { display: flex; align-items: flex-end; gap: 7px; flex-wrap: wrap; padding-top: 9px; border-top: 1px solid color-mix(in srgb, var(--border) 76%, transparent); }
.topic-plan-edit .topic-field { flex: 1 1 170px; }
.topic-plan-edit .topic-field input,
.topic-plan-edit .topic-field select { min-height: 32px; padding: 4px 8px; background: var(--surface); font-size: var(--fs-caption); }
.topic-plan-clear,
.topic-focus-link { display: inline-flex; align-items: center; gap: 4px; min-height: 32px; padding: 4px 8px; border: 1px solid transparent; border-radius: 8px; background: transparent; color: var(--text-3); font-family: inherit; font-size: var(--fs-caption); cursor: pointer; }
.topic-plan-clear:hover { border-color: color-mix(in srgb, var(--danger) 30%, var(--border)); background: var(--tag-danger-bg); color: var(--danger); }
.topic-focus-link { margin-left: auto; color: var(--accent-ink); font-weight: 650; }
.topic-focus-link:hover { border-color: color-mix(in srgb, var(--accent) 26%, var(--border)); background: var(--accent-light); }
.topic-resource-core { padding: 14px; border: 1px solid color-mix(in srgb, var(--accent) 28%, var(--border)); border-radius: var(--radius-xl); background: color-mix(in srgb, var(--accent-light) 34%, var(--surface)); }
.topic-section-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 10px; margin-bottom: 10px; }
.topic-section-head > div { display: flex; flex-direction: column; gap: 2px; }
.topic-section-head b { display: inline-flex; align-items: center; gap: 5px; color: var(--text); font-size: var(--fs-body); }
.topic-section-head span { color: var(--text-3); font-size: var(--fs-caption); }
.topic-pick-resource {
  display: inline-flex; min-height: 32px; align-items: center; gap: 5px;
  padding: 0 10px; border: 1px solid var(--border); border-radius: var(--radius-full);
  background: var(--surface); color: var(--text-2); font: inherit; font-size: var(--fs-caption); cursor: pointer;
}
.topic-pick-resource:hover { border-color: var(--accent); background: var(--accent-light); color: var(--accent-ink); }
.topic-ai-inline { display: inline-flex; align-items: center; }
.topic-resource-list { overflow: hidden; border: 1px solid var(--border); border-radius: var(--radius-lg); background: var(--surface); }
.topic-resource-row { display: flex; width: 100%; align-items: center; gap: 8px; padding: 9px 10px; border-bottom: 1px solid var(--border); background: transparent; color: var(--text); }
.topic-resource-row:last-child { border-bottom: 0; }
.topic-resource-row:hover { background: var(--surface-2); }
.topic-resource-main { display: flex; flex: 1; min-width: 0; flex-direction: column; gap: 2px; padding: 0; border: 0; background: transparent; color: var(--text); text-align: left; font-family: inherit; cursor: pointer; }
.topic-resource-main b { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: var(--fs-sub); }
.topic-resource-main small { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--text-3); font-size: var(--fs-micro); }
.topic-ai-tag { padding: 1px 6px; border-radius: var(--radius-full); background: var(--accent-light); color: var(--accent-ink); font-size: var(--fs-micro); }
.topic-unlink { display: inline-flex; width: 24px; height: 24px; align-items: center; justify-content: center; padding: 0; border: 0; border-radius: 7px; background: transparent; color: var(--text-3); cursor: pointer; }
.topic-unlink:hover { background: color-mix(in srgb, var(--danger) 12%, var(--surface)); color: var(--danger); }
.topic-resource-empty { padding: 12px; border: 1px dashed var(--border-strong); border-radius: var(--radius-md); color: var(--text-3); font-size: var(--fs-caption); line-height: 1.65; }
.topic-resource-actions { display: flex; justify-content: flex-end; margin-top: 9px; }
.topic-note { padding: 11px 12px; border: 1px solid var(--border); border-radius: var(--radius-lg); background: var(--surface-2); }
.topic-note label { display: flex; flex-direction: column; gap: 5px; }
.topic-note span { color: var(--text-3); font-size: var(--fs-caption); font-weight: 650; }
.topic-note small { color: var(--text-4); font-weight: 500; }
.topic-note textarea { min-height: 66px; max-height: 110px; resize: vertical; padding: 7px 8px; border: 1px solid transparent; border-radius: 8px; outline: none; background: var(--surface); color: var(--text); font-family: inherit; font-size: var(--fs-sub); line-height: 1.65; }
.topic-note textarea:focus { border-color: var(--accent); }
.topic-tags { padding: 2px 0; }
.topic-meta { display: flex; gap: 14px; color: var(--text-4); font-size: var(--fs-micro); }
.topic-assets { padding: 10px 12px; border: 1px solid var(--border); border-radius: var(--radius-lg); background: var(--surface-2); }
.topic-assets summary { display: flex; align-items: center; justify-content: space-between; cursor: pointer; color: var(--text-2); font-size: var(--fs-caption); }
.topic-assets summary > span:first-child { display: inline-flex; align-items: center; gap: 5px; }
.topic-assets summary em { padding: 0 5px; border-radius: var(--radius-full); background: var(--accent-light); color: var(--accent-ink); font-style: normal; }
.topic-foot { display: flex; width: 100%; align-items: center; justify-content: space-between; gap: 10px; }
.topic-save { display: inline-flex; align-items: center; gap: 6px; min-height: 34px; padding: 6px 14px; border: 1px solid var(--accent); border-radius: 9px; background: var(--accent); color: var(--on-accent); font-family: inherit; font-size: var(--fs-sub); font-weight: 650; cursor: pointer; }
@media (max-width: 640px) {
  .topic-owner, .topic-plan { grid-template-columns: 1fr; }
  .topic-focus-link { margin-left: 0; }
}
</style>
