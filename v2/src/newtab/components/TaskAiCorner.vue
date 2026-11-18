<script setup lang="ts">
/**
 * V4.4.0：任务卡右上角 AI 入口直接为任务寻找资源支持。
 * 详情仍走单击卡片；AI 能力收敛为「找资源」，不再在卡面暴露补全或拆解。
 * 自包含纪律（承 TaskAiMenu/CardAiEntry）：按钮、评审抽屉、样式都在本组件内，
 * AI 依赖零静态引用，点击时才 dynamic import。
 */
import { ref, shallowRef } from 'vue'
import type { TaskCard } from '@/shared/models'
import { useAppStore } from '@/newtab/stores/app'
import { showToast } from '@/shared/components/toast'
import AiEntryButton from '@/shared/components/AiEntryButton.vue'

const props = defineProps<{ task: TaskCard }>()
const store = useAppStore()
import { AiDrawer } from './lazyAiDrawer'
const job = shallowRef<import('@/shared/ai/job').AiJob | null>(null)
const busy = ref(false)
const personaId = ref('default')

async function run() {
  if (busy.value) return
  busy.value = true
  try {
    const d = store.data
    if (!d) return
    const [{ loadAiConfig, aiReady, aiConfig }, { buildTaskSupportJob }] = await Promise.all([import('@/shared/ai/config'), import('@/shared/ai/taskSupport')])
    await loadAiConfig()
    if (!aiReady.value) { showToast('请先在 设置 → AI 助手 完成接入（地址/Key/模型）'); return }
    if (personaId.value === 'default' && aiConfig.value.defaultPersona) personaId.value = aiConfig.value.defaultPersona
    job.value = buildTaskSupportJob({
      d, depth: aiConfig.value.depth, persist: () => store.persist(), taskId: props.task.id,
      personaId: personaId.value,
      onPersona: (id) => { personaId.value = id; void run() },
    })
  } finally { busy.value = false }
}
</script>

<template>
  <button class="taic-btn" title="AI 从资源卡池为本任务寻找支持（勾选采纳后才建立关联）" @click.stop="run"><AiEntryButton :spin="busy" /></button>
  <AiDrawer v-if="job" :job="job" @close="job = null" />
</template>

<style scoped>
.taic-btn { position: absolute; top: 8px; right: 56px; width: 22px; height: 22px; border: none; background: transparent; color: var(--accent); opacity: .72; cursor: pointer; padding: 0; border-radius: 6px; display: inline-flex; align-items: center; justify-content: center; z-index: 1; transition: all var(--dur) ease; }
.taic-btn:hover { opacity: 1; background: var(--accent-light); }
</style>
