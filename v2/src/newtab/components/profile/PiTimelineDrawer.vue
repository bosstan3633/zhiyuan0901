<script setup lang="ts">
import { computed } from 'vue'
import Drawer from '@/shared/components/Drawer.vue'
import Icon from '@/shared/components/Icon.vue'
import type { PiTimelineEntry } from './PiTimeline.vue'

const props = defineProps<{
  open: boolean
  entry: PiTimelineEntry | null
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'locate', entry: PiTimelineEntry): void
  (e: 'open-link', entry: PiTimelineEntry): void
}>()

const KIND_LABEL: Record<PiTimelineEntry['kind'], string> = {
  resource: '资源卡',
  task: '任务卡',
  topic: '选题卡',
  curiosity: '好奇心卡',
}

const updatedLabel = computed(() => props.entry
  ? new Date(props.entry.ts).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
  : '')

const linkLabel = computed(() => {
  if (!props.entry?.link) return ''
  if (props.entry.kind === 'topic' || props.entry.linkType === 'obsidian') return '打开成果 / Obsidian 链接'
  if (props.entry.linkType === 'file') return '打开本地文件'
  return '打开卡片链接'
})
</script>

<template>
  <Drawer :open="open && !!entry" width="430px" width-storage-key="timeline" @close="emit('close')">
    <template #title>
      <div v-if="entry" class="ptd-title">
        <span class="ptd-kicker">{{ KIND_LABEL[entry.kind] }} · 时间轴详情</span>
        <b>{{ entry.title }}</b>
      </div>
    </template>

    <div v-if="entry" class="ptd-body">
      <section class="ptd-hero" :style="{ '--status-color': entry.statusColor }">
        <span class="ptd-status"><i />{{ entry.status }}</span>
        <p>{{ entry.action }}于 {{ updatedLabel }}</p>
        <small v-if="entry.count > 1">当天共 {{ entry.count }} 次写入或修改</small>
      </section>

      <section class="ptd-facts">
        <div>
          <span>所属项目</span>
          <b>{{ entry.project || '未关联项目' }}</b>
        </div>
        <div>
          <span>成功指标</span>
          <b>{{ entry.metric || '未关联指标' }}</b>
        </div>
        <div>
          <span>卡片 ID</span>
          <b class="mono">{{ entry.id }}</b>
        </div>
      </section>

      <section class="ptd-note">
        <Icon name="layers" :size="15" />
        <div>
          <b>从画像回到工作面</b>
          <span>定位会打开调度台对应卡池，并高亮这张卡。</span>
        </div>
      </section>

      <footer class="ptd-foot">
        <button class="ptd-secondary" type="button" @click="emit('close')">关闭</button>
        <button v-if="entry.link" class="ptd-secondary ptd-link" type="button" @click="emit('open-link', entry)">
          <Icon name="link" :size="13" /> {{ linkLabel }}
        </button>
        <button class="ptd-primary" type="button" @click="emit('locate', entry)">
          <Icon name="arrowright" :size="13" /> 定位回卡片池
        </button>
      </footer>
    </div>
  </Drawer>
</template>

<style scoped>
.ptd-title { display: flex; min-width: 0; flex-direction: column; gap: 4px; }
.ptd-kicker { color: var(--text-3); font-size: var(--fs-micro); font-weight: 700; letter-spacing: .08em; }
.ptd-title b { overflow: hidden; color: var(--text); font-size: var(--fs-title); text-overflow: ellipsis; white-space: nowrap; }
.ptd-body { display: flex; flex-direction: column; gap: 14px; padding: 4px 0 8px; }
.ptd-hero {
  padding: 16px;
  border: 1px solid color-mix(in srgb, var(--status-color) 24%, var(--border));
  border-radius: 16px;
  background: color-mix(in srgb, var(--status-color) 7%, var(--surface));
}
.ptd-status { display: inline-flex; align-items: center; gap: 6px; color: color-mix(in srgb, var(--status-color) 76%, var(--text)); font-size: var(--fs-caption); font-weight: 700; }
.ptd-status i { width: 7px; height: 7px; border-radius: 50%; background: var(--status-color); }
.ptd-hero p { margin: 9px 0 0; color: var(--text-2); font-size: var(--fs-body); line-height: 1.6; }
.ptd-hero small { display: block; margin-top: 4px; color: var(--text-3); font-size: var(--fs-micro); }
.ptd-facts {
  display: grid;
  gap: 1px;
  overflow: hidden;
  border: 1px solid var(--border);
  border-radius: 14px;
  background: var(--border);
}
.ptd-facts > div { display: grid; grid-template-columns: 92px minmax(0, 1fr); gap: 12px; padding: 11px 13px; background: var(--surface); }
.ptd-facts span { color: var(--text-3); font-size: var(--fs-caption); }
.ptd-facts b { overflow-wrap: anywhere; color: var(--text-2); font-size: var(--fs-caption); font-weight: 650; }
.ptd-facts .mono { font-family: var(--font-mono, ui-monospace, SFMono-Regular, Menlo, monospace); font-size: var(--fs-micro); }
.ptd-note { display: flex; align-items: flex-start; gap: 9px; padding: 12px 13px; border-radius: 13px; background: var(--surface-2); color: var(--text-3); }
.ptd-note > :deep(svg) { flex: none; margin-top: 1px; }
.ptd-note div { display: flex; flex-direction: column; gap: 3px; }
.ptd-note b { color: var(--text-2); font-size: var(--fs-caption); }
.ptd-note span { font-size: var(--fs-micro); line-height: 1.5; }
.ptd-foot { display: flex; justify-content: flex-end; gap: 9px; margin-top: auto; padding-top: 4px; }
.ptd-secondary, .ptd-primary { min-height: 36px; padding: 0 14px; border-radius: var(--radius-full); font: inherit; font-size: var(--fs-caption); font-weight: 700; cursor: pointer; }
.ptd-secondary { border: 1px solid var(--border); background: var(--surface); color: var(--text-2); }
.ptd-secondary.ptd-link { display: inline-flex; align-items: center; gap: 5px; color: var(--accent-ink); border-color: color-mix(in srgb, var(--accent) 28%, var(--border)); }
.ptd-primary { display: inline-flex; align-items: center; gap: 5px; border: 1px solid var(--accent); background: var(--accent); color: var(--on-accent, #fff); }
</style>
