<script setup lang="ts">
/**
 * R144 · G1：策展台头部的「🏛 提炼论点骨架」入口。
 * Workspace 压在 1500 行验收线上——按钮、评审抽屉、AI 懒栈全收进本组件，宿主原位补一个标签。
 * AI 依赖零静态引用：点击时才 dynamic import。
 */
import { defineAsyncComponent, ref, shallowRef } from 'vue'
import { useAppStore } from '@/newtab/stores/app'
import { showToast } from '@/shared/components/toast'

const props = defineProps<{ wsId: string; wsName: string }>()
const store = useAppStore()
const AiDrawer = defineAsyncComponent(() => import('@/newtab/components/AiSuggestionDrawer.vue'))
const job = shallowRef<import('@/shared/ai/job').AiJob | null>(null)
const personaId = ref('default')
const busy = ref(false)

async function run() {
  const d = store.data
  if (!d) return
  busy.value = true
  try {
    const [{ loadAiConfig, aiReady, aiConfig }, { buildThesisDraftJob }] = await Promise.all([import('@/shared/ai/config'), import('@/shared/ai/batchG')])
    await loadAiConfig()
    if (!aiReady.value) { showToast('请先在 设置 → AI 助手 完成接入（地址/Key/模型）'); return }
    if (personaId.value === 'default' && aiConfig.value.defaultPersona) personaId.value = aiConfig.value.defaultPersona
    job.value = buildThesisDraftJob({
      d, depth: aiConfig.value.depth, persist: () => store.persist(),
      wsId: props.wsId, wsName: props.wsName,
      personaId: personaId.value,
      onPersona: (id) => { personaId.value = id; void run() },
    })
    if (!job.value) showToast('本台卡少于 3 张——先攒几张卡再立论点')
  } finally { busy.value = false }
}
</script>

<template>
  <button class="th-ai-btn" :disabled="busy" :title="'AI 通读本台卡群（描述不足的按需抓链接正文），提炼一句可被反驳的中心论点 + MECE 分论点骨架；勾选采纳才写卡'" @click.stop="run">{{ busy ? '⏳ 提炼中…' : '🏛 提炼论点骨架' }}</button>
  <AiDrawer v-if="job" :job="job" @close="job = null" />
</template>

<style scoped>
/* 自带样式：宿主 workspace.css 是 scoped，跨不到本组件（fragment 根不继承父 scope） */
.th-ai-btn { flex-shrink: 0; font-size: 12px; font-weight: 600; color: var(--accent); background: var(--accent-light); border: 1px dashed color-mix(in srgb, var(--accent) 40%, transparent); padding: 4px 12px; border-radius: var(--radius-xs); cursor: pointer; font-family: inherit; }
.th-ai-btn:hover { background: var(--accent); color: #fff; }
.th-ai-btn:disabled { opacity: var(--opacity-disabled); cursor: progress; }
</style>
