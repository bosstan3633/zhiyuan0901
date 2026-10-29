/**
 * 书签导入的唯一实现。
 *
 * 设置 → 数据管理 → 数据包是唯一入口：解析 Netscape 书签 HTML 后直接生成资源卡池卡片。
 * 不选择目标策展台、不创建“书签导入”策展台或台内分类；文件夹路径只转成资源标签。
 * 标题与文件夹名统一解码，浏览器标准根文件夹名不进标签。
 *
 * 不做的事（口径照 R169-17，设置页文案也是这么写的）：**不建文件夹分类树**。层级只进标签。
 */
import { ref, type ComputedRef } from 'vue'
import { CURATION_WS_ID, type AppData, type ResourceCard } from '@/shared/models'
import { uid, safeDecodeText } from '@/shared/utils'
import { showToast } from '@/shared/components/toast'

interface BkNode { title: string; url: string; path: string[] }

/** 浏览器标准根文件夹不进标签（中英文与移动端栏名一并排掉） */
const BK_ROOT_NAMES = new Set(['书签栏', '收藏栏', '其他书签', 'Bookmarks bar', 'Bookmarks Toolbar', 'Favorites bar', 'Mobile bookmarks', '移动书签'])

/** 书签卡的唯一构造式（id 前缀 `rc` 与全站资源卡一致，`assets` 恒空——书签只有链接没有附件） */
function makeBookmarkCard(title: string, linkType: ResourceCard['linkType'], link: string, tags: string[]): ResourceCard {
  const now = Date.now()
  return {
    id: uid('rc'), kind: 'resource', title, linkType, link,
    workspaceId: CURATION_WS_ID, categoryId: '', description: '', tags, assets: [], customFields: {},
    pinned: false, callCount: 0, createdAt: now, updatedAt: now
  }
}

/** 解析 Netscape 书签 HTML（浏览器导出格式）：DL/DT/H3 递归，取 A 的 href 与文本 */
function parseBookmarksHtml(html: string): BkNode[] {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const out: BkNode[] = []
  function walk(dl: Element | null, path: string[]) {
    if (!dl) return
    for (const dt of Array.from(dl.children).filter(el => el.tagName === 'DT')) {
      const h3 = dt.querySelector(':scope > h3')
      const a = dt.querySelector(':scope > a')
      if (h3) {
        const name = safeDecodeText(h3.textContent?.trim() || '未命名')
        walk(dt.querySelector(':scope > dl'), [...path, name])
      } else if (a) {
        const url = a.getAttribute('href') || ''
        if (url && /^(https?:|file:|obsidian:)/i.test(url)) {
          out.push({ title: safeDecodeText(a.textContent?.trim() || url), url, path })
        }
      }
    }
  }
  walk(doc.querySelector('dl'), [])
  return out
}

export interface BookmarkImportCtx {
  /** 全局数据（store.data 的 computed） */
  d: ComputedRef<AppData>
  /** 持久化（store.persist） */
  persist: () => void
}

export function useBookmarkImport(ctx: BookmarkImportCtx) {
  const { d, persist } = ctx

  const bookmarkInput = ref<HTMLInputElement | null>(null)
  function bookmarkImport() { bookmarkInput.value?.click() }

  /**
   * 书签 HTML → 资源卡池。文件夹路径继续转标签；不创建策展台、不创建台内分类。
   * @returns 本次新建卡 id 列表——设置页拿去挂「归类并补全这批」可选后处理
   */
  async function handleBookmarkImport(e: Event): Promise<string[]> {
    const input = e.target as HTMLInputElement
    const file = input.files?.[0]
    if (!file) return []
    let items: BkNode[] = []
    try {
      items = parseBookmarksHtml(await file.text())
    } catch { showToast('✗ 书签文件解析失败'); input.value = ''; return [] }
    input.value = ''
    if (!items.length) { showToast('未在文件中解析到书签，请确认是浏览器导出的书签 HTML'); return [] }
    const data = d.value
    const ids: string[] = []
    for (const b of items) {
      const tags = Array.from(new Set(b.path.filter(p => p && !BK_ROOT_NAMES.has(p))))
      const linkType: ResourceCard['linkType'] = /^file:/i.test(b.url) ? 'file' : /^obsidian:/i.test(b.url) ? 'obsidian' : 'url'
      const card = makeBookmarkCard(b.title.substring(0, 120), linkType, b.url, tags)
      ids.push(card.id)
      data.resources.unshift(card)
    }
    persist()
    showToast(`✓ 已导入 ${items.length} 张资源卡到资源卡池（文件夹已作为标签）`)
    return ids
  }

  return { bookmarkInput, bookmarkImport, handleBookmarkImport }
}
