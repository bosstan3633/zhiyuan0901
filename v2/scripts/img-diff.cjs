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
 *   node scripts/img-diff.cjs --batch <目录A> <目录B> [--only=子串] [--strict]
 *                                                                  # ★R4-Ex 整归档成对比（一次起浏览器）
 *                                                                  # 同名 png 逐对判像素，分三档：0 差 / 抖动 / 变化
 *                                                                  # 有任一"变化"或两侧张数不齐 ⇒ 退出码 1
 * 输出：尺寸 / 差异像素数 / 占比 / 包围盒 / 最大通道差 / 若干采样点（前后 RGB）
 *
 * 与归档工具的分工：`theme-audit` 负责出图与"视角归零"（滚动 + 鼠标 hover），本工具负责判定差异。
 * 为什么批量模式是 R4-Ex 才补的：此前逐张要逐张起 chromium（104 张 = 104 次冷启动），
 *   "同构建连采两次该逐像素相同"这条噪声地板因此没法当门禁跑，只能靠一次性脚本量一次。
 */
const fs = require('fs')
const path = require('path')
const { chromium } = require('playwright-core')

/* R4-Ea（挂账 #84）：浏览器可执行文件解析统一到 scripts/browser.cjs——四级回落的唯一实现。
   此前这里各抄一份且抄得不一致（img-diff 只写死 chromium-1234，缓存换版本后直接起不来）。 */
const { CHROME } = require('./browser.cjs')

const argv = process.argv.slice(2)
const files = argv.filter(a => !a.startsWith('--'))
const cropArg = argv.find(a => a.startsWith('--crop='))
/** 逐通道差的阈值：>6 才算"变了"，滤掉 PNG 编解码的 ±1 抖动 */
const TOL = 6
/** ★R4-Ex 单通道阈值：把"差异"再分两层——
 *  变化像素 = 至少一个通道差 >6（肉眼可辨的内容/版式变化）
 *  抖动像素 = 三个通道都 ≤6 但求和 >TOL（半透明边线的覆盖率取整，实测 3–5/通道）
 *  实测依据：同构建连采三组两两对照（A/B/C 各 104 张），受影响的张每次都不同一批，
 *  差异全部落在 1–5 行高的边线带上（KPI 卡下沿、弹窗底边、分隔线），单通道差 ≤5 ⇒ 这是取色抖动不是变化。
 *  反过来真变化（如采集面板链接框里那串 URL）单通道差在 200 上下，不会被这层滤掉。 */
const HARD = 6

/** 浏览器侧算式（单对与批量共用同一把尺子，不许各抄一份）：三通道差求和 > TOL 才算这个像素变了 */
const DIFF_FN = async ([s1, s2, tol, hard]) => {
  const load = (src) => new Promise((r) => { const i = new Image(); i.onload = () => r(i); i.src = src })
  const [i1, i2] = await Promise.all([load(s1), load(s2)])
  const w = Math.max(i1.width, i2.width), h = Math.max(i1.height, i2.height)
  const px = (img) => {
    const c = document.createElement('canvas'); c.width = w; c.height = h
    const x = c.getContext('2d'); x.drawImage(img, 0, 0)
    return x.getImageData(0, 0, w, h).data
  }
  const d1 = px(i1), d2 = px(i2)
  let n = 0, hardN = 0, x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1, hx0 = 1e9, hy0 = 1e9, hx1 = -1, hy1 = -1, maxd = 0, maxSingle = 0
  const samples = []
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4
      const dr = Math.abs(d1[i] - d2[i]), dg = Math.abs(d1[i + 1] - d2[i + 1]), db = Math.abs(d1[i + 2] - d2[i + 2])
      const d = dr + dg + db
      if (d > tol) {
        n++
        if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y
        if (d > maxd) maxd = d
        const mx = Math.max(dr, dg, db)
        if (mx > maxSingle) maxSingle = mx
        if (mx > hard) {
          hardN++
          if (x < hx0) hx0 = x; if (x > hx1) hx1 = x; if (y < hy0) hy0 = y; if (y > hy1) hy1 = y
          if (samples.length < 6) samples.push({ x, y, A: [d1[i], d1[i + 1], d1[i + 2]], B: [d2[i], d2[i + 1], d2[i + 2]] })
        }
      }
    }
  }
  return {
    sizeA: [i1.width, i1.height], sizeB: [i2.width, i2.height], diffPixels: n, hardPixels: hardN, total: w * h,
    bbox: n ? [x0, y0, x1, y1] : null, hardBBox: hardN ? [hx0, hy0, hx1, hy1] : null,
    maxChannelDelta: maxSingle, maxDelta: maxd, samples
  }
}

const b64 = (p) => 'data:image/png;base64,' + fs.readFileSync(p).toString('base64')

/**
 * 抖动档的完整定义（两层都要满足，缺一即算变化）：
 *   ① 每个差异像素的**单通道**差都 ≤HARD（实测抖动 3–6/通道，真变化在 200 上下）；
 *   ② 差异包围盒**高度 ≤8 行**——实测抖动只出现在 1–6 行高的水平边线上（卡下沿描边、弹窗底边、分隔线）。
 * 加 ② 是因为：一整个面板被均匀调淡 5/通道 也是"每通道 ≤6"，但那是真变化，
 * 它不可能只落在 8 行以内的带里 ⇒ 用形状把"整片小改"和"边线取整"分开，别只靠数值。
 */
const JITTER_BAND_ROWS = 8
const classify = (r) => {
  if (!r.diffPixels) return { 档: 'same' }
  const rows = r.bbox[3] - r.bbox[1] + 1
  if (r.hardPixels > 0 || rows > JITTER_BAND_ROWS) return { 档: 'changed', rows }
  return { 档: 'jitter', rows }
}

/**
 * ★R4-Ex 批量模式：整归档成对判像素。
 * 语义：目录同名 `.png` 逐对比；A 有 B 无（或反之）算**缺失即红**（少一张图不是"没差异"）。
 * 每张分三档：0 差 / 只有抖动（边线取整）/ 有变化（存在单通道 >HARD 的像素，或差异带高 >8 行）。
 * 退出码 0 = 没有任何一张落到"有变化"，也没有张数不齐；`--strict` 连抖动都不许有。
 * 这条把"像素 A/B"从参考升级成门禁：同构建连采必须落到 0 差或抖动档，
 * 改前/改后 build 各跑一次（同一个 --freeze-at 日子）之后，**只有"有变化"那一档才是本次改动**。
 */
async function runBatch(page, dirA, dirB) {
  const strict = argv.includes('--strict')
  const only = (argv.find(a => a.startsWith('--only=')) || '').split('=')[1] || ''
  const inA = fs.readdirSync(dirA).filter(f => f.endsWith('.png') && (!only || f.includes(only)))
  const inB = new Set(fs.readdirSync(dirB).filter(f => f.endsWith('.png')))
  const both = inA.filter(f => inB.has(f))
  const missA = [...inB].filter(f => !inA.includes(f))
  console.log(`批量像素对照：A=${dirA}  B=${dirB}  TOL=${TOL}  变化=单通道>${HARD} 或差异带高>${JITTER_BAND_ROWS} 行${strict ? '  --strict（抖动也算红）' : ''}  成对 ${both.length} 张` +
    (only ? `（--only=${only}）` : ''))
  if (inA.length - both.length || missA.length) {
    console.log(`❌ 两侧张数不齐：A 独有 ${inA.filter(f => !inB.has(f)).join(',') || '无'} ｜ B 独有 ${missA.join(',') || '无'}`)
  }
  const changed = [], jittered = []
  for (const f of both) {
    const r = await page.evaluate(DIFF_FN, [b64(path.join(dirA, f)), b64(path.join(dirB, f)), TOL, HARD])
    const c = classify(r)
    const 尺寸变了 = r.sizeA.join('x') !== r.sizeB.join('x')
    if (尺寸变了 || c.档 === 'changed' || (strict && c.档 === 'jitter')) {
      changed.push({ 图: f, 变化: r.hardPixels, 抖动: r.diffPixels - r.hardPixels })
      console.log(`✗ ${f.padEnd(32)} 变化像素 ${r.hardPixels}  抖动 ${r.diffPixels - r.hardPixels}  差异带高 ${c.rows || 0} 行  单通道最大差 ${r.maxChannelDelta}  变化包围盒 ${r.hardBBox ? r.hardBBox.join(',') : '—'}${尺寸变了 ? `  尺寸 ${r.sizeA.join('x')} vs ${r.sizeB.join('x')}` : ''}`)
    } else if (c.档 === 'jitter') {
      jittered.push({ 图: f, 抖动: r.diffPixels, 带高: c.rows, 单通道最大差: r.maxChannelDelta })
    }
  }
  const 不齐 = (inA.length - both.length) + missA.length
  console.log(`\n⇒ 成对 ${both.length} 张：0 差 ${both.length - changed.length - jittered.length}，抖动 ${jittered.length}，有变化 ${changed.length}；张数不齐 ${不齐}`)
  if (jittered.length) {
    console.log('  抖动档（同构建边线取整，不算变化）：')
    for (const j of jittered) console.log(`    ${j.图.padEnd(32)} ${j.抖动} px  差异带高 ${j.带高} 行  单通道最大差 ${j.单通道最大差}`)
  }
  if (changed.length) console.log('  变化像素合计 ' + changed.reduce((s, x) => s + x.变化, 0))
  process.exit(changed.length || 不齐 ? 1 : 0)
}

async function main() {
  if (files.length !== 2) throw new Error('用法：node scripts/img-diff.cjs <A.png> <B.png> [--crop=x,y,w,h,scale,out.png] ｜ --batch <目录A> <目录B> [--only=子串] [--max-pixels=N]')
  const [a, b] = files
  for (const f of [a, b]) if (!fs.existsSync(f)) throw new Error('文件不存在：' + f)

  const ctx = await chromium.launchPersistentContext('', { headless: true, executablePath: CHROME })
  const page = await ctx.newPage()
  const load = (p) => 'data:image/png;base64,' + fs.readFileSync(p).toString('base64')

  if (argv.includes('--batch') || fs.existsSync(a) && fs.statSync(a).isDirectory()) {
    if (!fs.existsSync(a) || !fs.existsSync(b) || !fs.statSync(a).isDirectory() || !fs.statSync(b).isDirectory()) {
      throw new Error('--batch 需要两个已存在的目录：node scripts/img-diff.cjs --batch <目录A> <目录B>')
    }
    await runBatch(page, a, b)
  }

  const res = await page.evaluate(DIFF_FN, [load(a), load(b), TOL, HARD])

  const pct = (res.diffPixels / res.total * 100).toFixed(4)
  console.log(`A: ${a}  ${res.sizeA.join('x')}`)
  console.log(`B: ${b}  ${res.sizeB.join('x')}`)
  console.log(`差异像素：${res.diffPixels} / ${res.total}（${pct}%）  其中变化像素 ${res.hardPixels}（单通道差 >${HARD}）· 抖动像素 ${res.diffPixels - res.hardPixels}`)
  console.log(`差异包围盒：${res.bbox ? res.bbox.join(',') : '无（逐像素一致）'}  变化包围盒：${res.hardBBox ? res.hardBBox.join(',') : '无'}`)
  console.log(`单通道最大差：${res.maxChannelDelta}  三通道求和最大差：${res.maxDelta}`)
  if (res.samples.length) console.log('采样点：' + JSON.stringify(res.samples))
  console.log(res.hardPixels === 0
    ? (res.diffPixels === 0 ? '⇒ 逐像素一致（md5 若不同 = 纯 PNG 编码抖动）' : '⇒ 只有边线取色抖动（每通道 ≤6），不算变化')
    : '⇒ 存在真实变化，看变化包围盒定位')

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
