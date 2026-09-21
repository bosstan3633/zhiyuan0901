/**
 * R148-T：报告型产出的落卡通道（autoReport 的实现侧）。
 * 边界：这里**只新增一张卡**，不碰任何既有卡与结构——所以允许自动落；
 * 凡会改既有数据的动作（打标 / 归架 / 拆解 / 转化 / 建标签节点）一律不走本文件。
 */
import type { AppData, ResourceCard } from '@/shared/models'
import { uid } from '@/shared/utils'
import type { AiJob, AiRow } from './job'

export interface ReportCtx { d: AppData; persist: () => void }
export interface ReportPayload { title: string; description: string; tags?: string[] }

export const REPORT_TAG = 'AI 报告·待审阅'

function hubDeck(d: AppData): string {
  const hub = (d.workspaces || []).find(w => w.kind === 'resource') || (d.workspaces || [])[0]
  return hub ? hub.id : ''
}

/** 落一张报告卡到资源台待分类（categoryId 置空 = 待分类），返回给用户的回执 */
export function saveReportCard(ctx: ReportCtx, p: ReportPayload): string {
  const d = ctx.d
  const card: ResourceCard = {
    id: uid('res'), kind: 'resource', title: p.title.slice(0, 60), linkType: 'url', link: '',
    workspaceId: hubDeck(d), categoryId: '', description: p.description.slice(0, 4000),
    tags: [...new Set([...(p.tags || []), REPORT_TAG])].slice(0, 6),
    pinned: false, callCount: 0, createdAt: Date.now(), updatedAt: Date.now(), customFields: {},
  } as ResourceCard
  d.resources.unshift(card)
  ctx.persist()
  return `✓ 报告已存入 资源台 › 待分类「${card.title.slice(0, 18)}」（未改动任何既有卡片）`
}

/**
 * 给 job 挂 autoReport：body(rows) 负责把产出行拼成正文，返回空串=不落卡。
 * 产出行**不受勾选影响**——这是"报告已生成"，不是"采纳"，采纳按钮照旧留在抽屉里。
 */
export function withReport(job: AiJob, ctx: ReportCtx, title: () => string, body: (rows: AiRow[]) => string, tags?: string[]): AiJob {
  job.autoReport = {
    build: (rows) => {
      const text = body(rows)
      return text.trim() ? { title: title(), description: text, tags } : null
    },
    save: (p) => saveReportCard(ctx, p),
  }
  return job
}
