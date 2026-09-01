import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import 'virtual:uno.css'
import '@/shared/styles/tokens.css'
import { loadData, loadUIPrefs, replaceData } from '@/shared/storage/repository'
import { migrateV1ToV2 } from '@/shared/storage/migration'
import { STORAGE_KEY } from '@/shared/models'
import { useAppStore } from './stores/app'

/** B34：数据预启动——V2 数据已存在时跳过 V1 迁移检测（老用户每次开新标签页省一次 IO） */
async function ensureBootData(): Promise<void> {
  const cs = typeof chrome !== 'undefined' ? chrome.storage?.local : null
  if (!cs) { await loadData(); return }
  const r = await cs.get([STORAGE_KEY, 'lm_data_v5'])
  const v1 = r['lm_data_v5'] as { links?: unknown } | undefined
  if (!r[STORAGE_KEY] && v1 && Array.isArray(v1.links)) {
    console.log('[知源V2] 检测到V1数据，开始迁移...')
    const migrated = await migrateV1ToV2()
    await replaceData(migrated)
    console.log('[知源V2] V1数据迁移完成')
    return
  }
  await loadData()
}

async function bootstrap() {
  const app = createApp(App)
  app.use(createPinia())
  app.use(router)

  // B34：UI 偏好与数据并行加载（原为串行 3 次存储往返）
  const [ui] = await Promise.all([loadUIPrefs(), ensureBootData()])
  document.documentElement.setAttribute('data-theme', ui.theme)
  // 第卅三轮 REQ-026：密度档位初始化（compact 时挂 html 属性，tokens.css 变量覆盖）
  if (ui.density === 'compact') document.documentElement.setAttribute('data-density', 'compact')

  // 初始化 store
  const store = useAppStore()
  store.init()

  // 每次打开新标签页/刷新，固定回到首页；但保留深链（手册/设置等，第廿五轮）
  const p = router.currentRoute.value.path
  if (p !== '/' && !p.startsWith('/settings') && !p.startsWith('/manual')) {
    router.replace('/')
  }

  app.mount('#app')
}

bootstrap()
