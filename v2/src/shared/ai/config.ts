/**
 * R134-F1（批次 F · AI 接入）：AI 配置的独立持久层。
 *
 * ★安全边界：配置存 `zy_ai_v1` 独立键——不挂在 AppData（zy_data_v2）内，
 * 因此天然不进「导出/导入/自动备份/合并环/__wid」任何数据链路，密钥不随备份包外发。
 * 本模块由消费方动态 import（设置页 AI 面板 / AI 抽屉），不进新标签页启动链。
 */
import { computed, ref } from 'vue'
import { K } from '@/shared/storage/keys'

export const AI_STORAGE_KEY = K.AI_CONFIG

export type AiDepth = 'eco' | 'std' | 'deep'

export interface AiPersonaCfg { id: string; enabled: boolean; style: string; /** R142（反馈 #6）：内置专家人设/关注面覆盖（空=用内置默认） */ brief?: string; focus?: string }

/** R137：自建专家（角色库 v1）——名称+简介+关注面三元组，与内置专家同格会诊 */
export interface AiCustomPersona { id: string; name: string; brief: string; focus: string; icon?: string }

export interface AiConfig {
  /** OpenAI 兼容 base（如 https://api.deepseek.com/v1）；也可填完整 /chat/completions 地址，会自动归一 */
  baseUrl: string
  apiKey: string
  model: string
  depth: AiDepth
  /** 「关于我」全局偏好——注入所有场景所有专家 */
  aboutMe: string
  /** 专家角色本地覆盖（启停 + 风格补充；内置角色的基础提示词不在此处） */
  personas: AiPersonaCfg[]
  /** R137 自建专家列表 */
  customPersonas: AiCustomPersona[]
  /** R138-H1′：采集保存后自动跑「补全建议」（评审抽屉勾选采纳才写库）。
   *  W4（V3.8.4）起默认开——新卡入库自动预打标（AI 建议，采纳才写库）；见 loadAiConfig 的一次性迁移。 */
  captureEnrich: boolean
  /** R141（反馈 #2）：拆解/生成/优化等场景的默认执笔专家 id（'' / 'default' = 场景内置角色） */
  defaultPersona: string
}

const DEFAULTS: AiConfig = {
  baseUrl: '', apiKey: '', model: '', depth: 'std', aboutMe: '', personas: [], customPersonas: [], captureEnrich: true, defaultPersona: '',
}

const raw = ref<AiConfig>({ ...DEFAULTS })
const loaded = ref(false)
/** W4（V3.8.4）：captureEnrich 一次性迁移已跑过的戳（存独立键，不进 AppData / 不随备份外发） */
const CAPTURE_ENRICH_MIGRATED_KEY = K.AI_CAPTURE_ENRICH_MIGRATED

/**
 * 惰性加载一次（多处并发调用只读一回盘）；不挂 App.vue 启动链。
 *
 * ★只有**真读到配置**才算加载过：读盘失败或键不存在时不置 `loaded`，下次调用还要再读。
 * 原实现无条件置位，于是"谁先读谁定调"——R169-T3 的自动推荐让调度台成为全站第一个碰
 * AI 配置的地方，若那一刻存储里还没有 `zy_ai_v1`（首启、或外部注入配置的时序），
 * 整份配置就被冻结成默认空值，本会话**所有** AI 入口都变成"未接入"（theme-audit 实跑抓到）。
 */
export async function loadAiConfig(): Promise<AiConfig> {
  if (loaded.value) return raw.value
  try {
    const res = await chrome.storage.local.get(AI_STORAGE_KEY)
    const s = res?.[AI_STORAGE_KEY]
    if (s && typeof s === 'object') {
      raw.value = { ...DEFAULTS, ...s }
      loaded.value = true
      await migrateCaptureEnrichDefault()
    }
  } catch { /* 读不到按默认值（本机工具，静默回落），且下次仍会重试 */ }
  return raw.value
}

export const aiConfig = raw

/**
 * W4（V3.8.4）：`captureEnrich` 语义从 opt-in 翻成「默认开」的一次性迁移。
 *
 * 为什么必须迁移而不是简单改 DEFAULTS：存量库里这个键几乎都是 `false`（旧默认），
 * 直接改默认值对他们是空话——老用户永远停在关闭态，新卡入库自动预打标根本不会触发。
 * 而若在读取时粗暴地 `!== false` 强制开回来，则**用户主动关掉的开关每次唤起采集面板都会被翻回开**，
 * 「可一键关掉」的承诺当场作废。
 *
 * 所以只做一次：没跑过迁移戳时，把 `false` 翻成 `true` 并落盘，同时打上迁移戳。
 * 之后（有戳）一律尊重存量值——用户关掉就一直是关的。存量已是 `true` 的（主动开过的）原样保留。
 */
async function migrateCaptureEnrichDefault(): Promise<void> {
  try {
    const stamped = await chrome.storage.local.get(CAPTURE_ENRICH_MIGRATED_KEY)
    if (stamped?.[CAPTURE_ENRICH_MIGRATED_KEY]) return
    if (raw.value.captureEnrich === false) {
      raw.value = { ...raw.value, captureEnrich: true }
      await persistAiConfig()
    }
    await chrome.storage.local.set({ [CAPTURE_ENRICH_MIGRATED_KEY]: true })
  } catch { /* 满盘等异常静默——下次 load 会重试；打不上戳只是这次迁移不生效，不阻断读配置 */ }
}

export function patchAiConfig(p: Partial<AiConfig>) {
  raw.value = { ...raw.value, ...p }
  void persistAiConfig()
}

export async function persistAiConfig() {
  try { await chrome.storage.local.set({ [AI_STORAGE_KEY]: JSON.parse(JSON.stringify(raw.value)) }) } catch { /* 满盘等异常静默 */ }
}

/** 三个必填项齐了才算「已接入」 */
export const aiReady = computed(() => !!(raw.value.baseUrl.trim() && raw.value.apiKey.trim() && raw.value.model.trim()))
