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

module.exports = { CHROME, resolveChromium, cacheRoot }
