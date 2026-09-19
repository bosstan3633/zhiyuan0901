/**
 * R134-F1：AI 场景任务书（内置提示词 + 输出契约 + 专家角色库）。
 * 提示词是工程资产：输出必须是 JSON（jsonMode），解析走 llm.extractJson，绝不让模型自由散文。
 * 「关于我」偏好经 withAboutMe 注入所有场景——用户只维护这一层画像。
 */
import { aiConfig } from './config'
import type { AppData } from '@/shared/models'

export function withAboutMe(system: string): string {
  const me = (aiConfig.value.aboutMe || '').trim()
  return me ? `${system}\n\n【用户画像（长期偏好，建议须贴合）】\n${me}` : system
}

// ---------- 输出契约 ----------

/** 打标/补全（单卡与批量共用行契约） */
export interface EnrichSuggestion {
  cardId?: string
  tags?: string[]
  description?: string
  categoryId?: string
  reason?: string
}
/** 沉睡唤醒判定 */
export interface DormantVerdict {
  cardId: string
  verdict: 'revive' | 'archive' | 'keep'
  reason?: string
  actionHint?: string
}
/** 深度诊断发现 */
export interface DiagnosisFinding {
  severity: 'high' | 'mid' | 'low'
  title: string
  detail?: string
  suggestion?: string
}

const ENRICH_SCHEMA = `输出 JSON：{"tags":["至多5个，优先复用给定标签词表中的写法，确无近义才可新增"],"description":"2~3句：这是什么/适合什么场景用/注意点","categoryId":"只能从给定分类清单中选，不确定则留空字符串"}。只输出 JSON。`
const BATCH_SCHEMA = `输出 JSON：{"items":[{"cardId":"原样回填","tags":[...],"description":"...","reason":"一句话：为何这么补"}]}。信息不足以判断的字段给空数组/空串，不要编造。只输出 JSON。`
const DORMANT_SCHEMA = `输出 JSON：{"items":[{"cardId":"原样回填","verdict":"revive|archive|keep","reason":"对照进行中任务与战略目标解释相关性","actionHint":"revive 时给具体用法（如：挂到某任务/置顶并说明何时用）"}]}。revive=仍有用建议唤醒，archive=建议归档，keep=保留观察。宁可 keep 不可瞎判。只输出 JSON。`
const DIAGNOSIS_SCHEMA = `输出 JSON：{"findings":[{"severity":"high|mid|low","title":"≤20字断语","detail":"证据：引用材料中具体条目/数字","suggestion":"下一步动作（可执行、具体到对象）"}]}。3~8条，按严重度降序；只说有证据的话，每条必须能在材料里找到出处。只输出 JSON。`

// ---------- 场景任务书 ----------

export const enrichSystem = (hasCats: boolean) => withAboutMe(
  `你是中文互联网资源的知识管理助手，为用户的个人资源调度台补全卡片元数据。${hasCats ? '候选分类会在材料中给出；' : ''}打标克制：贴切宁缺毋滥。${ENRICH_SCHEMA}`
)
export const batchEnrichSystem = () => withAboutMe(
  '你是资源调度台的批量元数据助手，对用户选中的多张卡片逐张补标签与一句话描述。' + BATCH_SCHEMA
)
export const dormantSystem = () => withAboutMe(
  '你是用户的资源管家，负责"沉睡资源唤醒"：对照用户当前目标与进行中的任务，判断每张沉睡卡是被遗忘的利器还是该退场的旧物。' + DORMANT_SCHEMA
)
export function diagnosisSystem(persona: AiPersona, style: string): string {
  return withAboutMe(`你是「${persona.name}」，${persona.brief}。以该专家视角审视用户个人调度台的整库摘要，做结构性体检。\n${persona.focus}${style ? `\n【用户定制风格】${style}` : ''}\n${DIAGNOSIS_SCHEMA}`)
}

// ---------- 专家角色库（内置两员；启停与风格覆盖在 aiConfig.personas） ----------

export interface AiPersona { id: string; name: string; icon: string; brief: string; focus: string }

export const BUILTIN_PERSONAS: AiPersona[] = [
  {
    id: 'goal-expert', name: '目标管理专家', icon: '🎯',
    brief: '精于 OKR/战略落地的老练教练，见过太多"目标写得好但链条断裂"的团队。',
    focus: '关注：愿景↔目标↔项目↔指标↔任务五层是否环环支撑；有无无指标支撑的项目、长期零进度/无截止日的主攻、期限已到未收口的目标、任务与目标脱节的孤儿工作；term 分期与时间窗是否匹配。',
  },
  {
    id: 'knowledge-expert', name: '知识管理专家', icon: '📚',
    brief: '个人知识库策展人，信条是"库的价值=被再次用上的概率"。',
    focus: '关注：分类与标签体系的失衡（超大杂类/近义标签/单卡分类）；沉睡资产与活跃目标的错位；回收站堆积不清；台与台职责重叠；资源卡缺描述导致的可发现性差。',
  },
]

export function personaOverrides(): Record<string, { enabled: boolean; style: string }> {
  const out: Record<string, { enabled: boolean; style: string }> = {}
  for (const p of aiConfig.value.personas || []) out[p.id] = { enabled: p.enabled, style: p.style || '' }
  return out
}

/** 校验模型回填的 cardId/categoryId 真实存在（防幻觉引用），返回安全化后的对象 */
export function sanitizeRefs<T extends { cardId?: string; categoryId?: string }>(item: T, d: AppData): T {
  const next = { ...item }
  if (next.cardId && !d.resources.some(r => r.id === next.cardId && !r.deletedAt)) delete next.cardId
  if (next.categoryId && !d.categories.some(c => c.id === next.categoryId && !c.deletedAt)) delete next.categoryId
  return next
}
