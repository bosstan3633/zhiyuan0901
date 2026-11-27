<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import Icon from '@/shared/components/Icon.vue'
import Modal from '@/shared/components/Modal.vue'
import type { ResourceCard } from '@/shared/models'

const props = withDefaults(defineProps<{
  open: boolean
  resources: ResourceCard[]
  linkedIds?: string[]
  title?: string
}>(), {
  linkedIds: () => [],
  title: '从资源卡池选择',
})

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'confirm', resources: ResourceCard[]): void
}>()

const query = ref('')
const selectedIds = ref<Set<string>>(new Set())

watch(() => props.open, open => {
  if (!open) return
  query.value = ''
  selectedIds.value = new Set()
})

const linked = computed(() => new Set(props.linkedIds))
const liveResources = computed(() => props.resources.filter(card => !card.deletedAt))
const filtered = computed(() => {
  const q = query.value.trim().toLowerCase()
  if (!q) return liveResources.value
  return liveResources.value.filter(card => [
    card.title,
    card.description || '',
    card.link || '',
    (card.tags || []).join(' '),
  ].some(text => String(text).toLowerCase().includes(q)))
})
const selectedResources = computed(() =>
  liveResources.value.filter(card => selectedIds.value.has(card.id) && !linked.value.has(card.id)))

function toggle(card: ResourceCard): void {
  if (linked.value.has(card.id)) return
  const next = new Set(selectedIds.value)
  if (next.has(card.id)) next.delete(card.id)
  else next.add(card.id)
  selectedIds.value = next
}

function confirmSelection(): void {
  if (!selectedResources.value.length) return
  emit('confirm', selectedResources.value)
}
</script>

<template>
  <Modal
    :open="open"
    :title="title"
    width="min(760px, 94vw)"
    max-height="min(82vh, 760px)"
    height="100%"
    @close="emit('close')"
  >
    <template #sub>
      <div class="crp-sub">
        <span>多选后一次挂载；已关联资源会标记并禁选。</span>
        <b>{{ selectedResources.length }} 已选</b>
      </div>
    </template>

    <div class="crp">
      <label class="crp-search">
        <Icon name="search" :size="14" />
        <input v-model="query" autofocus placeholder="搜索资源卡标题、标签、说明或链接…" />
        <button v-if="query" type="button" aria-label="清空搜索" @click="query = ''"><Icon name="x" :size="12" /></button>
      </label>

      <div class="crp-meta">
        <span>{{ filtered.length }} 张可浏览资源</span>
        <span v-if="query">关键词「{{ query.trim() }}」</span>
      </div>

      <div class="crp-list" role="listbox" aria-multiselectable="true" aria-label="资源卡候选">
        <button
          v-for="card in filtered"
          :key="card.id"
          class="crp-row"
          type="button"
          role="option"
          :aria-selected="selectedIds.has(card.id)"
          :disabled="linked.has(card.id)"
          :class="{ selected: selectedIds.has(card.id), linked: linked.has(card.id) }"
          @click="toggle(card)"
        >
          <span class="crp-check" aria-hidden="true">
            <Icon v-if="selectedIds.has(card.id)" name="check" :size="11" />
            <Icon v-else-if="linked.has(card.id)" name="link" :size="11" />
          </span>
          <span class="crp-copy">
            <b>{{ card.title || '（无标题资源）' }}</b>
            <small>{{ card.description || card.link || '资源卡' }}</small>
            <span v-if="(card.tags || []).length" class="crp-tags">
              <em v-for="tag in (card.tags || []).slice(0, 4)" :key="tag">{{ tag }}</em>
            </span>
          </span>
          <span v-if="linked.has(card.id)" class="crp-state">已关联</span>
          <Icon v-else name="filetext" :size="15" class="crp-file" />
        </button>
        <div v-if="!filtered.length" class="crp-empty">
          <Icon name="search" :size="22" />
          <b>没有匹配的资源卡</b>
          <span>试试更短的关键词，或先到资源卡池收藏素材。</span>
        </div>
      </div>
    </div>

    <template #footer>
      <div class="crp-foot">
        <span>只写独立关联记录，不改资源卡或当前卡片本体。</span>
        <div>
          <button type="button" class="crp-btn" @click="emit('close')">取消</button>
          <button type="button" class="crp-btn primary" :disabled="!selectedResources.length" @click="confirmSelection">
            挂载 {{ selectedResources.length || '' }} 张
          </button>
        </div>
      </div>
    </template>
  </Modal>
</template>

<style scoped>
.crp-sub { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 0 0 12px; color: var(--text-3); font-size: var(--fs-caption); }
.crp-sub b { flex: none; color: var(--accent-ink); font-variant-numeric: tabular-nums; }
.crp { display: flex; min-height: 0; flex-direction: column; gap: 10px; height: 100%; }
.crp-search {
  display: flex; min-height: 40px; align-items: center; gap: 8px;
  padding: 0 11px; border: 1px solid var(--border); border-radius: var(--radius-md);
  background: var(--surface-2); color: var(--text-3);
}
.crp-search:focus-within { border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-light); }
.crp-search input { flex: 1; min-width: 0; border: 0; outline: 0; background: transparent; color: var(--text); font: inherit; font-size: var(--fs-sub); }
.crp-search button { display: grid; width: 24px; height: 24px; place-items: center; padding: 0; border: 0; border-radius: 50%; background: var(--surface-3); color: var(--text-3); cursor: pointer; }
.crp-meta { display: flex; align-items: center; justify-content: space-between; gap: 8px; color: var(--text-4); font-size: var(--fs-micro); }
.crp-list { min-height: 0; flex: 1; overflow: auto; border: 1px solid var(--border); border-radius: var(--radius-lg); background: var(--surface); }
.crp-row {
  display: flex; width: 100%; align-items: flex-start; gap: 10px;
  padding: 11px 12px; border: 0; border-bottom: 1px solid var(--border);
  background: transparent; color: var(--text); text-align: left; font-family: inherit; cursor: pointer;
  transition: background var(--dur-fast), box-shadow var(--dur-fast);
}
.crp-row:last-child { border-bottom: 0; }
.crp-row:hover:not(:disabled) { background: var(--surface-2); }
.crp-row.selected { background: var(--accent-light); box-shadow: inset 3px 0 0 var(--accent); }
.crp-row.linked { cursor: default; background: color-mix(in srgb, var(--surface-2) 70%, var(--surface)); }
.crp-check {
  display: grid; width: 20px; height: 20px; flex: none; place-items: center;
  margin-top: 1px; border: 1px solid var(--border-strong); border-radius: 6px;
  background: var(--surface); color: var(--accent-ink);
}
.crp-row.selected .crp-check { border-color: var(--accent); background: var(--accent); color: var(--on-accent); }
.crp-row.linked .crp-check { border-color: var(--border); background: var(--surface-2); color: var(--text-4); }
.crp-copy { display: flex; flex: 1; min-width: 0; flex-direction: column; gap: 3px; }
.crp-copy b { overflow: hidden; color: var(--text); font-size: var(--fs-sub); font-weight: 650; text-overflow: ellipsis; white-space: nowrap; }
.crp-row.linked .crp-copy b { color: var(--text-3); }
.crp-copy small { overflow: hidden; color: var(--text-3); font-size: var(--fs-micro); text-overflow: ellipsis; white-space: nowrap; }
.crp-tags { display: flex; gap: 4px; flex-wrap: wrap; margin-top: 2px; }
.crp-tags em { padding: 1px 6px; border-radius: var(--radius-full); background: var(--surface-2); color: var(--text-3); font-size: var(--fs-micro); font-style: normal; }
.crp-state { flex: none; padding: 2px 7px; border-radius: var(--radius-full); background: var(--surface-2); color: var(--text-4); font-size: var(--fs-micro); }
.crp-file { flex: none; margin-top: 2px; color: var(--text-4); }
.crp-empty { display: grid; min-height: 220px; place-items: center; align-content: center; gap: 6px; color: var(--text-3); text-align: center; }
.crp-empty b { color: var(--text-2); font-size: var(--fs-body); }
.crp-empty span { font-size: var(--fs-caption); }
.crp-foot { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.crp-foot > span { color: var(--text-4); font-size: var(--fs-micro); line-height: 1.5; }
.crp-foot > div { display: flex; flex: none; gap: 7px; }
.crp-btn { min-height: 34px; padding: 0 13px; border: 1px solid var(--border); border-radius: var(--radius-full); background: var(--surface); color: var(--text-2); font: inherit; font-size: var(--fs-caption); cursor: pointer; }
.crp-btn.primary { border-color: var(--accent); background: var(--accent); color: var(--on-accent); font-weight: 650; }
.crp-btn:disabled { opacity: var(--opacity-disabled); cursor: not-allowed; }
@media (max-width: 640px) {
  .crp-foot { align-items: stretch; flex-direction: column; }
  .crp-foot > div { justify-content: flex-end; }
}
</style>
