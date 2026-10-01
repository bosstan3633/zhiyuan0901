/**
 * R4-Ea（挂账 #84）：浏览器可执行文件解析的唯一实现。
 *
 * 为什么要有它：四级回落此前在 7 个门禁脚本里各抄一份（e2e / perf / perf-census / probe-f /
 * theme-audit / test-import-compat / img-diff），抄出来的结果并不一致——
 * ★实测 `img-diff.cjs` 只写死了 `chromium-1234` 这一条路径，Playwright 缓存换版本后它直接起不来
 * （`executable doesn't exist at …/chromium-1234/…`），而它是 R161 用来回答"这次到底改了像素没有"的工具，
 * 坏掉却没有任何门禁会红（它是手动工具，不在回归链里）。缓存目录扫描也只在 mac 分支写过，Windows 上等于没有第三级。
 *
 * 四级回落（顺序即优先级）：
 *   1. 钉死的版本（pinned）——存在就用，保证与 Playwright 期望版本一致；
 *   2. `ZY_CHROME` 环境变量——显式指定优先于任何自动猜测；
 *   3. 本机任一 `ms-playwright/chromium-*` ——**优先于系统 Chrome**：系统 Chrome 的旧 headless
 *      起不了 MV3 service worker，E2E-1 会直接超时，门禁不该靠"记不记得设环境变量"（R128/R149 教训）；
 *   4. 系统 Chrome；都没有则回 pinned，让报错里出现那个"本该存在"的路径，比报一个含糊的解析失败好诊断。
 *
 * 用法：`const { CHROME } = require('./browser.cjs')`
 */
const fs = require('fs')
const path = require('path')

const IS_MAC = process.platform === 'darwin'
const IS_WIN = process.platform === 'win32'

/** 与 playwright-core 期望版本对齐的钉死路径（版本升级时改这里一处） */
const PIN_VERSIONS_MAC = ['chromium-1234', 'chromium-1223']
const PIN_VERSIONS_WIN = ['chromium-1223', 'chromium-1211']

function cacheRoot() {
  if (IS_WIN) return path.join(process.env.LOCALAPPDATA || '', 'ms-playwright')
  return path.join(process.env.HOME || '', 'Library', 'Caches', 'ms-playwright')
}
function pinnedCandidates() {
  const vers = IS_WIN ? PIN_VERSIONS_WIN : PIN_VERSIONS_MAC
  if (IS_WIN) return vers.map(v => path.join(cacheRoot(), v, 'chrome-win64', 'chrome.exe'))
  if (IS_MAC) {
    return vers.flatMap(v => [
      path.join(cacheRoot(), v, 'chrome-mac-arm64', 'Google Chrome for Testing.app', 'Contents', 'MacOS', 'Google Chrome for Testing'),
      path.join(cacheRoot(), v, 'chrome-mac', 'Chromium.app', 'Contents', 'MacOS', 'Chromium')
    ])
  }
  return vers.map(v => path.join(cacheRoot(), v, 'chrome-linux', 'chrome'))
}
/** 本机任意一个 ms-playwright Chromium（取版本号最大的） */
function anyCachedChromium() {
  const root = cacheRoot()
  let dirs = []
  try { dirs = fs.readdirSync(root).filter(x => /^chromium(-headless-shell)?-\d+$/.test(x)).sort() } catch { return '' }
  for (const d of dirs.reverse()) {
    const cands = IS_WIN
      ? [path.join(root, d, 'chrome-win64', 'chrome.exe')]
      : IS_MAC
        ? [path.join(root, d, 'chrome-mac', 'Chromium.app', 'Contents', 'MacOS', 'Chromium'),
           path.join(root, d, 'chrome-mac-arm64', 'Google Chrome for Testing.app', 'Contents', 'MacOS', 'Google Chrome for Testing')]
        : [path.join(root, d, 'chrome-linux', 'chrome')]
    for (const p of cands) if (fs.existsSync(p)) return p
  }
  return ''
}
function systemChrome() {
  if (IS_MAC) return '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
  if (IS_WIN) return path.join(process.env['PROGRAMFILES'] || 'C:\\Program Files', 'Google', 'Chrome', 'Application', 'chrome.exe')
  return '/usr/bin/google-chrome'
}

function resolveChromium() {
  for (const p of pinnedCandidates()) if (fs.existsSync(p)) return p
  if (process.env.ZY_CHROME) return process.env.ZY_CHROME
  const cached = anyCachedChromium()
  if (cached) return cached
  const sys = systemChrome()
  if (fs.existsSync(sys)) return sys
  return pinnedCandidates()[0] || sys
}

const CHROME = resolveChromium()

/**
 * R4-Pa：等 MV3 service worker 的 `chrome.*` 注入就绪，再允许脚本对它求值。
 *
 * 为什么要有它：perf.cjs 拿 worker 后的**第一次** evaluate 就是读 manifest.version，本机现在稳定抛
 * `TypeError: Cannot read properties of undefined (reading 'getManifest')`——`serviceworker` 事件在目标
 * 挂上时就发，扩展的 chrome.runtime 绑定还要晚一拍才进上下文（实测立即失败、1 秒后同一条 evaluate 返回 "3.7.1"）。
 * perf 是 R148「先立尺子再动手」里检索瘦身的验收尺子（M5/R7），它起不来等于这一轮没有基线可读；
 * 而它坏在门禁链之外（perf 手动跑），没有任何一条断言会红——和 Ea 修 img-diff 是同一种烂法。
 *
 * @param worker Playwright 的 Worker 句柄
 * @param {{tries?: number, gap?: number}} opt 默认 12×250ms＝最多等 3 秒
 * @returns 就绪时的自检结果（含 version）；超时抛错并把 worker.url() 写进消息，便于诊断"等的是哪个 SW"
 */
async function swReady(worker, opt = {}) {
  const tries = opt.tries || 12
  const gap = opt.gap || 250
  let last = null
  for (let i = 0; i < tries; i++) {
    try {
      const info = await worker.evaluate(() => ({
        ready: !!(chrome && chrome.runtime && typeof chrome.runtime.getManifest === 'function'),
        version: (chrome && chrome.runtime && chrome.runtime.getManifest) ? chrome.runtime.getManifest().version : ''
      }))
      if (info && info.ready) return info
      last = 'chrome.runtime 未注入'
    } catch (e) { last = e instanceof Error ? e.message : String(e) }
    await new Promise(r => setTimeout(r, gap))
  }
  throw new Error(`service worker 未就绪（等 ${tries * gap}ms）：${worker.url()} —— ${last}`)
}

module.exports = { CHROME, resolveChromium, cacheRoot, swReady }
