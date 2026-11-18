<script setup lang="ts">
import { computed, ref } from 'vue'
import Icon from '@/shared/components/Icon.vue'
import { useConfirm } from '@/shared/components/confirm'
import { showToast } from '@/shared/components/toast'
import { useAppStore } from '../../stores/app'
import type { TopicStatusDef } from '@/shared/models'
import { sortedTopicStatuses } from '@/shared/utils/topicStatus'

const store = useAppStore()
const statuses = computed(() => sortedTopicStatuses(store.data!))
const draftName = ref('')
const draftColor = ref('#0F6F9E')

function persist(message?: string): void {
  store.persist()
  if (message) showToast(message)
}

function normalizeOrder(): void {
  sortedTopicStatuses(store.data!).forEach((status, index) => { status.order = index })
}

function rename(status: TopicStatusDef, event: Event): void {
  const value = (event.target as HTMLInputElement).value.trim()
  if (!value) {
    ;(event.target as HTMLInputElement).value = status.name
    showToast('状态名称不能为空')
    return
  }
  if (value === status.name) return
  status.name = value
  persist('状态名称已更新')
}

function recolor(status: TopicStatusDef, event: Event): void {
  const value = (event.target as HTMLInputElement).value
  if (!/^#[0-9a-f]{6}$/i.test(value) || value.toLowerCase() === status.color.toLowerCase()) return
  status.color = value
  persist('状态颜色已更新')
}

function move(status: TopicStatusDef, delta: number): void {
  const rows = statuses.value
  const index = rows.findIndex(row => row.id === status.id)
  const target = index + delta
  if (index < 0 || target < 0 || target >= rows.length) return
  const [row] = rows.splice(index, 1)
  rows.splice(target, 0, row)
  rows.forEach((item, idx) => { item.order = idx })
  persist('状态顺序已更新')
}

function setTerminal(status: TopicStatusDef): void {
  if (status.terminal) {
    showToast('至少保留一个完成态，不能取消最后一个')
    return
  }
  for (const item of store.data!.topicStatuses) item.terminal = item.id === status.id
  persist(`「${status.name}」已设为完成态`)
}

function addStatus(): void {
  const name = draftName.value.trim()
  if (!name) {
    showToast('请输入状态名称')
    return
  }
  if (statuses.value.some(status => status.name === name)) {
    showToast('已存在同名状态')
    return
  }
  const row: TopicStatusDef = {
    id: `topic-status-${Date.now().toString(36)}`,
    name,
    color: draftColor.value,
    order: statuses.value.length,
  }
  store.data!.topicStatuses.push(row)
  draftName.value = ''
  persist('已添加选题状态')
}

async function removeStatus(status: TopicStatusDef): Promise<void> {
  if (statuses.value.length <= 1) {
    showToast('至少保留一个选题状态')
    return
  }
  const affected = (store.data!.topics || []).filter(topic => !topic.deletedAt && topic.statusId === status.id)
  const fallback = statuses.value.find(row => row.id !== status.id)
  if (!fallback) return
  if (!(await useConfirm({
    title: '删除选题状态',
    message: affected.length
      ? `「${status.name}」正在被 ${affected.length} 张选题卡使用。删除后，这些选题会迁移到「${fallback.name}」。`
      : `确定删除「${status.name}」？`,
    confirmText: `删除并迁移到「${fallback.name}」`,
  }))) return
  for (const topic of affected) {
    topic.statusId = fallback.id
    if (topic.statusBeforeDoneId === status.id) topic.statusBeforeDoneId = undefined
    topic.updatedAt = Date.now()
  }
  store.data!.topicStatuses = store.data!.topicStatuses.filter(row => row.id !== status.id)
  normalizeOrder()
  if (!store.data!.topicStatuses.some(row => row.terminal)) {
    const last = sortedTopicStatuses(store.data!).at(-1)
    if (last) last.terminal = true
  }
  persist(`已删除「${status.name}」${affected.length ? `，迁移 ${affected.length} 张选题` : ''}`)
}
</script>

<template>
  <div class="topic-status-editor">
    <div class="topic-status-caption">
      <span><Icon name="refresh" :size="13" /> 选题状态用于看板分组、详情徽标和今日完成语义</span>
      <small>名称、颜色和顺序会随云同步；完成态有且只有一个</small>
    </div>

    <div class="topic-status-list">
      <div v-for="(status, index) in statuses" :key="status.id" class="topic-status-row">
        <span class="topic-status-drag">⋮⋮</span>
        <label class="topic-status-color" :style="{ '--status-color': status.color }">
          <input type="color" :value="status.color" aria-label="状态颜色" @change="recolor(status, $event)">
        </label>
        <input class="gs-input topic-status-name" :value="status.name" maxlength="12" aria-label="状态名称" @change="rename(status, $event)">
        <button
          class="topic-terminal"
          :class="{ on: status.terminal }"
          type="button"
          :title="status.terminal ? '当前完成态' : '设为完成态'"
          @click="setTerminal(status)"
        >
          <Icon :name="status.terminal ? 'check' : 'circle'" :size="12" />
          {{ status.terminal ? '完成态' : '设为完成' }}
        </button>
        <div class="topic-status-actions">
          <button type="button" title="上移" :disabled="index === 0" @click="move(status, -1)"><Icon name="arrowup" :size="12" /></button>
          <button type="button" title="下移" :disabled="index === statuses.length - 1" @click="move(status, 1)"><Icon name="arrowdown" :size="12" /></button>
          <button class="danger" type="button" title="删除状态" @click="removeStatus(status)"><Icon name="trash" :size="12" /></button>
        </div>
      </div>
    </div>

    <div class="topic-status-add">
      <label class="topic-status-color" :style="{ '--status-color': draftColor }">
        <input v-model="draftColor" type="color" aria-label="新状态颜色">
      </label>
      <input v-model="draftName" class="gs-input" maxlength="12" placeholder="新状态名称，如：待复盘" @keydown.enter.prevent="addStatus">
      <button class="gs-btn" type="button" @click="addStatus"><Icon name="plus" :size="12" /> 添加状态</button>
    </div>
  </div>
</template>

<style src="./base.css"></style>

<style scoped>
.topic-status-editor { display: flex; flex-direction: column; gap: 12px; }
.topic-status-caption { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 10px 12px; border-radius: 10px; background: var(--accent-light); color: var(--accent-ink); font-size: var(--fs-caption); }
.topic-status-caption span { display: inline-flex; align-items: center; gap: 5px; }
.topic-status-caption small { color: var(--text-3); }
.topic-status-list { display: flex; flex-direction: column; gap: 7px; }
.topic-status-row { display: grid; grid-template-columns: 18px 30px minmax(120px, 1fr) auto auto; align-items: center; gap: 9px; padding: 9px 10px; border: 1px solid var(--border); border-radius: 10px; background: var(--surface); }
.topic-status-drag { color: var(--text-4); cursor: grab; }
.topic-status-color { --status-color: var(--accent); display: inline-grid; width: 26px; height: 26px; place-items: center; border: 1px solid color-mix(in srgb, var(--status-color) 45%, var(--border)); border-radius: 8px; background: color-mix(in srgb, var(--status-color) 13%, var(--surface)); cursor: pointer; }
.topic-status-color input { width: 18px; height: 18px; padding: 0; border: 0; border-radius: 5px; background: transparent; cursor: pointer; }
.topic-status-name { min-height: 32px; }
.topic-terminal { display: inline-flex; align-items: center; gap: 4px; min-height: 28px; padding: 0 8px; border: 1px solid var(--border); border-radius: 99px; background: var(--surface-2); color: var(--text-3); font: inherit; font-size: var(--fs-micro); cursor: pointer; }
.topic-terminal.on { border-color: color-mix(in srgb, var(--success) 45%, var(--border)); background: var(--tag-ok-bg); color: var(--tag-ok-text); }
.topic-status-actions { display: flex; gap: 3px; }
.topic-status-actions button { display: inline-grid; width: 26px; height: 26px; place-items: center; padding: 0; border: 0; border-radius: 7px; background: transparent; color: var(--text-3); cursor: pointer; }
.topic-status-actions button:hover { background: var(--surface-2); color: var(--text); }
.topic-status-actions button.danger:hover { background: var(--tag-danger-bg); color: var(--danger); }
.topic-status-actions button:disabled { opacity: var(--opacity-disabled); cursor: not-allowed; }
.topic-status-add { display: grid; grid-template-columns: 30px minmax(0, 1fr) auto; align-items: center; gap: 9px; padding-top: 10px; border-top: 1px solid var(--border); }
@media (max-width: 720px) {
  .topic-status-row { grid-template-columns: 18px 30px minmax(0, 1fr) auto; }
  .topic-terminal { grid-column: 3 / -1; justify-self: start; }
  .topic-status-caption { align-items: flex-start; flex-direction: column; }
}
</style>
