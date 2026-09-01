import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { AppData, Workspace, UIPrefs } from '@/shared/models'
import { getData, saveData, loadUIPrefs, saveUIPrefs, subscribe, syncCache, isSelfWrite } from '@/shared/storage/repository'

export const useAppStore = defineStore('app', () => {
  // ---- 数据 ----
  const data = ref<AppData | null>(null)
  const ui = ref<UIPrefs | null>(null)

  // ---- 计算属性 ----
  const workspaces = computed<Workspace[]>(() =>
    data.value?.workspaces.filter((w) => !w.archived).sort((a, b) => a.order - b.order) || []
  )
  const theme = computed(() => ui.value?.theme || 'green')

  // ---- 初始化 ----
  async function init() {
    data.value = getData()
    ui.value = await loadUIPrefs()

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
          if (isSelfWrite(Date.now())) return
          syncCache(newData)
          data.value = newData
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
