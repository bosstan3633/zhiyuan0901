<script setup lang="ts">
/**
 * R167：资源详情「一行两格」AI 入口条（AI 补全 / 关联任务）——两宿主共用一份。
 *
 * 为什么必须成组件，而不是在两宿主各写一遍：R165-A 那条被绕过的红线就是"两枚入口并成一枚时
 * 只改了一个宿主"留下的（见 06-2 通则）。入口的**文案、禁用条件、互斥锁、抓不抓链接**只要分叉，
 * 用户在同一张卡上看到的就是两套承诺。
 *
 * 零静态 AI 依赖：评审抽屉走 `lazyAiDrawer` 的异步壳，job 工厂在点击时才 dynamic import——
 * 本组件挂在 Workspace（启动链）上，静态引一道就会把整条 AI 栈卷进启动 chunk（R134 踩坑）。
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
const busy = ref<'' | 'enrich' | 'linkTask'>('')

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

async function run(kind: 'enrich' | 'linkTask'): Promise<void> {
  if (busy.value) return
  const card = props.card
  const d = store.data
  if (!card || !d) return
  busy.value = kind
  try {
    const { loadAiConfig, aiReady, aiConfig } = await import('@/shared/ai/config')
    await loadAiConfig()
    if (!aiReady.value) { showToast('请先在 设置 → AI 助手 完成接入（地址/Key/模型）'); return }
    if (personaId.value === 'default' && aiConfig.value.defaultPersona) personaId.value = aiConfig.value.defaultPersona
    const ctx = {
      d, depth: aiConfig.value.depth, persist: () => store.persist(),
      personaId: personaId.value, onPersona: (id: string) => { personaId.value = id; void run(kind) },
    }
    let j: AiJob | null = null
    if (kind === 'enrich') {
      const { buildResourceEnrichJob } = await import('@/shared/ai/select')
      j = buildResourceEnrichJob(card, ctx)
    } else {
      const { buildResourceLinkTaskJob } = await import('@/shared/ai/resourceLinkTask')
      j = buildResourceLinkTaskJob({ ...ctx, resourceId: card.id })
    }
    if (!j) { showToast('这张卡已不存在或没有可发起的内容'); return }
    wrapApply(j)
    job.value = j
  } finally { busy.value = '' }
}

function fmt(ts?: number): string {
  return ts ? new Date(ts).toLocaleString('zh-CN', { hour12: false, month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : ''
}
</script>

<template>
  <div class="ds-ai-strip">
    <button class="ds-ai-cell" :disabled="!card || busy !== ''"
      title="点了才抓：链接是 http(s) 就先把网页正文读回来一起补（本地/Obsidian 不抓）。空着的地方直接补，你已经写过的字段只给建议、默认不勾。"
      @click.stop="run('enrich')">
      <span class="ico"><AiEntryButton variant="icon" :spin="busy === 'enrich'" /></span>
      <span class="tx"><b>{{ card?.aiTouchedAt ? '↻ 重新补全' : 'AI 补全' }}</b><small>自动抓链接正文 · 补四项</small></span>
    </button>
    <button class="ds-ai-cell" :disabled="!card || busy !== ''"
      title="扫任务调度里的全量任务卡，找出这条资源真正支撑着哪些任务。采纳只记关联，任务卡本体一字不改；解绑在任务侧做。"
      @click.stop="run('linkTask')">
      <span class="ico"><AiEntryButton variant="icon" :spin="busy === 'linkTask'" /></span>
      <span class="tx"><b>关联任务</b><small>扫全量任务卡 · 找这条支撑谁</small></span>
    </button>
    <span v-if="card?.aiTouchedAt" class="ds-ai-when">最近 · {{ fmt(card.aiTouchedAt) }}</span>
  </div>
  <AiDrawer v-if="job" :job="job" @close="job = null" />
</template>
