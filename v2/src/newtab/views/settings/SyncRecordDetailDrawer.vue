<script setup lang="ts">
import { computed } from 'vue'
import Drawer from '@/shared/components/Drawer.vue'
import Icon from '@/shared/components/Icon.vue'
import type { SyncManifestRecord } from '@/shared/cloud/sync'

const props = defineProps<{
  open: boolean
  record: SyncManifestRecord | null
  source: 'local' | 'remote'
}>()
const emit = defineEmits<{ close: [] }>()

const typeLabel = computed(() => ({
  workspace: '策展台',
  category: '分类',
  resource: '资源卡',
  task: '任务卡',
  curiosity: '好奇心卡',
  argument: '论证卡',
  direction: '方向',
  project: '项目',
  metric: '成功指标',
  dailyFocus: '今日三件事',
  event: '操作事件',
  preference: '偏好',
} as Record<string, string>)[props.record?.type || ''] || '记录')

function metaLabel(key: string): string {
  return ({
    action: '动作',
    cardKind: '卡种',
    cardId: '目标卡 ID',
    deviceId: '来源设备',
    to: '目标状态',
  } as Record<string, string>)[key] || key
}

function fmtTime(ts?: number): string {
  return ts ? new Date(ts).toLocaleString('zh-CN', { hour12: false }) : '—'
}

function shortDigest(value?: string): string {
  if (!value) return '—'
  return value.length > 34 ? `${value.slice(0, 19)}…${value.slice(-10)}` : value
}
</script>

<template>
  <Drawer :open="open" width="460px" @close="emit('close')">
    <template #title>
      <Icon name="database" :size="15"/>
      <span>记录详情 · {{ typeLabel }}</span>
    </template>
    <div v-if="record" class="srd">
      <div class="srd-source" :class="source">
        {{ source === 'local' ? '本机同步基线' : '云端当前修订' }}
      </div>
      <h2>{{ record.title }}</h2>
      <dl class="srd-facts">
        <div><dt>类型</dt><dd>{{ typeLabel }}</dd></div>
        <div><dt>状态</dt><dd>{{ record.deleted ? '已删除 / 回收站' : '有效' }}</dd></div>
        <div><dt>更新时间</dt><dd>{{ fmtTime(record.updatedAt) }}</dd></div>
        <div><dt>稳定 ID</dt><dd><code>{{ record.id }}</code></dd></div>
        <div><dt>内容摘要指纹</dt><dd><code :title="record.digest">{{ shortDigest(record.digest) }}</code></dd></div>
      </dl>

      <section v-if="record.meta" class="srd-meta">
        <h3>记录背后的事实</h3>
        <dl>
          <div v-for="(value, key) in record.meta" :key="key">
            <dt>{{ metaLabel(String(key)) }}</dt>
            <dd><code>{{ value }}</code></dd>
          </div>
        </dl>
      </section>

      <p class="srd-note">
        这里展示同步记录的可读摘要与指纹，不展开完整业务 JSON、附件本体、令牌或凭据。
      </p>
    </div>
  </Drawer>
</template>

<style scoped>
.srd { display: flex; flex-direction: column; gap: 14px; }
.srd-source { align-self: flex-start; padding: 3px 8px; border-radius: 999px; background: var(--accent-light); color: var(--accent-ink); font-size: var(--fs-micro); font-weight: 700; }
.srd-source.remote { background: var(--tag-info-bg); color: var(--tag-info-text); }
.srd h2 { margin: 0; color: var(--text); font-size: var(--fs-title); line-height: 1.55; overflow-wrap: anywhere; }
.srd-facts, .srd-meta dl { display: flex; flex-direction: column; gap: 7px; margin: 0; }
.srd-facts > div, .srd-meta dl > div { display: grid; grid-template-columns: 112px minmax(0, 1fr); gap: 10px; padding: 8px 10px; border: 1px solid var(--border); border-radius: 8px; background: var(--surface); }
.srd dt { color: var(--text-3); font-size: var(--fs-micro); }
.srd dd { min-width: 0; margin: 0; color: var(--text-2); font-size: var(--fs-caption); overflow-wrap: anywhere; }
.srd code { color: var(--text-2); font-family: var(--font-mono); font-size: var(--fs-micro); overflow-wrap: anywhere; }
.srd-meta { padding: 12px; border: 1px solid var(--border); border-radius: 10px; background: var(--surface-2); }
.srd-meta h3 { margin: 0 0 9px; color: var(--text); font-size: var(--fs-sub); }
.srd-note { margin: 0; padding: 10px 11px; border-radius: 8px; background: var(--surface-2); color: var(--text-3); font-size: var(--fs-caption); line-height: 1.65; }
@media (max-width: 520px) {
  .srd-facts > div, .srd-meta dl > div { grid-template-columns: 1fr; gap: 3px; }
}
</style>
