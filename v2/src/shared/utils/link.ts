/**
 * B40（第卅二轮）：三卡链接打开统一口径
 *
 * 数据模型：**当前槽**仍是单链接字段（linkType + link），一卡一"活动链"；
 *  R169-T2 起另两槽的值挂在可选 `linkSlots`（详见 models 的字段注释）——本文件同时是三槽的
 *  唯一读写口径（LINK_SLOT_TABS / slotLinkOf / switchLinkSlot / setLinkSlot），
 *  打开/筛选/导出等消费点一律只看 linkType + link，不需要知道有几条备选。
 *  - url / obsidian → 原样打开
 *  - file → 盘符路径转 file:///；仅文件名（无完整路径）= 不可打开
 * 打开通道：chrome.tabs.create 优先（扩展页），降级 window.open（网页端浮层）。
 * 本地文件经 file:/// 由浏览器接管：文本/图片/PDF 直接渲染，
 * 未知类型可能触发下载（Chrome 扩展平台限制，无法调用系统默认程序）。
 */
import type { LinkType } from '@/shared/models'

/** 按 linkType 归一化出可打开 URL；不可打开返回 '' */
export function toOpenableUrl(linkType: LinkType, link: string): string {
  const t = (link || '').trim()
  if (!t) return ''
  if (linkType === 'file') {
    if (/^file:\/\//i.test(t)) return t
    if (/^[a-zA-Z]:[\\/]/.test(t)) {
      return 'file:///' + encodeURI(t.replace(/\\/g, '/')).replace(/#/g, '%23')
    }
    return ''
  }
  // R70：拦截可执行伪协议——此前 url 类型「原样返回」，录入或导入的 javascript: / data: 链接点击即执行脚本
  //（同文件 toOpenableRawLink 已有协议白名单，此处是遗漏）。用黑名单而非白名单，是为了不误伤
  // obsidian:// 等合法自定义协议。
  if (/^\s*(javascript|data|vbscript|blob):/i.test(t)) return ''
  return t
}

/** 无 linkType 的裸链接（好奇心 sourceUrl / 任务 link）：协议探测后归一化 */
export function toOpenableRawLink(link?: string): string {
  const t = (link || '').trim()
  if (!t) return ''
  if (/^(https?|obsidian|file):/i.test(t)) return t
  if (/^[a-zA-Z]:[\\/]/.test(t)) {
    return 'file:///' + encodeURI(t.replace(/\\/g, '/')).replace(/#/g, '%23')
  }
  return ''
}

// ===== R87（R5/R7）：链接状态三态判据 =====
/**
 * 是否内部附件引用（R80/R13 起本地文件导入生成的卡）：`zy-asset://<assetId>`。
 * 这类卡 linkType 是 'file'，但**故意不暴露本机路径**——打开走 AssetPreview / openHtmlAsset，
 * 故**不能**被判为「待补全路径」。
 */
export function isZyAssetLink(link?: string): boolean {
  return /^zy-asset:\/\//i.test((link || '').trim())
}

/** 是否为完整路径（盘符 / file:// / unix 根）——自 ResourceEditForm 迁出，全应用唯一实现 */
export function isFullPath(link: string): boolean {
  return /^([a-zA-Z]:[\\/]|file:\/\/|\/)/.test(link.trim())
}

/**
 * R87（R7）：链接三态 —— 一个口径，多个出口（筛选「有链接」/「⚠待补全路径」、卡片徽标、双击 toast）。
 *  - none       空链接
 *  - ok         可打开（含 zy-asset:// 附件引用）
 *  - incomplete 本地文件仅存文件名（双击打不开，需补全完整路径）
 * ⚠ 顺序要紧：zy-asset:// 必须先判，否则会被 file 型的 isFullPath 误判为 incomplete。
 */
export function linkStateOf(linkType: LinkType, link: string): 'none' | 'ok' | 'incomplete' {
  const t = (link || '').trim()
  if (!t) return 'none'
  if (isZyAssetLink(t)) return 'ok'
  if (linkType === 'file' && !isFullPath(t)) return 'incomplete'
  return 'ok'
}

/** 统一打开通道（chrome.tabs.create 优先，网页端降级 window.open）；空 URL 返回 false */
export function openExternalLink(url: string): boolean {
  if (!url) return false
  if (typeof chrome !== 'undefined' && chrome.tabs?.create) chrome.tabs.create({ url })
  else window.open(url, '_blank')
  return true
}

// ===== R169-T2：链接三槽（URL / 本地 / Obsidian 各一条） =====
/** 三槽的固定顺序与文案（**唯一真源**：详情表单与两处采集表单共用，别各写一份 label） */
export const LINK_SLOT_TABS: ReadonlyArray<{ t: LinkType; label: string; ph: string }> = [
  { t: 'url', label: 'URL', ph: 'https://…' },
  { t: 'file', label: '本地', ph: 'D:\\folder\\file.pdf' },
  { t: 'obsidian', label: 'Obsidian', ph: 'obsidian://open?vault=…' }
]

/** 某一槽的输入占位符（三处表单共用：详情抽屉 / 采集浮层 / 采集 popup —— 各写一份就会漂成三种提示） */
export function linkPlaceholderFor(t: LinkType): string {
  return LINK_SLOT_TABS.find(x => x.t === t)?.ph || ''
}

export interface LinkSlotHost {
  linkType: LinkType
  link: string
  linkSlots?: Partial<Record<LinkType, string>>
}

/** 某一槽的值：当前槽读 `link`，其余读 `linkSlots`（没有就是空，不猜、不回落） */
export function slotLinkOf(m: LinkSlotHost, t: LinkType): string {
  return t === m.linkType ? (m.link || '') : (m.linkSlots?.[t] || '')
}

/** 三槽填写状态（表单的三点指示器用） */
export function slotFillOf(m: LinkSlotHost): Record<LinkType, string> {
  return { url: slotLinkOf(m, 'url'), file: slotLinkOf(m, 'file'), obsidian: slotLinkOf(m, 'obsidian') }
}

/**
 * 切槽：当前值先存回它所属的槽，再把目标槽的值取进 `link`。
 * 目标槽为空 ⇒ `link` 置空 —— 这正是本轮要修的旧缺陷：原先切 tab 只改指针不改值，
 * 一条 `https://x` 点一下「本地」还挂在那儿，且立刻被按 file 判据误报"仅存文件名"。
 */
export function switchLinkSlot(m: LinkSlotHost, next: LinkType): void {
  const cur = m.linkType
  if (cur === next) return
  const v = (m.link || '').trim()
  if (!m.linkSlots) m.linkSlots = {}
  if (v) m.linkSlots[cur] = m.link
  else delete m.linkSlots[cur]
  m.linkType = next
  m.link = m.linkSlots[next] || ''
}

/**
 * 直接落到某一槽（挂载附件、批量改写等"不是用户手输"的路径）。
 * 与 switchLinkSlot 同一纪律：**换槽前必须先把当前值存回原槽**，否则切过去就把它冲掉了
 * —— ResourceEditForm 的 PDF/HTML 挂载原先正是直接连写 linkType + link，丢过这条链。
 */
export function setLinkSlot(m: LinkSlotHost, t: LinkType, value: string): void {
  if (t === m.linkType) { m.link = value; return }
  const cur = m.linkType
  const v = (m.link || '').trim()
  if (!m.linkSlots) m.linkSlots = {}
  if (v) m.linkSlots[cur] = m.link
  m.linkType = t
  m.link = value
}
