<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import Drawer from '@/shared/components/Drawer.vue'
import Icon from '@/shared/components/Icon.vue'
import type { CaptureConvertedKind, CaptureItem, CapturePatch } from '@/shared/cloud/sync'

const props = defineProps<{
  open: boolean
  item: CaptureItem | null
  busy?: boolean
  saving?: boolean
  deleting?: boolean
}>()

const emit = defineEmits<{
  close: []
  save: [patch: CapturePatch]
  convert: [kind: CaptureConvertedKind]
  remove: []
  openSource: [url?: string]
}>()

const conversionOptions: { kind: CaptureConvertedKind; label: string; icon: string }[] = [
  { kind: 'task', label: '任务卡', icon: 'clipboard' },
  { kind: 'curiosity', label: '好奇心卡', icon: 'bulb' },
  { kind: 'resource', label: '资源卡', icon: 'filetext' },
]

const draft = reactive({ title: '', url: '', text: '', note: '', tags: '' })
const tagFocused = ref(false)

function resetDraft(item: CaptureItem | null): void {
  draft.title = item?.title || ''
  draft.url = item?.url || ''
  draft.text = item?.text || ''
  draft.note = item?.note || ''
  draft.tags = (item?.tags || []).join('，')
}

watch(() => [props.open, props.item?.id], () => {
  if (props.open) resetDraft(props.item)
}, { immediate: true })

const sourceLabel = computed(() => props.item?.contentKind === 'link' ? '链接采集' : '文本采集')
const parsedTags = computed(() => [...new Set(
  draft.tags.split(/[,，\n]/).map(tag => tag.trim()).filter(Boolean),
)])
const dirty = computed(() => {
  const item = props.item
  if (!item) return false
  return draft.title !== (item.title || '')
    || draft.url !== (item.url || '')
    || draft.text !== (item.text || '')
    || draft.note !== (item.note || '')
    || parsedTags.value.join('\u0000') !== (item.tags || []).join('\u0000')
})
const canSave = computed(() => dirty.value && !props.saving && !props.busy && !!draft.title.trim())

function save(): void {
  if (!canSave.value) return
  emit('save', {
    title: draft.title,
    url: draft.url,
    ...(props.item?.contentKind === 'text' ? { text: draft.text } : {}),
    note: draft.note,
    tags: parsedTags.value,
  })
}

function openSource(): void {
  emit('openSource', draft.url)
}

function fmtTime(ts?: number): string {
  return ts ? new Date(ts).toLocaleString('zh-CN', { hour12: false }) : '—'
}
</script>

<template>
  <Drawer :open="open" width="540px" @close="emit('close')">
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
        <span class="icd-pending">未转化 · 可在此编辑，转化后才离开列表</span>
        <time>{{ fmtTime(item.createdAt) }}</time>
      </header>

      <section class="icd-block">
        <label class="icd-label" for="inbox-edit-title">标题</label>
        <input id="inbox-edit-title" v-model="draft.title" class="icd-input icd-title-input"
          placeholder="未填写标题时，将取正文首行" @keydown.enter.prevent="save">
      </section>

      <section v-if="item.contentKind === 'link'" class="icd-block">
        <label class="icd-label" for="inbox-edit-url">采集链接</label>
        <div class="icd-link-row">
          <input id="inbox-edit-url" v-model="draft.url" class="icd-input" type="url" placeholder="https://…">
          <button type="button" :disabled="!draft.url.trim()" @click="openSource">
            <Icon name="external" :size="12"/> 打开
          </button>
        </div>
      </section>

      <section v-else class="icd-block">
        <label class="icd-label" for="inbox-edit-text">采集正文</label>
        <textarea id="inbox-edit-text" v-model="draft.text" class="icd-input icd-textarea"
          placeholder="采集正文" rows="8"></textarea>
      </section>

      <section class="icd-block">
        <label class="icd-label" for="inbox-edit-note">备注</label>
        <textarea id="inbox-edit-note" v-model="draft.note" class="icd-input icd-textarea"
          placeholder="补充为什么要留下它" rows="4"></textarea>
      </section>

      <section class="icd-block">
        <label class="icd-label" for="inbox-edit-tags">标签</label>
        <input id="inbox-edit-tags" v-model="draft.tags" class="icd-input"
          placeholder="用逗号或换行分隔，例如：AI，研究，待读"
          @focus="tagFocused = true" @blur="tagFocused = false">
        <div v-if="parsedTags.length" class="icd-tags" :class="{ muted: tagFocused }">
          <span v-for="tag in parsedTags" :key="tag">{{ tag }}</span>
        </div>
      </section>

      <section class="icd-block icd-convert">
        <span class="icd-label">转化为其他卡</span>
        <div class="icd-actions">
          <button v-for="option in conversionOptions" :key="option.kind" type="button"
            :disabled="!!busy || !!saving" @click="emit('convert', option.kind)">
            <Icon :name="option.icon" :size="13"/>
            {{ option.label }}
          </button>
        </div>
        <p class="icd-hint">转化成功后，这条采集立即离开 Inbox；目标卡进入对应卡池。若还有未保存编辑，建议先保存。</p>
      </section>

      <footer class="icd-foot">
        <button type="button" class="icd-danger" :disabled="!!deleting || !!busy || !!saving" @click="emit('remove')">
          <Icon name="trash" :size="12"/> {{ deleting ? '删除中…' : '删除采集' }}
        </button>
        <span class="spacer"></span>
        <button type="button" class="icd-secondary" @click="emit('close')">取消</button>
        <button type="button" class="icd-primary" :disabled="!canSave" @click="save">
          <Icon name="check" :size="13"/> {{ saving ? '保存中…' : dirty ? '保存修改' : '已保存' }}
        </button>
      </footer>
    </div>
  </Drawer>
</template>

<style scoped>
.icd { display: flex; flex-direction: column; gap: 14px; }
.icd-head { display: flex; align-items: center; gap: 7px; flex-wrap: wrap; }
.icd-head time { margin-left: auto; color: var(--text-3); font-size: var(--fs-micro); font-variant-numeric: tabular-nums; }
.icd-kind, .icd-pending { display: inline-flex; align-items: center; gap: 4px; padding: 2px 7px; border-radius: 999px; font-size: var(--fs-micro); font-weight: 600; }
.icd-kind { background: var(--surface-2); color: var(--text-3); }
.icd-kind.text { background: var(--accent-light); color: var(--accent-ink); }
.icd-pending { background: var(--info-blue-light); color: var(--info-blue); }
.icd-block { padding: 12px; border: 1px solid var(--border); border-radius: 10px; background: var(--surface); }
.icd-label { display: block; margin-bottom: 7px; color: var(--text-3); font-size: var(--fs-micro); font-weight: 650; letter-spacing: .03em; }
.icd-input { width: 100%; min-height: 34px; padding: 7px 9px; border: 1px solid var(--border); border-radius: 8px; background: var(--surface-2); color: var(--text); font: inherit; font-size: var(--fs-sub); outline: 0; }
.icd-input:focus { border-color: var(--accent); box-shadow: 0 0 0 2px var(--accent-light); }
.icd-title-input { font-size: var(--fs-title); font-weight: 650; }
.icd-textarea { min-height: 96px; resize: vertical; line-height: 1.65; }
.icd-link-row { display: flex; align-items: center; gap: 8px; }
.icd-link-row .icd-input { flex: 1; min-width: 0; }
.icd-link-row button { min-height: 34px; flex: none; display: inline-flex; align-items: center; gap: 4px; padding: 5px 9px; border: 1px solid var(--accent); border-radius: 8px; background: var(--accent-light); color: var(--accent-ink); font: inherit; font-size: var(--fs-caption); cursor: pointer; }
.icd-tags { display: flex; gap: 5px; flex-wrap: wrap; margin-top: 7px; transition: opacity var(--dur-fast); }
.icd-tags.muted { opacity: .42; }
.icd-tags span { padding: 2px 7px; border-radius: 999px; background: var(--surface-2); color: var(--text-3); font-size: var(--fs-micro); }
.icd-actions { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 7px; }
.icd-actions button { min-height: 36px; display: inline-flex; align-items: center; justify-content: center; gap: 5px; border: 1px solid var(--border); border-radius: 8px; background: var(--surface-2); color: var(--text-2); font: inherit; font-size: var(--fs-caption); cursor: pointer; }
.icd-actions button:hover:not(:disabled) { border-color: var(--accent); background: var(--accent-light); color: var(--accent-ink); }
.icd-actions button:disabled { opacity: var(--opacity-disabled); cursor: not-allowed; }
.icd-hint { margin: 8px 0 0; color: var(--text-3); font-size: var(--fs-micro); line-height: 1.6; }
.icd-foot { display: flex; align-items: center; gap: 8px; padding-top: 4px; }
.icd-foot .spacer { flex: 1; }
.icd-primary, .icd-secondary, .icd-danger { min-height: 32px; display: inline-flex; align-items: center; gap: 5px; padding: 5px 11px; border: 1px solid var(--border); border-radius: 8px; background: var(--surface); color: var(--text-2); font: inherit; font-size: var(--fs-caption); cursor: pointer; }
.icd-primary { border-color: var(--accent); background: var(--accent); color: #fff; }
.icd-danger { color: var(--danger); }
.icd-primary:disabled, .icd-danger:disabled { opacity: var(--opacity-disabled); cursor: not-allowed; }
@media (max-width: 560px) {
  .icd-actions { grid-template-columns: 1fr; }
  .icd-foot { flex-wrap: wrap; }
}
</style>
