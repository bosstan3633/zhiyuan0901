<script setup lang="ts">
/** L1 论点卡详情：与页头横幅、画布根节点同读同一张 ResourceCard。 */
import { computed, ref, watch } from 'vue'
import Drawer from '@/shared/components/Drawer.vue'
import Icon from '@/shared/components/Icon.vue'
import ThesisAiBtn from '@/newtab/components/ThesisAiBtn.vue'
import type { Category, ResourceCard } from '@/shared/models'

const props = defineProps<{
  open: boolean
  card: ResourceCard | null
  nodes: Category[]
  wsId: string
  wsName: string
  rootCount: number
  resourceCount: number
  attachmentCount: number
}>()

const emit = defineEmits<{
  close: []
  save: [patch: { title: string; description: string }]
  'open-create': []
}>()

const title = ref('')
const description = ref('')

watch(() => [props.open, props.card?.id, props.card?.updatedAt], () => {
  if (!props.open) return
  title.value = props.card?.title || ''
  description.value = props.card?.description || ''
}, { immediate: true })

const canSave = computed(() => !!props.card && title.value.trim().length > 0)

function fmt(ts?: number): string {
  if (!ts) return '—'
  const d = new Date(ts)
  const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  const hm = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  return `${date} ${hm}`
}

function save(): void {
  if (!canSave.value) return
  emit('save', { title: title.value.trim(), description: description.value.trim() })
}
</script>

<template>
  <Drawer :open="open" width="520px" @close="emit('close')">
    <template #title>
      <Icon name="landmark" :size="15"/> 中心论点卡
    </template>
    <template v-if="card">
      <div class="ct-kicker">论点卡 · 策展台 L1 · 与顶部横幅和画布根节点同源</div>
      <label class="ct-label" for="curation-thesis-title">论点标题</label>
      <input id="curation-thesis-title" v-model="title" class="ct-input" maxlength="120"
        placeholder="一句可被反驳的核心判断" @keydown.enter.prevent="save" />
      <label class="ct-label" for="curation-thesis-desc">论点内容</label>
      <textarea id="curation-thesis-desc" v-model="description" class="ct-textarea" rows="5"
        placeholder="说明这个判断为什么成立、边界在哪里、本次策展要证明什么。" />
      <div class="ct-kv">
        <span>卡型</span><b>论点卡 · 策展台 L1</b>
        <span>创建时间</span><b>{{ fmt(card.createdAt) }}</b>
        <span>最近更新</span><b>{{ fmt(card.updatedAt) }}</b>
        <span>关联结构</span><b>{{ nodes.length }} 个论证节点 · {{ rootCount }} 个一级分支</b>
        <span>关联资源</span><b>{{ resourceCount }} 张资源卡 · {{ attachmentCount }} 个附件</b>
      </div>
      <div class="ct-section-title">卡内结构</div>
      <div v-if="nodes.filter(n => !n.parentId).length" class="ct-structure">
        <div v-for="node in nodes.filter(n => !n.parentId).sort((a, b) => a.order - b.order)" :key="node.id" class="ct-structure-row">
          <Icon name="folder" :size="13"/>
          <span>{{ node.name || '未命名分支' }}</span>
          <small>{{ nodes.filter(n => n.parentId === node.id).length }} 个子节点</small>
        </div>
      </div>
      <div v-else class="ct-empty">画布还没有一级分支。保存论点后按 Tab 创建第一个。</div>
      <div class="ct-actions">
        <ThesisAiBtn :ws-id="wsId" :ws-name="wsName" />
      </div>
    </template>
    <div v-else class="ct-empty">
      还没有中心论点。
      <button type="button" class="ct-link" @click="emit('open-create')">先写下中心论点</button>
    </div>
    <template #footer>
      <button v-if="card" type="button" class="ct-btn primary" :disabled="!canSave" @click="save">
        <Icon name="check" :size="13"/> 保存修改
      </button>
      <button type="button" class="ct-btn" @click="emit('close')">关闭</button>
    </template>
  </Drawer>
</template>

<style scoped>
.ct-kicker { margin-bottom: 16px; padding: 8px 10px; border-radius: 8px; background: var(--accent-light); color: var(--accent-ink); font-size: var(--fs-caption); line-height: 1.55; }
.ct-label { display: block; margin: 13px 0 6px; font-size: var(--fs-caption); font-weight: 650; color: var(--text-2); }
.ct-input, .ct-textarea { width: 100%; box-sizing: border-box; border: 1px solid var(--border); border-radius: 8px; background: var(--surface); color: var(--text); padding: 9px 11px; font: inherit; font-size: var(--fs-body); outline: none; transition: border-color var(--dur), box-shadow var(--dur); }
.ct-textarea { resize: vertical; min-height: 104px; line-height: 1.65; }
.ct-input:focus, .ct-textarea:focus { border-color: var(--accent); box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 14%, transparent); }
.ct-kv { display: grid; grid-template-columns: 86px minmax(0, 1fr); gap: 8px 10px; margin: 18px 0; padding: 13px; border: 1px solid var(--border); border-radius: 9px; background: var(--surface-2); font-size: var(--fs-caption); line-height: 1.5; }
.ct-kv span { color: var(--text-3); }
.ct-kv b { color: var(--text-2); font-weight: 600; overflow-wrap: anywhere; }
.ct-section-title { margin: 18px 0 8px; font-size: var(--fs-sub); font-weight: 700; color: var(--text); }
.ct-structure { display: flex; flex-direction: column; gap: 5px; }
.ct-structure-row { display: flex; align-items: center; gap: 7px; min-height: 32px; padding: 5px 9px; border: 1px solid var(--border); border-radius: 7px; color: var(--text-2); font-size: var(--fs-sub); }
.ct-structure-row span { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ct-structure-row small { color: var(--text-3); font-size: var(--fs-tiny); }
.ct-empty { padding: 16px; border: 1px dashed var(--border-strong); border-radius: 8px; color: var(--text-3); font-size: var(--fs-sub); line-height: 1.65; }
.ct-link { border: none; background: transparent; color: var(--accent); cursor: pointer; font: inherit; padding: 0 3px; text-decoration: underline; text-underline-offset: 2px; }
.ct-actions { display: flex; gap: 8px; flex-wrap: wrap; }
.ct-btn { min-height: 32px; display: inline-flex; align-items: center; justify-content: center; gap: 5px; padding: 6px 12px; border-radius: 7px; border: 1px solid var(--border); background: var(--surface); color: var(--text-2); cursor: pointer; font: inherit; font-size: var(--fs-sub); transition: all var(--dur); }
.ct-btn:hover { border-color: var(--accent); color: var(--accent); }
.ct-btn.primary { border-color: var(--accent); background: var(--accent); color: #fff; }
.ct-btn.primary:hover { background: var(--accent-hover); color: #fff; }
.ct-btn:disabled { opacity: var(--opacity-disabled); cursor: not-allowed; }
</style>
