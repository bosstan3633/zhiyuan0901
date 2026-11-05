<script setup lang="ts">
/**
 * V4.1.3：资源卡只保留单卡全字段 AI 优化。
 *
 * 关系白名单已经收口为「任务挂资源、策展节点挂资源」；资源侧不再提供反向关联任务入口。
 * 零静态 AI 依赖：job 工厂仍只在点击时 dynamic import。
 */
import { ref, shallowRef } from 'vue'
import type { ResourceCard } from '@/shared/models'
import type { AiJob, AiRow } from '@/shared/ai/job'
import { useAppStore } from '@/newtab/stores/app'
import { showToast } from '@/shared/components/toast'
import AiEntryButton from '@/shared/components/AiEntryButton.vue'
import { AiDrawer } from './lazyAiDrawer'

const props = defineProps<{
  card: ResourceCard | null
  /** 采纳后回调：抽屉还开着，宿主要把表单同步成已落库的值（R154 拍板①：采纳=直接写库） */
  onAdopted?: () => void
}>()
const store = useAppStore()

const job = shallowRef<AiJob | null>(null)
const personaId = ref('default')
/** 两枚入口共用一把锁：动态 import + 读配置这段真空期徽标转起来，且不吃第二次点击 */
const busy = ref(false)

function wrapApply(j: AiJob): void {
  const base = j.apply
  if (!base) return
  j.apply = (rows: AiRow[]): string | Promise<string> => {
    const out = base(rows)
    const sync = () => props.onAdopted?.()
    if (typeof (out as Promise<string>)?.then === 'function') return (out as Promise<string>).then(t => { sync(); return t })
    sync()
    return out
  }
}

async function run(): Promise<void> {
  if (busy.value) return
  const card = props.card
  const d = store.data
  if (!card || !d) return
  busy.value = true
  try {
    const { loadAiConfig, aiReady, aiConfig } = await import('@/shared/ai/config')
    await loadAiConfig()
    if (!aiReady.value) { showToast('请先在 设置 → AI 助手 完成接入（地址/Key/模型）'); return }
    if (personaId.value === 'default' && aiConfig.value.defaultPersona) personaId.value = aiConfig.value.defaultPersona
    const ctx = {
      d, depth: aiConfig.value.depth, persist: () => store.persist(),
      personaId: personaId.value, onPersona: (id: string) => { personaId.value = id; void run() },
    }
    const { buildResourceEnrichJob } = await import('@/shared/ai/select')
    const j: AiJob | null = buildResourceEnrichJob(card, ctx)
    if (!j) { showToast('这张卡已不存在或没有可发起的内容'); return }
    wrapApply(j)
    job.value = j
  } finally { busy.value = false }
}

function fmt(ts?: number): string {
  return ts ? new Date(ts).toLocaleString('zh-CN', { hour12: false, month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : ''
}
</script>

<template>
  <div class="ds-ai-strip">
    <button class="ds-ai-cell" :disabled="!card || busy"
      title="AI 读取完整卡面；http(s) 链接会同时读取正文，然后重新评估标题、描述、标签、来源等全部内容字段。不是只补空缺；采纳前可逐项取消。链接、附件、ID、时间与同步字段不会被 AI 改写。"
      @click.stop="run">
      <span class="ico"><AiEntryButton variant="icon" :spin="busy" /></span>
      <span class="tx"><b>{{ card?.aiTouchedAt ? '↻ 重新优化' : 'AI 优化' }}</b><small>复核全字段与链接正文 · 重写后对照采纳</small></span>
    </button>
    <span v-if="card?.aiTouchedAt" class="ds-ai-when">最近 · {{ fmt(card.aiTouchedAt) }}</span>
  </div>
  <AiDrawer v-if="job" :job="job" @close="job = null" />
</template>
