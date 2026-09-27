#!/usr/bin/env node
/**
 * 主题对比度门禁 · theme-contrast（R156 新建）
 *
 * 为什么有它：R156「accent 解禁」把四主题从「同一个 #5E6AD2」变成「四套独立强调色」，
 *   而 accent 在本产品**同时承担三种角色**——① 主按钮底色（配硬编码白字）② 当前态文字色
 *   ③ 焦点环/选中底。角色一决定了 accent 的**相对亮度上限**（白字要 ≥4.5:1 ⇒ L ≤ 0.183），
 *   角色二决定了下限（不能太暗）。这是"手调色值"最容易踩空的地方，必须机器判定。
 *
 * 做什么：解析 `src/shared/styles/tokens.css` 的四个主题块，按 WCAG 2.1 计算并校验：
 *   - --text / --bg ≥ 4.5 · --text / --surface ≥ 4.5 · --text-2 / --bg ≥ 4.5
 *   - --text-3 / --bg ≥ 3 · --text-3 / --surface-3 ≥ 3（最苛刻的深层底）
 *   - #fff / --accent ≥ 4.5（主按钮：全站 `background: var(--accent); color: #fff` 十余处）
 *   - --accent / --bg ≥ 3 · --accent-hover / --bg ≥ 3（当前态文字/焦点环）
 *   - --accent-ink / --accent-light ≥ 4.5（R171-C4：淡底深字组合——选中 tab/徽标/确认弹窗图标等
 *     「彩字压彩底」场景统一走 --accent-ink；此前 accent 本档在暗主题仅 3.28/3.40，属信息项裸奔）
 *   - --toast-fg / --toast-bg ≥ 4.5 · --toast-action / --toast-bg ≥ 4.5（R146 曾踩 1.98:1）
 *   - --heat-ink / --surface ≥ 4.5 · --heat-ink / --surface-2 ≥ 4.5（R172-T3：热力段专用文字色；
 *     图例注释 / 概览带人话句高亮 / 代码片都压在 surface 家族上）+ 热力令牌 8/8 齐全
 *   - 四主题 --accent 互不相同（R156 解禁的硬底线：不许再"伪选择"）
 *   - 四主题 --heat-5 互不相同（R172-T3：顶档色是四主题可辨性的最后一道）
 * 另打印**信息项**（不作判据）：accent/accent-light（同色系淡底深字固有上限 ~3.3:1）、
 *   四主题 accent 色相角矩阵（"两两可辨"的最终判据是 theme-audit 截图，此处只给数值参考）。
 *
 * 用法：node scripts/theme-contrast.cjs   （退出码 0 = 全绿）
 */
const path = require('path')
const fs = require('fs')

const CSS = path.resolve(__dirname, '..', 'src', 'shared', 'styles', 'tokens.css')
const THEMES = ['linear', 'raycast', 'apple', 'notion']

// ---- WCAG 2.1 相对亮度 / 对比度 ----
const h2r = (h) => { const s = h.replace('#', ''); return [0, 2, 4].map((i) => parseInt(s.slice(i, i + 2), 16)) }
const lin = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4) }
const Lum = ([r, g, b]) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
const ratio = (a, b) => { const x = Lum(a), y = Lum(b); const hi = Math.max(x, y), lo = Math.min(x, y); return (hi + 0.05) / (lo + 0.05) }
const over = (rgb, a, base) => rgb.map((c, i) => c * a + base[i] * (1 - a))
/** 解析颜色字符串（#hex 或 rgba(r,g,b,a)）；半透明需给合成底 */
const P = (s, base) => {
  if (!s) return null
  if (s.startsWith('#')) return h2r(s)
  const n = s.match(/[\d.]+/g)
  if (!n || n.length < 4) return null
  return over(n.slice(0, 3).map(Number), Number(n[3]), base)
}
const hsl = ([r, g, b]) => {
  r /= 255; g /= 255; b /= 255
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn
  let h = 0
  if (d) { h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h *= 60; if (h < 0) h += 360 }
  const l = (mx + mn) / 2, s = d ? d / (1 - Math.abs(2 * l - 1)) : 0
  return [h, s * 100, l * 100]
}
const dHue = (a, b) => { const d = Math.abs(a - b) % 360; return d > 180 ? 360 - d : d }

// ---- 解析 tokens.css ----
const css = fs.readFileSync(CSS, 'utf8')
const blocks = {}
const re = /\[data-theme='(\w+)'\]\s*\{([^}]*)\}/g
let m
while ((m = re.exec(css))) {
  const vars = {}
  const vr = /(--[\w-]+)\s*:\s*([^;]+);/g
  let v
  while ((v = vr.exec(m[2]))) vars[v[1]] = v[2].trim()
  blocks[m[1]] = vars
}
for (const t of THEMES) if (!blocks[t]) { console.error(`✗ tokens.css 缺少 [data-theme='${t}'] 块`); process.exit(1) }

// ---- 校验 ----
let fail = 0
const chk = (t, label, v, min) => {
  const ok = v !== null && v >= min
  if (!ok) fail++
  console.log(`  ${ok ? '✓' : '✗'} ${t.padEnd(8)} ${label.padEnd(18)} ${v === null ? 'N/A' : v.toFixed(2).padStart(6)}  (>= ${min})`)
  return ok
}

console.log('== 主题对比度门禁 · theme-contrast（WCAG 2.1）==')
const accents = {}
const heat5 = {}
const HEAT_TOKENS = ['--heat-0', '--heat-1', '--heat-2', '--heat-3', '--heat-4', '--heat-5', '--heat-ink', '--heat-ring']
for (const t of THEMES) {
  const V = blocks[t]
  const bg = P(V['--bg']), s1 = P(V['--surface']), s3 = P(V['--surface-3'])
  const text = P(V['--text'], bg), t2 = P(V['--text-2'], bg), t3 = P(V['--text-3'], bg)
  const acc = P(V['--accent']), ah = P(V['--accent-hover'])
  const al = P(V['--accent-light'], s1)
  const ink = P(V['--accent-ink'], s1)
  const tBg = P(V['--toast-bg']), tFg = P(V['--toast-fg']), tAc = P(V['--toast-action'])
  const s2 = P(V['--surface-2'])
  const hink = P(V['--heat-ink'], s1)
  console.log(`\n-- ${t} --`)
  chk(t, 'text/bg', ratio(text, bg), 4.5)
  chk(t, 'text/surface', ratio(text, s1), 4.5)
  chk(t, 'text-2/bg', ratio(t2, bg), 4.5)
  chk(t, 'text-3/bg', ratio(t3, bg), 3)
  chk(t, 'text-3/surface-3', ratio(t3, s3), 3)
  chk(t, '#fff/accent', ratio([255, 255, 255], acc), 4.5)
  chk(t, 'accent/bg', ratio(acc, bg), 3)
  chk(t, 'accent-hover/bg', ratio(ah, bg), 3)
  chk(t, 'accent-ink/accent-light', ratio(ink, al), 4.5)
  // R172-T3：热力段专用文字色（04-67 §8.2「--heat-ink 文字对比度 ≥ 4.5」）——
  // 它压在 --surface / --surface-2 上（图例注释、概览带人话句高亮、代码片），两处都要达标
  chk(t, 'heat-ink/surface', ratio(hink, s1), 4.5)
  chk(t, 'heat-ink/surface-2', ratio(hink, s2), 4.5)
  chk(t, 'toast-fg/toast-bg', ratio(tFg, tBg), 4.5)
  chk(t, 'toast-action/toast-bg', ratio(tAc, tBg), 4.5)
  accents[t] = V['--accent']
  heat5[t] = V['--heat-5']
  // R172-T3：热力令牌组完整性（8 个缺一即红）
  const missing = HEAT_TOKENS.filter((k) => !V[k])
  if (missing.length) { fail++; console.log(`  ✗ 热力令牌缺失：${missing.join(', ')}`) }
  else console.log(`  ✓ 热力令牌 8/8（${HEAT_TOKENS.join(' ')}）`)
  const [h, s, l] = hsl(acc)
  console.log(`  ·  ${t.padEnd(8)} 信息 accent/accent-light=${ratio(acc, al).toFixed(2)}（同色系淡底固有上限）  accent=HSL(${h.toFixed(0)},${s.toFixed(0)}%,${l.toFixed(0)}%)`)
}

// 四主题 accent 必须互不相同（R156 解禁的硬底线）
const uniq = new Set(Object.values(accents))
console.log('\n-- 四主题 accent 唯一性 --')
if (uniq.size !== THEMES.length) { fail++; console.log(`  ✗ accent 存在重复：${JSON.stringify(accents)}`) }
else console.log(`  ✓ 四主题 accent 互不相同：${THEMES.map((t) => `${t}=${accents[t]}`).join(' · ')}`)

// R172-T3：四主题 --heat-5（顶档）必须互不相同——否则「一屏看四主题」时分不出彼此
const huniq = new Set(Object.values(heat5))
console.log('\n-- 四主题 --heat-5 唯一性（R172-T3）--')
if (huniq.size !== THEMES.length) { fail++; console.log(`  ✗ --heat-5 存在重复：${JSON.stringify(heat5)}`) }
else console.log(`  ✓ 四主题 --heat-5 互不相同：${THEMES.map((t) => `${t}=${heat5[t]}`).join(' · ')}`)

const hue = THEMES.map((t) => [t, hsl(P(accents[t]))[0]])
console.log('\n-- accent 色相角差矩阵（信息项；"两两可辨"的最终判据是 theme-audit 截图）--')
for (let i = 0; i < hue.length; i++) for (let j = i + 1; j < hue.length; j++)
  console.log(`  ·  ${hue[i][0].padEnd(8)} vs ${hue[j][0].padEnd(8)} Δh=${dHue(hue[i][1], hue[j][1]).toFixed(1)}°`)

console.log(`\n${fail === 0 ? '✓ theme-contrast 全绿（4 主题 · 14 项/主题 + accent/heat-5 唯一性）' : `✗ theme-contrast 失败 ${fail} 项`}`)
process.exit(fail === 0 ? 0 : 1)
