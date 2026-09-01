/**
 * Background Service Worker · V2.0
 *
 * 职责：
 *  1. 监听全局快捷键（chrome.commands.onCommand）
 *  2. 确保 content script 已注入，发消息唤起页内浮层
 *  3. 无法注入的页面（chrome:// 等）降级为独立弹窗窗口
 */

const SESSION_KEY = 'zy_qc_prefill'

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

/** 计算弹窗位置（贴近工具栏图标） */
async function anchorPosition(width: number): Promise<Partial<chrome.windows.CreateData>> {
  try {
    const win = await chrome.windows.getLastFocused()
    if (win && typeof win.left === 'number' && typeof win.width === 'number') {
      return {
        left: Math.round(win.left + win.width - width - 56),
        top: Math.round((typeof win.top === 'number' ? win.top : 0) + 96)
      }
    }
  } catch { /* ignore */ }
  return {}
}

/** 单例打开弹窗窗口 */
async function openPopupWindow(url: string, width = 460, height = 640): Promise<void> {
  const target = chrome.runtime.getURL(url)
  try {
    const base = target.split('?')[0].split('#')[0]
    const tabs = await chrome.tabs.query({ url: base + '*' })
    const hit = tabs?.find((t) => t.url && t.url.split('#')[0] === target)
    if (hit?.windowId != null) {
      const win = await chrome.windows.get(hit.windowId).catch(() => null)
      const patch: chrome.windows.UpdateInfo = { focused: true }
      if (win?.state === 'minimized') patch.state = 'normal'
      await chrome.windows.update(hit.windowId, patch)
      return
    }
  } catch { /* 查询失败退回新建 */ }

  const pos = await anchorPosition(width)
  chrome.windows.create({
    url: target,
    type: 'popup',
    focused: true,
    width,
    height,
    ...pos
  })
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

/** 快捷键监听 */
chrome.commands.onCommand.addListener(async (command) => {
  const tab = await getActiveTab()

  switch (command) {
    case 'open-dashboard': {
      // B10：已有新标签页则聚焦回归（回首页），避免重复开 tab
      const base = chrome.runtime.getURL('src/newtab/index.html')
      const tabs = await chrome.tabs.query({ url: base + '*' })
      const existing = tabs.find(t => t.id != null)
      if (existing?.id != null) {
        if (existing.windowId != null) await chrome.windows.update(existing.windowId, { focused: true }).catch(() => {})
        await chrome.tabs.update(existing.id, { active: true })
        chrome.tabs.sendMessage(existing.id, { type: 'zy-route', route: '/' }).catch(() => {})
      } else {
        chrome.tabs.create({ url: chrome.runtime.getURL('src/newtab/index.html') })
      }
      break
    }
    case 'quick-capture': {
      // 优先：content script 页内浮层（自动注入）
      if (tab?.id) {
        const ok = await notifyTab(tab.id, 'zy-open-capture')
        if (ok) break
      }
      // 降级：chrome:// 等无法注入的页面，用独立弹窗窗口
      if (tab) {
        await chrome.storage.session.set({
          [SESSION_KEY]: { title: tab.title || '', url: tab.url || '', mode: 'capture' }
        })
      }
      openPopupWindow('src/popup/index.html')
      break
    }
    case 'inspire': {
      if (tab?.id) {
        const ok = await notifyTab(tab.id, 'zy-open-curiosity')
        if (ok) break
      }
      if (tab) {
        await chrome.storage.session.set({
          [SESSION_KEY]: { title: tab.title || '', url: tab.url || '', mode: 'curiosity' }
        })
      }
      openPopupWindow('src/popup/index.html?mode=curiosity', 460, 420)
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

/** 扩展图标点击 → 优先 content script 浮层，降级弹窗窗口 */
chrome.action.onClicked.addListener(async () => {
  const tab = await getActiveTab()
  if (tab?.id) {
    const ok = await notifyTab(tab.id, 'zy-open-capture')
    if (ok) return
  }
  if (tab) {
    await chrome.storage.session.set({
      [SESSION_KEY]: { title: tab.title || '', url: tab.url || '', mode: 'capture' }
    })
  }
  openPopupWindow('src/popup/index.html')
})

/**
 * 工作台单例定位（G / B3）：
 * chrome.tabs.query 的 URL 匹配不含 # 锚点，无法直接按 hash 路由查找，
 * 因此查询所有扩展新标签页 → 逐个询问当前路由 →
 *   命中目标工作台 → 激活并转发定位消息（页内跳转+高亮）
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
    handleOpenRoute(route, sender.tab?.id).then(() => sendResponse({ ok: true }))
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
  const target = `/workspace/${wsId}`
  const tabs = await chrome.tabs.query({ url: base + '*' })
  // 1) 找已打开目标工作台的标签页
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
  // 2) 无已开工作台：发送方是新标签页则本页跳转
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
    await chrome.tabs.sendMessage(host.id, { type: 'zy-route', route: `${target}${hl ? `?hl=${encodeURIComponent(hl)}` : ''}` }).catch(() => {})
    return
  }
  chrome.tabs.create({ url: `${base}#${target}${hl ? `?hl=${encodeURIComponent(hl)}` : ''}` })
}

/** 通用路由打开（B4：搜索结果定位任务/好奇心），优先复用已开新标签页 */
async function handleOpenRoute(route: string, senderTabId?: number): Promise<void> {
  const base = await newtabBase()
  const tabs = await chrome.tabs.query({ url: base + '*' })
  const host = tabs.find(t => t.id != null && t.id !== senderTabId) || tabs.find(t => t.id != null)
  if (host?.id != null) {
    if (host.windowId != null) await chrome.windows.update(host.windowId, { focused: true }).catch(() => {})
    await chrome.tabs.update(host.id, { active: true })
    await chrome.tabs.sendMessage(host.id, { type: 'zy-route', route }).catch(() => {})
    return
  }
  if (senderTabId != null) {
    try {
      const senderTab = await chrome.tabs.get(senderTabId)
      if (senderTab.url?.startsWith(base)) {
        await chrome.tabs.sendMessage(senderTabId, { type: 'zy-route', route }).catch(() => {})
        return
      }
    } catch { /* fallthrough */ }
  }
  chrome.tabs.create({ url: `${base}#${route}` })
}

console.log('[知源V2] background service worker started')
