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
  const H = pad + 54 + kpiRows * kpiH + (gridH ? gridH + 18 : 0) + 34
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
