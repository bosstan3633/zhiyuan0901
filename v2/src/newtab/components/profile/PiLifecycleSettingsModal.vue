<script setup lang="ts">
import { computed } from 'vue'
import Icon from '@/shared/components/Icon.vue'
import type { LifecycleCard } from '@/newtab/components/LifecyclePanel.vue'

const props = defineProps<{ open: boolean; defaultDraft: number; cards: LifecycleCard[] }>()
const emit = defineEmits<{
  close: []
  'save-default': []
  'update:default-draft': [value: number]
  'set-days': [id: string, days: number | null]
}>()
const days = computed(() => Math.min(365, Math.max(1, Math.round(Number(props.defaultDraft) || 30))))
const titleOf = (card: LifecycleCard) => (card as { title?: string; question?: string }).title
  || (card as { question?: string }).question || '未命名'
function onDaysInput(event: Event) {
  const value = Number((event.target as HTMLInputElement).value) || 30
  emit('update:default-draft', value)
}
</script>

<template>
  <Teleport to="body">
    <div class="settings-overlay" :class="{ open }" @click.self="emit('close')">
      <div class="settings-modal">
        <div class="header"><Icon name="settings" :size="13"/> 冷却阈值设置</div>
        <div class="body">
          <p>全局默认冷却 <b>{{ days }}</b> 天 · 归档 = 冷却 × 3 = <b>{{ days * 3 }}</b> 天；每张卡可单独覆盖（清除后回落全局默认）。<br>修改阈值只影响状态判定，<b>不会改变卡片活跃度</b>。</p>
          <div class="global-row">
            <span>默认冷却天数</span>
            <input :value="defaultDraft" type="number" min="1" max="365" @input="onDaysInput">
            <button @click="emit('save-default')">保存</button>
          </div>
          <div class="card-list">
            <div v-for="card in cards" :key="card.id" class="card-row">
              <span class="name" :title="titleOf(card)">{{ titleOf(card) }}</span>
              <input class="small" type="number" min="1" max="365" placeholder="默认"
                :value="card.coolingDays || ''"
                @change="emit('set-days', card.id, Number(($event.target as HTMLInputElement).value) || null)">
              <button @click="emit('set-days', card.id, null)">清除</button>
            </div>
          </div>
        </div>
        <div class="footer"><button @click="emit('close')">关闭</button></div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.settings-overlay { position: fixed; inset: 0; z-index: var(--z-modal); display: none; align-items: center; justify-content: center; background: rgba(0,0,0,.45); }
.settings-overlay.open { display: flex; }
.settings-modal { display: flex; flex-direction: column; width: 640px; max-height: 85vh; border-radius: var(--radius-md); background: var(--surface); box-shadow: var(--shadow); }
.header { padding: 18px 22px 12px; border-bottom: 1px solid var(--border); color: var(--text); font-size: var(--fs-title); font-weight: 700; }
.body { flex: 1; overflow-y: auto; padding: 16px 22px; color: var(--text-2); font-size: var(--fs-body); line-height: 1.8; }
.global-row, .card-row { display: flex; align-items: center; gap: 10px; }
.global-row { margin: 12px 0; }
.card-list { display: flex; flex-direction: column; gap: 4px; max-height: 280px; overflow-y: auto; }
.card-row { padding: 6px 8px; border: 1px solid var(--border); border-radius: var(--radius-sm); }
.name { flex: 1; min-width: 0; overflow: hidden; color: var(--text); font-size: var(--fs-caption); text-overflow: ellipsis; white-space: nowrap; }
input, button { border: 1px solid var(--border); border-radius: var(--radius-sm); background: var(--surface); color: var(--text-2); font-family: inherit; font-size: var(--fs-sub); }
input { width: 90px; padding: 4px 8px; }
input.small { width: 80px; }
input:focus { outline: none; border-color: var(--accent); }
button { padding: 5px 14px; cursor: pointer; }
button:hover { border-color: var(--border-strong); color: var(--text); }
.footer { display: flex; justify-content: flex-end; gap: 8px; padding: 12px 22px 18px; border-top: 1px solid var(--border); }
</style>
