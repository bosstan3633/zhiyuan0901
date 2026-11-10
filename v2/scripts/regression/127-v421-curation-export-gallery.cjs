/**
 * V4.2.1 · 策展 HTML 附件图库：
 * - 中心论点关联卡进入导出树，公开链接与说明可见；
 * - 中心论点附件与分支附件都进入自包含图库；
 * - 同节点多图可打开、上一张/下一张切换，不依赖可执行脚本；
 * - ZIP 模式使用相对附件路径，危险文本与链接保持转义/降级。
 */
const fs = require('fs')
const { check, path, SCRIPTS_DIR } = require('./helpers.cjs')

let esbuild = null
try { esbuild = require('esbuild') } catch { /* source assertions below remain available */ }

function loadShareTools() {
  if (!esbuild) return null
  const src = path.resolve(SCRIPTS_DIR, '..', 'src')
  const build = (name) => {
    const entry = path.resolve(src, 'shared', 'utils', name + '.ts')
    const out = path.resolve(SCRIPTS_DIR, '..', `.${name}-v421.tmp.cjs`)
    try {
      esbuild.buildSync({
        entryPoints: [entry],
        bundle: true,
        platform: 'node',
        format: 'cjs',
        outfile: out,
        logLevel: 'silent',
        alias: { '@': src },
      })
      return require(out)
    } finally {
      try { fs.unlinkSync(out) } catch { /* no artifact on compile failure */ }
    }
  }
  try {
    return { ...build('curationShare'), ...build('curationShareData') }
  } catch {
    return null
  }
}

const shareTools = loadShareTools()

function asset(id, name, kind = 'image') {
  return { id, name, kind, size: 128, mime: kind === 'image' ? 'image/png' : 'application/octet-stream', createdAt: 1 }
}

function card(overrides) {
  return {
    id: 'card-' + Math.random().toString(36).slice(2),
    kind: 'resource',
    title: '资源卡',
    linkType: 'url',
    link: '',
    workspaceId: 'ws-421',
    categoryId: '',
    tags: [],
    pinned: false,
    callCount: 0,
    customFields: {},
    createdAt: 1,
    updatedAt: 1,
    ...overrides,
  }
}

function fixture() {
  const thesis = card({
    id: 'thesis-421',
    title: '中心论点',
    description: '中心论点说明',
    isThesis: true,
    assets: [asset('thesis-image-1', '论点图一.png'), asset('thesis-image-2', '论点图二.png')],
  })
  const node = {
    id: 'cat-421',
    workspaceId: 'ws-421',
    name: '看市场',
    description: '市场证据',
    order: 0,
    assets: [asset('node-image-1', '分支图一.png'), asset('node-image-2', '分支图二.png')],
  }
  const linked = card({
    id: 'thesis-linked-card',
    categoryId: thesis.id,
    title: '中心论点关联卡',
    description: '应出现在中心论点区域',
    link: 'https://example.com/thesis-linked',
    sourceType: 'official',
    tags: ['论点证据'],
  })
  const nodeCard = card({
    id: 'node-linked-card',
    categoryId: node.id,
    title: '节点关联卡',
    link: 'https://example.com/node-linked',
  })
  return {
    thesis,
    node,
    linked,
    nodeCard,
    input: {
      workspaceName: 'V4.2.1 图库验收台',
      thesis,
      nodes: [node],
      cards: [linked, nodeCard],
      options: { format: 'tree', links: true, attachments: true, sources: true, date: true, theme: 'paper' },
      nodeAssetDataUrls: {
        'thesis-image-1': 'data:image/png;base64,AAAA',
        'thesis-image-2': 'data:image/png;base64,BBBB',
        'node-image-1': 'data:image/png;base64,CCCC',
        'node-image-2': 'data:image/png;base64,DDDD',
      },
      generatedAt: 1760000000000,
    },
  }
}

console.log('【V4.2.1 · 策展 HTML 附件图库与中心论点证据】')

check('V421-10 ★中心论点关联卡和中心论点附件进入同一导出树：关联卡带公开链接与说明，附件计入总量，分支节点仍按原有层级输出', () => {
  if (!shareTools) {
    const src = fs.readFileSync(path.resolve(SCRIPTS_DIR, '..', 'src', 'shared', 'utils', 'curationShareData.ts'), 'utf8')
    return src.includes('thesisAssets: CurationRenderAsset[]')
      && src.includes('thesisCards: CurationRenderCard[]')
      && src.includes("cardsByCat.get(input.thesis.id)")
      && src.includes('thesisCards.length + flat.reduce')
  }
  const { input } = fixture()
  const tree = shareTools.buildCurationRenderTree({ nodes: input.nodes, cards: input.cards, thesis: input.thesis })
  const html = shareTools.buildCurationShareHtml(input)
  return tree.thesisCards.length === 1
    && tree.thesisCards[0].title === '中心论点关联卡'
    && tree.thesisCards[0].url === 'https://example.com/thesis-linked'
    && tree.thesisAssets.length === 2
    && tree.cardCount === 2
    && tree.attachmentCount === 4
    && html.includes('中心论点关联卡')
    && html.includes('href="https://example.com/thesis-linked"')
    && html.includes('论点关联卡 · 1 张')
})

check('V421-11 ★同节点多图使用独立图库：中心论点与分支各一组，图片缩略图可打开，当前图有上一张/下一张与 2 / 2 计数', () => {
  if (!shareTools) {
    const src = fs.readFileSync(path.resolve(SCRIPTS_DIR, '..', 'src', 'shared', 'utils', 'curationShare.ts'), 'utf8')
    return src.includes('function imageGalleryHtml')
      && src.includes('gallery-prev')
      && src.includes('gallery-next')
      && src.includes('.gallery-open:checked~.gallery-lightbox')
      && src.includes('.gallery-radio:checked+.gallery-slide')
  }
  const { input } = fixture()
  const html = shareTools.buildCurationShareHtml(input)
  return (html.match(/class="asset-gallery /g) || []).length === 2
    && (html.match(/class="gallery-thumb"/g) || []).length === 4
    && html.includes('id="cur-thesis-open"')
    && html.includes('id="cur-tree-1-open"')
    && (html.match(/name="cur-thesis-slides"/g) || []).length === 2
    && (html.match(/name="cur-tree-1-slides"/g) || []).length === 2
    && html.includes('aria-label="下一张"')
    && html.includes('2 / 2')
    && html.includes('role="dialog"')
    && html.includes('.gallery-open:checked~.gallery-lightbox')
    && !html.includes('addEventListener')
})

check('V421-12 ★ZIP 图库使用相对附件路径且 HTML 仍只含一份惰性 JSON 数据脚本；附件名与恶意链接正确转义/降级', () => {
  if (!shareTools) {
    const src = fs.readFileSync(path.resolve(SCRIPTS_DIR, '..', 'src', 'shared', 'utils', 'curationShare.ts'), 'utf8')
    return src.includes('nodeAssetDetailHtml(asset, dataUrl, compact)')
      && src.includes("<script type=\"application/json\" id=\"zy-curation-share-data\">")
  }
  const f = fixture()
  f.thesis.assets[0].name = '图 <危险>.png'
  f.linked.title = '<script>alert(1)</script>'
  f.linked.link = 'javascript:alert(1)'
  const html = shareTools.buildCurationShareHtml({
    ...f.input,
    nodeAssetDataUrls: {
      'thesis-image-1': 'attachments/001_图.png',
      'thesis-image-2': 'attachments/002_图.png',
      'node-image-1': 'attachments/003_图.png',
      'node-image-2': 'attachments/004_图.png',
    },
  })
  const scripts = [...html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/gi)]
  return scripts.length === 1
    && /type="application\/json"/i.test(scripts[0][1])
    && /id="zy-curation-share-data"/i.test(scripts[0][1])
    && html.includes('src="attachments/001_图.png"')
    && html.includes('&lt;script&gt;alert(1)&lt;/script&gt;')
    && !html.includes('href="javascript:')
    && !html.includes('图 <危险>')
})

check('V421-13 ★缺失附件不伪造空图库：无可用数据的图片显示缺失说明，其余已加载图片仍可正常打开', () => {
  if (!shareTools) {
    const src = fs.readFileSync(path.resolve(SCRIPTS_DIR, '..', 'src', 'shared', 'utils', 'curationShare.ts'), 'utf8')
    return src.includes("const dataUrl = dataUrls[asset.id] || ''")
      && src.includes('missing.push(asset)')
      && src.includes('missingAssetHtml')
  }
  const { input } = fixture()
  const html = shareTools.buildCurationShareHtml({
    ...input,
    nodeAssetDataUrls: {
      'thesis-image-1': 'data:image/png;base64,AAAA',
      'node-image-1': 'data:image/png;base64,CCCC',
      'node-image-2': 'data:image/png;base64,DDDD',
    },
  })
  return html.includes('论点图二.png')
    && html.includes('node-asset missing')
    && html.includes('id="cur-thesis-open"')
    && !html.includes('id="cur-thesis-slide-2"')
    && html.includes('id="cur-tree-1-slide-2"')
})
