<script setup lang="ts">
/**
 * R140：资源卡动作条的「✦ 全方位优化」入口（读链接网页正文）。R151：label 非空时改按详情抽屉页脚按钮的样式呈现（同一入口、两种容器）。
 * Workspace 宿主压在 1500 行验收线上——按钮、评审抽屉、AI 懒栈全部收进本组件，
 * 宿主只原位补一个标签。AI 依赖零静态引用：点击时才 dynamic import。
 */
import { ref, shallowRef } from 'vue'
import type { ResourceCard } from '@/shared/models'
import { useAppStore } from '@/newtab/stores/app'
import { showToast } from '@/shared/components/toast'
import ZhiMark from '@/shared/components/ZhiMark.vue'

const props = withDefaults(defineProps<{ card: ResourceCard; label?: string }>(), { label: '' })
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
    const [{ loadAiConfig, aiReady, aiConfig }, { buildFullOptimizeJob }] = await Promise.all([import('@/shared/ai/config'), import('@/shared/ai/select')])
    await loadAiConfig()
    if (!aiReady.value) { showToast('请先在 设置 → AI 助手 完成接入（地址/Key/模型）'); return }
    if (personaId.value === 'default' && aiConfig.value.defaultPersona) personaId.value = aiConfig.value.defaultPersona
    job.value = buildFullOptimizeJob(props.card, {
      d, depth: aiConfig.value.depth, persist: () => store.persist(),
      personaId: personaId.value,
      onPersona: (id) => { personaId.value = id; void run(); },
    })
  } finally { busy.value = false }
}
</script>

<template>
  <div :class="label ? 'dr-footer-btn ai' : 'rc-action ai'" :title="card.link ? 'AI 读取链接网页正文后优化标题/描述/标签（审阅勾选才写库）' : 'AI 按卡面信息优化（本卡没有链接）'" @click.stop="run"><ZhiMark :size="label ? 13 : 14" :spin="busy" />{{ label }}</div>
  <AiDrawer v-if="job" :job="job" @close="job = null" />
</template>
