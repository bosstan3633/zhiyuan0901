/**
 * R80（R13）：附件类型判定共享工具
 *
 * 原 `guessKind` 是 `AssetManager.vue` 的局部函数。R13 的本地文件导入需要同一套判定，
 * 若在导入侧重写一份，两处口径必然漂移（一个认 `.jpeg` 一个不认）。故抽到此处，
 * 由 AssetManager 与 Workspace 导入侧共用——**判定只有一份**。
 */
import type { AssetMeta } from '@/shared/models'

export type AssetKind = AssetMeta['kind']

/** 单文件体积上限（MB）——与 AssetManager 既有口径一致：图片 10 / PDF 100 / HTML 20 */
export const ASSET_KIND_MB: Record<AssetKind, number> = {
  image: 10,
  html: 20,
  pdf: 100
}

/**
 * 判定附件类型：先看 mime，再用扩展名兜底（拖拽/某些系统下 file.type 可能为空）。
 * 返回 null = 不支持的类型（导入侧跳过，不建哑卡）。
 */
export function guessAssetKind(name: string, mime: string): AssetKind | null {
  if (/^image\//i.test(mime)) return 'image'
  if (/\.(png|jpe?g|gif|webp|svg|bmp|avif|ico)$/i.test(name)) return 'image'
  if (/\.html?$/i.test(name) || /\.htm$/i.test(name)) return 'html'
  if (/\.pdf$/i.test(name) || /^application\/pdf$/i.test(mime)) return 'pdf'
  return null
}

/** mime 兜底：file.type 缺失时按判定结果给一个合理值（与 AssetManager 原逻辑逐字一致） */
export function assetMimeOf(kind: AssetKind, fallback: string): string {
  return fallback || (kind === 'image' ? 'image/png' : kind === 'pdf' ? 'application/pdf' : 'text/html')
}

/** 去扩展名的文件名（导入建卡时作标题） */
export function stripExt(name: string): string {
  return name.replace(/\.[^.]+$/, '')
}

/**
 * 附件文本摘要（R81/R15）：「N 图 · N PDF · M HTML」
 *
 * 改前三处各自写着 `htmls = list.length - imgs`，把 **PDF 算进 HTML 档**——
 * 徽标、卡片字段值、CSV 导出三个出口同时错。抽到此处后三处共用同一口径。
 * ⚠ 仅当卡上确有 PDF 时输出才会变化；无 PDF 的卡输出逐字不变。
 */
export function assetSummary(list: Array<{ kind: AssetMeta['kind'] }> | undefined | null): string {
  const arr = list || []
  const imgs = arr.filter(a => a.kind === 'image').length
  const pdfs = arr.filter(a => a.kind === 'pdf').length
  const htmls = arr.filter(a => a.kind === 'html').length
  const parts: string[] = []
  if (imgs) parts.push(`${imgs} 图`)
  if (pdfs) parts.push(`${pdfs} PDF`)
  if (htmls) parts.push(`${htmls} HTML`)
  return parts.join(' · ')
}
