<script setup lang="ts">
/** 论证卡原生详情：标题、论证正文与附件；数据写入由宿主负责。 */
import { computed, ref, watch } from 'vue'
import Drawer from '@/shared/components/Drawer.vue'
import Icon from '@/shared/components/Icon.vue'
import AssetManager from '@/shared/components/AssetManager.vue'
import type { ArgumentCard, AssetMeta } from '@/shared/models'

const props = defineProps<{
  open: boolean
  card: ArgumentCard | null
  workspaceName: string
}>()

const emit = defineEmits<{
  close: []
  save: [patch: Pick<ArgumentCard, 'title' | 'content' | 'assets'>]
}>()

const title = ref('')
const content = ref('')
const assets = ref<AssetMeta[]>([])
watch(() => [props.open, props.card?.id, props.card?.updatedAt], () => {
  if (!props.open || !props.card) return
  title.value = props.card.title || ''
  content.value = props.card.content || ''
  assets.value = [...(props.card.assets || [])]
}, { immediate: true })

const canSave = computed(() => title.value.trim().length > 0)
function save(): void {
  if (!canSave.value) return
  emit('save', {
    title: title.value.trim(),
    content: content.value.trim() || undefined,
    assets: assets.value
  })
}
</script>

<template>
  <Drawer :open="open" width="520px" @close="emit('close')">
    <template #title><Icon name="landmark" :size="15"/> 论证卡</template>
    <template v-if="card">
      <div class="arg-kicker">论证卡 · {{ workspaceName }}</div>
      <label class="arg-label" for="argument-title">论证标题</label>
      <input id="argument-title" v-model="title" class="arg-input" maxlength="120"
        placeholder="一句可被检验的论证要点" @keydown.enter.prevent="save" />
      <label class="arg-label" for="argument-content">论证内容</label>
      <textarea id="argument-content" v-model="content" class="arg-textarea" rows="6"
        placeholder="补充这个论证成立的依据、边界与反例。" />
      <div class="arg-section">
        <div class="arg-section-title"><Icon name="paperclip" :size="13"/> 附件</div>
        <AssetManager v-model="assets" :owner-id="card.id" />
      </div>
      <div class="arg-meta">
        <span>所属策展台</span><b>{{ workspaceName }}</b>
        <span>关联资源</span><b>{{ card.linkedResourceIds?.length || 0 }} 张</b>
        <span>最近更新</span><b>{{ card.updatedAt ? new Date(card.updatedAt).toLocaleString('zh-CN', { hour12: false }) : '—' }}</b>
      </div>
    </template>
    <template #footer>
      <button type="button" class="arg-btn" @click="emit('close')">关闭</button>
      <button type="button" class="arg-btn primary" :disabled="!canSave" @click="save">
        <Icon name="check" :size="13"/> 保存修改
      </button>
    </template>
  </Drawer>
</template>

<style scoped>
.arg-kicker { margin-bottom: 14px; padding: 8px 10px; border-radius: 8px; background: var(--accent-light); color: var(--accent-ink); font-size: var(--fs-caption); }
.arg-label { display: block; margin: 13px 0 6px; color: var(--text-2); font-size: var(--fs-caption); font-weight: 650; }
.arg-input, .arg-textarea { width: 100%; box-sizing: border-box; padding: 9px 11px; border: 1px solid var(--border); border-radius: 8px; background: var(--surface); color: var(--text); font: inherit; font-size: var(--fs-body); outline: none; }
.arg-textarea { min-height: 130px; resize: vertical; line-height: 1.65; }
.arg-input:focus, .arg-textarea:focus { border-color: var(--accent); box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 14%, transparent); }
.arg-section { margin-top: 16px; }
.arg-section-title { display: flex; align-items: center; gap: 6px; margin-bottom: 8px; color: var(--text-2); font-size: var(--fs-sub); font-weight: 650; }
.arg-meta { display: grid; grid-template-columns: 82px minmax(0, 1fr); gap: 7px 10px; margin-top: 16px; padding: 12px; border: 1px solid var(--border); border-radius: 8px; background: var(--surface-2); font-size: var(--fs-caption); }
.arg-meta span { color: var(--text-3); }
.arg-meta b { color: var(--text-2); font-weight: 600; overflow-wrap: anywhere; }
.arg-btn { min-height: 32px; display: inline-flex; align-items: center; justify-content: center; gap: 5px; padding: 6px 12px; border: 1px solid var(--border); border-radius: 7px; background: var(--surface); color: var(--text-2); cursor: pointer; font: inherit; font-size: var(--fs-sub); }
.arg-btn:hover { border-color: var(--accent); color: var(--accent); }
.arg-btn.primary { border-color: var(--accent); background: var(--accent); color: #fff; }
.arg-btn:disabled { opacity: var(--opacity-disabled); cursor: not-allowed; }
</style>
