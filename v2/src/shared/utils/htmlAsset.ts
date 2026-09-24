/**
 * 第卌二轮 REQ-058：HTML 附件「file:// 完整打开」通道
 * 第卌四轮 T-08：泛化为通用文件通道——同函数同时服务 HTML 与 PDF 附件（openFileAsset 别名）。
 * PDF 经落盘 file:// 打开由 Chrome 内置 PDF viewer 渲染（已真机实证）。
 *
 * 根因（用户真机反馈）：blob:chrome-extension:// 页面继承扩展 MV3 CSP（script-src 'self'），
 * 自包含 HTML 里的内联 <script> 被静默拦截 → "双击完整、知源打开丢内容"。
 * 治本：落盘真实文件 → file:// 打开（与双击 100% 等效：内联脚本/localStorage/编码全一致）。
 *
 * R162 修复（用户真机再反馈"HTML 能打开但交互无法响应"，实为落盘链路静默失败降级 blob）：
 *  - 打开**被下载的那个文件**两条通道，按权限自动分流：
 *      ① 已开「允许访问文件网址」（chrome.extension.isAllowedFileSchemeAccess）→ file:// 本浏览器打开；
 *      ② 未开（tabs.create(file://) 会被 Chrome 拦下）→ chrome.downloads.open(下载 id)
 *         用系统默认程序打开刚下载的副本（.html → 默认浏览器 / .pdf → 默认阅读器，交互完整）。
 *  - 下载失败才降级 blob（保留引导 Toast），并明确告知"已下载到下载目录"。
 *
 * 行为约定：
 *  - 落盘目录固定「下载目录/知源附件/」，文件名 = <assetId>-<净化原名>（确定性路径）
 *  - 复用：优先 fetch(file://…) 探测既有文件（200 → 直接打开不重复下载，仅在文件权限已开时）；探测失败或 404 →
 *    chrome.downloads 重新落盘（conflictAction:'overwrite'，同路径覆盖不产生重复副本）
 *  - 路径记忆存独立存储键 zy_file_paths（第卌四轮由 zy_html_paths 泛化更名；不进主 JSON，不碰卡片模型）
 */
import type { AssetMeta } from '@/shared/models'
import { K } from '@/shared/storage/keys'
import { getAssetBlob } from '@/shared/storage/assets'
import { openExternalLink } from '@/shared/utils/link'
import { showToast } from '@/shared/components/toast'

const PATHS_KEY = K.FILE_PATHS

type HtmlPathMap = Record<string, string>

function hasDownloads(): boolean {
  return typeof chrome !== 'undefined' && !!chrome.downloads?.download
}

/** R162：扩展是否被允许访问 file://（未开启时 chrome.tabs.create(file://) 会被 Chrome 拦下） */
function isFileAccessAllowed(): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      const ext = (typeof chrome !== 'undefined' ? chrome.extension : undefined) as
        | { isAllowedFileSchemeAccess?: (cb: (ok: boolean) => void) => void }
        | undefined
      if (ext?.isAllowedFileSchemeAccess) ext.isAllowedFileSchemeAccess((ok) => resolve(!!ok))
      else resolve(false)
    } catch { resolve(false) }
  })
}

/** R162：用 downloads.open 打开"刚下载的那个文件"（系统默认程序；无需 file:// 访问权限） */
function openDownloaded(id: number): boolean {
  try {
    const dl = (typeof chrome !== 'undefined' ? chrome.downloads : undefined) as
      | { open?: (downloadId: number) => void }
      | undefined
    if (!dl?.open || id < 0) return false
    dl.open(id)
    return true
  } catch { return false }
}

/** 净化文件名：去路径分隔符与非法字符，限长 */
function sanitizeName(name: string): string {
  const base = (name || 'attachment.pdf').replace(/[\\/:*?"<>|]/g, '_').replace(/^\.+/, '_')
  return base.length > 60 ? base.slice(-60) : base
}

/** R129-B5：附件 id 可能来自导入 JSON——含 `..` 或路径分隔符就能把落盘路径甩出「知源附件/」目录 */
function safeAssetId(id: string): string {
  if (/^[\w-]{1,64}$/.test(id || '')) return id
  return (id || '').replace(/[^\w-]/g, '_').slice(0, 64) || 'asset'
}

/** 确定性落盘相对路径（下载目录/知源附件/…） */
function targetPath(meta: AssetMeta): string {
  return `知源附件/${safeAssetId(meta.id)}-${sanitizeName(meta.name)}`
}

async function loadPathMap(): Promise<HtmlPathMap> {
  try {
    if (typeof chrome === 'undefined' || !chrome.storage?.local?.get) return {}
    const cur = (await chrome.storage.local.get([PATHS_KEY]))[PATHS_KEY]
    return (cur && typeof cur === 'object') ? cur as HtmlPathMap : {}
  } catch { return {} }
}

async function savePathMap(map: HtmlPathMap): Promise<void> {
  try { await chrome.storage.local.set({ [PATHS_KEY]: map }) } catch { /* 容错：路径记忆失败不影响打开 */ }
}

/** file:/// URL（Windows 盘符路径 → file:///C:/…；已是 file:// 原样） */
function toFileUrl(p: string): string {
  if (/^file:\/\//i.test(p)) return p
  return 'file:///' + encodeURI(p.replace(/\\/g, '/')).replace(/#/g, '%23')
}

/** 探测已落盘文件仍存在（fetch file:// 成功即认为可复用） */
async function fileStillThere(fileUrl: string): Promise<boolean> {
  try {
    const resp = await fetch(fileUrl, { method: 'GET' })
    return resp.ok
  } catch { return false }
}

/** chrome.downloads 落盘并返回最终绝对路径与下载 id（失败返回 {path:'', id:-1}） */
function downloadToDisk(meta: AssetMeta, blob: Blob): Promise<{ path: string; id: number }> {
  return new Promise((resolve) => {
    let blobUrl = ''
    let timer: ReturnType<typeof setTimeout> | null = null
    const done = (path: string) => {
      if (timer) clearTimeout(timer)
      try { chrome.downloads.onChanged.removeListener(onChanged) } catch { /* noop */ }
      if (blobUrl) { try { URL.revokeObjectURL(blobUrl) } catch { /* noop */ } }
      resolve({ path, id: path ? dlId : -1 })
    }
    const onChanged = (delta: { id: number; state?: { current?: string } }) => {
      if (delta.id !== dlId) return
      const st = delta.state?.current
      if (st === 'complete') {
        chrome.downloads.search({ id: dlId }, items => done(items?.[0]?.filename || ''))
      } else if (st === 'interrupted') {
        done('')
      }
    }
    let dlId = -1
    try {
      blobUrl = URL.createObjectURL(blob)
      chrome.downloads.download(
        { url: blobUrl, filename: targetPath(meta), conflictAction: 'overwrite', saveAs: false },
        id => {
          if (typeof id === 'number' && id >= 0) {
            dlId = id
            chrome.downloads.onChanged.addListener(onChanged)
            timer = setTimeout(() => done(''), 20000)
          } else {
            chrome.runtime.lastError // 清空错误标记
            done('')
          }
        }
      )
    } catch { done('') }
  })
}

/**
 * 打开 HTML / PDF 附件（下载本地副本后打开，与双击本地文件等效）。
 * PDF 由浏览器内置 viewer 渲染；返回实际使用的通道：'file'（落盘打开）| 'blob'（降级）| 'missing'（本体缺失）
 */
export async function openHtmlAsset(meta: AssetMeta): Promise<'file' | 'blob' | 'missing'> {
  let blob: Blob | null = null
  try { blob = await getAssetBlob(meta.id) } catch (err) { console.error('[htmlAsset] get failed:', err) }
  if (!blob) { showToast('⚠ 附件本体缺失（可能已被清理），请重新上传'); return 'missing' }

  if (hasDownloads()) {
    const allowed = await isFileAccessAllowed()
    // ① 复用：有记忆路径、文件仍在、且已开文件网址权限 → 直接打开（不重复落盘）
    if (allowed) {
      const map = await loadPathMap()
      const remembered = map[meta.id]
      if (remembered) {
        const fileUrl = toFileUrl(remembered)
        if (await fileStillThere(fileUrl)) {
          openExternalLink(fileUrl)
          showToast('已在浏览器打开（本地副本复用）')
          return 'file'
        }
      }
    }
    // ② 落盘（确定性路径覆盖写）→ 打开"被下载的那个文件"（两条通道按权限分流）
    const saved = await downloadToDisk(meta, blob)
    if (saved.path) {
      const map = await loadPathMap()
      map[meta.id] = saved.path
      await savePathMap(map)
      if (allowed) {
        openExternalLink(toFileUrl(saved.path))
        showToast('已下载并在浏览器完整打开（内联脚本可运行）')
      } else if (openDownloaded(saved.id)) {
        // R162：未开文件网址权限时 tabs.create(file://) 会被拦下——改由系统默认程序打开刚下载的副本
        showToast('已下载并用本地程序打开（要在本浏览器内打开，请到 扩展详情 → 允许访问文件网址）')
      } else {
        showToast('已下载到「下载/知源附件」；未能自动打开，可从下载记录双击打开')
      }
      return 'file'
    }
    // ③ 落盘失败（downloads 被拦/超时）→ 引导 + 降级
    showToast('⚠ 落盘失败：请到 扩展详情 → 允许访问文件网址 开启后重试；本次降级预览（内联脚本可能受限）')
  }

  // ④ 降级：blob URL 打开（网页端 / downloads 异常）
  const url = URL.createObjectURL(blob)
  openExternalLink(url)
  setTimeout(() => { try { URL.revokeObjectURL(url) } catch { /* noop */ } }, 300000)
  return 'blob'
}

/** 第卌四轮 T-08：通用文件打开别名——PDF 与 HTML 共用同一条落盘 file:// 通道 */
export const openFileAsset = openHtmlAsset
