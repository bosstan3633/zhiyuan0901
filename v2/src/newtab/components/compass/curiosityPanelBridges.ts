/**
 * R181 结构优化：从 CuriosityPanel.vue 抽出的自足桥接逻辑——
 *   好奇心「转化」弹窗（选策展台/分类 → 转资源卡，或 选项目/指标 → 转任务）。
 * V4.1.3 关系白名单收口后，好奇心不再提供资源挂载入口；历史记录仍随数据包与云快照保留。
 *
 * 为什么单独成文件：宿主是 ≥800 行结构债务候选，这两块各自只依赖少量外部状态
 * （store / d / detailItem / convertToX / detailId），与面板其余逻辑无耦合。
 * 历史断言凡命中宿主的字符串（如 R4-Ep「默认落点显式写池」、转化双保险注释）随
 * helpers.cjs COMPONENT_AGGREGATES 聚合回读宿主路径，一处不改。
 */
import { ref, computed } from 'vue'
import type { AppData, CuriosityCard } from '@/shared/models'
import { CURATION_WS_ID } from '@/shared/models'
import { showToast } from '@/shared/components/toast'
import { selectableWsOptions, wsNameById } from '@/shared/utils/wsName'
import { flattenProjectOptions } from './curiosityPanelCore'

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
