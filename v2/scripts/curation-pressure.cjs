#!/usr/bin/env node
/**
 * G-02 策展导出压力与边界门禁。
 *
 * 直接加载 shared/utils/curationShareData.ts 的真实实现，不复制第二套规则；
 * 长图侧用最小假 canvas 验证「超限先拒绝、绝不先分配巨大画布」。
 *
 * 用法：node scripts/curation-pressure.cjs
 * 退出码：0 = 全部 PASS；1 = 任一 FAIL。
 */
'use strict'

const path = require('path')
const esbuild = require('esbuild')

const ROOT = path.resolve(__dirname, '..')
const SHARE_DATA_TS = path.join(ROOT, 'src/shared/utils/curationShareData.ts')
const CURATION_IMAGE_TS = path.join(ROOT, 'src/shared/utils/curationImage.ts')

function loadTs(entry) {
  const built = esbuild.buildSync({
    entryPoints: [entry],
    bundle: true,
    write: false,
    format: 'cjs',
    platform: 'node',
    target: 'node18',
    logLevel: 'silent',
  })
  const module = { exports: {} }
  const run = new Function('module', 'exports', 'require', '__filename', '__dirname', built.outputFiles[0].text)
  run(module, module.exports, require, entry, path.dirname(entry))
  return module.exports
}

const shareData = loadTs(SHARE_DATA_TS)
const curationImage = loadTs(CURATION_IMAGE_TS)
const LIMITS = shareData.CURATION_RENDER_LIMITS

let passed = 0
let failed = 0

async function test(name, fn) {
  try {
    await fn()
    passed++
    console.log(`PASS  ${name}`)
  } catch (error) {
    failed++
    console.error(`FAIL  ${name}`)
    console.error(`      ${error instanceof Error ? error.message : String(error)}`)
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function assertThrows(fn, pattern, message) {
  let thrown = null
  try {
    fn()
  } catch (error) {
    thrown = error
  }
  assert(thrown, message + '（实际没有抛出）')
  const text = thrown instanceof Error ? thrown.message : String(thrown)
  assert(pattern.test(text), `${message}（实际错误：${text}）`)
  return text
}

function cat(id, parentId, order = 0, name = id) {
  return { id, workspaceId: 'pressure-board', name, order, parentId }
}

function thesis() {
  const now = Date.now()
  return {
    id: 'pressure-thesis',
    kind: 'resource',
    title: '压力边界中心论点',
    description: '验证 L1-L4 与超限拒绝',
    linkType: 'url',
    link: 'https://example.com/thesis',
    workspaceId: 'pressure-board',
    categoryId: '',
    tags: [],
    pinned: false,
    callCount: 0,
    customFields: {},
    createdAt: now,
    updatedAt: now,
    isThesis: true,
  }
}

function resource(id, categoryId, index = 0) {
  const now = Date.now()
  return {
    id,
    kind: 'resource',
    title: `压力资源 ${index}`,
    linkType: 'url',
    link: `https://example.com/${id}`,
    workspaceId: 'pressure-board',
    categoryId,
    tags: ['压力测试'],
    pinned: false,
    callCount: 0,
    customFields: {},
    createdAt: now,
    updatedAt: now,
    assets: index % 25 === 0 ? [{ id: `asset-${id}`, kind: 'pdf', name: `${id}.pdf`, size: 1024, mime: 'application/pdf', createdAt: now }] : [],
  }
}

function chain(length) {
  const nodes = []
  for (let index = 0; index < length; index++) {
    nodes.push(cat(`pressure-c${index + 1}`, index ? `pressure-c${index}` : undefined, index, `第 ${index + 2} 层`))
  }
  return nodes
}

function fakeCanvasEnvironment() {
  const state = { canvases: 0, widthWrites: 0, heightWrites: 0, toDataUrlCalls: 0 }
  const context = {
    font: '',
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    textAlign: 'left',
    shadowColor: '',
    shadowBlur: 0,
    shadowOffsetY: 0,
    measureText(value) { return { width: String(value || '').length * 8 } },
    beginPath() {},
    moveTo() {},
    lineTo() {},
    arcTo() {},
    arc() {},
    closePath() {},
    fill() {},
    stroke() {},
    fillRect() {},
    strokeRect() {},
    fillText() {},
    save() {},
    restore() {},
    scale() {},
    clearRect() {},
  }
  class Canvas {
    constructor() {
      state.canvases++
      this._width = 300
      this._height = 150
    }
    get width() { return this._width }
    set width(value) {
      state.widthWrites++
      this._width = value
    }
    get height() { return this._height }
    set height(value) {
      state.heightWrites++
      this._height = value
    }
    getContext() { return context }
    toDataURL() {
      state.toDataUrlCalls++
      return 'data:image/png;base64,'
    }
    toBlob(callback) {
      callback(new Blob([], { type: 'image/png' }))
    }
  }
  return {
    state,
    document: {
      createElement(tag) {
        if (tag !== 'canvas') throw new Error(`压力测试只应创建 canvas，实际创建 ${tag}`)
        return new Canvas()
      },
    },
  }
}

async function assertRejects(fn, pattern, message) {
  let thrown = null
  try {
    await fn()
  } catch (error) {
    thrown = error
  }
  assert(thrown, message + '（实际没有抛出）')
  const text = thrown instanceof Error ? thrown.message : String(thrown)
  assert(pattern.test(text), `${message}（实际错误：${text}）`)
  return text
}

async function main() {
  console.log('== 策展导出压力与边界门禁 · curation-pressure ==')

  await test('上限常量齐备且数值合理', () => {
    assert(LIMITS && typeof LIMITS === 'object', '缺少 CURATION_RENDER_LIMITS')
    assert(LIMITS.nodes === 5000, `nodes 应为 5000，实际 ${LIMITS.nodes}`)
    assert(LIMITS.cards === 5000, `cards 应为 5000，实际 ${LIMITS.cards}`)
    assert(LIMITS.maxLevel === 4, `maxLevel 应为 4，实际 ${LIMITS.maxLevel}`)
    assert(LIMITS.maxLogicalWidth === 20000, `maxLogicalWidth 应为 20000，实际 ${LIMITS.maxLogicalWidth}`)
    assert(LIMITS.maxLogicalHeight === 30000, `maxLogicalHeight 应为 30000，实际 ${LIMITS.maxLogicalHeight}`)
    assert(LIMITS.maxPixelArea === 40000000, `maxPixelArea 应为 40000000，实际 ${LIMITS.maxPixelArea}`)
    assert(LIMITS.maxLogicalWidth < LIMITS.maxLogicalHeight, '逻辑高度应允许比宽度更长')
    assert(LIMITS.maxPixelArea < LIMITS.maxLogicalWidth * LIMITS.maxLogicalHeight, '像素面积上限必须小于逻辑面积理论上限')
    assert(Number.isSafeInteger(LIMITS.maxPixelArea) && LIMITS.maxPixelArea <= 2 ** 26, '像素面积上限应能被浏览器 canvas 安全承接')
  })

  await test('限制断言：5000 节点 / 5000 资源 / L4 恰好通过', () => {
    shareData.assertCurationRenderLimits({ nodeCount: 5000, cardCount: 5000, maxLevel: 4 })
  })

  await test('限制断言：5001 节点拒绝', () => {
    assertThrows(
      () => shareData.assertCurationRenderLimits({ nodeCount: 5001, cardCount: 0, maxLevel: 4 }),
      /5001.*5000/,
      '5001 节点应被拒绝',
    )
  })

  await test('限制断言：5001 资源拒绝', () => {
    assertThrows(
      () => shareData.assertCurationRenderLimits({ nodeCount: 1, cardCount: 5001, maxLevel: 4 }),
      /5001.*5000/,
      '5001 资源应被拒绝',
    )
  })

  await test('限制断言：L4 通过，真实层级到 L5 拒绝', () => {
    shareData.assertCurationRenderLimits({ nodeCount: 1, cardCount: 0, maxLevel: 4 })
    assertThrows(
      () => shareData.assertCurationRenderLimits({ nodeCount: 1, cardCount: 0, maxLevel: 5 }),
      /L5.*L4/,
      'L5 应被拒绝',
    )
  })

  await test('真实树构建：L1 → L4 通过', () => {
    const tree = shareData.buildCurationRenderTree({
      nodes: chain(3),
      cards: [],
      thesis: thesis(),
    })
    assert(tree.nodeCount === 3, `节点数应为 3，实际 ${tree.nodeCount}`)
    assert(tree.maxLevel === 4, `最大层级应为 L4，实际 L${tree.maxLevel}`)
    assert(tree.flat.map(node => node.level).join(',') === '2,3,4', '层级序列应为 L2,L3,L4')
  })

  await test('真实树构建：节点真实到 L5 时拒绝', () => {
    assertThrows(
      () => shareData.buildCurationRenderTree({
        nodes: chain(4),
        cards: [],
        thesis: thesis(),
      }),
      /L5.*L4/,
      '真实第五层节点应被拒绝',
    )
  })

  await test('真实树构建：5000 个节点通过', () => {
    const nodes = Array.from({ length: 5000 }, (_, index) => cat(`limit-node-${index}`, undefined, index))
    const tree = shareData.buildCurationRenderTree({ nodes, cards: [], thesis: thesis() })
    assert(tree.nodeCount === 5000, `节点数应为 5000，实际 ${tree.nodeCount}`)
    assert(tree.maxLevel === 2, `无子级时最大层级应为 L2，实际 L${tree.maxLevel}`)
  })

  await test('真实树构建：5001 个节点拒绝', () => {
    const nodes = Array.from({ length: 5001 }, (_, index) => cat(`over-node-${index}`, undefined, index))
    assertThrows(
      () => shareData.buildCurationRenderTree({ nodes, cards: [], thesis: thesis() }),
      /5001.*5000/,
      '5001 个节点应被拒绝',
    )
  })

  await test('真实树构建：5000 张资源通过，5001 张拒绝', () => {
    const nodes = [cat('resource-root')]
    const cards5000 = Array.from({ length: 5000 }, (_, index) => resource(`limit-card-${index}`, 'resource-root', index))
    const tree = shareData.buildCurationRenderTree({ nodes, cards: cards5000, thesis: thesis() })
    assert(tree.cardCount === 5000, `资源数应为 5000，实际 ${tree.cardCount}`)

    const cards5001 = cards5000.concat(resource('over-card', 'resource-root', 5000))
    assertThrows(
      () => shareData.buildCurationRenderTree({ nodes, cards: cards5001, thesis: thesis() }),
      /5001.*5000/,
      '5001 张资源应被拒绝',
    )
  })

  await test('长图逻辑尺寸超限先拒绝，不写 canvas 宽高', async () => {
    const fake = fakeCanvasEnvironment()
    const previousDocument = global.document
    global.document = fake.document
    try {
      const nodes = Array.from({ length: 60 }, (_, index) => cat(`wide-${index}`, undefined, index))
      const error = await assertRejects(
        () => curationImage.renderCurationImage({
          workspaceName: '压力画布',
          thesis: thesis(),
          nodes,
          cards: [],
          layout: 'pyramid',
          theme: 'paper',
        }),
        /逻辑尺寸上限/,
        '60 个并列一级节点应超出逻辑宽度',
      )
      assert(/20000/.test(error), `错误应点名宽度上限，实际：${error}`)
      assert(fake.state.canvases === 1, '应只创建一张空 canvas 做能力探测')
      assert(fake.state.widthWrites === 0, '超限时不得写入 canvas.width')
      assert(fake.state.heightWrites === 0, '超限时不得写入 canvas.height')
      assert(fake.state.toDataUrlCalls === 0, '超限时不得进入 PNG 编码')
    } finally {
      global.document = previousDocument
    }
  })

  await test('超过 5000 节点时在布局前 fail-fast，不分配巨大 canvas', async () => {
    const fake = fakeCanvasEnvironment()
    const previousDocument = global.document
    global.document = fake.document
    try {
      const nodes = Array.from({ length: 5001 }, (_, index) => cat(`over-canvas-${index}`, undefined, index))
      await assertRejects(
        () => curationImage.renderCurationImage({
          workspaceName: '超限画布',
          thesis: thesis(),
          nodes,
          cards: [],
          layout: 'pyramid',
          theme: 'paper',
        }),
        /5001.*5000/,
        '5001 节点应在画布分配前被拒绝',
      )
      assert(fake.state.canvases === 1, '应只创建一张空 canvas 做能力探测')
      assert(fake.state.widthWrites === 0, 'fail-fast 时不得写入 canvas.width')
      assert(fake.state.heightWrites === 0, 'fail-fast 时不得写入 canvas.height')
      assert(fake.state.toDataUrlCalls === 0, 'fail-fast 时不得进入 PNG 编码')
    } finally {
      global.document = previousDocument
    }
  })

  await test('长图源码把尺寸与像素面积前置校验放在 canvas 分配之前', () => {
    const source = require('fs').readFileSync(CURATION_IMAGE_TS, 'utf8')
    const widthCheck = source.indexOf('width > CURATION_RENDER_LIMITS.maxLogicalWidth')
    const heightCheck = source.indexOf('height > CURATION_RENDER_LIMITS.maxLogicalHeight')
    const pixelCheck = source.indexOf('pixelWidth * pixelHeight > CURATION_RENDER_LIMITS.maxPixelArea')
    const allocation = source.search(/canvas\.width\s*=/)
    assert(widthCheck >= 0 && heightCheck >= 0, '缺少逻辑宽高校验')
    assert(pixelCheck >= 0, '缺少像素面积校验')
    assert(allocation > widthCheck && allocation > heightCheck && allocation > pixelCheck, 'canvas 分配必须晚于三项前置校验')
  })

  console.log(`\n结果：${passed} PASS / ${failed} FAIL`)
  process.exitCode = failed ? 1 : 0
}

main().catch(error => {
  console.error('curation-pressure 执行失败：', error)
  process.exitCode = 1
})
