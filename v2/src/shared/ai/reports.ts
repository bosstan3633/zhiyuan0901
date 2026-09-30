/**
 * R148-T：报告型产出的落卡通道（autoReport 的实现侧）。
 * 边界：这里**只写报告卡自己那一行**（新建，或刷新同日同名的上一份），不碰任何别的卡与结构——
 * 所以允许自动落；凡会改既有数据的动作（打标 / 归架 / 拆解 / 转化 / 建标签节点）一律不走本文件。
 */
import type { AppData, ResourceCard } from '@/shared/models'
import { CURATION_WS_ID } from '@/shared/models'
import { uid } from '@/shared/utils'
import { pushUndo } from '@/shared/utils/undo'
import type { AiJob, AiRow } from './job'

export interface ReportCtx { d: AppData; persist: () => void }
export interface ReportPayload { title: string; description: string; tags?: string[] }

export const REPORT_TAG = 'AI 报告·待审阅'

/** 落一张报告卡到资源卡池 › 待分类（categoryId 置空 = 待分类），返回给用户的回执。
 *  落点写死池 id 而不是去找 `kind==='resource'` 的 workspace 实体：那枚实体只在存量库里存在
 *  （R61 建、store getter 已过滤），`defaults.ts` 新建库没有它 ⇒ 找实体的写法会把报告卡丢进第一张策展台。 */
export function saveReportCard(ctx: ReportCtx, p: ReportPayload): string {
  const d = ctx.d
  const title = p.title.slice(0, 60)
  const tags = [...new Set([...(p.tags || []), REPORT_TAG])].slice(0, 6)
  // R149（用户拍板"保持一张卡"）：同一天的同一类报告只有一张——重跑是刷新那张，不是再攒一张
  const dup = (d.resources || []).find(r => !r.deletedAt && r.title === title && (r.tags || []).includes(REPORT_TAG))
  if (dup) {
    // R174-6（04-69）：刷新分支同样进撤销栈——04-68 §5 挂账「文案承诺可撤销而此分支不进」收口。
    // 撤销语义 = 恢复刷新前的正文/标签/更新时间（不是软删：卡还在，被改掉的是内容）。
    const prevDesc = dup.description
    const prevTags = dup.tags
    const prevAt = dup.updatedAt
    dup.description = p.description.slice(0, 4000)
    dup.tags = [...new Set([...(dup.tags || []), ...tags])].slice(0, 6)
    dup.updatedAt = Date.now()
    ctx.persist()
    pushUndo(`撤销报告卡刷新「${dup.title.slice(0, 12)}」`, () => {
      const i = d.resources.findIndex(x => x.id === dup.id)
      if (i < 0) return
      d.resources[i] = { ...dup, description: prevDesc, tags: prevTags, updatedAt: prevAt }
      ctx.persist()
    })
    return `✓ 报告已刷新 资源卡池 › 待分类「${dup.title.slice(0, 18)}」（同日重跑不另起新卡 · Ctrl/Cmd+Z 可撤销）`
  }
  const card: ResourceCard = {
    id: uid('res'), kind: 'resource', title, linkType: 'url', link: '',
    workspaceId: CURATION_WS_ID, categoryId: '', description: p.description.slice(0, 4000),
    tags,
    pinned: false, callCount: 0, createdAt: Date.now(), updatedAt: Date.now(), customFields: {},
  } as ResourceCard
  d.resources.unshift(card)
  ctx.persist()
  /** R172-T11（04-67 F32）：报告卡也要能撤 —— 撤销=软删进回收站（不越「删除一律软删」红线），
   *  登记在全局撤销栈里，Ctrl/Cmd+Z 与 9 秒窗口都认（R159 同一套机制）。 */
  pushUndo(`撤销报告卡「${card.title.slice(0, 12)}」`, () => {
    const i = d.resources.findIndex(x => x.id === card.id)
    if (i < 0) return
    d.resources[i] = { ...card, deletedAt: Date.now() }
    ctx.persist()
  })
  return `✓ 报告已存入 资源卡池 › 待分类「${card.title.slice(0, 18)}」（未改动任何既有卡片 · Ctrl/Cmd+Z 可撤销）`
}

/**
 * 给 job 挂 autoReport：body(rows) 负责把产出行拼成正文，返回空串=不落卡。
 * 产出行**不受勾选影响**——落卡的是"报告本身"，不是"用户采纳了哪几条"。
 * 挂了 autoReport 且**没有 apply** 的 job = 纯报告型（周回顾/深度洞察/成果文稿）：
 * 抽屉不出采纳按钮（R149 用户拍板）；若还带 apply（深度诊断：勾发现→生成跟进任务），按钮照旧。
 */
export function withReport(job: AiJob, ctx: ReportCtx, title: () => string, body: (rows: AiRow[]) => string, tags?: string[]): AiJob {
  job.autoReport = {
    build: (rows) => {
      const text = body(rows)
      return text.trim() ? { title: title(), description: text, tags } : null
    },
    save: (p) => saveReportCard(ctx, p),
  }
  /**
   * R154（用户拍板③）：报告型右栏正文改成可编辑后，"编辑要有地方去"——
   * 给一条**再存一次**的通道，仍走 `saveReportCard` 的同名复用分支（同日同类只一张，
   * 不会因为多点一次「存为卡」就多出一张卡）。跑完自动落卡那条行为不变。
   */
  job.resave = (rows) => {
    const p = job.autoReport ? job.autoReport.build(rows) : null
    if (!p) return '⚠ 正文是空的，没东西可存'
    return job.autoReport ? job.autoReport.save(p) : '⚠ 落卡通道未就绪'
  }
  return job
}
