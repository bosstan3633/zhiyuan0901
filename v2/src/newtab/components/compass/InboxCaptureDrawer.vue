<script setup lang="ts">
import { computed } from 'vue'
import Drawer from '@/shared/components/Drawer.vue'
import Icon from '@/shared/components/Icon.vue'
import type { CaptureConvertedKind, CaptureItem } from '@/shared/cloud/sync'

const props = defineProps<{
  open: boolean
  item: CaptureItem | null
  busy?: boolean
  deleting?: boolean
}>()

const emit = defineEmits<{
  close: []
  convert: [kind: CaptureConvertedKind]
  remove: []
  openSource: []
  openTarget: []
}>()

const conversionOptions: { kind: CaptureConvertedKind; label: string; icon: string }[] = [
  { kind: 'task', label: '任务卡', icon: 'clipboard' },
  { kind: 'curiosity', label: '好奇心卡', icon: 'bulb' },
  { kind: 'resource', label: '资源卡', icon: 'filetext' },
]

const sourceLabel = computed(() => props.item?.contentKind === 'link' ? '链接采集' : '文本采集')
const convertedLabel = computed(() => {
  const kind = props.item?.convertedKind
  return kind === 'task' ? '任务卡' : kind === 'curiosity' ? '好奇心卡' : kind === 'resource' ? '资源卡' : ''
})

function fmtTime(ts?: number): string {
  return ts ? new Date(ts).toLocaleString('zh-CN', { hour12: false }) : '—'
}
</script>

<template>
  <Drawer :open="open" width="520px" @close="emit('close')">
    <template #title>
      <Icon name="inbox" :size="15"/>
      <span>Inbox 采集详情</span>
    </template>

    <div v-if="item" class="icd">
      <header class="icd-head">
        <span class="icd-kind" :class="item.contentKind">
          <Icon :name="item.contentKind === 'link' ? 'link' : 'filetext'" :size="12"/>
          {{ sourceLabel }}
        </span>
        <span v-if="item.convertedKind" class="icd-converted">
          <Icon name="check" :size="12"/> 已转化为{{ convertedLabel }}
        </span>
        <span v-else class="icd-pending">待转化</span>
        <time>{{ fmtTime(item.createdAt) }}</time>
      </header>

      <section class="icd-block">
        <span class="icd-label">标题</span>
        <h3>{{ item.title?.trim() || '未填写标题' }}</h3>
      </section>

      <section v-if="item.url" class="icd-block">
        <span class="icd-label">原始链接</span>
        <div class="icd-link-row">
          <a :href="item.url" target="_blank" rel="noopener noreferrer">{{ item.url }}</a>
          <button type="button" @click="emit('openSource')">
            <Icon name="external" :size="12"/> 打开链接
          </button>
        </div>
      </section>

      <section v-if="item.text" class="icd-block">
        <span class="icd-label">采集正文</span>
        <pre>{{ item.text }}</pre>
      </section>

      <section v-if="item.note" class="icd-block">
        <span class="icd-label">备注</span>
        <p class="icd-note">{{ item.note }}</p>
      </section>

      <section v-if="item.tags?.length" class="icd-block">
        <span class="icd-label">标签</span>
        <div class="icd-tags">
          <span v-for="tag in item.tags" :key="tag">{{ tag }}</span>
        </div>
      </section>

      <section class="icd-block">
        <span class="icd-label">转化去向</span>
        <div class="icd-actions">
          <button v-for="option in conversionOptions" :key="option.kind" type="button"
            :class="{ on: item.convertedKind === option.kind }"
            :disabled="!!item.convertedKind || !!busy"
            @click="emit('convert', option.kind)">
            <Icon :name="option.icon" :size="13"/>
            {{ option.label }}
          </button>
        </div>
        <p v-if="item.convertedKind" class="icd-hint">这条采集已完成转化，另外两种类型不可再选。</p>
        <p v-else class="icd-hint">选择一种类型后，目标卡进入对应卡池；Inbox 只保留镜像入口。</p>
      </section>

      <footer class="icd-foot">
        <button v-if="item.convertedKind" type="button" class="icd-primary" @click="emit('openTarget')">
          <Icon name="arrowright" :size="13"/> 打开{{ convertedLabel }}
        </button>
        <span class="spacer"></span>
        <button type="button" class="icd-danger" :disabled="!!deleting || !!busy" @click="emit('remove')">
          <Icon name="trash" :size="12"/> {{ deleting ? '删除中…' : '删除 Inbox 记录' }}
        </button>
      </footer>
    </div>
  </Drawer>
</template>

<style scoped>
.icd { display: flex; flex-direction: column; gap: 16px; }
.icd-head { display: flex; align-items: center; gap: 7px; flex-wrap: wrap; }
.icd-head time { margin-left: auto; color: var(--text-3); font-size: var(--fs-micro); font-variant-numeric: tabular-nums; }
.icd-kind, .icd-converted, .icd-pending { display: inline-flex; align-items: center; gap: 4px; padding: 2px 7px; border-radius: 999px; font-size: var(--fs-micro); font-weight: 600; }
.icd-kind { background: var(--surface-2); color: var(--text-3); }
.icd-kind.text { background: var(--accent-light); color: var(--accent-ink); }
.icd-converted { background: var(--success-bg-soft); color: var(--success); }
.icd-pending { background: var(--info-blue-light); color: var(--info-blue); }
.icd-block { padding: 12px; border: 1px solid var(--border); border-radius: 10px; background: var(--surface); }
.icd-label { display: block; margin-bottom: 7px; color: var(--text-3); font-size: var(--fs-micro); font-weight: 600; letter-spacing: .03em; }
.icd-block h3 { margin: 0; color: var(--text); font-size: var(--fs-title); line-height: 1.55; overflow-wrap: anywhere; }
.icd-block a { color: var(--accent-ink); font-size: var(--fs-caption); line-height: 1.6; overflow-wrap: anywhere; }
.icd-link-row { display: flex; align-items: flex-start; gap: 9px; }
.icd-link-row a { flex: 1; min-width: 0; }
.icd-link-row button { flex: none; min-height: 30px; display: inline-flex; align-items: center; gap: 4px; padding: 4px 9px; border: 1px solid var(--accent); border-radius: 7px; background: var(--accent-light); color: var(--accent-ink); font: inherit; font-size: var(--fs-caption); cursor: pointer; }
.icd-block pre, .icd-block .icd-note { max-height: 240px; margin: 0; overflow: auto; white-space: pre-wrap; word-break: break-word; color: var(--text-2); font: inherit; font-size: var(--fs-sub); line-height: 1.7; }
.icd-tags { display: flex; gap: 5px; flex-wrap: wrap; }
.icd-tags span { padding: 2px 7px; border-radius: 999px; background: var(--surface-2); color: var(--text-3); font-size: var(--fs-micro); }
.icd-actions { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 7px; }
.icd-actions button { min-height: 36px; display: inline-flex; align-items: center; justify-content: center; gap: 5px; border: 1px solid var(--border); border-radius: 8px; background: var(--surface-2); color: var(--text-2); font: inherit; font-size: var(--fs-caption); cursor: pointer; }
.icd-actions button:hover:not(:disabled) { border-color: var(--accent); background: var(--accent-light); color: var(--accent-ink); }
.icd-actions button.on { border-color: var(--accent); background: var(--accent-light); color: var(--accent-ink); font-weight: 600; }
.icd-actions button:disabled { opacity: var(--opacity-disabled); cursor: not-allowed; }
.icd-hint { margin: 8px 0 0; color: var(--text-3); font-size: var(--fs-micro); line-height: 1.6; }
.icd-foot { display: flex; align-items: center; gap: 8px; padding-top: 4px; }
.icd-foot .spacer { flex: 1; }
.icd-primary, .icd-danger { min-height: 32px; display: inline-flex; align-items: center; gap: 5px; padding: 5px 11px; border: 1px solid var(--border); border-radius: 8px; background: var(--surface); color: var(--text-2); font: inherit; font-size: var(--fs-caption); cursor: pointer; }
.icd-primary { border-color: var(--accent); background: var(--accent-light); color: var(--accent-ink); }
.icd-danger { color: var(--danger); }
.icd-primary:hover, .icd-danger:hover:not(:disabled) { filter: brightness(.98); }
.icd-danger:disabled { opacity: var(--opacity-disabled); cursor: not-allowed; }
@media (max-width: 560px) { .icd-actions { grid-template-columns: 1fr; } }
</style>
