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

// ---------- R135：罗盘链式生成（五契约：目标/项目/指标/任务/拆解） ----------

export type ChainLevel = 'directions' | 'projects' | 'metrics' | 'tasks' | 'breakdown'

export interface ChainSuggestion {
  name?: string; title?: string
  term?: string; endDate?: string; dueDate?: string
  target?: string; acceptance?: string
  priority?: string; estimatedMinutes?: number
  why?: string
}

const CHAIN_DEF: Record<ChainLevel, { role: string; rules: string; schema: string }> = {
  directions: {
    role: '你是目标管理教练，替用户从愿景/使命推导现阶段该立的战略目标。目标要可攻坚、可验收、互相不重叠。',
    rules: 'term 只能是 long/mid/short；name ≤14 字、动词开头或名词短语，禁止口号词（如"赋能""卓越"）。',
    schema: '输出 JSON：{"items":[{"name":"目标名","term":"long|mid|short","why":"为何现在是它"}]}。2~4 条。只输出 JSON。',
  },
  projects: {
    role: '你是项目拆解教练，替某个战略目标补齐攻坚项目——项目是达成目标的路径依赖，不是待办清单。',
    rules: 'name ≤16 字；endDate 用 YYYY-MM-DD（不逾越目标时限，不确定则省略）；与现有项目互补不重复。',
    schema: '输出 JSON：{"items":[{"name":"项目名","endDate":"YYYY-MM-DD(可选)","why":"它如何支撑目标"}]}。2~4 条。只输出 JSON。',
  },
  metrics: {
    role: '你是度量设计教练，为攻坚项目设计「成功指标」——好指标可量化、可验收、能证明项目做成。',
    rules: 'title 含可测对象+量纲（如"实验章节完成 3 版"）；target 写目标值；acceptance 写怎么算达成。',
    schema: '输出 JSON：{"items":[{"title":"指标名","target":"目标值/期限","acceptance":"验收口径","why":"为何测这个"}]}。2~3 条。只输出 JSON。',
  },
  tasks: {
    role: '你是执行教练，把成功指标的缺口拆成近两周可落地的具体任务。任务=一次能做完的动作，不是目标复读。',
    rules: 'title 动词开头 ≤24 字；dueDate=YYYY-MM-DD（从今天推算，只给相对日期时自行换算）；priority 三选一 high/medium/low；estimatedMinutes 为 30~480 的整数。',
    schema: '输出 JSON：{"items":[{"title":"任务名","dueDate":"YYYY-MM-DD(可选)","priority":"high|medium|low","estimatedMinutes":数字(可选),"why":"推进指标的哪一步"}]}。3~6 条。只输出 JSON。',
  },
  breakdown: {
    role: '你是执行教练，把一个任务拆成半天内可完成的步骤序列——拆到「打开电脑就能动手」的粒度。',
    rules: 'steps 按先后顺序排列；title 动词开头 ≤20 字；dueDate 相对原任务截止日/今天推算；estimatedMinutes 每步 30~240。',
    schema: '输出 JSON：{"plan":"两句话行动思路","steps":[{"title":"步骤名","dueDate":"YYYY-MM-DD(可选)","priority":"high|medium|low","estimatedMinutes":数字(可选),"why":"这步解锁什么"}]}。3~6 步。只输出 JSON。',
  },
}

export function chainSystem(level: ChainLevel): string {
  const def = CHAIN_DEF[level]
  return withAboutMe(`${def.role}\n${def.rules}\n${def.schema}`)
}
export function chainSchema(level: ChainLevel): string { return CHAIN_DEF[level].schema }

// ---------- R136：应用推荐（按任务选卡）与搜索重排 ----------

export interface RecommendSuggestion { cardId?: string; why?: string }
export interface RerankHit { id: string; why?: string }

export const recommendSystem = () => withAboutMe(
  '你是用户的资源调度参谋：给定一个任务（含其指标/项目/目标链）与全库资源卡目录，挑出「此刻真的用得上」的卡片。宁缺毋滥，最多 5 张，按贴合度降序；why 必须说清「支撑任务的哪一步」，禁止泛泛夸卡片有用。' +
  '输出 JSON：{"note":"一句话总览(可选)","items":[{"cardId":"必须从给定目录中选","why":"≤30字"}]}。目录里没有的 id 不许编造。只输出 JSON。'
)
export const rerankSystem = () => withAboutMe(
  '你是搜索意图理解器：用户关键词命中了一批卡片，其中不少是字面巧合。按「用户真正想找什么」重排，只保留真正相关的至多 6 条，并各给一句 ≤20 字的入选理由。' +
  '输出 JSON：{"note":"对用户意图的一句话理解(可选，≤24字)","order":[{"id":"必须从给定命中列表中选","why":"..."}]}。宁可少选不硬凑；都不相关则 order 给空数组。只输出 JSON。'
)

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
