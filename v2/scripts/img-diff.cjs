/**
 * 视觉对照 · 像素级 diff（R161 新建）
 *
 * 为什么有它：`theme-audit` 出图后判"有没有改"的第一手段是 `md5sum`，而 **md5 会骗人** ——
 *   R161 实测同一次归档里：同包重采的 `raycast-resource.png` **md5 不同（161,730 vs 161,727 B）
 *   但逐像素 0 差异**（纯 PNG 编码抖动）；反过来 before/after 的 md5 不同，真正原因却是
 *   **卡片上一个残留的鼠标 hover 工具条**（8,140 px 差异集中在一个 196×150 方块里）。
 *   ⇒ 回答"改了没有"必须能落到**像素与位置**，不能只看文件哈希。
 *
 * 用法：
 *   node scripts/img-diff.cjs <A.png> <B.png>                       # 差异统计 + 差异包围盒
 *   node scripts/img-diff.cjs <A.png> <B.png> --crop=610,415,245,195,3,out.png
 *                                                                  # 再裁出该区域放大 ×3 存 PNG（目视定位）
 * 输出：尺寸 / 差异像素数 / 占比 / 包围盒 / 最大通道差 / 若干采样点（前后 RGB）
 *
 * 与归档工具的分工：`theme-audit` 负责出图与"视角归零"（滚动 + 鼠标 hover），本工具负责判定差异。
 */
const fs = require('fs')
const path = require('path')
const { chromium } = require('playwright-core')

const CHROME = process.platform === 'darwin'
  ? path.join(process.env.HOME || '', 'Library', 'Caches', 'ms-playwright', 'chromium-1234', 'chrome-mac-arm64', 'Google Chrome for Testing.app', 'Contents', 'MacOS', 'Google Chrome for Testing')
  : path.join(process.env.LOCALAPPDATA || '', 'ms-playwright', 'chromium-1223', 'chrome-win64', 'chrome.exe')

const argv = process.argv.slice(2)
const files = argv.filter(a => !a.startsWith('--'))
const cropArg = argv.find(a => a.startsWith('--crop='))
/** 逐通道差的阈值：>6 才算"变了"，滤掉 PNG 编解码的 ±1 抖动 */
const TOL = 6

async function main() {
  if (files.length !== 2) throw new Error('用法：node scripts/img-diff.cjs <A.png> <B.png> [--crop=x,y,w,h,scale,out.png]')
  const [a, b] = files
  for (const f of [a, b]) if (!fs.existsSync(f)) throw new Error('文件不存在：' + f)

  const ctx = await chromium.launchPersistentContext('', { headless: true, executablePath: CHROME })
  const page = await ctx.newPage()
  const load = (p) => 'data:image/png;base64,' + fs.readFileSync(p).toString('base64')

  const res = await page.evaluate(async ([s1, s2, tol]) => {
    const load = (src) => new Promise((r) => { const i = new Image(); i.onload = () => r(i); i.src = src })
    const [i1, i2] = await Promise.all([load(s1), load(s2)])
    const w = Math.max(i1.width, i2.width), h = Math.max(i1.height, i2.height)
    const px = (img) => {
      const c = document.createElement('canvas'); c.width = w; c.height = h
      const x = c.getContext('2d'); x.drawImage(img, 0, 0)
      return x.getImageData(0, 0, w, h).data
    }
    const d1 = px(i1), d2 = px(i2)
    let n = 0, x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1, maxd = 0
    const samples = []
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4
        const d = Math.abs(d1[i] - d2[i]) + Math.abs(d1[i + 1] - d2[i + 1]) + Math.abs(d1[i + 2] - d2[i + 2])
        if (d > tol) {
          n++
          if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y
          if (d > maxd) maxd = d
          if (samples.length < 6) samples.push({ x, y, A: [d1[i], d1[i + 1], d1[i + 2]], B: [d2[i], d2[i + 1], d2[i + 2]] })
        }
      }
    }
    return { sizeA: [i1.width, i1.height], sizeB: [i2.width, i2.height], diffPixels: n, total: w * h, bbox: n ? [x0, y0, x1, y1] : null, maxChannelDelta: maxd, samples }
  }, [load(a), load(b), TOL])

  const pct = (res.diffPixels / res.total * 100).toFixed(4)
  console.log(`A: ${a}  ${res.sizeA.join('x')}`)
  console.log(`B: ${b}  ${res.sizeB.join('x')}`)
  console.log(`差异像素：${res.diffPixels} / ${res.total}（${pct}%）  最大通道差：${res.maxChannelDelta}`)
  console.log(`差异包围盒：${res.bbox ? res.bbox.join(',') : '无（逐像素一致）'}`)
  if (res.samples.length) console.log('采样点：' + JSON.stringify(res.samples))
  console.log(res.diffPixels === 0 ? '⇒ 逐像素一致（md5 若不同 = 纯 PNG 编码抖动）' : '⇒ 存在真实差异，看包围盒定位')

  if (cropArg) {
    const [, spec] = cropArg.split('=')
    const [x, y, w, h, s, out] = spec.split(',')
    const dataUrl = await page.evaluate(async ([src, x, y, w, h, s]) => {
      const img = await new Promise((r) => { const i = new Image(); i.onload = () => r(i); i.src = src })
      const c = document.createElement('canvas')
      c.width = w * s; c.height = h * s
      const cx = c.getContext('2d'); cx.imageSmoothingEnabled = false
      cx.drawImage(img, x, y, w, h, 0, 0, w * s, h * s)
      return c.toDataURL('image/png')
    }, [load(a), +x, +y, +w, +h, +s])
    fs.writeFileSync(out, Buffer.from(dataUrl.split(',')[1], 'base64'))
    console.log('已裁出 ' + out + `（A 的 ${x},${y} ${w}x${h} 放大 ×${s}）`)
  }
  await ctx.close()
}
main().catch(e => { console.error('img-diff 失败：' + e.message); process.exit(1) })
