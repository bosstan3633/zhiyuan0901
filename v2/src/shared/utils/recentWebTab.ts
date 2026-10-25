/** R55-C：快速采集任务 + 好奇心采集（chrome.tabs 侧「最近网页标签」的唯一实现）。
 *  ★V3.9.20 自 GlobalPopups.vue 抽出（拆分 Stage 1）：采集预填与好奇来源捕获共用一份，
 *  此前是 GlobalPopups 的私有函数——两个面板拆家后升为共享工具，实现一字未改。 */
export async function getRecentWebTab(): Promise<chrome.tabs.Tab | null> {
  try {
    const [active] = await chrome.tabs.query({ active: true, currentWindow: true })
    if (active?.url && /^https?:\/\//.test(active.url)) return active
    const tabs = await chrome.tabs.query({ url: ['http://*/*', 'https://*/*'] })
    if (!tabs.length) return null
    return [...tabs].sort((a, b) => (b.lastAccessed || 0) - (a.lastAccessed || 0))[0] || tabs[0]
  } catch { return null }
}
