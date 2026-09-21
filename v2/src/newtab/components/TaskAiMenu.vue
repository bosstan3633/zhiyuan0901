<script setup lang="ts">
/**
 * R147-d：任务级 AI 辅助菜单（拆解成子任务 / 推荐资源卡 / 打开详情）。
 * R146 先落在项目详情页，本轮抽成组件铺到任务面板与看板——同一套动作，不在两个视图各写一遍。
 * 自包含纪律（承 R144）：按钮、浮层菜单、评审抽屉、样式都在本组件内，
 * 宿主 workspace.css 是 scoped，fragment 根不继承父 scope；AI 依赖零静态引用，点击时才 dynamic import。
 */
import { ref, shallowRef } from 'vue'
import type { TaskCard } from '@/shared/models'
import { useAppStore } from '@/newtab/stores/app'
import { showToast } from '@/shared/components/toast'
import ZhiMark from '@/shared/components/ZhiMark.vue'

const props = defineProps<{ task: TaskCard; tip?: string }>()
/** 打开详情走宿主通道（各视图的抽屉实现不同） */
const emit = defineEmits<{ (e: 'detail', task: TaskCard): void }>()
const store = useAppStore()
import { AiDrawer } from './lazyAiDrawer'
const job = shallowRef<import('@/shared/ai/job').AiJob | null>(null)
const shown = ref(false)
const busy = ref(false)
const pos = ref({ x: 0, y: 0 })
const personaId = ref('default')

function toggle(e: MouseEvent) {
  e.stopPropagation()
  if (shown.value) { shown.value = false; return }
  const r = (e.currentTarget as HTMLElement).getBoundingClientRect()
  pos.value = { x: Math.max(8, Math.min(r.left, window.innerWidth - 200)), y: Math.min(r.bottom + 4, window.innerHeight - 140) }
  shown.value = true
}

async function breakdown() {
  const d = store.data
  if (!d) return
  const [{ loadAiConfig, aiReady, aiConfig }, { buildChainJob }] = await Promise.all([import('@/shared/ai/config'), import('@/shared/ai/chain')])
  await loadAiConfig()
  if (!aiReady.value) { showToast('请先在 设置 → AI 助手 完成接入（地址/Key/模型）'); return }
  if (personaId.value === 'default' && aiConfig.value.defaultPersona) personaId.value = aiConfig.value.defaultPersona
  const j = buildChainJob('breakdown', props.task.id, {
    d, depth: aiConfig.value.depth, persist: () => store.persist(),
    personaId: personaId.value, onPersona: (id) => { personaId.value = id; void breakdown() },
  })
  if (!j) { showToast('⚠ 任务已不存在（可能刚被删除）'); return }
  job.value = j
}

async function recommend() {
  const d = store.data
  if (!d) return
  const t = d.tasks.find(x => x.id === props.task.id && !x.deletedAt)
  if (!t) { showToast('⚠ 任务已不存在'); return }
  const [{ loadAiConfig, aiReady, aiConfig }, sel] = await Promise.all([import('@/shared/ai/config'), import('@/shared/ai/select')])
  await loadAiConfig()
  if (!aiReady.value) { showToast('请先在 设置 → AI 助手 完成接入（地址/Key/模型）'); return }
  const j = sel.buildRecommendJob(t, { d, depth: aiConfig.value.depth, persist: () => store.persist() })
  if (!j) { showToast('⚠ 库里还没有可推荐的资源卡'); return }
  job.value = j
}

async function pick(kind: 'breakdown' | 'recommend' | 'detail') {
  shown.value = false
  if (kind === 'detail') { emit('detail', props.task); return }
  if (busy.value) return
  busy.value = true
  try { await (kind === 'recommend' ? recommend() : breakdown()) } finally { busy.value = false }
}
</script>

<template>
  <button class="tam-btn" :class="{ on: shown }" :title="tip || '本任务的 AI 辅助：拆解成子任务 / 推荐资源卡 / 打开详情（勾选采纳才写库，可换执笔专家）'" @click.stop="toggle"><ZhiMark :size="13" :spin="busy" /></button>
  <Teleport to="body">
    <div v-if="shown" class="tam-mask" @click="shown = false" />
    <div v-if="shown" class="tam-menu" :style="{ left: pos.x + 'px', top: pos.y + 'px' }" @click.stop>
      <button class="tam-item" @click="pick('breakdown')"><ZhiMark :size="13" /> 拆解成子任务</button>
      <button class="tam-item" @click="pick('recommend')"><ZhiMark :size="13" /> 推荐资源卡</button>
      <button class="tam-item" @click="pick('detail')">📋 打开任务详情</button>
    </div>
  </Teleport>
  <AiDrawer v-if="job" :job="job" @close="job = null" />
</template>

<style scoped>
.tam-btn { display: inline-flex; align-items: center; justify-content: center; min-width: 26px; min-height: 26px; border: none; background: transparent; color: var(--accent); opacity: .72; cursor: pointer; padding: 2px; border-radius: 6px; flex-shrink: 0; }
.tam-btn:hover { opacity: 1; background: var(--accent-light); }
.tam-btn.on { opacity: 1; background: var(--accent-light); }
.tam-mask { position: fixed; inset: 0; z-index: 690; background: transparent; }
.tam-menu { position: fixed; z-index: 691; min-width: 176px; background: var(--surface); border: 1px solid var(--border); border-radius: 10px; box-shadow: var(--shadow-lg); padding: 5px; display: flex; flex-direction: column; gap: 2px; }
.tam-item { display: flex; align-items: center; gap: 8px; padding: 8px 11px; border: none; border-radius: 7px; background: transparent; color: var(--text-2); font-size: 12px; font-family: inherit; text-align: left; cursor: pointer; }
.tam-item:hover { background: var(--surface-3); color: var(--text); }
</style>
