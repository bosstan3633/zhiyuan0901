/**
 * R134-F1（批次 F · AI 接入）：AI 配置的独立持久层。
 *
 * ★安全边界：配置存 `zy_ai_v1` 独立键——不挂在 AppData（zy_data_v2）内，
 * 因此天然不进「导出/导入/自动备份/合并环/__wid」任何数据链路，密钥不随备份包外发。
 * 本模块由消费方动态 import（设置页 AI 面板 / AI 抽屉），不进新标签页启动链。
 */
import { computed, ref } from 'vue'

export const AI_STORAGE_KEY = 'zy_ai_v1'

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
  /** R138-H1′：采集保存后自动跑「补全建议」（评审抽屉勾选采纳才写库；默认关） */
  captureEnrich: boolean
  /** R141（反馈 #2）：拆解/生成/优化等场景的默认执笔专家 id（'' / 'default' = 场景内置角色） */
  defaultPersona: string
}

const DEFAULTS: AiConfig = {
  baseUrl: '', apiKey: '', model: '', depth: 'std', aboutMe: '', personas: [], customPersonas: [], captureEnrich: false, defaultPersona: '',
}

const raw = ref<AiConfig>({ ...DEFAULTS })
const loaded = ref(false)

/** 惰性加载一次（多处并发调用只读一回盘）；不挂 App.vue 启动链 */
export async function loadAiConfig(): Promise<AiConfig> {
  if (loaded.value) return raw.value
  try {
    const res = await chrome.storage.local.get(AI_STORAGE_KEY)
    const s = res?.[AI_STORAGE_KEY]
    if (s && typeof s === 'object') raw.value = { ...DEFAULTS, ...s }
  } catch { /* 读不到按默认值（本机工具，静默回落） */ }
  loaded.value = true
  return raw.value
}

export const aiConfig = raw

export function patchAiConfig(p: Partial<AiConfig>) {
  raw.value = { ...raw.value, ...p }
  void persistAiConfig()
}

export async function persistAiConfig() {
  try { await chrome.storage.local.set({ [AI_STORAGE_KEY]: JSON.parse(JSON.stringify(raw.value)) }) } catch { /* 满盘等异常静默 */ }
}

/** 三个必填项齐了才算「已接入」 */
export const aiReady = computed(() => !!(raw.value.baseUrl.trim() && raw.value.apiKey.trim() && raw.value.model.trim()))
