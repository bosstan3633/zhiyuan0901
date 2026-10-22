/**
 * 策展成果分享：生成可离线打开的自包含 HTML。
 *
 * 安全边界：
 * - 只输出 http(s) 资源链接，不输出本地绝对路径、账号、PAT、内部 ID；
 * - 不包含脚本、外部字体或外部样式；
 * - 附件只展示名称、类型和大小，不输出 IndexedDB 键或存储路径。
 */
import type { Category, ResourceCard } from '@/shared/models'
import {
  buildCurationRenderTree,
  buildCurationSnapshot,
  type CurationRenderCard,
  type CurationRenderNode,
} from './curationShareData'

export interface CurationShareOptions {
  format: 'reading' | 'tree'
  links: boolean
  attachments: boolean
  sources: boolean
  date: boolean
  theme: 'paper' | 'ink'
}

export interface CurationShareInput {
  workspaceName: string
  thesis: ResourceCard | null
  nodes: Category[]
  cards: ResourceCard[]
  options: CurationShareOptions
  imageDataUrl?: string
  generatedAt?: number
}

const esc = (value: unknown): string => String(value ?? '').replace(/[&<>"']/g, c => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[c] || c))

function safeUrl(value?: string): string {
  const url = String(value || '').trim()
  return /^https?:\/\//i.test(url) ? url : ''
}

function fmtDate(ts: number): string {
  const d = new Date(ts)
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`
}

function fmtSize(size?: number): string {
  const n = Number(size || 0)
  if (!n) return '—'
  if (n < 1024) return `${n} B`
  if (n < 1048576) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / 1048576).toFixed(1)} MB`
}

function kindLabel(kind?: string): string {
  return kind === 'pdf' ? 'PDF' : kind === 'image' ? '图片' : kind === 'html' ? 'HTML' : '附件'
}

function sourceLabel(source?: string): string {
  return ({ official: '官方', academic: '学术', media: '媒体', personal: '个人', 'ai-tool': 'AI 工具', 'own-work': '个人成果' } as Record<string, string>)[source || ''] || '未标注'
}

function sourceClass(source?: string): string {
  return ({ official: 'official', academic: 'academic', media: 'media', personal: 'personal', 'ai-tool': 'ai', 'own-work': 'own' } as Record<string, string>)[source || ''] || 'personal'
}

function cardHtml(card: CurationRenderCard, options: CurationShareOptions): string {
  const url = options.links ? safeUrl(card.url) : ''
  const title = url
    ? `<a class="res-title" href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(card.title)}<span class="open">打开原文 ↗</span></a>`
    : `<span class="res-title">${esc(card.title)}</span>`
  const tags = (card.tags || []).slice(0, 5).map(tag => `<span class="tag">#${esc(tag)}</span>`).join('')
  const assets = options.attachments && card.assets.length
    ? `<div class="asset-list">${card.assets.map(a => `<span class="asset"><b>${esc(a.name || kindLabel(a.kind))}</b><small>${kindLabel(a.kind)} · ${fmtSize(a.size)}</small></span>`).join('')}</div>`
    : ''
  return `<article class="resource">
    <div class="resource-head">
      ${options.sources ? `<span class="source ${sourceClass(card.sourceType)}">${esc(sourceLabel(card.sourceType))}</span>` : ''}
      ${card.assets.length && options.attachments ? `<span class="type">${card.assets.length} 个附件</span>` : ''}
      ${tags}
    </div>
    ${title}
    ${card.description ? `<p>${esc(card.description)}</p>` : ''}
    ${assets}
  </article>`
}

function nodeReadingHtml(node: CurationRenderNode, options: CurationShareOptions, index: string): string {
  const depth = Math.max(0, node.level - 2)
  return `<section class="node depth-${Math.min(depth, 3)}" id="node-${index}">
    <div class="node-kicker">L${node.level} · 论证节点</div>
    <h2>${esc(node.title)}</h2>
    ${node.description ? `<p class="node-desc">${esc(node.description)}</p>` : ''}
    <div class="resources">${node.cards.length ? node.cards.map(card => cardHtml(card, options)).join('') : '<div class="empty">这个节点暂未挂资源卡。</div>'}</div>
    ${node.children.map((child, i) => nodeReadingHtml(child, options, `${index}-${i + 1}`)).join('')}
  </section>`
}

function nodeTreeHtml(
  node: CurationRenderNode,
  options: CurationShareOptions,
): string {
  return `<li class="tree-branch">
    <div class="tree-node">
      <div class="node-kicker">L${node.level} · 论证节点</div>
      <h3>${esc(node.title)}</h3>
      ${node.description ? `<p>${esc(node.description)}</p>` : ''}
      ${node.cards.length ? `<div class="resources">${node.cards.map(card => cardHtml(card, options)).join('')}</div>` : '<div class="empty">暂未挂资源卡。</div>'}
    </div>
    ${node.children.length ? `<ul>${node.children.map(child => nodeTreeHtml(child, options)).join('')}</ul>` : ''}
  </li>`
}

export function buildCurationShareHtml(input: CurationShareInput): string {
  const { workspaceName, thesis, nodes, cards, options } = input
  const generatedAt = input.generatedAt || Date.now()
  const snapshot = buildCurationSnapshot({
    workspaceName,
    thesis,
    nodes,
    cards,
    layout: options.format === 'reading' ? 'pyramid' : 'tree',
    generatedAt,
  })
  const renderTree = buildCurationRenderTree({ nodes, cards, thesis })
  const snapshotJson = JSON.stringify(snapshot).replace(/</g, '\\u003c')
  const roots = renderTree.roots
  const attachmentCount = renderTree.attachmentCount
  const thesisTitle = thesis?.title || `${workspaceName} · 策展成果`
  const thesisDesc = thesis?.description || '这份策展成果尚未补充中心论点说明。'
  const treeTheme = options.theme === 'ink'
    ? { bg: '#17181c', surface: '#202126', surface2: '#26272d', ink: '#f4f0e8', ink2: '#d8d2c8', ink3: '#aaa397', line: 'rgba(255,255,255,.20)', accent: '#c3d0dd', accentSoft: 'rgba(195,208,221,.18)', shadow: 'rgba(0,0,0,.32)' }
    : { bg: '#f7f4ed', surface: '#fffdf8', surface2: '#efeade', ink: '#25221c', ink2: '#4d483f', ink3: '#71695d', line: 'rgba(40,34,24,.18)', accent: '#2f5955', accentSoft: '#e7f0ed', shadow: 'rgba(54,44,30,.12)' }
  const toc = roots.map((n, i) => `<a href="#node-${i + 1}">${esc(n.title)}</a>`).join('')
  const reading = `<div class="doc-shell">
    <aside class="toc">
      <div class="kicker">策展目录</div>
      ${toc || '<span class="toc-empty">暂无一级分支</span>'}
      <div class="toc-foot">${esc(workspaceName)}<br>${options.date ? `生成于 ${fmtDate(generatedAt)}` : '自包含离线文件'}</div>
    </aside>
    <main class="article">
      <header class="hero">
        <div class="kicker">策展成果 · 阅读长文</div>
        <h1>${esc(thesisTitle)}</h1>
        <p class="lead">${esc(thesisDesc)}</p>
        <div class="metrics"><span><b>${renderTree.cardCount}</b> 张资源</span><span><b>${renderTree.nodeCount}</b> 个节点</span><span><b>${roots.length}</b> 个一级分支</span><span><b>${attachmentCount}</b> 个附件</span></div>
      </header>
      ${roots.length ? roots.map((n, i) => nodeReadingHtml(n, options, String(i + 1))).join('') : '<div class="empty-page">这份成果还没有论证分支。</div>'}
      ${options.attachments && attachmentCount ? `<section class="attachment-section"><div class="kicker">附件清单</div><h2>可追溯的材料</h2>${renderTree.flat.filter(n => n.cards.some(c => c.assets.length)).map(n => n.cards.filter(c => c.assets.length).map(c => `<div class="attachment-row"><span>${esc(c.title)}</span><small>${c.assets.map(a => `${esc(a.name || kindLabel(a.kind))}（${kindLabel(a.kind)} · ${fmtSize(a.size)}）`).join('、')}</small></div>`).join('')).join('')}</section>` : ''}
      <footer class="footer">由知源生成${options.date ? ` · ${fmtDate(generatedAt)}` : ''}<br>本文件为自包含 HTML，不含账号、密钥、内部标识或本地绝对路径。</footer>
    </main>
  </div>`
  const treeHtml = `<main class="tree-doc">
    <header class="hero tree-hero">
      <div class="kicker">策展成果 · 论证树</div>
      <h1>${esc(thesisTitle)}</h1>
      <p class="lead">${esc(thesisDesc)}</p>
      <div class="metrics"><span><b>${renderTree.cardCount}</b> 张资源</span><span><b>${renderTree.nodeCount}</b> 个节点</span><span><b>${roots.length}</b> 个一级分支</span></div>
    </header>
    <div class="tree-scroll"><div class="share-tree">
      <div class="share-root"><div class="node-kicker">L1 · 中心论点</div><h2>${esc(thesisTitle)}</h2><p>${esc(thesisDesc)}</p></div>
      <ul class="tree-root">${roots.length ? roots.map(n => nodeTreeHtml(n, options)).join('') : '<li class="empty-page">暂无论证分支。</li>'}</ul>
    </div></div>
    <footer class="footer">由知源生成${options.date ? ` · ${fmtDate(generatedAt)}` : ''}<br>资源链接可点击；分享文件不依赖知源扩展。</footer>
  </main>`
  const imageLink = input.imageDataUrl
    ? `<a class="image-download" download="${esc(workspaceName.replace(/[\\/:*?"<>|]/g, '_').slice(0, 40) || '策展成果')}_高清长图.png" href="${esc(input.imageDataUrl)}"><span>↓</span> 下载高清长图</a>`
    : ''
  return `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(thesisTitle)}</title>
<style>
:root{--bg:${treeTheme.bg};--surface:${treeTheme.surface};--surface-2:${treeTheme.surface2};--ink:${treeTheme.ink};--ink-2:${treeTheme.ink2};--ink-3:${treeTheme.ink3};--line:${treeTheme.line};--accent:${treeTheme.accent};--accent-soft:${treeTheme.accentSoft};--shadow:${treeTheme.shadow}}
*{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;background:var(--bg);color:var(--ink);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Hiragino Sans GB","Microsoft YaHei",sans-serif;font-size:15px;line-height:1.72}
a{color:inherit;text-decoration:none}.doc-shell{max-width:1220px;margin:0 auto;padding:54px 28px 70px;display:grid;grid-template-columns:190px minmax(0,1fr);gap:46px;align-items:start}
.toc{position:sticky;top:28px;border-left:2px solid var(--line);padding:2px 0 2px 16px}.toc a{display:block;padding:5px 0;font-size:13px;color:var(--ink-2)}.toc a:hover{color:var(--accent)}.toc-foot{margin-top:18px;padding-top:14px;border-top:1px solid var(--line);font-size:11px;color:var(--ink-3);line-height:1.7}.toc-empty{font-size:12px;color:var(--ink-3)}
.kicker,.node-kicker{font-size:11px;letter-spacing:.14em;text-transform:uppercase;font-weight:800;color:var(--accent)}.article{min-width:0;max-width:850px}.hero{padding:12px 0 34px;border-bottom:1px solid var(--line);margin-bottom:34px}.hero h1{font-size:clamp(30px,4.4vw,52px);line-height:1.18;letter-spacing:-.035em;margin:12px 0 16px;font-weight:800;max-width:820px}.lead{font-size:18px;line-height:1.75;color:var(--ink-2);max-width:760px;margin:0}.metrics{display:flex;gap:9px;flex-wrap:wrap;margin-top:22px}.metrics span{border:1px solid var(--line);border-radius:999px;padding:4px 10px;font-size:12px;color:var(--ink-3)}.metrics b{color:var(--ink);font-size:13px}
.node{padding:26px 0;border-top:1px solid var(--line);scroll-margin-top:24px}.node h2{font-size:24px;line-height:1.35;margin:7px 0 8px;letter-spacing:-.02em}.node h3{font-size:18px;margin:7px 0 6px}.node-desc{color:var(--ink-2);margin:0 0 16px;max-width:760px}.depth-1{margin-left:20px;padding-left:18px;border-left:2px solid color-mix(in srgb,var(--accent) 30%,var(--line))}.depth-1 h2{font-size:19px}.depth-2{margin-left:24px;padding-left:18px;border-left:2px solid color-mix(in srgb,var(--accent) 24%,var(--line))}.depth-3{margin-left:28px;padding-left:18px;border-left:2px solid color-mix(in srgb,var(--accent) 18%,var(--line))}
.resources{display:flex;flex-direction:column;gap:9px}.resource{border:1px solid var(--line);border-radius:10px;background:var(--surface);padding:13px 14px}.resource-head{display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin-bottom:5px}.resource-head .type,.tag,.source{font-size:10px;border-radius:4px;padding:1px 6px;border:1px solid var(--line);color:var(--ink-3)}.tag{background:var(--surface-2)}.source.official{color:#2368b7;background:#eaf2fb}.source.academic{color:#2e7d45;background:#edf5ee}.source.media{color:#9b6819;background:#faf1e1}.source.own{color:var(--accent);background:var(--accent-soft)}.source.ai{color:#7652a8;background:#f2edf8}.source.personal{color:var(--ink-3);background:var(--surface-2)}
.res-title{display:inline-block;font-size:15px;font-weight:700;line-height:1.5;text-decoration:underline;text-decoration-color:color-mix(in srgb,var(--accent) 45%,transparent);text-underline-offset:3px}.res-title:hover{color:var(--accent)}.open{font-size:11px;color:var(--accent);font-weight:700;text-decoration:none;white-space:nowrap;margin-left:7px}.resource p{margin:5px 0 0;font-size:13px;line-height:1.65;color:var(--ink-2)}.empty,.empty-page{border:1px dashed var(--line);border-radius:8px;padding:11px;font-size:13px;color:var(--ink-3)}.asset-list{display:flex;flex-wrap:wrap;gap:6px;margin-top:9px}.asset{display:inline-flex;align-items:center;gap:5px;padding:4px 7px;border-radius:6px;background:var(--surface-2);font-size:11px}.asset small{color:var(--ink-3)}.attachment-section{margin-top:32px;padding-top:24px;border-top:1px solid var(--line)}.attachment-section h2{font-size:20px;margin:7px 0 12px}.attachment-row{display:flex;justify-content:space-between;gap:14px;border-bottom:1px solid var(--line);padding:8px 0;font-size:13px;color:var(--ink-2)}.attachment-row small{color:var(--ink-3);text-align:right}.footer{margin-top:44px;padding-top:18px;border-top:1px solid var(--line);font-size:11px;line-height:1.7;color:var(--ink-3)}
.tree-doc{max-width:1440px;margin:0 auto;padding:46px 26px 60px}.tree-hero{max-width:880px}.tree-scroll{overflow-x:auto;padding-bottom:16px}.share-tree{display:flex;gap:44px;align-items:flex-start;min-width:1080px;margin-top:28px}.share-root{width:300px;flex:none;border:2px solid var(--accent);border-radius:14px;padding:18px;background:linear-gradient(135deg,var(--accent-soft),var(--surface));box-shadow:0 12px 34px var(--shadow)}.share-root h2{font-size:20px;line-height:1.4;margin:6px 0 8px}.share-root p{font-size:13px;color:var(--ink-2);margin:0}.tree-root,.tree-root ul{list-style:none;margin:0;padding:0}.tree-root{display:flex;flex-direction:column;gap:14px;padding-left:24px;border-left:1px solid var(--line)}.tree-branch{position:relative}.tree-branch::before{content:"";position:absolute;left:-24px;top:28px;width:24px;height:1px;background:var(--line)}.tree-node{border:1px solid var(--line);border-radius:11px;background:var(--surface);padding:13px 15px;width:330px}.tree-node h3{font-size:17px;margin:5px 0}.tree-node p{font-size:12px;color:var(--ink-2);margin:0 0 9px}.tree-branch>ul{display:flex;flex-direction:column;gap:10px;margin:10px 0 0 20px;padding-left:20px;border-left:1px solid var(--line)}.tree-node .resources{gap:7px}.tree-node .resource{padding:9px 10px}.tree-node .res-title{font-size:13px}.tree-node .resource p{font-size:12px}
.image-download{position:fixed;right:22px;bottom:22px;z-index:10;display:inline-flex;align-items:center;gap:7px;padding:9px 14px;border:1px solid var(--accent);border-radius:999px;background:var(--surface);color:var(--accent);box-shadow:0 8px 26px var(--shadow);font-size:12px;font-weight:700;text-decoration:none}.image-download:hover{background:var(--accent-soft)}.image-download span{font-size:16px;line-height:1}
@media(max-width:900px){.doc-shell{display:block;padding:32px 18px 50px}.toc{position:relative;top:auto;display:none}.article{max-width:none}.hero h1{font-size:34px}.lead{font-size:16px}.depth-1,.depth-2,.depth-3{margin-left:0}.tree-doc{padding:30px 16px 44px}.share-tree{min-width:900px}.share-root{width:250px}}
@media print{body{background:#fff}.doc-shell{display:block;padding:0}.toc{display:none}.article{max-width:none}.resource,.tree-node{break-inside:avoid}.footer{position:static}.image-download{display:none}}
</style></head><body>${options.format === 'reading' ? reading : treeHtml}${imageLink}
<script type="application/json" id="zy-curation-share-data">${snapshotJson}</script></body></html>`
}
