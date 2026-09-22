/**
 * R154：一次性指令（用户为「这个入口 / 这张卡」写的具体要求）。
 *
 * 与角色库的分工（两件事，别混）：
 *  - **角色** = 谁来写：可复用身份，跨模块在下拉里选（`config.ts` 的 `customPersonas`）。
 *  - **指令** = 这次要什么：只影响当前作用域，优先级高于角色。
 *
 * 优先级固定：`场景骨架 + JSON schema`（**不可覆盖**——破了整轮 `parse` 直接失败）
 * → 角色人设 → 用户指令。所以指令能改口径、改取舍，改不了输出结构。
 *
 * ★安全边界：存独立键 `zy_ai_directives_v1`，与密钥同侧、**不进 AppData**，
 * 因此不进导出/导入/自动备份/合并环任何数据链路。指令里常有个人处境，不该跟着备份包外发。
 *
 * ★零宿主改造：抽屉在 `run()` / `openJob()` 前调一次 `withDirective(job)` 即可——
 * `runner.execute()` 每轮重新调 `job.build()`（见 R154-6 断言），所以改完指令点重跑天然读到新值。
 * 自带 `run` 的工厂（多批归架 / 多专家会诊）不走 `build`，需要时自己调 `activeDirective(job)`。
 */
import { ref } from 'vue'
import type { AiJob } from './job'
import type { ChatMsg } from './llm'
import { aiConfig, loadAiConfig, patchAiConfig } from './config'

export const AI_DIRECTIVES_KEY = 'zy_ai_directives_v1'
/** 上限与提示：超了截断，别默默吃掉用户写的字 */
export const DIRECTIVE_CAP = 2000
/** 每个作用域留最近 5 条旧指令——"改了再测"必须能横向比、能一键切回 */
export const HISTORY_CAP = 5
export const PRIORITY_LINE = '【用户附加指令 · 优先级最高】与上文人设冲突时以此为准；但输出结构与字段不得增删，违反即视为无效。'

/** 'object' = 只作用于这个对象（这张卡/这个台）；'entry' = 作用于整个入口 */
export type DirTier = 'object' | 'entry'

export interface DirRun { at: number; secs: number; outChars: number; rows: number; adopted: boolean }
export interface DirSlot { text: string; at: number; runs: DirRun[]; past: DirSlot[] }
export interface DirScope { tier: DirTier; entry: DirSlot | null; objects: Record<string, DirSlot> }

const store = ref<Record<string, DirScope>>({})
let loaded = false
let timer: ReturnType<typeof setTimeout> | null = null

export async function loadDirectives(): Promise<void> {
  if (loaded) return
  try {
    const res = await chrome.storage.local.get(AI_DIRECTIVES_KEY)
    const s = res?.[AI_DIRECTIVES_KEY]
    if (s && typeof s === 'object') store.value = s as Record<string, DirScope>
  } catch { /* 读不到按空表（本机工具，静默回落） */ }
  loaded = true
}

function persist(): void {
  if (timer) clearTimeout(timer)
  timer = setTimeout(() => {
    void chrome.storage.local.set({ [AI_DIRECTIVES_KEY]: JSON.parse(JSON.stringify(store.value)) }).catch(() => {})
  }, 300)
}

function scopeOf(scope: string): DirScope {
  if (!store.value[scope]) store.value[scope] = { tier: 'object', entry: null, objects: {} }
  return store.value[scope]
}

/** 默认落「这张卡」；升档到「这类入口」只能由用户点（拍板④） */
export function tierOf(scope: string): DirTier { return store.value[scope]?.tier ?? 'object' }
export function setTier(scope: string, tier: DirTier): void {
  scopeOf(scope).tier = tier; persist()
}

function slotOf(scope: string, objId?: string): DirSlot | null {
  const s = scopeOf(scope)
  return objId ? (s.objects[objId] || null) : s.entry
}

/** 当前生效文本：无对象 id 的入口（标签梳理/诊断/周报）直接用入口级 */
export function activeDirective(job: AiJob): string {
  if (!job.promptScope) return ''
  const s = scopeOf(job.promptScope)
  const obj = job.promptObject && s.tier === 'object' ? job.promptObject : undefined
  return slotOf(job.promptScope, obj)?.text || ''
}

export function directiveSlot(job: AiJob): DirSlot | null { return slotOfJob(job) }

/** 写入即留痕：与旧文本不同才入历史，避免"改个空格"多出一条历史 */
export function setDirective(scope: string, text: string, objId?: string): void {
  const s = scopeOf(scope)
  const t = text.trim().slice(0, DIRECTIVE_CAP)
  const cur = objId ? s.objects[objId] : s.entry
  if (cur && cur.text === t) return
  const next: DirSlot = { text: t, at: Date.now(), runs: cur ? cur.runs.slice(0, HISTORY_CAP) : [], past: cur ? [cur, ...cur.past].slice(0, HISTORY_CAP) : [] }
  if (objId) s.objects[objId] = next; else s.entry = next
  persist()
}

/** 清空当前作用域的指令（历史仍留着，可切回） */
export function clearDirective(scope: string, objId?: string): void {
  const s = scopeOf(scope)
  if (objId) delete s.objects[objId]; else s.entry = null
  persist()
}

/** 本轮跑完记账，历史里才看得到"这条指令值不值" */
export function noteRun(job: AiJob, run: DirRun): void {
  const slot = slotOfJob(job)
  if (!slot) return
  slot.runs = [run, ...slot.runs].slice(0, HISTORY_CAP)
  persist()
}

/** 采纳时回填：历史里"这条指令产出的东西你最后用没用"才是有效信息 */
export function markRunAdopted(job: AiJob): void {
  const slot = slotOfJob(job)
  if (!slot || !slot.runs.length) return
  slot.runs = slot.runs.map((r, i) => (i === 0 ? { ...r, adopted: true } : r))
  persist()
}

function slotOfJob(job: AiJob): DirSlot | null {
  if (!job.promptScope) return null
  const s = scopeOf(job.promptScope)
  return slotOf(job.promptScope, job.promptObject && s.tier === 'object' ? job.promptObject : undefined)
}

/**
 * 把指令追加到 system 尾部（所有场景的系统提示词都从 `scenarios.ts withAboutMe()` 出，
 * 这里只加一段，不改任何一处提示词工厂）。
 */
export function applyDirective(messages: ChatMsg[], text: string): ChatMsg[] {
  const t = (text || '').trim().slice(0, DIRECTIVE_CAP)
  if (!t) return messages
  const block = `\n\n${PRIORITY_LINE}\n${t}`
  const i = messages.findIndex(m => m.role === 'system')
  if (i < 0) return [{ role: 'system', content: PRIORITY_LINE + '\n' + t }, ...messages]
  const out = messages.slice()
  out[i] = { ...out[i], content: out[i].content + block }
  return out
}

const wrapped = new WeakSet<AiJob>()
/** 单点包装：幂等（抽屉与宿主各调一次也只包一层） */
export function withDirective<T extends AiJob>(job: T): T {
  if (!job.promptScope || wrapped.has(job) || (!job.build && !job.run)) return job
  wrapped.add(job)
  if (job.build) {
    const orig = job.build.bind(job)
    job.build = () => Promise.resolve(orig()).then(r => ({ ...r, messages: applyDirective(r.messages, activeDirective(job)) }))
  }
  return job
}

/**
 * 存为角色（拍板⑤）：把调好的口径升级成可复用身份，进 `customPersonas`，
 * 之后任何入口的角色下拉都能选到它。形状与设置页「＋ 自建专家」保持一致。
 */
export async function promoteToPersona(text: string, name: string): Promise<string> {
  const t = (text || '').trim()
  if (!t) throw new Error('指令是空的，没什么可存')
  await loadAiConfig()
  const id = 'custom-' + Date.now()
  const list = [...(aiConfig.value.customPersonas || []), {
    id,
    name: (name || '').trim() || t.slice(0, 12),
    brief: '由一次性指令沉淀（R154）',
    focus: t,
  }]
  patchAiConfig({ customPersonas: list })
  return id
}
