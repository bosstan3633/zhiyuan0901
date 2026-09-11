/**
 * B40（第卅二轮）：三卡链接打开统一口径
 *
 * 数据模型为单链接字段（linkType + link），一卡一链：
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

/** 统一打开通道（chrome.tabs.create 优先，网页端降级 window.open）；空 URL 返回 false */
export function openExternalLink(url: string): boolean {
  if (!url) return false
  if (typeof chrome !== 'undefined' && chrome.tabs?.create) chrome.tabs.create({ url })
  else window.open(url, '_blank')
  return true
}
