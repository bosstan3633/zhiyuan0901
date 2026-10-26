/**
 * Shared Markdown / HTML export primitives.
 *
 * This module is deliberately storage-free: it only accepts attachment metadata
 * and never touches IndexedDB or an attachment BLOB. Callers that need a
 * downloadable attachment bundle must use a dedicated bundle utility.
 */

export type ExportLinkKind = 'http' | 'https' | 'obsidian' | 'file'

export interface SafeExportLink {
  raw: string
  href: string
  kind: ExportLinkKind | null
  clickable: boolean
  reason?: 'empty' | 'unsupported-protocol' | 'invalid'
}

export interface ExportAttachmentMeta {
  name?: string
  mime?: string
  size?: number
  kind?: string
}

export interface ExportStat {
  label: string
  value: string
  note?: string
}

export interface ExportRow {
  text: string
  link?: string | null
  linkType?: 'url' | 'file' | 'obsidian' | string
  label?: string
  time?: string
  meta?: string
}

export interface ExportSection {
  title: string
  paragraphs?: string[]
  rows?: ExportRow[]
  attachments?: ExportAttachmentMeta[]
}

export interface CardExportDocument {
  kicker?: string
  title: string
  subtitle?: string
  stats?: ExportStat[]
  sections: ExportSection[]
  footer?: string
  generatedAt?: number
}

export interface ExportTheme {
  bg: string
  surface: string
  surface2: string
  text: string
  textMuted: string
  border: string
  accent: string
  accentInk: string
  fontSans: string
  fontMono: string
}

export interface MarkdownExportLine {
  text: string
  link?: string | null
  linkType?: 'url' | 'file' | 'obsidian' | string
  /** Set false when the caller already supplies its own list marker. */
  bullet?: boolean
}

export interface MarkdownExportSection {
  heading: string
  lines: Array<string | MarkdownExportLine>
}

const DEFAULT_THEME: ExportTheme = {
  bg: '#14161b',
  surface: '#1a1d24',
  surface2: '#1c1f26',
  text: 'rgba(255,255,255,.92)',
  textMuted: 'rgba(255,255,255,.50)',
  border: 'rgba(255,255,255,.08)',
  accent: '#5e6ad2',
  accentInk: '#828fff',
  fontSans: '-apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif',
  fontMono: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
}

const HTML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
}

export function escapeHtml(value: unknown): string {
  return String(value ?? '').replace(/[&<>"']/g, char => HTML_ESCAPES[char] || char)
}

/** Escape text that will be placed in inline Markdown, not pre-built Markdown. */
export function escapeMarkdown(value: unknown): string {
  return String(value ?? '').replace(/([\\`*_[\]{}()<>#|~])/g, '\\$1')
}

function isLikelyWindowsPath(value: string): boolean {
  return /^[a-zA-Z]:[\\/]/.test(value)
}

function isLikelyPosixPath(value: string): boolean {
  return value.startsWith('/') && !value.startsWith('//')
}

function fileHrefFromPath(value: string): string {
  const path = value.replace(/\\/g, '/')
  const prefix = isLikelyWindowsPath(value) ? 'file:///' : 'file://'
  return prefix + encodeURI(path).replace(/#/g, '%23')
}

function blocked(reason: SafeExportLink['reason']): SafeExportLink {
  return { raw: '', href: '', kind: null, clickable: false, reason }
}

/**
 * Normalize a link and apply the export whitelist:
 * http, https, obsidian and file only. javascript/data/vbscript/blob and any
 * other scheme remain visible as text but are never rendered clickable.
 */
export function safeExportLink(
  value?: string | null,
  linkType?: 'url' | 'file' | 'obsidian' | string,
): SafeExportLink {
  const raw = String(value ?? '').trim()
  if (!raw) return blocked('empty')
  if (/[\u0000-\u001f\u007f]/.test(raw)) return blocked('invalid')

  // Windows drive paths look like a URL scheme (`D:`), so normalize them first.
  if (isLikelyWindowsPath(raw) || isLikelyPosixPath(raw)) {
    const href = fileHrefFromPath(raw)
    return { raw, href, kind: 'file', clickable: true }
  }
  if (!/^[a-z][a-z0-9+.-]*:/i.test(raw)) return blocked('invalid')

  let url: URL
  try {
    url = new URL(raw)
  } catch {
    return blocked('invalid')
  }

  const protocol = url.protocol.replace(/:$/, '').toLowerCase()
  if (protocol !== 'http' && protocol !== 'https' && protocol !== 'obsidian' && protocol !== 'file') {
    return blocked('unsupported-protocol')
  }
  if ((protocol === 'http' || protocol === 'https') && !url.hostname) return blocked('invalid')
  if (protocol === 'obsidian' && !url.hostname && !url.pathname) return blocked('invalid')
  if (protocol === 'file' && !url.pathname) return blocked('invalid')

  return {
    raw,
    href: url.href,
    kind: protocol as ExportLinkKind,
    clickable: true,
  }
}

export const toSafeExportLink = safeExportLink

function kindLabel(kind?: string, mime?: string): string {
  if (kind === 'image') return '图片'
  if (kind === 'pdf') return 'PDF'
  if (kind === 'html') return 'HTML'
  if (mime) return mime
  return '附件'
}

export function formatBytes(size?: number): string {
  if (size === undefined || !Number.isFinite(size) || size < 0) return '—'
  if (size < 1024) return `${Math.round(size)} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
  return `${(size / (1024 * 1024)).toFixed(1)} MB`
}

/** Format metadata only; a Blob or any other extra property is intentionally ignored. */
export function formatAttachmentMeta(meta: ExportAttachmentMeta): string {
  const name = meta.name?.trim() || '未命名附件'
  const type = kindLabel(meta.kind, meta.mime)
  const mime = meta.mime && meta.kind ? ` · ${meta.mime}` : ''
  return `${name}（${type}${mime} · ${formatBytes(meta.size)}）`
}

function renderMarkdownLink(text: string, link: SafeExportLink): string {
  const label = escapeMarkdown(text)
  if (!link.clickable) return label
  const href = link.href
    .replace(/\\/g, '%5C')
    .replace(/\(/g, '%28')
    .replace(/\)/g, '%29')
    .replace(/\s/g, '%20')
  return `[${label}](${href})`
}

function markdownLine(line: MarkdownExportLine, escapeText: boolean): string {
  const text = escapeText ? escapeMarkdown(line.text) : line.text
  const link = line.link ? safeExportLink(line.link, line.linkType) : null
  const body = link?.clickable
    ? renderMarkdownLink(line.text, link)
    : text
  return `${line.bullet === false ? '' : '- '}${body}`
}

/**
 * Markdown section helper with the same shape as exportView.sectionsToMd, plus
 * structured links. String lines are escaped by default; use
 * { text, link } for a clickable resource or task link.
 */
export function sectionsToMd(
  title: string,
  subtitle: string,
  sections: MarkdownExportSection[],
  options: { escape?: boolean } = {},
): string {
  const escapeText = options.escape !== false
  const out: string[] = [`# ${escapeText ? escapeMarkdown(title) : title}`]
  if (subtitle) out.push('', `> ${escapeText ? escapeMarkdown(subtitle) : subtitle}`)
  for (const section of sections) {
    out.push('', `## ${escapeText ? escapeMarkdown(section.heading) : section.heading}`, '')
    if (!section.lines.length) {
      out.push('暂无内容')
      continue
    }
    for (const line of section.lines) {
      out.push(typeof line === 'string'
        ? (escapeText ? escapeMarkdown(line) : line)
        : markdownLine(line, escapeText))
    }
  }
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n'
}

export const sectionsToMarkdown = sectionsToMd

export function exportDateStamp(date = new Date()): string {
  const pad = (n: number): string => String(n).padStart(2, '0')
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}`
}

/** Remove path separators and characters that are illegal on common filesystems. */
export function safeExportFileName(name: string, ext = ''): string {
  const wantedExt = ext.replace(/^\./, '').replace(/[^a-z0-9]/gi, '').toLowerCase()
  let stem = String(name || '').trim()
  if (wantedExt && stem.toLowerCase().endsWith(`.${wantedExt}`)) {
    stem = stem.slice(0, -(wantedExt.length + 1))
  }
  stem = stem
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^[\s._-]+|[\s._-]+$/g, '')
    .slice(0, 80)
  if (!stem) stem = '未命名导出'
  return wantedExt ? `${stem}.${wantedExt}` : stem
}

function cssValue(value: string, fallback: string): string {
  const safe = String(value || '').replace(/[;{}<>]/g, '').trim()
  return safe || fallback
}

/** Read the active theme from CSS variables; DOM-free callers get a stable fallback. */
export function readExportTheme(doc?: Document | null): ExportTheme {
  const root = doc || (typeof document !== 'undefined' ? document : null)
  const element = root?.documentElement
  if (!root || !element) return { ...DEFAULT_THEME }
  const view = root.defaultView
  const style = view?.getComputedStyle(element)
  const pick = (name: string, fallback: string): string => cssValue(style?.getPropertyValue(name) || '', fallback)
  return {
    bg: pick('--surface', DEFAULT_THEME.bg),
    surface: pick('--surface-2', DEFAULT_THEME.surface),
    surface2: pick('--surface-3', DEFAULT_THEME.surface2),
    text: pick('--text', DEFAULT_THEME.text),
    textMuted: pick('--text-3', DEFAULT_THEME.textMuted),
    border: pick('--border', DEFAULT_THEME.border),
    accent: pick('--accent', DEFAULT_THEME.accent),
    accentInk: pick('--accent-ink', DEFAULT_THEME.accentInk),
    fontSans: pick('--font-sans', DEFAULT_THEME.fontSans),
    fontMono: pick('--font-mono', DEFAULT_THEME.fontMono),
  }
}

export const currentExportTheme = readExportTheme

function renderHtmlLink(text: string, link: SafeExportLink): string {
  const label = escapeHtml(text)
  if (!link.clickable) return label
  return `<a href="${escapeHtml(link.href)}" target="_blank" rel="noopener noreferrer">${label}</a>`
}

function renderHtmlRow(row: ExportRow): string {
  const link = row.link ? safeExportLink(row.link, row.linkType) : null
  const body = link?.clickable ? renderHtmlLink(row.text, link) : escapeHtml(row.text)
  const label = row.label ? `<span class="row-label">${escapeHtml(row.label)}</span>` : ''
  const time = row.time ? `<span class="row-time">${escapeHtml(row.time)}</span>` : ''
  const meta = row.meta ? `<span class="row-meta">${escapeHtml(row.meta)}</span>` : ''
  return `<div class="row">${time}${label}<span class="row-text">${body}${meta}</span></div>`
}

function renderHtmlSection(section: ExportSection): string {
  const paragraphs = (section.paragraphs || [])
    .map(text => `<p>${escapeHtml(text)}</p>`)
    .join('')
  const rows = (section.rows || []).map(renderHtmlRow).join('')
  const attachments = section.attachments
    ? `<div class="attachments"><div class="subhead">附件清单</div>${
      section.attachments.length
        ? `<ul>${section.attachments.map(a => `<li>${escapeHtml(formatAttachmentMeta(a))}</li>`).join('')}</ul>`
        : '<p class="empty">暂无附件</p>'
    }</div>`
    : ''
  return `<section class="section"><h2>${escapeHtml(section.title)}</h2>${paragraphs}${rows}${attachments}</section>`
}

/** Self-contained HTML shell: inline CSS only, no scripts, fonts or remote assets. */
export function htmlDocumentShell(
  title: string,
  bodyHtml: string,
  theme: ExportTheme = readExportTheme(),
): string {
  const t: ExportTheme = {
    ...DEFAULT_THEME,
    ...theme,
    bg: cssValue(theme.bg, DEFAULT_THEME.bg),
    surface: cssValue(theme.surface, DEFAULT_THEME.surface),
    surface2: cssValue(theme.surface2, DEFAULT_THEME.surface2),
    text: cssValue(theme.text, DEFAULT_THEME.text),
    textMuted: cssValue(theme.textMuted, DEFAULT_THEME.textMuted),
    border: cssValue(theme.border, DEFAULT_THEME.border),
    accent: cssValue(theme.accent, DEFAULT_THEME.accent),
    accentInk: cssValue(theme.accentInk, DEFAULT_THEME.accentInk),
  }
  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(title || '知源导出')}</title>
<style>
*{box-sizing:border-box}
html{background:${t.bg}}
body{margin:0;background:${t.bg};color:${t.text};font-family:${t.fontSans};font-size:14px;line-height:1.7;-webkit-font-smoothing:antialiased}
.wrap{max-width:860px;margin:0 auto;padding:40px 24px 56px}
.kicker{color:${t.accentInk};font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase}
h1{font-size:26px;line-height:1.3;margin:8px 0 5px;overflow-wrap:anywhere}
.subtitle{color:${t.textMuted};margin:0 0 20px;overflow-wrap:anywhere}
.stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:10px;margin:0 0 22px}
.stat{background:${t.surface};border:1px solid ${t.border};border-radius:10px;padding:12px 14px}
.stat b{display:block;font-size:22px;line-height:1.2}
.stat span{display:block;color:${t.textMuted};font-size:12px;margin-top:3px}
.stat small{display:block;color:${t.textMuted};font-size:11px;margin-top:2px}
.section{border-top:1px solid ${t.border};padding:20px 0 2px;margin-top:18px}
.section h2{font-size:15px;line-height:1.4;margin:0 0 10px;color:${t.accentInk}}
.section p{margin:0 0 10px;white-space:pre-wrap;overflow-wrap:anywhere}
.row{display:flex;gap:10px;align-items:baseline;padding:6px 0;border-top:1px solid ${t.border}}
.row:first-of-type{border-top:0}
.row-time{color:${t.textMuted};font-family:${t.fontMono};font-size:11px;flex:none}
.row-label{color:${t.accent};font-size:11px;font-weight:700;flex:none}
.row-text{min-width:0;overflow-wrap:anywhere}
.row-meta{color:${t.textMuted};font-size:11px;margin-left:8px}
a{color:${t.accentInk};text-decoration:underline;text-underline-offset:2px;overflow-wrap:anywhere}
a:hover{color:${t.accent}}
.attachments{margin:12px 0 0;padding:11px 13px;background:${t.surface};border:1px solid ${t.border};border-radius:8px}
.subhead{color:${t.textMuted};font-size:11px;font-weight:700;margin-bottom:5px}
.attachments ul{margin:0;padding-left:18px}
.attachments li{overflow-wrap:anywhere}
.empty{color:${t.textMuted};font-size:12px;margin:0}
.footer{border-top:1px solid ${t.border};margin-top:26px;padding-top:13px;color:${t.textMuted};font-size:11px;display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap}
@media(max-width:640px){.wrap{padding:28px 16px 44px}h1{font-size:22px}.row{display:block}.row-time,.row-label{margin-right:8px}}
@media print{html,body{background:#fff;color:#111}.wrap{max-width:none;padding:0}a{color:#111}.section,.footer{break-inside:avoid}}
</style>
</head>
<body><main class="wrap">${bodyHtml}</main></body>
</html>`
}

export function renderExportMarkdown(doc: CardExportDocument): string {
  const out: string[] = [`# ${escapeMarkdown(doc.title || '未命名导出')}`]
  if (doc.subtitle) out.push('', `> ${escapeMarkdown(doc.subtitle)}`)
  if (doc.stats?.length) {
    out.push('', '## 读数')
    for (const stat of doc.stats) {
      const note = stat.note ? `（${escapeMarkdown(stat.note)}）` : ''
      out.push(`- ${escapeMarkdown(stat.label)}：${escapeMarkdown(stat.value)}${note}`)
    }
  }
  for (const section of doc.sections) {
    out.push('', `## ${escapeMarkdown(section.title)}`, '')
    if (section.paragraphs?.length) {
      for (const paragraph of section.paragraphs) out.push(escapeMarkdown(paragraph))
      out.push('')
    }
    if (section.rows?.length) {
      for (const row of section.rows) {
        const link = row.link ? safeExportLink(row.link, row.linkType) : null
        const text = link?.clickable ? renderMarkdownLink(row.text, link) : escapeMarkdown(row.text)
        const label = row.label ? `${escapeMarkdown(row.label)} · ` : ''
        const time = row.time ? `${escapeMarkdown(row.time)} ` : ''
        const meta = row.meta ? ` · ${escapeMarkdown(row.meta)}` : ''
        out.push(`- ${time}${label}${text}${meta}`)
      }
      out.push('')
    }
    if (section.attachments) {
      if (section.attachments.length) {
        out.push('附件清单：')
        for (const attachment of section.attachments) out.push(`- ${escapeMarkdown(formatAttachmentMeta(attachment))}`)
      } else {
        out.push('附件清单：暂无附件')
      }
      out.push('')
    }
    if (!section.paragraphs?.length && !section.rows?.length && !section.attachments) out.push('暂无内容', '')
  }
  if (doc.footer) out.push('---', '', `> ${escapeMarkdown(doc.footer)}`)
  const stamp = doc.generatedAt ? new Date(doc.generatedAt) : new Date()
  out.push('', `> 知源导出 · ${exportDateStamp(stamp)}`)
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n'
}

export function renderExportHtml(doc: CardExportDocument, theme: ExportTheme = readExportTheme()): string {
  const stats = doc.stats?.length
    ? `<div class="stats">${doc.stats.map(stat =>
      `<div class="stat"><b>${escapeHtml(stat.value)}</b><span>${escapeHtml(stat.label)}</span>${
        stat.note ? `<small>${escapeHtml(stat.note)}</small>` : ''
      }</div>`).join('')}</div>`
    : ''
  const sections = doc.sections.map(renderHtmlSection).join('')
  const footer = `<div class="footer"><span>${escapeHtml(doc.footer || '知源导出')}</span><span>${exportDateStamp(doc.generatedAt ? new Date(doc.generatedAt) : new Date())}</span></div>`
  const body = `${doc.kicker ? `<div class="kicker">${escapeHtml(doc.kicker)}</div>` : ''}
<h1>${escapeHtml(doc.title || '未命名导出')}</h1>
${doc.subtitle ? `<p class="subtitle">${escapeHtml(doc.subtitle)}</p>` : ''}
${stats}${sections}${footer}`
  return htmlDocumentShell(doc.title, body, theme)
}

export const renderCardMarkdown = renderExportMarkdown
export const renderCardHtml = renderExportHtml
