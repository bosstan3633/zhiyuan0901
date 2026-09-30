/**
 * R100（纯拆分第一批）：资源台 / 策展台导入三链路 —— 自 Workspace.vue 原位迁出（零行为变更）。
 *
 * 覆盖三条导入链路（W6/R73 的 mode-aware 入口语义不变）：
 *   1. 策展台数据包 JSON（`handleBoardImport`，非 hub；R65-F4/R65-8/R70 结构校验）
 *   2. ~~书签 HTML~~ → ★R4-Db 起唯一实现在 `composables/useBookmarkImport.ts`（本模块那份是死链，已删）
 *   3. 本地文件批量（`handleFileImport`，hub；R13 一文件一卡 + 附件本体入 IndexedDB）
 *
 * 拆分约定（04-49 任务书）：
 * - **零行为变更**：实现逐行迁出，不改任何逻辑/文案/顺序；宿主以解构保持原标识符绑定（模板零改动）；
 * - 依赖以 ctx 注入（store/d/workspaceId/newCardCatId），composable 不反向依赖宿主；
 * - 断言按「实现随迁、绑定留宿主」归位（R100 重指）。
 */
import { ref, computed, type ComputedRef } from 'vue'
import type { AppData, AssetMeta, ResourceCard } from '@/shared/models'
import { uid, safeDecodeText } from '@/shared/utils'
import { guessAssetKind, assetMimeOf, stripExt, ASSET_KIND_MB } from '@/shared/utils/assetKind'
import { putAsset } from '@/shared/storage/assets'
import { sanitizeCategoryTree, catTreeFixedAny, catTreeFixNote } from '@/shared/utils/catTree'
import { sanitizeThesisDuplicates } from '@/shared/storage/hub'
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
        /**
         * R169-T1：合并**不许让旧包时间戳盖掉今日改动**。
         * `mergeById` 是覆盖式合并（`{...现值, ...来值}`），且导入晚于载入 ⇒ 拿一份上周的包导进来，
         * 「最近更新」会整体退回上周，用户读到的是"我今天做的事不见了"。
         * 只钳时间、不钳内容（内容以来值为准是"导入"的既有语义，动它会伤别的场景）。
         */
        const clampUpdatedAt = <T extends { id: string; updatedAt?: number }>(existing: T[], incoming: T[]): T[] => {
          const byId = new Map(existing.map(x => [x.id, x]))
          return incoming.map(i => {
            const cur = byId.get(i.id)
            return cur && typeof cur.updatedAt === 'number' && typeof i.updatedAt === 'number' && cur.updatedAt > i.updatedAt
              ? { ...i, updatedAt: cur.updatedAt } : i
          })
        }
        // 只并本台段：策展台/分类/台内卡 + 投射清单中指向本台的记录（全局段不在此入口搬运，走设置页「导入数据」）
        const wsId = workspaceId.value
        const incCats = san.cats.filter(c => c.workspaceId === wsId)
        const incRes = (ext.resources || []).filter(r => r.workspaceId === wsId).map(r => ({ ...r, importedAt: importedNow }))
        const incProj = (ext.curationProjections || []).filter(p => p.targetWsId === wsId)
        const cardsBefore = d.value.resources.length
        d.value.workspaces = mergeById(d.value.workspaces, ext.workspaces?.filter(w => w.id === wsId) || [])
        d.value.categories = mergeById(d.value.categories, incCats)
        d.value.resources = mergeById(d.value.resources, clampUpdatedAt(d.value.resources, incRes) as ResourceCard[])
        if (incProj.length) d.value.curationProjections = mergeById(d.value.curationProjections || [], incProj)
        // R171-A1：覆盖式合并可能让同台中心论点多张并存（导入包里的 isThesis 卡与现库各立一张）
        // ——导入即净化，metrics 取首张的口径才不被幽灵论点污染
        const tsan = sanitizeThesisDuplicates(d.value)
        persist()
        importModalOpen.value = false
        const added = d.value.resources.length - cardsBefore
        const fixNote = catTreeFixedAny(san.fixed) ? `（已自动修复：${catTreeFixNote(san.fixed)}）` : ''
        const thesisNote = tsan.cleared ? `（中心论点重复已净化：清 ${tsan.cleared} 张多余标记）` : ''
        showToast(`✓ 已导入：分类 ${incCats.length} · 卡片 ${incRes.length}（新增 ${added}，其余按 ID 覆盖合并）${fixNote}${thesisNote}`)
      } catch { showToast('✗ JSON 解析失败，请确认是「导出策展台数据」生成的文件') }
    }
    reader.readAsText(file)
    input.value = ''
  }

  // ===== R4-Db（旧世界清账）：书签导入整段搬出本模块 =====
  /* 原先这里挂着书签的**第二条**实现（文件夹勾选 → 按前 2 级在隐藏池下建分类）。
     它自 V3.7.0 起就是够不着的死链（宿主那一枚 file input 全站零 .click()），
     且写的形状被 models 明令禁止（池卡 categoryId 恒空、hub 分类实体已由迁移器移除），
     而清理器被幂等戳挡住不会重跑 ⇒ 触发一次就永久残留。
     本轮连同勾选弹窗、其文件夹清单与那一段样式一并删除，本模块只剩「策展台数据包 JSON」与
     「本地文件批量」两条链路。书签唯一实现见 composables/useBookmarkImport.ts
     （含从本模块搬走的解码与软删分类排除两处硬化）。
     ★写这条注释时刻意不点被删符号的名字——本仓库已三次踩到"解释退役原因的注释把自己的
       零命中判据顶成恒真"（R166 纪律：负判据一律走 codeOnly，注释里也不留字面量）。 */
  const fileImportInput = ref<HTMLInputElement | null>(null)

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
    fileImportInput,
    handleBoardImport,
    fileImport, handleFileImport
  }
}
