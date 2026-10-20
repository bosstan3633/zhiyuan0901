/**
 * ★W18（2026-10-20 用户拍板 · 统一卡片模板）知源统一卡片导出模板。
 *
 * 为什么要有这一层：知源的核心概念是「卡」——三类卡（任务 / 好奇 / 资源）构成全部数据的基础；
 * 于是**所有呈现形式与下载方式也该是卡片**，便于阅读、便于传播。此前各导出点各写一套版式
 * （热力图一份、日战报一份、复盘一份），图与图之间不像同一个产品。
 *
 * 卡片契约（唯一模板，新增导出只填内容不画版式）：
 *   ① 顶部眉标（知源 · 卡型） + 主标题 + 副题（时间范围 / 口径）
 *   ② 读数区：2–4 枚主读数（大字 + 标签 + 口径注）
 *   ③ 三类卡带：任务 / 好奇 / 资源 的存量或增量（知源「卡」世界观的最小可视单位）
 *   ④ 明细区：0–N 行（时间 + 标签 + 标题），战报 / 热力图 / 月度共用
 *   ⑤ 品牌页脚：知源调度台 · 数据只在本机 · 生成时间
 *
 * 两条硬约束（沿用 R172-T12 的口径）：
 *   - PNG 走 canvas 自绘（不引 html2canvas；体积预算已贴顶，foreignObject 还会整片丢色）；
 *   - 颜色一律现取 `getComputedStyle` 令牌 ⇒ 四主题导出的图与屏上所见一致。
 */
import { stampDay } from './download'

/** 三类卡的最小可视单位 —— 知源「卡」世界观 */
export interface CardKinds {
  task: number
  curio: number
  res: number
  /** 该组数字的口径：如「在库」「当日新增」「本月入池」 */
  label?: string
}

export interface ZyCardReadout {
  label: string
  value: string
  /** 口径补充（小字） */
  note?: string
}

export interface ZyCardRow {
  time?: string
  /** 行标签（如「调出」「新增」「推进」） */
  label: string
  title: string
}

export interface ZyCardSpec {
  /** 眉标：如「每日战报」「年度热力」「本月沉淀」 */
  kicker: string
  title: string
  /** 副题：时间范围 + 口径说明 */
  sub: string
  readouts: ZyCardReadout[]
  /** 三类卡带；不传则整条不画 */
  kinds?: CardKinds | null
  rows?: ZyCardRow[]
  /** 明细区标题（有 rows 才用） */
  rowsTitle?: string
  footer?: string
  /** 画格子图（热力图卡用）：坐标 + 档位，版式由本模块决定 */
  grid?: { cells: { c: number; r: number; lv: number }[]; cols: number; rows: number } | null
}

/** 现取主题令牌（与屏上同色） */
function tokens() {
  const cs = getComputedStyle(document.documentElement)
  const pick = (n: string, fb: string) => (cs.getPropertyValue(n) || '').trim() || fb
  return {
    bg: pick('--surface', '#fff'),
    bg2: pick('--surface-2', '#f5f5f5'),
    fg: pick('--text', '#222'),
    fg2: pick('--text-3', '#888'),
    line: pick('--border', '#e5e5e5'),
    accent: pick('--accent', '#9842ad'),
    heat: [0, 1, 2, 3, 4, 5].map(i => pick(`--heat-${i}`, '#eee'))
  }
}

const FONT = '"PingFang SC", "Microsoft YaHei", system-ui, sans-serif'

/** 生成卡片 PNG（DPR=2，宽度 1000，高度按内容算） */
export function zyCardBlob(spec: ZyCardSpec): Promise<Blob> {
  const c = tokens()
  const W = 1000
  const pad = 40
  const inner = W - pad * 2

  const readoutCols = Math.min(4, Math.max(1, spec.readouts.length))
  const readoutRows = Math.ceil(spec.readouts.length / readoutCols)
  const readoutH = 86
  const kindsH = spec.kinds ? 74 : 0
  const cols = spec.grid?.cols || 12
  const rows = spec.grid?.rows || 0
  const cell = spec.grid ? Math.floor((inner - (cols - 1) * 5) / cols) : 0
  const gridH = spec.grid ? rows * (cell + 5) + 14 : 0
  const rowH = spec.rows?.length ? spec.rows.length * 26 + 34 : 0

  const headH = 116
  const H = pad + headH + readoutRows * readoutH + (kindsH ? kindsH + 14 : 0) + (gridH ? gridH + 14 : 0) + rowH + 62

  const cv = document.createElement('canvas')
  const dpr = 2
  cv.width = W * dpr
  cv.height = H * dpr
  const g = cv.getContext('2d')
  if (!g) return Promise.reject(new Error('canvas 2d 不可用'))
  g.scale(dpr, dpr)

  // 卡面底
  g.fillStyle = c.bg
  g.fillRect(0, 0, W, H)

  let y = pad

  // ① 眉标 + 主标题 + 副题
  g.fillStyle = c.accent
  g.font = `700 12px ${FONT}`
  g.fillText(spec.kicker, pad, y + 12)
  y += 30
  g.fillStyle = c.fg
  g.font = `700 30px ${FONT}`
  g.fillText(spec.title.slice(0, 26), pad, y + 12)
  y += 34
  g.fillStyle = c.fg2
  g.font = `400 13px ${FONT}`
  g.fillText(spec.sub.slice(0, 96), pad, y + 10)
  y += 28

  // 眉标下的细分隔线
  g.strokeStyle = c.line
  g.lineWidth = 1
  g.beginPath()
  g.moveTo(pad, y + 6)
  g.lineTo(W - pad, y + 6)
  g.stroke()
  y += 24

  // ② 读数区（横向等分，数字大字）
  spec.readouts.forEach((r, i) => {
    const col = i % readoutCols
    const row = Math.floor(i / readoutCols)
    const cw = inner / readoutCols
    const x = pad + col * cw
    const yy = y + row * readoutH
    g.fillStyle = c.fg
    g.font = `700 30px ${FONT}`
    g.fillText(r.value, x, yy + 26)
    g.fillStyle = c.fg2
    g.font = `600 12px ${FONT}`
    g.fillText(r.label.slice(0, 14), x, yy + 48)
    if (r.note) {
      g.fillStyle = c.fg2
      g.font = `400 11px ${FONT}`
      g.fillText(r.note.slice(0, 22), x, yy + 66)
    }
  })
  y += readoutRows * readoutH

  // ③ 三类卡带（任务 / 好奇 / 资源）
  if (spec.kinds) {
    const k = spec.kinds
    const items = [
      { name: '任务卡', n: k.task },
      { name: '好奇心卡', n: k.curio },
      { name: '资源卡', n: k.res }
    ]
    const bandW = inner
    const cellW = bandW / 3
    g.strokeStyle = c.line
    g.beginPath()
    g.moveTo(pad, y + 10)
    g.lineTo(W - pad, y + 10)
    g.stroke()
    y += 18
    items.forEach((it, i) => {
      const x = pad + i * cellW
      g.fillStyle = c.fg
      g.font = `700 20px ${FONT}`
      g.fillText(String(it.n), x, y + 22)
      g.fillStyle = c.fg2
      g.font = `400 12px ${FONT}`
      g.fillText(it.name, x + 34, y + 22)
      if (k.label) {
        g.font = `400 11px ${FONT}`
        g.fillStyle = c.fg2
        g.fillText(k.label, x, y + 40)
      }
    })
    y += kindsH
  }

  // ④ 格子图（热力图卡）
  if (spec.grid) {
    for (const cellData of spec.grid.cells) {
      const x = pad + cellData.c * (cell + 5)
      const yy = y + 10 + cellData.r * (cell + 5)
      g.fillStyle = c.heat[Math.max(0, Math.min(5, cellData.lv))]
      g.fillRect(x, yy, cell, cell)
    }
    y += gridH
  }

  // ⑤ 明细区
  if (spec.rows?.length) {
    g.strokeStyle = c.line
    g.beginPath()
    g.moveTo(pad, y + 8)
    g.lineTo(W - pad, y + 8)
    g.stroke()
    y += 26
    if (spec.rowsTitle) {
      g.fillStyle = c.fg2
      g.font = `600 12px ${FONT}`
      g.fillText(spec.rowsTitle, pad, y)
      y += 18
    }
    for (const r of spec.rows) {
      if (r.time) {
        g.fillStyle = c.fg2
        g.font = `400 12px ${FONT}`
        g.fillText(r.time, pad, y)
      }
      g.fillStyle = c.accent
      g.font = `600 12px ${FONT}`
      g.fillText(r.label, pad + 52, y)
      g.fillStyle = c.fg
      g.font = `400 13px ${FONT}`
      let title = r.title
      const maxW = inner - 120
      while (g.measureText(title).width > maxW && title.length > 4) title = title.slice(0, -2)
      if (title !== r.title) title = title.slice(0, -1) + '…'
      g.fillText(title, pad + 108, y)
      y += 26
    }
  }

  // ⑥ 品牌页脚
  const fy = H - 34
  g.strokeStyle = c.line
  g.beginPath()
  g.moveTo(pad, fy - 14)
  g.lineTo(W - pad, fy - 14)
  g.stroke()
  g.fillStyle = c.fg2
  g.font = `400 11px ${FONT}`
  g.fillText(spec.footer || '知源调度台 · 数据只在本机', pad, fy)
  g.textAlign = 'right'
  g.fillText(`知源调度台 · ${stampDay()}`, W - pad, fy)
  g.textAlign = 'left'

  return new Promise((resolve, reject) => {
    cv.toBlob(b => (b ? resolve(b) : reject(new Error('PNG 生成失败'))), 'image/png')
  })
}

/** 同一份内容的自包含 HTML 卡片（任何人浏览器打开即看，便于传播） */
export function zyCardHtml(spec: ZyCardSpec): string {
  const c = tokens()
  const esc = (s: string) => s.replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch] as string))
  const readouts = spec.readouts
    .map(r => `<div class="ro"><b>${esc(r.value)}</b><span>${esc(r.label)}</span>${r.note ? `<i>${esc(r.note)}</i>` : ''}</div>`)
    .join('')
  const kinds = spec.kinds
    ? `<div class="kinds">
        <div class="kind"><b>${spec.kinds.task}</b><span>任务卡</span></div>
        <div class="kind"><b>${spec.kinds.curio}</b><span>好奇心卡</span></div>
        <div class="kind"><b>${spec.kinds.res}</b><span>资源卡</span></div>
        <em>${esc(spec.kinds.label || '')}</em>
      </div>`
    : ''
  const rows = spec.rows?.length
    ? `<section class="rows">${spec.rowsTitle ? `<h2>${esc(spec.rowsTitle)}</h2>` : ''}${spec.rows
        .map(r => `<div class="row">${r.time ? `<span class="tm">${esc(r.time)}</span>` : ''}<span class="lb">${esc(r.label)}</span><span class="ti">${esc(r.title)}</span></div>`)
        .join('')}</section>`
    : ''
  return `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(spec.title)}</title>
<style>
*{box-sizing:border-box}
body{margin:0;padding:24px;background:${c.bg2};color:${c.fg};font:14px/1.6 "PingFang SC","Microsoft YaHei",system-ui,sans-serif}
.card{max-width:760px;margin:0 auto;background:${c.bg};border:1px solid ${c.line};border-radius:18px;padding:32px 34px 24px}
.kicker{color:${c.accent};font-size:12px;font-weight:700;letter-spacing:.08em}
h1{margin:8px 0 6px;font-size:26px;line-height:1.35}
.sub{margin:0 0 18px;color:${c.fg2};font-size:13px}
.ro-wrap{display:grid;grid-template-columns:repeat(${Math.min(4, Math.max(1, spec.readouts.length))},1fr);gap:14px;padding:16px 0;border-top:1px solid ${c.line};border-bottom:1px solid ${c.line}}
.ro b{display:block;font-size:26px;line-height:1.2}
.ro span{display:block;color:${c.fg2};font-size:12px;font-weight:600;margin-top:4px}
.ro i{display:block;color:${c.fg2};font-size:11px;font-style:normal;margin-top:2px}
.kinds{display:flex;gap:24px;align-items:baseline;padding:14px 0;border-bottom:1px solid ${c.line}}
.kind b{font-size:20px;margin-right:6px}
.kind span{color:${c.fg2};font-size:12px}
.kinds em{margin-left:auto;color:${c.fg2};font-size:11px;font-style:normal}
.rows h2{margin:16px 0 8px;font-size:13px;color:${c.fg2}}
.row{display:flex;gap:10px;align-items:baseline;padding:7px 0;border-top:1px solid ${c.line};font-size:13px}
.row:first-of-type{border-top:0}
.tm{color:${c.fg2};font-family:ui-monospace,Consolas,monospace;font-size:12px;width:46px;flex:none}
.lb{color:${c.accent};font-weight:600;font-size:12px;width:52px;flex:none}
.ti{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.foot{display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;margin:22px 0 0;color:${c.fg2};font-size:11px}
</style></head>
<body><div class="card">
  <div class="kicker">${esc(spec.kicker)}</div>
  <h1>${esc(spec.title)}</h1>
  <p class="sub">${esc(spec.sub)}</p>
  <div class="ro-wrap">${readouts}</div>
  ${kinds}
  ${rows}
  <p class="foot"><span>${esc(spec.footer || '知源调度台 · 数据只在本机')}</span><span>知源调度台 · 生成于 ${stampDay()}</span></p>
</div></body></html>`
}
