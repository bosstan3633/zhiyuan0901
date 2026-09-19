/**
 * R134-F1：轻量 LLM 客户端（OpenAI 兼容协议——DeepSeek/Kimi/通义/OpenAI 等均可）。
 * MV3 新标签页/设置页 fetch：manifest host_permissions 已含 <all_urls>，零新增权限。
 * 所有调用必须由用户动作触发（无常驻轮询）；支持 SSE 流式（onDelta）与中止。
 */
import { aiConfig } from './config'

export interface ChatMsg { role: 'system' | 'user' | 'assistant'; content: string }

export interface ChatOpts {
  messages: ChatMsg[]
  onDelta?: (accum: string) => void
  signal?: AbortSignal
  jsonMode?: boolean
  temperature?: number
  maxTokens?: number
}

/** base 归一：允许用户粘贴带尾斜杠 / 带 /chat/completions 甚至整个控制台的常见误填 */
function normalizeBase(input: string): string {
  let b = input.trim().replace(/\/+$/, '')
  b = b.replace(/\/chat\/completions$/i, '')
  return b
}

function endpoint(input: string, suffix: string): string {
  const b = normalizeBase(input)
  if (!/^https?:\/\//i.test(b)) throw new Error('API 地址需以 http(s):// 开头')
  return b + suffix
}

function headers(): Record<string, string> {
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${aiConfig.value.apiKey.trim()}` }
}

/** 中文为主的粗估：约 1 token ≈ 1.6 字符（用于用量展示，非计费口径） */
export function estTokens(text: string): number {
  return Math.ceil(text.length / 1.6)
}

async function apiError(res: Response): Promise<never> {
  let detail = ''
  try {
    const t = await res.text()
    try { detail = JSON.parse(t)?.error?.message || t.slice(0, 200) } catch { detail = t.slice(0, 200) }
  } catch { /* ignore */ }
  const hint = res.status === 401 || res.status === 403 ? '（API Key 无效或过期）'
    : res.status === 404 ? '（地址或模型名不存在，请核对 baseUrl 与 model）'
    : res.status === 429 ? '（触发限流，稍后再试）' : ''
  throw new Error(`HTTP ${res.status}${hint}${detail ? ' · ' + detail : ''}`)
}

/** 非流式 chat（评审/打标等短产出够用；抽屉侧统一走 chatStream 拿进度，两者共用解析） */
export async function chat(opts: ChatOpts): Promise<string> {
  const cfg = aiConfig.value
  const res = await fetch(endpoint(cfg.baseUrl, '/chat/completions'), {
    method: 'POST',
    headers: headers(),
    signal: opts.signal,
    body: JSON.stringify({
      model: cfg.model.trim(),
      messages: opts.messages,
      temperature: opts.temperature ?? 0.3,
      max_tokens: opts.maxTokens ?? 2048,
      ...(opts.jsonMode ? { response_format: { type: 'json_object' } } : {}),
    }),
  })
  if (!res.ok) await apiError(res)
  const j = await res.json()
  const content: string = j?.choices?.[0]?.message?.content ?? ''
  opts.onDelta?.(content)
  return content
}

/** SSE 流式 chat：每增量回调累计文本；网关不支持流式时自动回退非流式 */
export async function chatStream(opts: ChatOpts): Promise<string> {
  const cfg = aiConfig.value
  let res: Response
  try {
    res = await fetch(endpoint(cfg.baseUrl, '/chat/completions'), {
      method: 'POST',
      headers: headers(),
      signal: opts.signal,
      body: JSON.stringify({
        model: cfg.model.trim(),
        messages: opts.messages,
        temperature: opts.temperature ?? 0.3,
        max_tokens: opts.maxTokens ?? 4096,
        stream: true,
        ...(opts.jsonMode ? { response_format: { type: 'json_object' } } : {}),
      }),
    })
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw e
    throw new Error('网络请求失败（检查地址可达性/代理）：' + (e as Error).message)
  }
  if (!res.ok || !res.body) {
    if (!res.ok) await apiError(res)
    return chat(opts)
  }
  const reader = res.body.getReader()
  const dec = new TextDecoder()
  let buf = ''
  let accum = ''
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      buf += dec.decode(value, { stream: true })
      let nl: number
      while ((nl = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, nl).trim()
        buf = buf.slice(nl + 1)
        if (!line.startsWith('data:')) continue
        const data = line.slice(5).trim()
        if (data === '[DONE]') continue
        try {
          const delta = JSON.parse(data)?.choices?.[0]?.delta?.content
          if (typeof delta === 'string' && delta) { accum += delta; opts.onDelta?.(accum) }
        } catch { /* 心跳/分包残行忽略 */ }
      }
    }
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw e
    if (!accum) return chat(opts) // 流没吐过字 → 回退非流式
    throw e
  }
  if (!accum) return chat(opts)
  return accum
}

/** 拉模型列表（设置页下拉 + 测试连接复用）；个别网关不支持时抛错由 UI 提示手填 */
export async function listModels(): Promise<string[]> {
  const cfg = aiConfig.value
  const res = await fetch(endpoint(cfg.baseUrl, '/models'), { headers: headers(), signal: AbortSignal.timeout(15000) })
  if (!res.ok) await apiError(res)
  const j = await res.json()
  return (Array.isArray(j?.data) ? j.data : [])
    .map((m: { id?: string }) => String(m?.id || ''))
    .filter(Boolean)
    .sort()
}

/** 测试连接：一次 6 token 最小对话，返回模型回话片段 */
export async function testConnection(): Promise<string> {
  const out = await chat({
    messages: [{ role: 'user', content: '回复 OK 两个字母即可' }],
    maxTokens: 8, temperature: 0,
  })
  return out.trim().slice(0, 40) || '(空响应)'
}

/**
 * 从模型返回文本里提取 JSON（容错三态：裸 JSON / ```json 围栏 / 正文中内嵌对象）。
 * 只做截取与 JSON.parse，失败抛可读错误——不 eval、不修补语义。
 */
export function extractJson<T = unknown>(text: string): T {
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  const candidates = [fence?.[1], text].filter(Boolean) as string[]
  for (const c of candidates) {
    const t = c.trim()
    try { return JSON.parse(t) as T } catch { /* next */ }
    const s = t.search(/[[{]/)
    const e = Math.max(t.lastIndexOf(']'), t.lastIndexOf('}'))
    if (s >= 0 && e > s) { try { return JSON.parse(t.slice(s, e + 1)) as T } catch { /* next */ } }
  }
  throw new Error('未能从模型回复中解析出 JSON（可重试或换「标准/深度」档）')
}
