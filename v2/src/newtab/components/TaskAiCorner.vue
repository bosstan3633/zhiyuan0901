<script setup lang="ts">
/**
 * W6（V3.8.6）#3：任务卡**右上角** AI 入口 —— 点击直接跑「补全」（enrich），不再弹菜单。
 * 用户拍板：卡片视图的 AI 入口不应是「打开任务详情」或「拆解子任务」菜单——
 * 详情走单击卡片（onTaskRowClick 既有 260ms 去重），这里就该是纯 AI 功能直跑。
 * 与 TaskAiMenu 并存（R147-5）：菜单形态留给列表/看板/项目页行位，本组件只做卡片角标形态。
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
    const [{ loadAiConfig, aiReady, aiConfig }, { buildTaskEnrichJob }] = await Promise.all([import('@/shared/ai/config'), import('@/shared/ai/taskEnrich')])
    await loadAiConfig()
    if (!aiReady.value) { showToast('请先在 设置 → AI 助手 完成接入（地址/Key/模型）'); return }
    if (personaId.value === 'default' && aiConfig.value.defaultPersona) personaId.value = aiConfig.value.defaultPersona
    job.value = buildTaskEnrichJob(props.task, {
      d, depth: aiConfig.value.depth, persist: () => store.persist(),
      personaId: personaId.value,
      onPersona: (id) => { personaId.value = id; void run() },
    })
  } finally { busy.value = false }
}
</script>

<template>
  <button class="taic-btn" title="✦ AI 补全本任务（勾选采纳才写库，可换执笔专家）" @click.stop="run"><AiEntryButton :spin="busy" /></button>
  <AiDrawer v-if="job" :job="job" @close="job = null" />
</template>

<style scoped>
.taic-btn { position: absolute; top: 8px; right: 56px; width: 22px; height: 22px; border: none; background: transparent; color: var(--accent); opacity: .72; cursor: pointer; padding: 0; border-radius: 6px; display: inline-flex; align-items: center; justify-content: center; z-index: 1; transition: all var(--dur) ease; }
.taic-btn:hover { opacity: 1; background: var(--accent-light); }
</style>
