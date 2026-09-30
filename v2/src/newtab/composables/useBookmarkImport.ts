/**
 * R4-Db（旧世界清账）：**书签导入的唯一实现**。
 *
 * 本轮之前全站有两份书签导入：
 *  ① `useWorkspaceImport.ts` 里那条（R73-S2 自 CurationCenter 迁入）——文件夹勾选弹窗 → 按前 2 级
 *     在**隐藏池** `CURATION_WS_ID` 下建分类；
 *  ② 设置页「导入数据 → 🔖 导入书签文件」里那条——目标台下拉 + 台内单「待分类」+ 文件夹全路径转标签。
 * V3.7.0 资源台退役后 ① 的触发钮早被摘掉，`bookmarkInput` 在 `Workspace.vue` 只是一枚**全站零 `.click()`
 * 的 parked input**，整条链够不着；更糟的是它写的形状模型里不许存在——`models/index.ts` 定「池卡
 * `categoryId` 恒空、hub 分类实体已由迁移器移除」，而清理器 `poolMigration` 又被 `d.catsMigratedAt`
 * 的幂等闸挡住不会重跑 ⇒ 一旦有人真触发就留下金字塔仍在枚举的永久残留。
 *
 * 本轮合一：**② 的语义为唯一口径**，① 整条删除（连同勾选弹窗与 `.bk-*` 样式）。
 * 但 ① 身上有三处硬化是 ② 没跟上的真 BUG，一并搬过来：
 *  - `safeDecodeText` 解码文件夹名与书签标题（② 漏了 ⇒ 浏览器导出的实体名以 mojibake 落库）；
 *  - 复用「待分类」时查 `!c.deletedAt`（② 至今没修 ⇒ 同名分类在回收站时，导入的卡既不显示也不可恢复，
 *    与 R129-B11 修过的完全同一个坑）；
 *  - 根文件夹名按 `BK_ROOT_NAMES` 八枚排净（② 只排 `'书签栏'` 一枚 ⇒ `'收藏栏'` / `'Bookmarks bar'`
 *    / `'移动书签'` 会当成标签贴到每张卡上）。
 *
 * 不做的事（口径照 R169-17，设置页文案也是这么写的）：**不建文件夹分类树**。层级只进标签。
 */
import { ref, type ComputedRef } from 'vue'
import type { AppData, ResourceCard } from '@/shared/models'
import { uid, safeDecodeText } from '@/shared/utils'
import { showToast } from '@/shared/components/toast'

interface BkNode { title: string; url: string; path: string[] }

/** 浏览器标准根文件夹不进标签（中英文与移动端栏名一并排掉） */
const BK_ROOT_NAMES = new Set(['书签栏', '收藏栏', '其他书签', 'Bookmarks bar', 'Bookmarks Toolbar', 'Favorites bar', 'Mobile bookmarks', '移动书签'])

/** 书签卡的唯一构造式（id 前缀 `rc` 与全站资源卡一致，`assets` 恒空——书签只有链接没有附件） */
function makeBookmarkCard(title: string, linkType: ResourceCard['linkType'], link: string, wsId: string, categoryId: string, tags: string[]): ResourceCard {
  const now = Date.now()
  return {
    id: uid('rc'), kind: 'resource', title, linkType, link,
    workspaceId: wsId, categoryId, description: '', tags, assets: [], customFields: {},
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
   * 书签 HTML → 资源卡：`targetWsId` 为 `'__new__'` 或已失效的台 id ⇒ 新建「🔖 书签导入 <今天>」策展台；
   * 台内单「待分类」承接归属，文件夹全路径转标签。
   * @returns 本次新建卡 id 列表——设置页拿去挂「归类并补全这批」回执
   *          （R138-H3 口径：导入完成**不自动弹**评审抽屉，范式是"点击 → 弹窗"不是"导入 → 弹窗"）
   */
  async function handleBookmarkImport(e: Event, targetWsId = '__new__'): Promise<string[]> {
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
    let ws = targetWsId !== '__new__' ? data.workspaces.find(w => w.id === targetWsId) : undefined
    if (!ws) {
      ws = {
        id: uid('ws'), name: '🔖 书签导入 ' + new Date().toLocaleDateString(), icon: '🔖',
        color: 'var(--accent)', coverTheme: 'deep-sea', desc: '从浏览器书签导入', order: data.workspaces.length, archived: false
      }
      data.workspaces.push(ws)
    }
    const target = ws
    let cat = data.categories.find(c => !c.deletedAt && c.workspaceId === target.id && c.name === '待分类')
    if (!cat) {
      cat = {
        id: uid('cat'), workspaceId: target.id, name: '待分类',
        order: data.categories.filter(c => !c.deletedAt && c.workspaceId === target.id).length
      }
      data.categories.push(cat)
    }
    const ids: string[] = []
    for (const b of items) {
      const tags = Array.from(new Set(b.path.filter(p => p && !BK_ROOT_NAMES.has(p))))
      const linkType: ResourceCard['linkType'] = /^file:/i.test(b.url) ? 'file' : /^obsidian:/i.test(b.url) ? 'obsidian' : 'url'
      const card = makeBookmarkCard(b.title.substring(0, 120), linkType, b.url, target.id, cat.id, tags)
      ids.push(card.id)
      data.resources.unshift(card)
    }
    persist()
    showToast(`✓ 已导入 ${items.length} 个书签到「${target.name}」（文件夹已作为标签）`)
    return ids
  }

  return { bookmarkInput, bookmarkImport, handleBookmarkImport }
}
