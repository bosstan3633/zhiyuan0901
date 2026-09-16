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
      const existing = tabs.find(t => t.id != null && t.windowId === tab?.windowId) || tabs.find(t => t.id != null)
      if (existing?.id != null) {
        if (existing.windowId != null) await chrome.windows.update(existing.windowId, { focused: true }).catch(() => {})
        await chrome.tabs.update(existing.id, { active: true })
        chrome.tabs.sendMessage(existing.id, { type: 'zy-route', route: '/' }).catch(() => {})
      } else {
        chrome.tabs.create({ url: chrome.runtime.getURL('src/newtab/index.html') })
      }
      break
    }
    case 'open-settings': {
      // 第卅五轮 REQ-037：一键直达全局设置（复用 open-dashboard 聚焦模式，路由指向 /settings）
      const base = chrome.runtime.getURL('src/newtab/index.html')
      const tabs = await chrome.tabs.query({ url: base + '*' })
      const existing = tabs.find(t => t.id != null && t.windowId === tab?.windowId) || tabs.find(t => t.id != null)
      if (existing?.id != null) {
        if (existing.windowId != null) await chrome.windows.update(existing.windowId, { focused: true }).catch(() => {})
        await chrome.tabs.update(existing.id, { active: true })
        chrome.tabs.sendMessage(existing.id, { type: 'zy-route', route: '/settings' }).catch(() => {})
      } else {
        chrome.tabs.create({ url: chrome.runtime.getURL('src/newtab/index.html#/settings') })
      }
      break
    }
    // R68-F3：「打开方向台」「打开资源台」两命令退役（open-compass/open-resource 已从 manifest 下架）——改由应用内 Alt+数字（台签顺序）切台，见 App.vue switchToIndex
    case 'open-resource': {
      // R50-F3 启用 + R61 资源台转正 + R65-F6：命令口径改「打开资源台」（/curation 即资源台路由）
      // R68-F3：本 case 保留兜底（历史已分配键位不失效），但 manifest 已下架不再出现在快捷键设置页
      const base = chrome.runtime.getURL('src/newtab/index.html')
      const tabs = await chrome.tabs.query({ url: base + '*' })
      const existing = tabs.find(t => t.id != null && t.windowId === tab?.windowId) || tabs.find(t => t.id != null)
      if (existing?.id != null) {
        if (existing.windowId != null) await chrome.windows.update(existing.windowId, { focused: true }).catch(() => {})
        await chrome.tabs.update(existing.id, { active: true })
        chrome.tabs.sendMessage(existing.id, { type: 'zy-route', route: '/curation' }).catch(() => {})
      } else {
        chrome.tabs.create({ url: chrome.runtime.getURL('src/newtab/index.html#/curation') })
      }
      break
    }
    case 'open-tree': {
      // R50-F8：完整方向树浏览器级命令（chrome://extensions/shortcuts 自定义键位）
      const base = chrome.runtime.getURL('src/newtab/index.html')
      const tabs = await chrome.tabs.query({ url: base + '*' })
      const existing = tabs.find(t => t.id != null && t.windowId === tab?.windowId) || tabs.find(t => t.id != null)
      if (existing?.id != null) {
        if (existing.windowId != null) await chrome.windows.update(existing.windowId, { focused: true }).catch(() => {})
        await chrome.tabs.update(existing.id, { active: true })
        chrome.tabs.sendMessage(existing.id, { type: 'zy-route', route: '/compass/tree' }).catch(() => {})
      } else {
        chrome.tabs.create({ url: chrome.runtime.getURL('src/newtab/index.html#/compass/tree') })
      }
      break
    }
    case 'goto-curiosity':
    case 'goto-tasks': {
      // R68-F3：直达「任务调度」/「好奇心培育」模块
      // R117（04-61 C1）：任务调度面板由方向台迁入**调度台底部 tab**（与好奇心培育并列），
      // 两命令因此同落调度台（/），靠 anchor 切到对应 tab；不再指向 /compass。
      const anchor = command === 'goto-curiosity' ? 'curiosity' : 'task'
      const route = '/'
      const hash = '#/'
      const base = chrome.runtime.getURL('src/newtab/index.html')
      const tabs = await chrome.tabs.query({ url: base + '*' })
      const existing = tabs.find(t => t.id != null && t.windowId === tab?.windowId) || tabs.find(t => t.id != null)
      if (existing?.id != null) {
        if (existing.windowId != null) await chrome.windows.update(existing.windowId, { focused: true }).catch(() => {})
        await chrome.tabs.update(existing.id, { active: true })
        chrome.tabs.sendMessage(existing.id, { type: 'zy-route', route, anchor }).catch(() => {})
      } else {
        chrome.tabs.create({ url: chrome.runtime.getURL('src/newtab/index.html?zy-anchor=' + anchor + hash) })
      }
      break
    }
    case 'open-tasks': {
      // R55-C：快速采集任务（浏览器级命令，无默认键）——优先页内浮层（含新标签页应用内面板），降级独立弹窗
      if (tab?.id) {
        const ok = await notifyTab(tab.id, 'zy-open-task-capture')
        if (ok) break
      }
      if (tab) {
        await chrome.storage.session.set({
          [SESSION_KEY]: { title: '', url: tab.url || '', mode: 'task' }
        })
      }
      openPopupWindow('src/popup/index.html?mode=task', 460, 480)
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
    case 'sync-airtable': {
      // R63-8：Airtable 手动同步（无默认键，chrome://extensions/shortcuts 自定义）。
      // background 不写主数据（整根 JSON 跨上下文覆盖风险）——交给已开新标签页执行；
      // 没有就开一个带 zy-autosync 标记的新标签页，App 挂载后自动执行。
      await triggerAirtableSync(false)
      break
    }
  }
})

/** R63-10：触发新标签页执行 Airtable 同步（无页则开新页带自动同步标记） */
async function triggerAirtableSync(silent: boolean): Promise<void> {
  const base = chrome.runtime.getURL('src/newtab/index.html')
  const tabs = await chrome.tabs.query({ url: base + '*' })
  const host = tabs.find(t => t.id != null)
  if (host?.id != null) {
    try {
      await chrome.tabs.sendMessage(host.id, { type: 'zy-airtable-sync', silent })
      return
    } catch { /* 页面未就绪，落入开新页 */ }
  }
  chrome.tabs.create({ url: `${base}?zy-autosync=${silent ? '1' : 'toast'}` })
}

/** R63-10：3 小时轮询——SW 每次唤醒按开关对齐 alarm（开关默认关） */
const AT_POLL_ALARM = 'airtable-poll'
async function alignAirtableAlarm(): Promise<void> {
  try {
    const data = await chrome.storage.local.get('zy_data_v2')
    const enabled = !!(data['zy_data_v2'] as { airtableSync?: { pollEnabled?: boolean; pat?: string; baseId?: string; tableId?: string } } | undefined)?.airtableSync?.pollEnabled
    const alarm = await chrome.alarms.get(AT_POLL_ALARM)
    if (enabled && !alarm) {
      chrome.alarms.create(AT_POLL_ALARM, { periodInMinutes: 180 })
    } else if (!enabled && alarm) {
      chrome.alarms.clear(AT_POLL_ALARM)
    }
  } catch { /* 存储未就绪忽略，下次唤醒再对齐 */ }
}
alignAirtableAlarm()
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name !== AT_POLL_ALARM) return
  // 轮询静默执行：无已开新标签页则跳过本轮（不为此打开页面打扰用户）
  ;(async () => {
    const base = chrome.runtime.getURL('src/newtab/index.html')
    const tabs = await chrome.tabs.query({ url: base + '*' })
    const host = tabs.find(t => t.id != null)
    if (host?.id != null) {
      chrome.tabs.sendMessage(host.id, { type: 'zy-airtable-sync', silent: true }).catch(() => {})
    } else {
      console.log('[知源V2] Airtable 轮询跳过：无已开新标签页')
    }
  })()
})
// 开关变化即时对齐 alarm（设置页 toggle 后无需等 SW 唤醒）
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && (changes as Record<string, chrome.storage.StorageChange>)['zy_data_v2']) {
    alignAirtableAlarm()
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
  const target = `/workspace/${wsId}`
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
    await chrome.tabs.sendMessage(host.id, { type: 'zy-route', route: `${target}${hl ? `?hl=${encodeURIComponent(hl)}` : ''}` }).catch(() => {})
    return
  }
  chrome.tabs.create({ url: `${base}#${target}${hl ? `?hl=${encodeURIComponent(hl)}` : ''}` })
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
