/**
 * R181 结构优化：从 CuriosityPanel.vue 抽出的两块自足桥接逻辑——
 *   ① 好奇心「转化」弹窗（选策展台/分类 → 转资源卡，或 选项目/指标 → 转任务）；
 *   ② 好奇心 ↔ 资源卡的「资源支撑」闭环（关联/解绑/打开源卡）。
 *
 * 为什么单独成文件：宿主是 ≥800 行结构债务候选，这两块各自只依赖少量外部状态
 * （store / d / detailItem / convertToX / detailId），与面板其余逻辑无耦合。
 * 历史断言凡命中宿主的字符串（如 R4-Ep「默认落点显式写池」、转化双保险注释）随
 * helpers.cjs COMPONENT_AGGREGATES 聚合回读宿主路径，一处不改。
 */
import { ref, computed, type ComputedRef, type Ref } from 'vue'
import type { AppData, CuriosityCard, ResourceCard } from '@/shared/models'
import { CURATION_WS_ID } from '@/shared/models'
import { showToast } from '@/shared/components/toast'
import { toOpenableRawLink, openExternalLink } from '@/shared/utils/link'
import { selectableWsOptions, wsNameById } from '@/shared/utils/wsName'
import { recordCardOpen } from '@/shared/storage/stats'
import { addCurioSupportLink, removeCurioSupportLink } from '@/shared/utils/supportLinks'
import {
  flattenProjectOptions,
  supportCandidatesOf,
  supportRowsOf,
} from './curiosityPanelCore'

interface CuriosityStore {
  data: AppData | null
  persist: () => void
  persistHot: () => void
}

/* ================= ① 转化弹窗 ================= */
export function useCurioConvert(opts: {
  store: CuriosityStore
  convertToResource: (c: CuriosityCard, wsId: string, catId?: string) => void
  convertToTask: (c: CuriosityCard, projId?: string, metId?: string) => void
  clearDetail: () => void
}) {
  const { store, convertToResource, convertToTask, clearDetail } = opts
  const convertOpen = ref(false)
  const convertTarget = ref<'task' | 'res'>('task')
  const convertItem = ref<CuriosityCard | null>(null)
  const convertWsId = ref('')
  const convertCatId = ref('')
  const convertProjId = ref('')
  const convertMetId = ref('')

  const convWorkspaces = computed(() => selectableWsOptions(store.data!.workspaces))
  const convCategories = computed(() =>
    store.data!.categories.filter(c => c.workspaceId === convertWsId.value)
  )
  /** 全部项目（跨方向扁平），带所属方向名 */
  const convProjects = computed(() => {
    return flattenProjectOptions(store.data!.compass.directions)
  })
  const convMetrics = computed(() =>
    convProjects.value.find(p => p.id === convertProjId.value)?.metrics || []
  )

  function openConvert(c: CuriosityCard, target: 'task' | 'res') {
    convertItem.value = c
    convertTarget.value = target
    // R4-Ep：默认落点显式写池——改前取 convWorkspaces[0]，而它来自原始 d.workspaces 数组，
    // 存量库第一枚是 hub 实体（落池）、新库第一枚是策展台（落台），同一个动作默认落点随库形状漂移。
    convertWsId.value = CURATION_WS_ID
    convertCatId.value = ''
    convertProjId.value = ''
    convertMetId.value = ''
    convertOpen.value = true
  }
  /** R70：项目下拉变更 → 无条件复位指标：
   *  - 项目清空后遗留的旧指标 → convertToTask(c, undefined, 'X') 会产出「有指标无项目」的非法任务（R49 起点名）；
   *  - 项目 A→B 切换后旧指标不在 B 的指标列表内，同属非法。
   *  convertToTask 内另有数据层兜底（双保险）。 */
  function onConvertProjChange() { convertMetId.value = '' }
  function confirmConvert() {
    const c = convertItem.value
    if (!c) return
    if (convertTarget.value === 'res') {
      if (!convertWsId.value) { showToast('请选择存入位置'); return }
      convertToResource(c, convertWsId.value, convertCatId.value || undefined)
      // 台名走 wsNameById 单源；改前硬拼 `「${ws.name}」资源台`，存量库实测印成「已归档至「🗂 资源台」资源台」
      showToast(`已归档至「${wsNameById(store.data!.workspaces, convertWsId.value) || '未命名台'}」`)
    } else {
      const proj = convProjects.value.find(p => p.id === convertProjId.value)
      const wasShelf = c.status === 'shelf'
      convertToTask(c, convertProjId.value || undefined, convertMetId.value || undefined)
      showToast(proj ? `已转为任务，归属「${proj.name}」` : '已转为任务，进入任务中心')
      // 第卌轮 REQ-050：搁置 → 任务按「待开始」处理，显式提示
      if (wasShelf) showToast('ℹ 已搁置的好奇心转为任务后按「待开始」处理')
    }
    convertOpen.value = false
    clearDetail()
  }

  return {
    convertOpen,
    convertTarget,
    convertItem,
    convertWsId,
    convertCatId,
    convertProjId,
    convertMetId,
    convWorkspaces,
    convCategories,
    convProjects,
    convMetrics,
    openConvert,
    onConvertProjChange,
    confirmConvert,
  }
}

/* ================= ② 资源支撑闭环 ================= */
export function useCurioSupport(opts: {
  store: CuriosityStore
  d: ComputedRef<AppData>
  detailItem: Ref<CuriosityCard | null>
}) {
  const { store, d, detailItem } = opts
  /* G-03：好奇心 ↔ 资源卡的「资源支撑」闭环。
     关联记录住在独立表 curioSupportLinks，好奇卡与资源卡本体都不持有对方 id；
     解绑只删记录，资源池源卡状态不变。 */
  const curioSupportDraft = ref('')
  const curioSupportRows = computed(() => supportRowsOf(d.value, detailItem.value?.id || null))
  const curioSupportCands = computed(() => {
    const linked = new Set(curioSupportRows.value.map(row => row.resource.id))
    return supportCandidatesOf(d.value.resources || [], linked, curioSupportDraft.value)
  })
  function addCurioSupport(): void {
    const curio = detailItem.value
    const q = curioSupportDraft.value.trim()
    if (!curio || !q) return
    const resource = (d.value.resources || []).find(r => !r.deletedAt && r.title === q)
      || curioSupportCands.value[0]
    if (!resource) {
      showToast('没找到匹配的资源卡')
      return
    }
    const out = addCurioSupportLink(d.value, {
      curioId: curio.id,
      resourceId: resource.id,
      from: 'manual',
    })
    if (out.dup) {
      showToast('这张资源卡已经在支撑列表里了')
      return
    }
    curioSupportDraft.value = ''
    store.persist()
    showToast(`已关联「${resource.title.slice(0, 12)}」`)
  }
  function removeCurioSupport(linkId: string): void {
    if (!removeCurioSupportLink(d.value, linkId)) return
    store.persist()
    showToast('已解除关联（资源卡本体未变动）')
  }
  function openCurioSupportResource(resource: ResourceCard): void {
    recordCardOpen(d.value, resource)
    store.persistHot()
    const url = toOpenableRawLink(resource.link)
    if (!url) {
      showToast('这张资源卡还没有可打开的链接')
      return
    }
    openExternalLink(url)
  }

  return {
    curioSupportDraft,
    curioSupportRows,
    curioSupportCands,
    addCurioSupport,
    removeCurioSupport,
    openCurioSupportResource,
  }
}
