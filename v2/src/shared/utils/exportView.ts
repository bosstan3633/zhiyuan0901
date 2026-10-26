/**
 * R172-T12（04-67 F39）：仪表盘两段（复盘 / 热力图）的导出三件套内容侧。
 *
 * 三条口径：
 *  ① **导出的是当前视图算出来的东西**，不是再跑一遍另一套算法 —— 表头与数值直接由调用方
 *     从 `aggregateRange` / `runRules` / `objectivesOf` / `stats.days` 的结果传入，杜绝"看到的 ≠ 导出的"；
 *  ② **PNG 走 canvas 自绘**，不引 html2canvas 那类 DOM→图片依赖：本产品体积预算已经贴顶（06-2 §G），
 *     而且 foreignObject 方案不吃外部样式表，主题令牌会整片丢色 —— 自绘反而更小更稳；
 *  ③ 颜色一律现取 `getComputedStyle` 的令牌值 ⇒ 四主题导出的图与屏上所见一致。
 */
import { stampDay } from './download'

/** 行值允许数字（`csvCell` 统一转义与 stringify），调用方不必到处写 `String()` */
export interface CsvTable { header: string[]; rows: unknown[][] }

const csvCell = (v: unknown): string => {
  const s = v === undefined || v === null ? '' : String(v)
  return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s
}

export function tablesToCsv(ts: CsvTable[]): string {
  const out: string[] = []
  ts.forEach((t, i) => {
    if (i) out.push('')
    out.push(t.header.map(csvCell).join(','))
    for (const r of t.rows) out.push(r.map(csvCell).join(','))
  })
  return out.join('\r\n')
}

export function sectionsToMd(title: string, sub: string, secs: { h: string; lines: string[] }[]): string {
  return [`# ${title}`, `> ${sub}`, '', ...secs.flatMap(s => [`## ${s.h}`, '', ...s.lines, ''])].join('\n').replace(/\n{3,}/g, '\n\n')
}

const tok = (names: Record<string, string>): Record<string, string> => {
  const cs = getComputedStyle(document.documentElement)
  const out: Record<string, string> = {}
  for (const k of Object.keys(names)) out[k] = (cs.getPropertyValue(names[k]) || '').trim() || '#888'
  return out
}

export interface PngSpec {
  title: string
  sub: string
  kpis: { label: string; value: string; note?: string }[]
  /** 格子图：调用方给**坐标 + 档位**（12 月块怎么排由调用方决定，本模块不懂业务） */
  grid?: { cells: { c: number; r: number; lv: number }[]; cols: number; rows: number; cell: number; gap: number; label?: string } | null
  /** W5（V3.8.5）：战报流水行（可选）——有则画在 KPI 下方；heatmap 导出不传则行为不变 */
  rows?: { time: string; label: string; title: string }[]
  footer: string
}

/** canvas 自绘导出一张 PNG（DPR=2，字面尺寸 ≈ 屏上观感） */
export function pngBlobFromSpec(spec: PngSpec): Promise<Blob> {
  const c = tok({ bg: '--surface', fg: '--text', fg2: '--text-3', line: '--border', card: '--surface-2',
    h0: '--heat-0', h1: '--heat-1', h2: '--heat-2', h3: '--heat-3', h4: '--heat-4', h5: '--heat-5' })
  const HEAT = [c.h0, c.h1, c.h2, c.h3, c.h4, c.h5]
  const W = 1000
  const pad = 28
  const kpiPerRow = Math.min(4, Math.max(1, spec.kpis.length))
  const kpiRows = Math.ceil(spec.kpis.length / kpiPerRow)
  const kpiH = 74
  const gridH = spec.grid ? spec.grid.rows * (spec.grid.cell + spec.grid.gap) + 26 : 0
  const rowH = spec.rows?.length ? spec.rows.length * 22 + 24 : 0
  const H = pad + 54 + kpiRows * kpiH + (gridH ? gridH + 18 : 0) + rowH + 34
  const cv = document.createElement('canvas')
  const dpr = 2
  cv.width = W * dpr
  cv.height = H * dpr
  const g = cv.getContext('2d')
  if (!g) return Promise.reject(new Error('canvas 2d 不可用'))
  g.scale(dpr, dpr)
  g.fillStyle = c.bg
  g.fillRect(0, 0, W, H)
  g.fillStyle = c.fg
  g.font = '600 22px system-ui, "PingFang SC", "Microsoft YaHei", sans-serif'
  g.fillText(spec.title.slice(0, 40), pad, pad + 20)
  g.fillStyle = c.fg2
  g.font = '400 13px system-ui, "PingFang SC", "Microsoft YaHei", sans-serif'
  g.fillText(spec.sub.slice(0, 110), pad, pad + 44)

  let y = pad + 58
  spec.kpis.forEach((k, i) => {
    const col = i % kpiPerRow
    const row = Math.floor(i / kpiPerRow)
    const x = pad + col * ((W - pad * 2) / kpiPerRow)
    const w = (W - pad * 2) / kpiPerRow - 10
    const top = y + row * kpiH
    g.fillStyle = c.card
    g.fillRect(x, top, w, kpiH - 12)
    g.strokeStyle = c.line
    g.lineWidth = 1
    g.strokeRect(x + .5, top + .5, w - 1, kpiH - 13)
    g.fillStyle = c.fg2
    g.font = '400 12px system-ui, "PingFang SC", sans-serif'
    g.fillText(k.label.slice(0, 14), x + 12, top + 20)
    g.fillStyle = c.fg
    g.font = '700 20px system-ui, "PingFang SC", sans-serif'
    g.fillText(String(k.value).slice(0, 12), x + 12, top + 44)
    if (k.note) {
      g.fillStyle = c.fg2
      g.font = '400 11px system-ui, "PingFang SC", sans-serif'
      g.fillText(k.note.slice(0, 26), x + 12, top + 58)
    }
  })
  y += kpiRows * kpiH

  if (spec.grid) {
    const gx = pad
    const gy = y + 22
    g.fillStyle = c.fg2
    g.font = '400 12px system-ui, "PingFang SC", sans-serif'
    g.fillText(spec.grid.label || '每日档位（0–5 档，越深越忙）', gx, y + 6)
    for (const cell of spec.grid.cells) {
      g.fillStyle = HEAT[Math.max(0, Math.min(5, cell.lv))]
      g.fillRect(gx + cell.c * (spec.grid!.cell + spec.grid!.gap), gy + cell.r * (spec.grid!.cell + spec.grid!.gap), spec.grid!.cell, spec.grid!.cell)
    }
    y = gy + spec.grid.rows * (spec.grid.cell + spec.grid.gap) + 8
  }

  /* W5（V3.8.5）：战报流水行（仅传 rows 时渲染；热力图导出不传则零变化） */
  if (spec.rows?.length) {
    const ry0 = y + 16
    g.fillStyle = c.fg2
    g.font = '400 12px system-ui, "PingFang SC", sans-serif'
    g.fillText('当日操作流水', pad, ry0)
    spec.rows.forEach((r, i) => {
      const ry = ry0 + 20 + i * 22
      g.fillStyle = c.fg2
      g.font = '400 12px ui-monospace, Consolas, monospace'
      g.fillText(r.time, pad, ry)
      g.fillStyle = c.fg
      g.font = '600 12px system-ui, "PingFang SC", sans-serif'
      g.fillText(r.label, pad + 54, ry)
      g.fillStyle = c.fg2
      g.font = '400 12px system-ui, "PingFang SC", sans-serif'
      g.fillText(r.title, pad + 104, ry)
    })
    y = ry0 + 20 + spec.rows.length * 22
  }

  g.fillStyle = c.fg2
  g.font = '400 11px system-ui, "PingFang SC", sans-serif'
  g.fillText(spec.footer.slice(0, 120), pad, H - 14)
  return new Promise<Blob>((res, rej) => cv.toBlob(b => (b ? res(b) : rej(new Error('toBlob 返回空'))), 'image/png'))
}

/** 文件名统一：`zhiyuan_<段>_<口径>_<日期>.<ext>` */
export function exportName(section: string, ext: string, winLabel?: string): string {
  const slug = (winLabel || '').replace(/[^0-9A-Za-z\u4e00-\u9fa5]+/g, '-').replace(/^-+|-+$/g, '')
  return ['zhiyuan', section, slug, stampDay()].filter(Boolean).join('_') + '.' + ext
}

/**
 * W2（V3.8.2）：年度热力图**独立 HTML 分享页**。
 *
 * 为什么不是导出 PNG 就够 —— PNG 只能"看"，HTML 能"转发"：任何人（不装扩展、不装 Obsidian）
 * 浏览器双击即看到这一年的热力图 + 四张卡 + 图例。做成**单文件自包含**（样式全部内联、
 * 颜色在生成瞬间用 getComputedStyle 现取当前主题令牌，和 PNG 同一口径），发出去后不依赖本扩展、
 * 不依赖网络、不依赖对方装字体 —— 关了扩展照样能开，这才叫分享页。
 *
 * 参数刻意**只给内容**（标题/副标/KPI/格子坐标+档位/图例），本模块不懂"月块怎么排"这类业务：
 * 与 `pngBlobFromSpec` 同一约定（②口径），PNG 与 HTML 因此永远同源同貌。
 */
export interface HeatmapShareSpec {
  title: string
  sub: string
  kpis: { label: string; value: string; note?: string }[]
  /** 格子：调用方给坐标+档位（c/r 为格子序号，非像素） */
  grid: { cells: { c: number; r: number; lv: number }[]; cols: number; rows: number; cell: number; gap: number; label?: string }
  legend?: { name: string; desc: string }[]
  footer: string
}

const escHtml = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/** 生成一份自包含 HTML 字符串（调用方负责 downloadText 落盘） */
export function heatmapShareHtml(spec: HeatmapShareSpec): string {
  const c = tok({ bg: '--surface', fg: '--text', fg2: '--text-3', line: '--border', card: '--surface-2',
    h0: '--heat-0', h1: '--heat-1', h2: '--heat-2', h3: '--heat-3', h4: '--heat-4', h5: '--heat-5',
    acc: '--accent', ok: '--ok', warn: '--warn', err: '--err' })
  const HEAT = [c.h0, c.h1, c.h2, c.h3, c.h4, c.h5]
  const kpiHtml = spec.kpis.map(k =>
    `<div class="k"><div class="kl">${escHtml(k.label)}</div><div class="kv">${escHtml(String(k.value))}</div>${
      k.note ? `<div class="kn">${escHtml(k.note)}</div>` : ''}</div>`).join('')
  const g = spec.grid
  const gridW = g.cols * (g.cell + g.gap) - g.gap
  const gridH = g.rows * (g.cell + g.gap) - g.gap
  const cellHtml = g.cells.map(cell => {
    const x = cell.c * (g.cell + g.gap)
    const y = cell.r * (g.cell + g.gap)
    const lv = Math.max(0, Math.min(5, cell.lv))
    return `<div class="cell" style="left:${x}px;top:${y}px;background:${HEAT[lv]}"></div>`
  }).join('')
  const legendHtml = (spec.legend || []).map(l =>
    `<span class="lg"><span class="sw" style="background:${HEAT[0]}"></span>${escHtml(l.name)}<em>${escHtml(l.desc)}</em></span>`).join('')
  const LEGEND_DOTS = HEAT.map((h, i) => `<span class="sw" style="background:${h}">${i}</span>`).join('')
  const now = new Date()
  const stamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escHtml(spec.title)}</title>
<style>
*{box-sizing:border-box}
body{margin:0;background:${c.bg};color:${c.fg};font-family:"PingFang SC","Microsoft YaHei",system-ui,sans-serif;line-height:1.6;-webkit-font-smoothing:antialiased}
.wrap{max-width:${Math.max(gridW + 56, 720)}px;margin:0 auto;padding:40px 28px 48px}
h1{font-size:22px;font-weight:700;margin:0 0 6px}
.sub{color:${c.fg2};font-size:13px;margin:0 0 28px}
.kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;margin:0 0 28px}
.k{background:${c.card};border:1px solid ${c.line};border-radius:10px;padding:14px 16px}
.kl{color:${c.fg2};font-size:12px}
.kv{font-size:24px;font-weight:700;margin-top:4px;line-height:1.2}
.kn{color:${c.fg2};font-size:11px;margin-top:3px}
.panel{background:${c.card};border:1px solid ${c.line};border-radius:12px;padding:20px 22px;margin:0 0 22px}
.ptitle{font-size:14px;font-weight:600;margin:0 0 4px}
.phint{color:${c.fg2};font-size:12px;margin:0 0 16px}
.grid{position:relative;width:${gridW}px;height:${gridH}px;margin:0 auto}
.cell{position:absolute;width:${g.cell}px;height:${g.cell}px;border-radius:3px}
.legend{display:flex;flex-wrap:wrap;gap:8px 16px;align-items:center;margin:16px 0 0}
.lg{display:inline-flex;align-items:center;gap:6px;font-size:12px;color:${c.fg2}}
.lg em{font-style:normal;color:${c.fg2};opacity:.75}
.sw{display:inline-flex;align-items:center;justify-content:center;width:16px;height:16px;border-radius:3px;font-size:0}
.foot{color:${c.fg2};font-size:11px;margin:22px 0 0;display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap}
</style>
</head>
<body>
<div class="wrap">
  <h1>${escHtml(spec.title)}</h1>
  <p class="sub">${escHtml(spec.sub)}</p>
  <div class="kpis">${kpiHtml}</div>
  <div class="panel">
    <p class="ptitle">${escHtml(g.label || '每日档位（0–5 档，越深越忙）')}</p>
    <p class="phint">横轴为月内日序，纵轴为周序。颜色越深，当天调度动作越多。</p>
    <div class="grid">${cellHtml}</div>
    <div class="legend">${LEGEND_DOTS}</div>
  </div>
  ${legendHtml ? `<div class="legend">${legendHtml}</div>` : ''}
  <p class="foot"><span>${escHtml(spec.footer)}</span><span>知源调度台 · 生成于 ${stamp}</span></p>
</div>
</body>
</html>`
}

/**
 * W5（V3.8.5）#6：单日战报**独立 HTML 分享页**（与 heatmapShareHtml 同一口径：
 * 单文件自包含、令牌生成瞬间现取、浏览器双击即看）。
 */
export interface DailyReportShareSpec {
  title: string
  sub: string
  summary: string
  kpis: { label: string; value: string; note?: string }[]
  /** href 仅在调用方确认是资源卡原始链接时传入；任务/系统行保持纯文本。 */
  rows: { time: string; label: string; title: string; href?: string }[]
  footer: string
}

export function dailyReportShareHtml(spec: DailyReportShareSpec): string {
  const c = tok({ bg: '--surface', fg: '--text', fg2: '--text-3', line: '--border', card: '--surface-2', acc: '--accent' })
  const kpiHtml = spec.kpis.map(k =>
    `<div class="k"><div class="kl">${escHtml(k.label)}</div><div class="kv">${escHtml(String(k.value))}</div>${
      k.note ? `<div class="kn">${escHtml(k.note)}</div>` : ''}</div>`).join('')
  const rowHtml = spec.rows.length
    ? spec.rows.map(r =>
      `<div class="row"><span class="tm">${escHtml(r.time)}</span><span class="lb">${escHtml(r.label)}</span><span class="ti">${
        r.href ? `<a href="${escHtml(r.href)}" target="_blank" rel="noopener noreferrer">${escHtml(r.title)}</a>` : escHtml(r.title)
      }</span></div>`).join('')
    : '<p class="empty">这一天没有操作记录。</p>'
  const now = new Date()
  const stamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escHtml(spec.title)}</title>
<style>
*{box-sizing:border-box}
body{margin:0;background:${c.bg};color:${c.fg};font-family:"PingFang SC","Microsoft YaHei",system-ui,sans-serif;line-height:1.6;-webkit-font-smoothing:antialiased}
.wrap{max-width:760px;margin:0 auto;padding:40px 28px 48px}
h1{font-size:22px;font-weight:700;margin:0 0 6px}
.sub{color:${c.fg2};font-size:13px;margin:0 0 4px}
.summary{font-size:14px;margin:0 0 22px}
.summary b{color:${c.acc}}
.kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px;margin:0 0 26px}
.k{background:${c.card};border:1px solid ${c.line};border-radius:10px;padding:14px 16px}
.kl{color:${c.fg2};font-size:12px}
.kv{font-size:24px;font-weight:700;margin-top:4px;line-height:1.2}
.kn{color:${c.fg2};font-size:11px;margin-top:3px}
.panel{background:${c.card};border:1px solid ${c.line};border-radius:12px;padding:18px 20px}
.ptitle{font-size:14px;font-weight:600;margin:0 0 12px}
.row{display:flex;gap:12px;align-items:baseline;padding:6px 2px;border-top:1px solid ${c.line}}
.row:first-of-type{border-top:0}
.tm{color:${c.fg2};font-family:ui-monospace,Consolas,monospace;font-size:12px;width:46px;flex:none}
.lb{font-weight:600;font-size:12px;width:52px;flex:none}
.ti{font-size:13px;min-width:0;overflow-wrap:anywhere}
a{color:${c.acc};text-decoration:underline;text-underline-offset:2px}
a:hover{color:${c.fg}}
.empty{color:${c.fg2};font-size:13px;margin:0}
.foot{color:${c.fg2};font-size:11px;margin:22px 0 0;display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap}
</style>
</head>
<body>
<div class="wrap">
  <h1>${escHtml(spec.title)}</h1>
  <p class="sub">${escHtml(spec.sub)}</p>
  <p class="summary">${escHtml(spec.summary)}</p>
  <div class="kpis">${kpiHtml}</div>
  <div class="panel">
    <p class="ptitle">当日操作流水</p>
    ${rowHtml}
  </div>
  <p class="foot"><span>${escHtml(spec.footer)}</span><span>知源调度台 · 生成于 ${stamp}</span></p>
</div>
</body>
</html>`
}
