import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { AppData, Workspace, UIPrefs } from '@/shared/models'
import { CURATION_WS_ID } from '@/shared/models'
import { getData, saveData, loadUIPrefs, saveUIPrefs, subscribe, syncCache, mergeExternalData, isSelfWrite } from '@/shared/storage/repository'
import { migrateCurationTree, migrateHubStructure, migrateHubMerge } from '@/shared/storage/curationMigration'

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
    if (data.value) {
      if (!data.value.hubMigratedAt || !data.value.hubMergedAt) {
        try { backupBeforeHubMigration(data.value) } catch { /* 备份失败不阻断迁移 */ }
      }
      const t1 = migrateCurationTree(data.value)
      const t2 = migrateHubStructure(data.value)
      // R64：旧工作台并入资源台（幂等 hubMergedAt；旧台实体删除、树挂同名根分类）
      const t3 = migrateHubMerge(data.value)
      if (t1 || t2 || t3) saveData()
    }

    // R60：投射至灯塔功能取消——清除存量 vision/mission/project 上的 pinnedToLighthouse 残留字段（幂等，静默）
    if (data.value) {
      let cleaned = false
      const cp = data.value.compass
      if (cp) {
        if (cp.vision && 'pinnedToLighthouse' in cp.vision) { delete (cp.vision as Record<string, unknown>).pinnedToLighthouse; cleaned = true }
        if (cp.mission && 'pinnedToLighthouse' in cp.mission) { delete (cp.mission as Record<string, unknown>).pinnedToLighthouse; cleaned = true }
        for (const dir of cp.directions || []) {
          for (const p of dir.projects || []) {
            if ('pinnedToLighthouse' in p) { delete (p as Record<string, unknown>).pinnedToLighthouse; cleaned = true }
          }
        }
      }
      if (cleaned) saveData()
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
        saveData()
      }
    }

    // 订阅数据变更（跨页面同步）—— 保持同一引用，不做深拷贝
    subscribe((d) => {
      data.value = d
    })

    // 监听 chrome.storage 变更（popup/content 写入后同步）
    // REQ-031 P-031-6：本页自身写入（saveData/saveDataNow 前置 selfWrite 标记）跳过全树替换，
    // 避免每次保存都触发 storage 读回 → syncCache + data 全树替换 → 全部 computed 失效重算。
    // 本地 listener（subscribe）已同步新引用，无需重复替换；外部写入（popup/content）仍正常全量同步。
    if (typeof chrome !== 'undefined' && chrome.storage) {
      chrome.storage.onChanged.addListener((changes, area) => {
        if (area === 'local' && changes.zy_data_v2) {
          const newData = changes.zy_data_v2.newValue as AppData
          if (!newData) return
          if (isSelfWrite(newData)) return  // R70：内容指纹比对（原为恒 false 的时间戳比较，守卫从未生效）
          // R58-B2：本页有未落盘修改时做卡片级 LWW 合并（防跨标签页/浮层并发写静默丢改），否则整树替换
          data.value = mergeExternalData(newData)
        }
      })
    }
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

  return { data, ui, workspaces, theme, init, setTheme, persist }
})
