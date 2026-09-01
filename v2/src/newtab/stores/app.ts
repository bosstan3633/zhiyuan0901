import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { AppData, Workspace, UIPrefs } from '@/shared/models'
import { getData, saveData, loadUIPrefs, saveUIPrefs, subscribe, syncCache } from '@/shared/storage/repository'

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
    if (typeof chrome !== 'undefined' && chrome.storage) {
      chrome.storage.onChanged.addListener((changes, area) => {
        if (area === 'local' && changes.zy_data_v2) {
          const newData = changes.zy_data_v2.newValue as AppData
          if (newData) {
            syncCache(newData)
            data.value = newData
          }
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
