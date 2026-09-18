/**
 * R100（纯拆分第一批）：资源台 / 策展台导入三链路 —— 自 Workspace.vue 原位迁出（零行为变更）。
 *
 * 覆盖三条导入链路（W6/R73 的 mode-aware 入口语义不变）：
 *   1. 策展台数据包 JSON（`handleBoardImport`，非 hub；R65-F4/R65-8/R70 结构校验）
 *   2. 书签 HTML（`handleBookmarkImport` → 文件夹勾选 → `confirmBookmarkImport`，hub；R30-4/R73-6）
 *   3. 本地文件批量（`handleFileImport`，hub；R13 一文件一卡 + 附件本体入 IndexedDB）
 *
 * 拆分约定（04-49 任务书）：
 * - **零行为变更**：实现逐行迁出，不改任何逻辑/文案/顺序；宿主以解构保持原标识符绑定（模板零改动）；
 * - 依赖以 ctx 注入（store/d/workspaceId/newCardCatId），composable 不反向依赖宿主；
 * - 断言按「实现随迁、绑定留宿主」归位（R100 重指）。
 */
import { ref, computed, type ComputedRef } from 'vue'
import type { AppData, AssetMeta, ResourceCard } from '@/shared/models'
import { CURATION_WS_ID } from '@/shared/models'
import { uid, safeDecodeText } from '@/shared/utils'
import { guessAssetKind, assetMimeOf, stripExt, ASSET_KIND_MB } from '@/shared/utils/assetKind'
import { putAsset } from '@/shared/storage/assets'
import { sanitizeCategoryTree, catTreeFixedAny, catTreeFixNote } from '@/shared/utils/catTree'
import { showToast } from '@/shared/components/toast'

export interface WorkspaceImportCtx {
  /** 全局数据（store.data 的 computed） */
  d: ComputedRef<AppData>
  /** 当前台 id（isHub 由调用方保证：数据包导入仅非 hub 入口、书签/本地文件仅 hub 入口） */
  workspaceId: ComputedRef<string>
  /** 新卡归属分类（聚合视图下的回落值，宿主持有口径） */
  newCardCatId: () => string
  /** 持久化（store.persist） */
  persist: () => void
}

export function useWorkspaceImport(ctx: WorkspaceImportCtx) {
  const { d, workspaceId, newCardCatId, persist } = ctx

  // ===== R65-F4：策展台导入 = 策展台数据包 JSON（书签/本地文件导入已移交资源台） =====
  const importModalOpen = ref(false)
  const boardImportInput = ref<HTMLInputElement | null>(null)

  /** 策展台数据包导入：与 ⚙ 导出策展台数据同格式（AppData 子集），按 ID 并集合并本台段 */
  function handleBoardImport(e: Event) {
    const input = e.target as HTMLInputElement
    const file = input.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const ext = JSON.parse(reader.result as string) as AppData
        if (!ext || typeof ext !== 'object' || !String(ext.version || '').startsWith('2')) { showToast('✗ 文件格式不识别——仅接受本产品导出的 v2 数据包'); return }
        // R70：结构校验与净化——此前只认 version。含环的 categories 会经 mergeById 的
        // { ...existing, ...incoming } 覆盖 parentId 进库，随后分类树渲染/计数递归无限展开
        // → 本台永久打不开（卡在渲染上，界面里没有入口能删掉坏分类）。
        const san = sanitizeCategoryTree(ext.categories || [])
        if (!san.ok) { showToast('✗ 数据包分类数量超出上限，已取消导入'); return }
        const importedNow = Date.now()
        const mergeById = <T extends { id: string }>(existing: T[], incoming: T[]): T[] => {
          const map = new Map(existing.map(x => [x.id, x]))
          for (const item of incoming) map.set(item.id, { ...map.get(item.id), ...item })
          return [...map.values()]
        }
        // 只并本台段：策展台/分类/台内卡 + 投射清单中指向本台的记录（全局段不在此入口搬运，走设置页「导入数据」）
        const wsId = workspaceId.value
        const incCats = san.cats.filter(c => c.workspaceId === wsId)
        const incRes = (ext.resources || []).filter(r => r.workspaceId === wsId).map(r => ({ ...r, importedAt: importedNow }))
        const incProj = (ext.curationProjections || []).filter(p => p.targetWsId === wsId)
        const cardsBefore = d.value.resources.length
        d.value.workspaces = mergeById(d.value.workspaces, ext.workspaces?.filter(w => w.id === wsId) || [])
        d.value.categories = mergeById(d.value.categories, incCats)
        d.value.resources = mergeById(d.value.resources, incRes as ResourceCard[])
        if (incProj.length) d.value.curationProjections = mergeById(d.value.curationProjections || [], incProj)
        persist()
        importModalOpen.value = false
        const added = d.value.resources.length - cardsBefore
        const fixNote = catTreeFixedAny(san.fixed) ? `（已自动修复：${catTreeFixNote(san.fixed)}）` : ''
        showToast(`✓ 已导入：分类 ${incCats.length} · 卡片 ${incRes.length}（新增 ${added}，其余按 ID 覆盖合并）${fixNote}`)
      } catch { showToast('✗ JSON 解析失败，请确认是「导出策展台数据」生成的文件') }
    }
    reader.readAsText(file)
    input.value = ''
  }

  // ===== R73-S2（R16 收敛）：书签 HTML 导入 + 本地文件导入（自 CurationCenter 迁入，真身落资源台） =====
  const bookmarkInput = ref<HTMLInputElement | null>(null)
  const fileImportInput = ref<HTMLInputElement | null>(null)

  interface BkFolder { path: string; name: string; count: number; checked: boolean }
  interface BkNode { title: string; url: string; path: string[] }

  const bookmarkModalOpen = ref(false)
  const bkFolders = ref<BkFolder[]>([])
  // R129-B11：原为普通 `let`——`bkTotalCount` computed 因无响应式依赖而**不会**随重新解析刷新
  //（第二次导入时计数停在旧值）。改 ref，解析结果一律走 `.value`。
  const bkBookmarks = ref<BkNode[]>([])

  /** 建一张资源台真身卡（分类由调用方给定；聚合视图下须传 newCardCatId() 的回落值） */
  function makeHubResource(title: string, linkType: ResourceCard['linkType'], link: string, categoryId: string, tags: string[] = []): ResourceCard {
    return {
      id: uid('res'), kind: 'resource', title, linkType, link,
      workspaceId: CURATION_WS_ID, categoryId, description: '', tags,
      customFields: {}, pinned: false, callCount: 0, createdAt: Date.now(), updatedAt: Date.now()
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

  /** 选中书签文件 → 解析 → 按文件夹路径分组 → 弹出文件夹勾选弹窗 */
  function handleBookmarkImport(e: Event) {
    const input = e.target as HTMLInputElement
    const file = input.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      try {
        bkBookmarks.value = parseBookmarksHtml(reader.result as string)
        if (!bkBookmarks.value.length) { showToast('未在文件中解析到书签，请确认是浏览器导出的书签 HTML'); return }
        const groups = new Map<string, BkNode[]>()
        for (const b of bkBookmarks.value) {
          const key = b.path.length ? b.path.join(' / ') : '未分组'
          if (!groups.has(key)) groups.set(key, [])
          groups.get(key)!.push(b)
        }
        bkFolders.value = Array.from(groups.entries())
          .map(([path, items]) => ({ path, name: path.split(' / ').pop() || path, count: items.length, checked: true }))
          .sort((a, b) => b.count - a.count)
        bookmarkModalOpen.value = true
        importModalOpen.value = false
      } catch { showToast('✗ 书签文件解析失败') }
    }
    reader.readAsText(file)
    input.value = ''
  }

  const allBkChecked = computed(() => bkFolders.value.length > 0 && bkFolders.value.every(f => f.checked))
  const bkTotalCount = computed(() => bkBookmarks.value.length)
  function toggleAllBk() {
    const next = !allBkChecked.value
    bkFolders.value.forEach(f => { f.checked = next })
  }

  /** 浏览器标准根文件夹不生成分类 */
  const BK_ROOT_NAMES = new Set(['书签栏', '收藏栏', '其他书签', 'Bookmarks bar', 'Bookmarks Toolbar', 'Favorites bar', 'Mobile bookmarks', '移动书签'])

  /** 按路径前 2 级确保资源台分类存在（同名同级复用），返回卡片归属分类 id（'' = 未分类） */
  function ensureBookmarkCategory(segs: string[]): string {
    let parentId: string | undefined
    let catId = ''
    for (const seg of segs.slice(0, 2)) {
      const name = seg.trim()
      if (!name) break
      // R129-B11：必须排除软删分类——此前同名分类在回收站时，导入的卡被挂进已删分类，
      // 卡既不显示（分类被过滤）也不可恢复，与 usePyramid.ts 的 `!c.deletedAt` 口径不一致。
      let cat = d.value.categories.find(c => !c.deletedAt && c.workspaceId === CURATION_WS_ID && (c.parentId || undefined) === parentId && c.name === name)
      if (!cat) {
        cat = { id: uid('cat'), workspaceId: CURATION_WS_ID, name, order: d.value.categories.filter(c => c.workspaceId === CURATION_WS_ID && (c.parentId || undefined) === parentId).length }
        if (parentId) cat.parentId = parentId
        d.value.categories.push(cat)
      }
      catId = cat.id
      parentId = cat.id
    }
    return catId
  }

  /** 按勾选文件夹导入：前 2 级建分类、第 3 级+ 并入标签（R30-4 / R30-5 口径） */
  function confirmBookmarkImport() {
    const checkedPaths = new Set(bkFolders.value.filter(f => f.checked).map(f => f.path))
    const items = bkBookmarks.value.filter(b => checkedPaths.has(b.path.length ? b.path.join(' / ') : '未分组'))
    if (!items.length) { showToast('未选择任何文件夹'); return }
    for (const b of items) {
      const segs = b.path.filter(p => p && !BK_ROOT_NAMES.has(p))
      const catId = ensureBookmarkCategory(segs)
      const tags = Array.from(new Set(segs.slice(2)))
      let linkType: ResourceCard['linkType'] = 'url'
      if (b.url.startsWith('file:')) linkType = 'file'
      else if (b.url.startsWith('obsidian:')) linkType = 'obsidian'
      d.value.resources.unshift(makeHubResource(b.title.substring(0, 120), linkType, b.url, catId, tags))
    }
    persist()
    bookmarkModalOpen.value = false
    showToast(`✓ 已导入 ${items.length} 个书签（文件夹结构已生成为分类，可自行增删改）`)
  }

  /** 本地文件批量导入（R13）：**每文件一张带附件的卡**。
   *  改前只把文件名当 link 存进卡里（如「报告.pdf」）——`toOpenableUrl('file','报告.pdf')` 因不是完整
   *  路径直接返回空，双击只提示「未设置链接」⇒ 用户既打不开也修不好，即 04-18 §261 所说的**哑卡**。
   *  现改为：guessAssetKind 判定 → putAsset 写 IndexedDB 本体 → 建卡（link='zy-asset://<id>' + assets=[meta]），
   *  **图片 / HTML / PDF 一律一文件一卡**（Q10 拍板）；不支持的类型跳过并汇总，不建哑卡。 */
  function fileImport() { fileImportInput.value?.click() }
  async function handleFileImport(e: Event) {
    const input = e.target as HTMLInputElement
    // ⚠ 必须先快照 FileList 再清空 input.value——置空会重置 FileList（第卌一轮同款坑）
    const files = Array.from(input.files || [])
    input.value = ''
    if (!files.length) return
    const catId = newCardCatId()
    const skipped: string[] = []
    let added = 0
    let totalBytes = 0
    for (const f of files) {
      const kind = guessAssetKind(f.name, f.type)
      if (!kind) { skipped.push(f.name); continue }
      if (f.size > ASSET_KIND_MB[kind] * 1024 * 1024) { skipped.push(f.name); continue }
      const id = uid('at')
      try {
        await putAsset(id, f)
      } catch (err) {
        console.error('[import] putAsset failed:', err)
        skipped.push(f.name)
        continue
      }
      const meta: AssetMeta = {
        id, kind, name: f.name, size: f.size,
        mime: assetMimeOf(kind, f.type), createdAt: Date.now()
      }
      const now = Date.now()
      d.value.resources.unshift({
        id: uid('rc'), kind: 'resource',
        title: stripExt(f.name) || f.name,
        linkType: 'file', link: `zy-asset://${id}`,
        workspaceId: workspaceId.value, categoryId: catId,
        description: '', tags: [], assets: [meta], customFields: {},
        pinned: false, callCount: 0, createdAt: now, updatedAt: now
      })
      added++
      totalBytes += f.size
    }
    if (added) { persist() }
    importModalOpen.value = false
    const mb = (totalBytes / 1024 / 1024).toFixed(1)
    const skipNote = skipped.length
      ? ` ⚠ 已跳过 ${skipped.length} 个不支持的文件：${skipped.slice(0, 3).join('、')}${skipped.length > 3 ? '…' : ''}`
      : ''
    showToast(
      added
        ? `✓ 已导入 ${added} 个文件（共 ${mb} MB）${skipNote}`
        : `✗ 无可用文件${skipNote}`
    )
  }

  return {
    importModalOpen, boardImportInput,
    bookmarkInput, fileImportInput, bookmarkModalOpen, bkFolders,
    allBkChecked, bkTotalCount,
    handleBoardImport, handleBookmarkImport, confirmBookmarkImport, toggleAllBk,
    fileImport, handleFileImport, makeHubResource
  }
}
