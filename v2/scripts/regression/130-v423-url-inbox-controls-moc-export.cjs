/**
 * V4.2.3 · 采集口径、资源 URL 唯一、受限存量合并、资源控制行、
 * 策展图片全屏与 HTML 附件下载、今日复制 MOC 前缀。
 */
const fs = require('fs')
const { check, read, path, SCRIPTS_DIR, CUR_VTAG } = require('./helpers.cjs')

let esbuild = null
try { esbuild = require('esbuild') } catch { /* source fallback below */ }

function loadTsTool(entry, suffix) {
  if (!esbuild) return null
  const src = path.resolve(SCRIPTS_DIR, '..', 'src')
  const out = path.resolve(SCRIPTS_DIR, '..', `.${suffix}-v423.tmp.cjs`)
  try {
    esbuild.buildSync({
      entryPoints: [path.resolve(src, entry)],
      bundle: true,
      platform: 'node',
      format: 'cjs',
      outfile: out,
      logLevel: 'silent',
      alias: { '@': src },
    })
    return require(out)
  } catch {
    return null
  } finally {
    try { fs.unlinkSync(out) } catch { /* no artifact on compile failure */ }
  }
}

function loadShareTools() {
  if (!esbuild) return null
  const src = path.resolve(SCRIPTS_DIR, '..', 'src')
  const build = name => {
    const out = path.resolve(SCRIPTS_DIR, '..', `.${name}-v423.tmp.cjs`)
    try {
      esbuild.buildSync({
        entryPoints: [path.resolve(src, 'shared', 'utils', name + '.ts')],
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

const dedupe = loadTsTool('shared/storage/captureDedupe.ts', 'capture-dedupe')
const focusCopy = loadTsTool('shared/utils/focusCopy.ts', 'focus-copy')
const urlTool = loadTsTool('shared/utils/url.ts', 'url')
const shareTools = loadShareTools()

function resource(overrides = {}) {
  return {
    id: 'res_' + Math.random().toString(36).slice(2),
    kind: 'resource',
    title: '资源卡',
    linkType: 'url',
    link: '',
    workspaceId: 'zy-curation',
    categoryId: '',
    tags: [],
    pinned: false,
    callCount: 0,
    customFields: {},
    createdAt: 1000,
    updatedAt: 1000,
    ...overrides,
  }
}

function asset(id, name, kind = 'image') {
  return {
    id,
    name,
    kind,
    size: 128,
    mime: kind === 'image' ? 'image/png' : 'application/pdf',
    createdAt: 1,
  }
}

console.log('【V4.2.3 · 采集口径 / URL 唯一 / 资源控制行 / 全屏与附件导出 / MOC 复制】')

check('V423-1 ★采集产品口径：桌面端快捷键直接进入三卡池，手机 PWA 进入 Inbox；Inbox 保留三卡转化，但不再宣传为全产品唯一采集入口', () => {
  const manual = read('/newtab/manual-data.ts')
  const inbox = read('/newtab/components/compass/InboxPanel.vue')
  const settings = read('/newtab/views/settings/SettingsCloudSync.vue')
  return manual.includes('桌面浏览器：快捷键 → 直接采集到')
    && manual.includes('手机 PWA：文本 / 链接 → <b>Inbox</b>')
    && manual.includes('Inbox 不是全产品唯一的采集入口')
    && manual.includes('移动采集与待处理收件箱')
    && !manual.includes('Inbox 是唯一转化入口')
    && inbox.includes('移动采集与待处理收件箱')
    && settings.includes('桌面端也可用快捷键直接采集到对应卡池')
})

check('V423-2 ★同一 HTTP(S) 规范 URL 只能存在一张有效资源卡：采集浮层保存前读取最新数据树复核，资源详情新建 / 编辑、移动 Inbox 转化和书签导入共用 canonicalHttpUrl', () => {
  const overlay = read('/content/overlay-capture.ts')
  const popup = read('/newtab/components/useGlobalPopupsCapture.ts')
  const drawer = read('/newtab/composables/useResourceDrawer.ts')
  const inbox = read('/newtab/composables/useInbox.ts')
  const bookmarks = read('/newtab/composables/useBookmarkImport.ts')
  return overlay.includes('latestResources.find')
    && overlay.includes('canonicalHttpUrl(r.link) === fp')
    && !overlay.includes('__zy_dup_force__')
    && popup.includes('canonicalHttpUrl')
    && drawer.includes('canonicalHttpUrl')
    && inbox.includes('existingResourceForUrl')
    && bookmarks.includes('canonicalHttpUrl(resource.link) === urlKey')
})

check('V423-3 ★URL 归一化覆盖大小写域名、追踪参数、锚点和尾斜杠；非 HTTP(S) 不进入网页资源去重池', () => {
  if (!urlTool) {
    const src = read('/shared/utils/url.ts')
    return src.includes('TRACKING_PARAM_PREFIXES')
      && src.includes('url.hostname = url.hostname.toLowerCase()')
      && src.includes('url.hash = ')
      && src.includes('url.pathname = url.pathname.slice(0, -1)')
  }
  const a = urlTool.canonicalHttpUrl('https://Example.COM/path/?utm_source=x&b=2#part')
  const b = urlTool.canonicalHttpUrl('https://example.com/path?b=2')
  return a === b
    && !!a
    && urlTool.canonicalHttpUrl('obsidian://open?vault=x') === ''
})

check('V423-4 ★存量修复按安全顺序合并：同 capture id → 同规范 URL → 仅“标题完全一致 + 60 秒内 + 一侧无 URL”兜底；不做纯标题全局去重', () => {
  if (!dedupe) {
    const src = read('/shared/storage/captureDedupe.ts')
    return src.includes('LEGACY_DUPLICATE_WINDOW_MS = 60_000')
      && src.includes('captureGroups')
      && src.includes('urlGroups')
      && src.includes('candidates.length !== 1')
  }
  const sameUrlA = resource({ id: 'same-url-a', link: 'https://Example.com/a/?utm_source=x#top', createdAt: 1000 })
  const sameUrlB = resource({ id: 'same-url-b', link: 'https://example.com/a', createdAt: 1100 })
  const urlData = { resources: [sameUrlA, sameUrlB] }
  dedupe.reconcileCapturedResources(urlData)

  const sameTitleA = resource({ id: 'same-title-a', link: 'https://a.example/item', createdAt: 1000 })
  const sameTitleB = resource({ id: 'same-title-b', link: 'https://b.example/item', createdAt: 500000 })
  const titleData = { resources: [sameTitleA, sameTitleB] }
  dedupe.reconcileCapturedResources(titleData)

  const legacyUrl = resource({ id: 'legacy-url', link: 'https://legacy.example/item', createdAt: 2000 })
  const legacyBlank = resource({ id: 'legacy-blank', linkType: 'url', link: '', createdAt: 2030 })
  const legacyData = { resources: [legacyUrl, legacyBlank] }
  dedupe.reconcileCapturedResources(legacyData)

  const oldBlank = resource({ id: 'old-blank', linkType: 'url', link: '', createdAt: 90000 })
  const oldData = { resources: [resource({ id: 'old-url', link: 'https://old.example/item', createdAt: 2000 }), oldBlank] }
  dedupe.reconcileCapturedResources(oldData)

  return urlData.resources.filter(row => !row.deletedAt).length === 1
    && titleData.resources.filter(row => !row.deletedAt).length === 2
    && legacyData.resources.filter(row => !row.deletedAt).length === 1
    && oldData.resources.filter(row => !row.deletedAt).length === 2
})

check('V423-5 ★重复资源合并时迁移常用夹、任务支持、好奇心支持、策展投射与愿景 / 使命旧引用，避免镜像继续指向回收站 id', () => {
  if (!dedupe) {
    const src = read('/shared/storage/captureDedupe.ts')
    return src.includes('migrateResourceReferences')
      && src.includes('data.supportLinks')
      && src.includes('data.curioSupportLinks')
      && src.includes('data.curationProjections')
      && src.includes('data.resourceFolderMirrors')
  }
  const keeper = resource({
    id: 'keeper',
    link: 'https://duplicate.example/item',
    sourceCaptureId: 'cap-dup',
    createdAt: 1000,
  })
  const duplicate = resource({
    id: 'duplicate',
    link: '',
    sourceCaptureId: 'cap-dup',
    createdAt: 1010,
  })
  const data = {
    resources: [keeper, duplicate],
    supportLinks: [{ id: 's1', taskId: 't1', resourceId: 'duplicate', from: 'manual', createdAt: 1 }],
    curioSupportLinks: [{ id: 'c1', curioId: 'q1', resourceId: 'duplicate', from: 'manual', createdAt: 1 }],
    curationProjections: [{ id: 'p1', kind: 'card', wsId: 'zy-curation', targetWsId: 'ws1', targetCatId: 'cat1', cardId: 'duplicate', addedAt: 1 }],
    resourceFolderMirrors: [{ id: 'm1', folderId: 'f1', resourceId: 'duplicate', order: 0, addedAt: 1 }],
    compass: { vision: { content: '', updatedAt: 1, linkedResourceIds: ['duplicate'] }, mission: { content: '', updatedAt: 1, linkedResourceIds: ['duplicate'] } },
  }
  dedupe.reconcileCapturedResources(data)
  return data.supportLinks[0].resourceId === 'keeper'
    && data.curioSupportLinks[0].resourceId === 'keeper'
    && data.curationProjections[0].cardId === 'keeper'
    && data.resourceFolderMirrors[0].resourceId === 'keeper'
    && data.compass.vision.linkedResourceIds[0] === 'keeper'
    && data.compass.mission.linkedResourceIds[0] === 'keeper'
    && data.resources.find(row => row.id === 'duplicate').deletedAt > 0
})

check('V423-5b ★URL 去重合并不得丢采集身份、来源类型或另外两条链接槽：保留卡缺省字段由重复卡补齐，双方已有值仍以保留卡为准', () => {
  if (!dedupe) {
    const src = read('/shared/storage/captureDedupe.ts')
    return src.includes('keeper.sourceCaptureId ||') === false
      && src.includes('if (!keeper.sourceCaptureId && duplicate.sourceCaptureId)')
      && src.includes('keeper.linkSlots = { ...(duplicate.linkSlots')
  }
  const keeper = resource({
    id: 'same-url-keeper',
    link: 'https://identity.example/item',
    createdAt: 1000,
    updatedAt: 3000,
    customFields: {},
  })
  const duplicate = resource({
    id: 'same-url-duplicate',
    link: 'https://identity.example/item?utm_source=dup',
    createdAt: 1100,
    updatedAt: 2000,
    sourceCaptureId: 'cap-identity',
    sourceType: 'official',
    customFields: { captureInboxId: 'cap-identity' },
    linkSlots: { file: 'file:///tmp/source.pdf', obsidian: 'obsidian://open?vault=v&file=x' },
  })
  const data = { resources: [keeper, duplicate] }
  dedupe.reconcileCapturedResources(data)
  const live = data.resources.filter(row => !row.deletedAt)
  const merged = data.resources.find(row => row.id === 'same-url-keeper')
  return live.length === 1
    && merged.sourceCaptureId === 'cap-identity'
    && merged.customFields.captureInboxId === 'cap-identity'
    && merged.sourceType === 'official'
    && merged.linkSlots.file === 'file:///tmp/source.pdf'
    && merged.linkSlots.obsidian === 'obsidian://open?vault=v&file=x'
})

check('V423-6 ★资源池控制行：状态筛选是下拉框且默认全部；常用夹位于控制行最右侧并保持强调视觉', () => {
  const pool = read('/newtab/components/compass/PoolCardsPanel.vue')
  const controls = read('/newtab/components/compass/DeckControls.vue')
  return pool.includes('filter-kind="select"')
    && pool.includes("const calledFilter = ref<CalledFilter>('all')")
    && pool.includes("label: '待打标'")
    && pool.includes("id: 'called'")
    && pool.includes("id: 'never'")
    && controls.indexOf('<slot name="tail" />') > controls.indexOf('newLabel')
    && pool.includes('pcp-folder-entry')
    && pool.includes('加入常用夹')
})

check('V423-7 ★策展图片全屏修复：Teleport 沉浸层自身请求原生全屏，失败仍有固定层；全屏中保留左右切换、缩放、拖动、下载，Esc 交给全屏层先处理', () => {
  const preview = read('/newtab/components/curation/CurationAssetPreviewModal.vue')
  return preview.includes('const immersiveRef = ref<HTMLElement | null>(null)')
    && preview.includes('const root = immersiveRef.value')
    && preview.includes('await root.requestFullscreen()')
    && preview.includes('ref="immersiveRef"')
    && preview.includes(':close-on-esc="!immersive"')
    && preview.includes('@click="step(-1)"')
    && preview.includes('@click="step(1)"')
    && preview.includes('title="下载当前图片"')
})

check('V423-8 ★策展 HTML 导出：底部附件清单退役；中心论点 / 节点 / 资源卡附件都进入图库或下载入口；图片带下载，非图片“下载并打开”，缺失附件明确提示', () => {
  if (!shareTools) {
    const share = read('/shared/utils/curationShare.ts')
    const data = read('/shared/utils/curationShareData.ts')
    return !share.includes('attachment-section')
      && share.includes('data-download-open')
      && share.includes('本体缺失，无法下载')
      && share.includes('card.assets')
      && data.includes('id: asset.id')
  }
  const thesis = resource({
    id: 'thesis-v423',
    title: '中心论点',
    isThesis: true,
    categoryId: '',
    assets: [asset('thesis-image', '论点图.png')],
  })
  const linked = resource({
    id: 'thesis-card-v423',
    title: '关联卡',
    categoryId: thesis.id,
    link: 'https://example.com/thesis-card',
    assets: [
      asset('card-image', '卡图.png'),
      asset('card-pdf', '说明.pdf', 'pdf'),
      asset('card-missing', '缺体.html', 'html'),
    ],
  })
  const node = {
    id: 'cat-v423',
    workspaceId: 'ws-v423',
    name: '分支',
    order: 0,
    assets: [asset('node-image', '节点图.png')],
  }
  const nodeCard = resource({
    id: 'node-card-v423',
    title: '节点关联卡',
    categoryId: node.id,
    link: 'https://example.com/node-card',
    assets: [asset('node-card-image', '节点卡图.png')],
  })
  const base = {
    workspaceName: 'V4.2.3 验收台',
    thesis,
    nodes: [node],
    cards: [linked, nodeCard],
    options: { format: 'reading', links: true, attachments: true, sources: true, date: true, theme: 'paper' },
    nodeAssetDataUrls: {
      'thesis-image': 'data:image/png;base64,AAAA',
      'card-image': 'data:image/png;base64,BBBB',
      'card-pdf': 'data:application/pdf;base64,CCCC',
      'node-image': 'data:image/png;base64,DDDD',
      'node-card-image': 'data:image/png;base64,EEEE',
    },
    generatedAt: 1760000000000,
  }
  const reading = shareTools.buildCurationShareHtml(base)
  const tree = shareTools.buildCurationShareHtml({ ...base, options: { ...base.options, format: 'tree' } })
  const scripts = [...reading.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/gi)]
  return !reading.includes('attachment-section')
    && !reading.includes('可追溯的材料')
    && !tree.includes('attachment-section')
    && reading.includes('id="cur-thesis-card-1-open"')
    && reading.includes('id="cur-reading-1-card-1-open"')
    && reading.includes('id="cur-reading-1-open"')
    && reading.includes('class="asset-download gallery-download"')
    && reading.includes('data-download-open')
    && reading.includes('下载并打开')
    && reading.includes('本体缺失，无法下载')
    && scripts.length === 2
    && !/\bsrc=/i.test(scripts[0][1])
})

check('V423-9 ★今日三件事复制固定加 MOC- 前缀且不重复：项目名为“workbuddy培训项目”或“MOC-workbuddy培训项目”都输出同一句', () => {
  if (!focusCopy) {
    const src = read('/shared/utils/focusCopy.ts')
    return src.includes('project.replace(/^MOC-/i')
      && src.includes('推进[[${mocProjectName(project)}]]项目')
  }
  const input = {
    projectName: 'workbuddy培训项目',
    taskTitle: '用workbuddy解决职场办公的100个方案',
    metricName: '教程文章20篇',
  }
  const expected = '推进[[MOC-workbuddy培训项目]]项目，用workbuddy解决职场办公的100个方案，助力【教程文章20篇】指标落实到位'
  return focusCopy.buildDailyFocusCopyText(input) === expected
    && focusCopy.buildDailyFocusCopyText({ ...input, projectName: 'MOC-workbuddy培训项目' }) === expected
    && focusCopy.buildDailyFocusCopyText({ ...input, metricName: '' }) === ''
})

check('V423-10 ★V4.2.3 手册与应用内版本同源：流程手册写清桌面直达、移动 Inbox、MOC 复制、资源下拉筛选与附件下载打开', () => {
  const manual = read('/newtab/manual-data.ts')
  const page = read('/newtab/views/ManualPage.vue')
  return manual.includes(CUR_VTAG)
    && manual.includes('推进[[MOC-项目名]]项目')
    && manual.includes('状态筛选收进下拉框')
    && manual.includes('附件点击后下载并打开')
    && page.includes(CUR_VTAG)
})
