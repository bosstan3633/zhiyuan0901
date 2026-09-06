import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import 'virtual:uno.css'
import '@/shared/styles/tokens.css'
import '@/shared/styles/detail-sheet.css'
import { loadData, loadUIPrefs, replaceData } from '@/shared/storage/repository'
import { migrateV1ToV2 } from '@/shared/storage/migration'
import { STORAGE_KEY } from '@/shared/models'
import { useAppStore } from './stores/app'
// R48-A1：错误留痕必须最先注册——TDZ 崩溃多发于模块初始化期，晚注册接不住
import { installRuntimeErrorCapture } from '@/shared/utils/runtimeError'

installRuntimeErrorCapture()

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
  const t0 = Date.now()
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

  // 每次打开新标签页/刷新，固定回到首页（调度台）；仅保留功能入口页深链（设置/手册，第廿五轮）
  // R50-B3：必须等 router ready（初始 hash 解析完成）再判断——ready 前 currentRoute 恒为 '/'，判断永不生效
  // R51-B5：/compass/tree、/compass/projects 移出白名单——刷新一律回调度台（含方向树/项目详情）；
  //         快捷键驱动的跳转（open-tree 等）发生在启动重定向之后，不受影响
  router.isReady().then(() => {
    const p = router.currentRoute.value.path
    if (p !== '/' && !p.startsWith('/settings') && !p.startsWith('/manual')) {
      router.replace('/')
    }
  })

  // R49-H：刷新动画节奏——总时长硬约束 300–600ms
  // 快加载：补足到 360ms 再切「资源归位 · 调度就绪」→ 220ms 淡出挂载（合计 ≤600ms，第二段定时器做漂移校正）
  // 慢加载：不强制延长——立即切完成态，短淡出后挂载；Esc/单击随时跳过
  const skl = () => document.querySelector('.zy-skl') as HTMLElement | null
  function showDone() {
    const s = skl()
    if (s) s.classList.add('done')
  }
  function skipSplash() {
    const s = skl()
    if (s) s.remove()
    window.removeEventListener('keydown', onSkipKey, true)
    document.removeEventListener('click', onSkipClick, true)
  }
  function onSkipKey(e: KeyboardEvent) { if (e.key === 'Escape') skipSplash() }
  function onSkipClick() { skipSplash() }
  window.addEventListener('keydown', onSkipKey, true)
  document.addEventListener('click', onSkipClick, true)

  const mount = () => {
    ;(window as unknown as { __zySplashMs?: number }).__zySplashMs = Date.now() - t0
    app.mount('#app')
  }
  const elapsed = Date.now() - t0
  if (elapsed < 360) {
    setTimeout(() => {
      showDone()
      const late = Date.now() - t0 - 360
      setTimeout(mount, Math.max(0, 220 - late))
    }, Math.max(0, 360 - elapsed))
  } else {
    // 慢加载：完成态短暂呈现即挂载，不为品牌延长加载
    showDone()
    setTimeout(mount, 160)
  }
}

/** R53-E3：数据加载健壮化——失败重试一次；仍失败则骨架屏转错误横幅且**不挂载**。
 *  绝不以空默认数据兜底挂载：后续任意 persist 会把空数据覆写回 storage，造成真实数据丢失。 */
async function bootDataRobust(): Promise<boolean> {
  try { await ensureBootData(); return true } catch (e1) { console.error('[知源V2] 数据加载异常，重试一次：', e1) }
  await new Promise(r => setTimeout(r, 150))
  try { await ensureBootData(); return true } catch (e2) { console.error('[知源V2] 数据加载两次失败：', e2) }
  const skl = document.querySelector('.zy-skl') as HTMLElement | null
  if (skl) skl.innerHTML = '<div style="padding:48px 32px;text-align:center;color:var(--danger,#F85149);font-size:14px;line-height:2">⚠ 数据加载异常，应用未启动以保护本地数据。<br>请关闭此标签页后重新打开；若反复出现，请勿导入/清空数据，并通过 设置 → 仪表盘 → 错误日志 反馈。</div>'
  return false
}

async function bootstrapSafe() {
  if (await bootDataRobust()) await bootstrap()
}

bootstrapSafe().catch(e => console.error('[知源V2] 启动失败：', e))
