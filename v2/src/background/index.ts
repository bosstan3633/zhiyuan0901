/**
 * Background Service Worker · V2.0
 *
 * 职责：
 *  1. 监听全局快捷键（chrome.commands.onCommand）
 *  2. 确保 content script 已注入，发消息唤起页内浮层
 *  3. 无法注入的页面（chrome:// 等）降级为「进应用开对应面板」
 */
import { K } from '@/shared/storage/keys'
import { resourceLocateRoute } from '@/shared/utils/locate'


/** 获取 content script 文件路径（从 manifest 动态读取，兼容构建 hash） */
function getContentScriptFiles(): string[] {
  try {
    const manifest = chrome.runtime.getManifest()
    const cs = manifest.content_scripts?.[0]
    if (cs?.js?.length) return cs.js
  } catch { /* ignore */ }
  return []
}

/** 确保 content script 已注入到目标标签页 */
async function ensureContentScript(tabId: number): Promise<boolean> {
  // 先尝试发消息，如果 content script 已在，直接成功
  try {
    await chrome.tabs.sendMessage(tabId, { type: 'zy-ping' })
    return true
  } catch {
    // content script 未注入，尝试手动注入
  }
  try {
    const files = getContentScriptFiles()
    if (!files.length) return false
    await chrome.scripting.executeScript({
      target: { tabId },
      files
    })
    // 注入后等待一小段时间让脚本初始化
    await new Promise(r => setTimeout(r, 100))
    return true
  } catch {
    return false
  }
}

/** 向标签页发送消息触发浮层（确保 content script 已注入） */
async function notifyTab(tabId: number, type: string): Promise<boolean> {
  const injected = await ensureContentScript(tabId)
  if (!injected) return false
  try {
    await chrome.tabs.sendMessage(tabId, { type })
    return true
  } catch {
    return false
  }
}

/**
 * R4-Fb（#117 拍板「撤降级路径」）：不可注入页的降级出口 = **进应用开对应面板**。
 * 原降级独立弹窗 `src/popup/index.html` **从未进过构建**（dist 里它仍引 ./main.ts、
 * manifest 的 action 没有 default_popup）⇒ 在 chrome:// / 扩展页 / Web Store 按快捷键只得到一个空白窗口。
 * 应用内那三块面板本来就是同一件事的正路，且采集/好奇面板会自己从最近的网页标签取标题与链接
 * （GlobalPopups 的 getRecentWebTab），所以这里不需要 prefill 通道。
 */
async function openQuickPanel(panel: 'capture' | 'curio' | 'taskcapture'): Promise<void> {
  const base = chrome.runtime.getURL('src/newtab/index.html')
  try {
    const tabs = await chrome.tabs.query({ url: base + '*' })
    const hit = tabs.find(t => t.id != null)
    if (hit?.id != null) {
      if (hit.windowId != null) await chrome.windows.update(hit.windowId, { focused: true }).catch(() => {})
      await chrome.tabs.update(hit.id, { active: true })
      await chrome.tabs.sendMessage(hit.id, { type: 'zy-quick-panel', panel }).catch(() => {})
      return
    }
  } catch { /* 查询失败退回新建 */ }
  chrome.tabs.create({ url: `${base}?zy-panel=${panel}#/` })
}

/** 获取当前标签页信息 */
async function getActiveTab(): Promise<chrome.tabs.Tab | null> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  return tab || null
}

/** 判断是否为知源新标签页 */
function isNewtabTab(tab: chrome.tabs.Tab | null): boolean {
  if (!tab?.url) return false
  return tab.url.startsWith(chrome.runtime.getURL('src/newtab/index.html'))
}

/** 复用已打开的新标签页；每次都用路由消息，确保 KeepAlive 页面也会重新响应。 */
async function openNewtabRoute(route: string): Promise<void> {
  const base = chrome.runtime.getURL('src/newtab/index.html')
  const tabs = await chrome.tabs.query({ url: base + '*' })
  const active = await getActiveTab()
  const existing = tabs.find(t => t.id != null && t.windowId === active?.windowId) || tabs.find(t => t.id != null)
  if (existing?.id != null) {
    if (existing.windowId != null) await chrome.windows.update(existing.windowId, { focused: true }).catch(() => {})
    await chrome.tabs.update(existing.id, { active: true })
    const sent = await chrome.tabs.sendMessage(existing.id, { type: 'zy-route', route })
      .then(() => true).catch(() => false)
    if (!sent) await chrome.tabs.update(existing.id, { url: `${base}#${route}` })
    return
  }
  await chrome.tabs.create({ url: `${base}#${route}` })
}

/** 快捷键监听 */
chrome.commands.onCommand.addListener(async (command) => {
  const tab = await getActiveTab()

  switch (command) {
    case 'open-dashboard': {
      // B10：已有新标签页则聚焦回归（回首页），避免重复开 tab
      await openNewtabRoute('/')
      break
    }
    case 'open-settings': {
      // 第卅五轮 REQ-037：一键直达全局设置（复用 open-dashboard 聚焦模式，路由指向 /settings）
      await openNewtabRoute('/settings')
      break
    }
    // R68-F3：「打开方向台」「打开资源台」两命令退役（open-compass/open-resource 已从 manifest 下架）——改由应用内 Alt+数字（台签顺序）切台，见 App.vue switchToIndex
    case 'open-resource': {
      // R50-F3 启用 + R61 资源台转正 + R65-F6：命令口径改「打开资源台」（/curation 即资源台路由）
      // R68-F3：本 case 保留兜底（历史已分配键位不失效），但 manifest 已下架不再出现在快捷键设置页
      await openNewtabRoute('/curation')
      break
    }
    case 'open-tree': {
      // V4.0.4：保留历史命令 ID，落点改为资源卡池默认最新列表。
      await openNewtabRoute(`/deck/resource?fresh=1&freshAt=${Date.now()}`)
      break
    }
    case 'goto-curiosity': {
      await openNewtabRoute(`/deck/curiosity?fresh=1&freshAt=${Date.now()}`)
      break
    }
    case 'goto-tasks': {
      await openNewtabRoute(`/deck/task?fresh=1&freshAt=${Date.now()}`)
      break
    }
    case 'open-cloud-sync': {
      await openNewtabRoute('/settings?page=cloud')
      break
    }
    case 'open-compass-curation': {
      await openNewtabRoute('/compass/curation?layout=pyramid')
      break
    }
    case 'open-tasks': {
      // R55-C：快速采集任务（浏览器级命令，无默认键）——优先页内浮层；不可注入页降级进应用开面板（R4-Fb）
      if (tab?.id) {
        const ok = await notifyTab(tab.id, 'zy-open-task-capture')
        if (ok) break
      }
      await openQuickPanel('taskcapture')
      break
    }
    case 'quick-capture': {
      // 优先：content script 页内浮层（自动注入）
      if (tab?.id) {
        const ok = await notifyTab(tab.id, 'zy-open-capture')
        if (ok) break
      }
      // 降级：chrome:// 等无法注入的页面 → 进应用开「采集」面板（R4-Fb 撤掉那个从未进过构建的独立弹窗）
      await openQuickPanel('capture')
      break
    }
    case 'inspire': {
      if (tab?.id) {
        const ok = await notifyTab(tab.id, 'zy-open-curiosity')
        if (ok) break
      }
      await openQuickPanel('curio')
      break
    }
    case 'search': {
      if (tab?.id) {
        const ok = await notifyTab(tab.id, 'zy-open-search')
        if (ok) break
      }
      // 降级：无法注入 content script 的页面，打开新标签页
      chrome.tabs.create({ url: chrome.runtime.getURL('src/newtab/index.html#/compass') })
      break
    }
  }
})



/** 扩展图标点击 → 优先 content script 浮层；不可注入页降级进应用开「采集」面板（R4-Fb） */
chrome.action.onClicked.addListener(async () => {
  const tab = await getActiveTab()
  if (tab?.id) {
    const ok = await notifyTab(tab.id, 'zy-open-capture')
    if (ok) return
  }
  await openQuickPanel('capture')
})

/**
 * 策展台单例定位（G / B3）：
 * chrome.tabs.query 的 URL 匹配不含 # 锚点，无法直接按 hash 路由查找，
 * 因此查询所有扩展新标签页 → 逐个询问当前路由 →
 *   命中目标策展台 → 激活并转发定位消息（页内跳转+高亮）
 *   未命中 → 发送方是新标签页则本页跳转；否则新建
 */
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.type === 'zy-locate-workspace') {
    const wsId: string = msg.wsId || ''
    const hl: string = msg.hl || ''
    handleLocate(wsId, hl, sender.tab?.id).then(() => sendResponse({ ok: true }))
    return true
  }
  if (msg?.type === 'zy-open-route') {
    const route: string = msg.route || '/'
    const drawer: { kind: string; id: string } | undefined = msg.drawer
    handleOpenRoute(route, sender.tab?.id, drawer).then(() => sendResponse({ ok: true }))
    return true
  }
})

async function newtabBase(): Promise<string> {
  return chrome.runtime.getURL('src/newtab/index.html')
}

/** 询问某个新标签页当前路由（超时容错） */
function askRoute(tabId: number, timeout = 600): Promise<string | null> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), timeout)
    try {
      chrome.tabs.sendMessage(tabId, { type: 'zy-where' }, (res) => {
        clearTimeout(timer)
        resolve(chrome.runtime.lastError ? null : (res?.path ?? null))
      })
    } catch { clearTimeout(timer); resolve(null) }
  })
}

async function handleLocate(wsId: string, hl: string, senderTabId?: number): Promise<void> {
  if (!wsId) return
  const base = await newtabBase()
  /* ★R4-E：落点由 resourceLocateRoute 一处算——隐藏池（zy-curation）不是 workspace 实体，
     拼成 /workspace/zy-curation 自 R179 起恒落「策展台不存在」死页（采集后按 Enter 即此路径）。
     与 App.vue 的 zy-locate 消费端同一个判据，不再两边各写一次字符串拼接。 */
  const route = resourceLocateRoute(wsId)
  const target = route.path
  const hashQuery = `?${new URLSearchParams(hl ? { hl, ...route.query } : route.query).toString()}`
  const tabs = await chrome.tabs.query({ url: base + '*' })
  // 1) 找已打开目标策展台的标签页
  // REQ-031 P-031-7：并行询问所有标签页（150ms 短超时），取首个命中——N 个标签页不再串行 N×600ms
  if (tabs.length) {
    const hits = await Promise.all(tabs.map(async (tab) => {
      if (tab.id == null) return null
      const path = await askRoute(tab.id, 150)
      return path === target ? tab : null
    }))
    const hit = hits.find((t) => t !== null)
    if (hit) {
      if (hit.windowId != null) await chrome.windows.update(hit.windowId, { focused: true }).catch(() => {})
      await chrome.tabs.update(hit.id!, { active: true })
      await chrome.tabs.sendMessage(hit.id!, { type: 'zy-locate', wsId, hl }).catch(() => {})
      return
    }
  }
  // 2) 无已开策展台：发送方是新标签页则本页跳转
  if (senderTabId != null) {
    try {
      const senderTab = await chrome.tabs.get(senderTabId)
      if (senderTab.url?.startsWith(base)) {
        await chrome.tabs.sendMessage(senderTabId, { type: 'zy-locate', wsId, hl }).catch(() => {})
        return
      }
    } catch { /* fallthrough */ }
  }
  // 3) 任一已开新标签页作为宿主跳转；完全没有才新建
  const host = tabs.find(t => t.id != null)
  if (host?.id != null) {
    if (host.windowId != null) await chrome.windows.update(host.windowId, { focused: true }).catch(() => {})
    await chrome.tabs.update(host.id, { active: true })
    await chrome.tabs.sendMessage(host.id, { type: 'zy-route', route: `${target}${hashQuery}` }).catch(() => {})
    return
  }
  chrome.tabs.create({ url: `${base}#${target}${hashQuery}` })
}

/** 通用路由打开（B4：搜索结果定位任务/好奇心），优先复用已开新标签页；可选透传 drawer（打开详情抽屉） */
async function handleOpenRoute(route: string, senderTabId?: number, drawer?: { kind: string; id: string }): Promise<void> {
  const base = await newtabBase()
  const tabs = await chrome.tabs.query({ url: base + '*' })
  const host = tabs.find(t => t.id != null && t.id !== senderTabId) || tabs.find(t => t.id != null)
  if (host?.id != null) {
    if (host.windowId != null) await chrome.windows.update(host.windowId, { focused: true }).catch(() => {})
    await chrome.tabs.update(host.id, { active: true })
    await chrome.tabs.sendMessage(host.id, { type: 'zy-route', route, ...(drawer ? { drawer } : {}) }).catch(() => {})
    return
  }
  if (senderTabId != null) {
    try {
      const senderTab = await chrome.tabs.get(senderTabId)
      if (senderTab.url?.startsWith(base)) {
        await chrome.tabs.sendMessage(senderTabId, { type: 'zy-route', route, ...(drawer ? { drawer } : {}) }).catch(() => {})
        return
      }
    } catch { /* fallthrough */ }
  }
  chrome.tabs.create({ url: `${base}#${route}` })
}

console.log('[知源V2] background service worker started')
