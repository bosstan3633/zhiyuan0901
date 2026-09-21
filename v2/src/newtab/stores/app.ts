import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { AppData, Workspace, UIPrefs } from '@/shared/models'
import { CURATION_WS_ID } from '@/shared/models'
import { getData, saveData, loadUIPrefs, saveUIPrefs, subscribe, syncCache } from '@/shared/storage/repository'
import { writeHot } from '@/shared/storage/hotStats'
import { migrateCurationTree, migrateHubStructure, migrateHubMerge, hubMergeWorkPending } from '@/shared/storage/curationMigration'
import { normalizeCardTagPaths } from '@/shared/utils/tags'
import { sanitizeMetricTaskIds } from '@/shared/utils/taskLinks'

export const useAppStore = defineStore('app', () => {
  // ---- 数据 ----
  const data = ref<AppData | null>(null)
  const ui = ref<UIPrefs | null>(null)

  // ---- 计算属性 ----
  // R52-BUG-3（R61 修订语义）：此处枚举 = 「策展台列表」——排除资源台（kind='resource'）与已归档台。
  // R61 后资源台是真实 Workspace 实体，顶栏以固定「资源台」Tab 呈现（/curation 路由），
  // 采集/移动/检索等全量枚举点（遍历 data.workspaces）自然包含资源台。
  const workspaces = computed<Workspace[]>(() =>
    data.value?.workspaces.filter((w) => !w.archived && w.id !== CURATION_WS_ID).sort((a, b) => a.order - b.order) || []
  )
  const theme = computed(() => ui.value?.theme || 'green')

  /** R61：资源台结构迁移前的自动备份下载（一次性，防误迁移） */
  function backupBeforeHubMigration(d: AppData) {
    const blob = new Blob([JSON.stringify(d, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `zhiyuan_auto_backup_before_hub_${new Date().toISOString().slice(0, 10)}.json`
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(a.href), 5000)
  }

  // ---- 初始化 ----
  async function init() {
    data.value = getData()
    ui.value = await loadUIPrefs()

    // R53-A1：策展树统一迁移——遗留分类/工作台投射记录物化为带 curFrom 的真实策展分类（幂等）
    // R61：资源台结构迁移（幂等，hubMigratedAt 标记）——首次执行前自动备份下载（沿用 R47-A2 安全网约定）
    // R131-C6b：三段存量迁移/清理原各调一次 saveData（300ms 防抖虽会合并为一次写，但依赖时序巧合）
    // → 统一累积 dirty 标记，链尾真改动才落 1 次盘；「无改动启动」依旧零写入。
    let migrated = false
    if (data.value) {
      // R128-A2：备份只在「真有一次不可逆合并要发生」时触发——原 `!hubMergedAt` 判据在资源台
      // 被归档（合并不落戳、留待重试）时会每次启动下载一份备份。
      if (!data.value.hubMigratedAt || hubMergeWorkPending(data.value)) {
        try { backupBeforeHubMigration(data.value) } catch { /* 备份失败不阻断迁移 */ }
      }
      const t1 = migrateCurationTree(data.value)
      const t2 = migrateHubStructure(data.value)
      // R64：旧工作台并入资源台（幂等 hubMergedAt；旧台实体删除、树挂同名根分类）
      const t3 = migrateHubMerge(data.value)
      // R126（诉求 7）：标签「父/子」路径归一 + 最多两级（幂等）
      const tz = normalizeCardTagPaths(data.value)
      // R141（反馈 #1）：metric.taskIds 引用消毒（历史软删残留一次清干净，幂等静默）
      const tLinks = sanitizeMetricTaskIds(data.value)
      migrated = t1 || t2 || t3 || tz || tLinks
    }

    // R60：投射至灯塔功能取消——清除存量 vision/mission/project 上的 pinnedToLighthouse 残留字段（幂等，静默）
    if (data.value) {
      const cp = data.value.compass
      if (cp) {
        if (cp.vision && 'pinnedToLighthouse' in cp.vision) { delete (cp.vision as Record<string, unknown>).pinnedToLighthouse; migrated = true }
        if (cp.mission && 'pinnedToLighthouse' in cp.mission) { delete (cp.mission as Record<string, unknown>).pinnedToLighthouse; migrated = true }
        for (const dir of cp.directions || []) {
          for (const p of dir.projects || []) {
            if ('pinnedToLighthouse' in p) { delete (p as Record<string, unknown>).pinnedToLighthouse; migrated = true }
          }
        }
      }
    }

    // V2.20.1 BUG-2 存量回填（幂等，静默）：凡有 metricId 而 projectId 为空的任务，
    // 按指标反查所属项目补齐 projectId（历史版本关联任务时漏写 projectId 的修复）。
    if (data.value) {
      const projOfMetric = new Map<string, string>()
      for (const dir of data.value.compass?.directions || []) {
        for (const p of dir.projects) {
          for (const m of p.metrics) projOfMetric.set(m.id, p.id)
        }
      }
      let fixed = 0
      for (const t of data.value.tasks || []) {
        if (t.metricId && !t.projectId && projOfMetric.has(t.metricId)) {
          t.projectId = projOfMetric.get(t.metricId)
          t.updatedAt = Date.now()
          fixed++
        }
      }
      if (fixed > 0) {
        data.value.projBackfillFixed = fixed
        migrated = true
      }
    }
    if (migrated) saveData()

    // 订阅数据变更（跨页面同步）—— 保持同一引用，不做深拷贝
    subscribe((d) => {
      data.value = d
    })

    // 监听 chrome.storage 变更（popup/content 写入后同步）
    // R128-A1：该接线已下沉到 repository.attachStorageSync（loadData 内自动注册，全上下文共用一份），
    // 本页只保留 subscribe——避免同一份外部写入被两处监听各合并一次（双 saveData 写环）。
    // REQ-031 P-031-6 的语义不变：本页自身写入按内容指纹短路，不触发全树替换。
  }

  // ---- 主题 ----
  function setTheme(t: string) {
    if (!ui.value) return
    ui.value.theme = t
    document.documentElement.setAttribute('data-theme', t)
    saveUIPrefs({ theme: t })
  }

  // ---- 数据持久化 ----
  function persist() {
    if (data.value) saveData()
  }
  /**
   * R148-P0b：只落热度统计（打开次数 / 最近打开 / WRR 段），**不重写整库**。
   * 用在"单击卡片看详情"这类最高频、又只改统计字段的动作上——
   * 走 persist() 会把 medium 档 600KB 主 JSON 重新序列化并写盘一次。
   */
  function persistHot() {
    if (data.value) writeHot(data.value)
  }

  return { data, ui, workspaces, theme, init, setTheme, persist, persistHot }
})
