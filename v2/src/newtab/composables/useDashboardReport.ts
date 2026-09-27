/**
 * R172-T11（04-67 F31/F32）：AI 复盘文本报告的四个出口，从 `GlobalSettings.vue` 抽出来。
 *
 * 为什么单独成文：报告弹框挂在仪表盘复盘段里，出口要写库（落卡）、要跳转、要预填快速采集——
 * 内联进设置页会把宿主顶破 R164-2 增长门禁（R171 体检卡同法：抽独立单元，宿主只留一行挂载）。
 *
 * 三条不变量在这里落地：
 *  ① **写库只在显式点击**：`save` 由用户点「存为资源卡」触发，`task` 只预填不入库（保存键在用户手里）；
 *  ② **启动零 AI**：本文件对 `@/shared/ai/*` 只有 `import type`，运行时一律 dynamic import；
 *  ③ **可撤**：落卡走 `saveReportCard`，其内部登记全局撤销栈（软删，不越"删除一律软删"红线）。
 */
import type { AppData } from '@/shared/models'
import type { ReviewReport, ReviewSug } from '@/shared/ai/review'
import type { Router } from 'vue-router'
import { emitOpenPanel } from '@/shared/utils/bus'
import { downloadText, stampDay } from '@/shared/utils/download'
import { showToast } from '@/shared/components/toast'

export interface ReportDeps {
  gd: { value: AppData }
  persist: () => void
  router: Router
}

/** 建议 → 该去哪儿处理（只有这四类有明确居所，其余回调度台，不硬凑跳转） */
const RULE_GOTO: Record<string, [string, string]> = {
  R2: ['/compass', '方向台'], R5: ['/compass', '方向台'], R6: ['/workspace/zy-curation', '资源台'], skew: ['/compass', '方向台']
}

export function useDashboardReport(deps: ReportDeps) {
  async function onReportSave(rep: ReviewReport): Promise<void> {
    const [{ saveReportCard }, { reportToMarkdown }] = await Promise.all([
      import('@/shared/ai/reports'), import('@/shared/ai/review')
    ])
    showToast(saveReportCard({ d: deps.gd.value, persist: deps.persist }, {
      title: `📈 复盘报告 ${rep.win.label}`, description: reportToMarkdown(rep), tags: ['复盘报告']
    }))
  }

  function onReportExport(rep: ReviewReport): void {
    void import('@/shared/ai/review').then(({ reportToMarkdown }) => {
      downloadText(`zhiyuan_复盘报告_${rep.win.label}_${stampDay()}.md`, reportToMarkdown(rep), 'md')
      showToast('✓ 已导出复盘报告（Markdown）')
    })
  }

  function onReportTask(s: ReviewSug): void {
    emitOpenPanel({ name: 'taskcapture', prefill: { title: s.title.slice(0, 40), description: s.detail } })
  }

  function onReportGoto(s: ReviewSug): void {
    const [to, label] = RULE_GOTO[s.id] || ['/', '调度台']
    deps.router.push(to)
    showToast(`已跳到${label} · 处理「${s.title.slice(0, 14)}」`)
  }

  return { onReportSave, onReportExport, onReportTask, onReportGoto }
}
