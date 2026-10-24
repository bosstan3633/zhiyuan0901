<script setup lang="ts">
/**
 * R140：资源卡**卡面**动作条的 AI 入口（三视图同一枚徽标）。
 * R167：详情抽屉里的入口改由共享 ResourceAiStrip 承担，本组件只留卡面形态——
 *        原先的 `label` 变体（页脚大按钮样式）随"AI 进标题行"一并退役，不留兼容分支。
 * Workspace 宿主压在 1500 行验收线上——按钮、评审抽屉、AI 懒栈全部收进本组件，
 * 宿主只原位补一个标签。AI 依赖零静态引用：点击时才 dynamic import。
 */
import { ref, shallowRef } from 'vue'
import type { ResourceCard } from '@/shared/models'
import { useAppStore } from '@/newtab/stores/app'
import { showToast } from '@/shared/components/toast'
import AiEntryButton from '@/shared/components/AiEntryButton.vue'

const props = defineProps<{ card: ResourceCard }>()
const store = useAppStore()
import { AiDrawer } from './lazyAiDrawer'
const job = shallowRef<import('@/shared/ai/job').AiJob | null>(null)
const personaId = ref('default')
/** R146-b：点击到抽屉拉起之间不再"点了没反应"——徽标转起来，且重复点击不重复起任务 */
const busy = ref(false)

async function run() {
  if (busy.value) return
  busy.value = true
  try {
    const d = store.data
    if (!d) return
    const [{ loadAiConfig, aiReady, aiConfig }, { buildResourceEnrichJob }] = await Promise.all([import('@/shared/ai/config'), import('@/shared/ai/select')])
    await loadAiConfig()
    if (!aiReady.value) { showToast('请先在 设置 → AI 助手 完成接入（地址/Key/模型）'); return }
    if (personaId.value === 'default' && aiConfig.value.defaultPersona) personaId.value = aiConfig.value.defaultPersona
    job.value = buildResourceEnrichJob(props.card, {
      d, depth: aiConfig.value.depth, persist: () => store.persist(),
      personaId: personaId.value,
      onPersona: (id) => { personaId.value = id; void run(); },
    })
  } finally { busy.value = false }
}
</script>

<template>
  <div class="rc-action ai" v-pressable :aria-disabled="busy" :title="card.link ? ' AI 读链接正文补全这张卡（你已经写过的字段只给建议，勾选采纳才写库）' : ' AI 按卡面信息补全（本卡没有链接）'" @click.stop="run"><AiEntryButton variant="icon" :spin="busy" /></div>
  <AiDrawer v-if="job" :job="job" @close="job = null" />
</template>
