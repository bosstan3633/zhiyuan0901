import { ref, shallowRef, type Ref } from 'vue'
import { showToast } from '@/shared/components/toast'
import type { AiJob } from '@/shared/ai/job'
import type { InsightRange } from '@/shared/ai/select'
import type { AppData } from '@/shared/models'
import type { PiRange } from '@/newtab/components/profile/PiRangeTabs.vue'

export interface RangeInsightInput {
  activeRange: Ref<PiRange>
  data: Ref<AppData>
  persist: () => void
  localInsight: (range: InsightRange) => { html: string }
  facts: (range: InsightRange) => string[]
}

/** G-04：四段画像洞察的只读 AI 续写入口。
 *  配置与工厂均按点击动态载入；失败只提示，不替换页面上的本地诊断。 */
export function useRangeAiInsight(input: RangeInsightInput) {
  const job = shallowRef<AiJob | null>(null)
  const busy = ref(false)

  async function open(): Promise<void> {
    if (busy.value) return
    busy.value = true
    try {
      const [{ loadAiConfig, aiReady, aiConfig }, select] = await Promise.all([
        import('@/shared/ai/config'),
        import('@/shared/ai/select'),
      ])
      await loadAiConfig()
      if (!aiReady.value) {
        showToast('请先在 设置 → AI 助手 完成地址、Key 与模型配置')
        return
      }
      const range = input.activeRange.value as InsightRange
      job.value = select.buildRangeInsightJob(
        { d: input.data.value, depth: aiConfig.value.depth, persist: input.persist },
        range,
        input.localInsight(range),
        input.facts(range),
      )
    } catch (error) {
      showToast('AI 入口载入失败：' + (error instanceof Error ? error.message : String(error)))
    } finally {
      busy.value = false
    }
  }

  return { job, busy, open }
}
