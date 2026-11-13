/**
 * V4.2.1 · 采集资源卡重复：
 * - 同一条 Inbox 采集被旧导入与后续转化各写一张时，按 capture id 合并；
 * - 合并后保留带链接、标签与完整描述的那张；
 * - 普通同名资源（capture id 不同）不得误合并；
 * - 新旧两代溯源字段在转换前必须被识别，避免再生成第二张。
 */
const { check, read, path, SCRIPTS_DIR } = require('./helpers.cjs')
const fs = require('fs')

console.log('【V4.2.1 · 采集资源卡幂等与存量去重】')

let esbuild = null
try { esbuild = require('esbuild') } catch { /* shape fallback below */ }

function loadRealCaptureDedupe() {
  if (!esbuild) return null
  const entry = path.resolve(SCRIPTS_DIR, '..', 'src', 'shared', 'storage', 'captureDedupe.ts')
  const out = path.resolve(SCRIPTS_DIR, '..', '.capture-dedupe.tmp.cjs')
  try {
    esbuild.buildSync({
      entryPoints: [entry],
      bundle: true,
      platform: 'node',
      format: 'cjs',
      outfile: out,
      logLevel: 'silent',
      alias: { '@': path.resolve(SCRIPTS_DIR, '..', 'src') },
    })
    return require(out)
  } catch {
    return null
  } finally {
    try { fs.unlinkSync(out) } catch { /* no artifact on compile failure */ }
  }
}

const dedupe = loadRealCaptureDedupe()

function resource(overrides) {
  return {
    id: 'res_' + Math.random().toString(36).slice(2),
    kind: 'resource',
    title: '职场办公 AI Agent 解决方案 · 全景地图',
    linkType: 'url',
    link: '',
    workspaceId: 'zy-curation',
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

check('V421-6 ★同一条采集的旧卡与新卡按 capture id 合并：保留带源 URL、标签和完整描述的一张，另一张软删进回收站，资源池只留下一张正确卡', () => {
  if (!dedupe) {
    const src = read('/shared/storage/captureDedupe.ts')
    return src.includes('export function reconcileCapturedResources')
      && src.includes('duplicate.deletedAt = now')
      && src.includes('if (!hasText(keeper.link) && hasText(duplicate.link))')
  }
  const legacy = resource({
    id: 'res_legacy_capture',
    title: '职场办公 AI Agent 解决方案 · 全景地图',
    customFields: { captureInboxId: 'cap-421-duplicate' },
    tags: [],
    description: '',
  })
  const current = resource({
    id: 'res_current_capture',
    title: '职场办公 AI Agent 解决方案 · 全景地图',
    sourceCaptureId: 'cap-421-duplicate',
    customFields: { captureInboxId: 'cap-421-duplicate' },
    link: 'https://example.com/capture-421',
    tags: ['事业策展台', '效能系统搭建'],
    description: '采集链接与来源摘要',
    updatedAt: 10,
  })
  const data = { resources: [legacy, current] }
  const changed = dedupe.reconcileCapturedResources(data)
  const live = data.resources.filter(row => !row.deletedAt)
  return changed >= 1
    && live.length === 1
    && live[0].link === 'https://example.com/capture-421'
    && live[0].tags.includes('效能系统搭建')
    && live[0].sourceCaptureId === 'cap-421-duplicate'
    && data.resources.some(row => row.id === 'res_legacy_capture' && row.deletedAt > 0)
})

check('V421-7 ★去重只认 capture id，不按标题粗暴合并：两张同名但来自不同采集的资源卡仍各自存活', () => {
  if (!dedupe) {
    const src = read('/shared/storage/captureDedupe.ts')
    return src.includes('如果普通同名资源不会因为标题相同被误删')
      || src.includes('普通同名资源不会因为标题相同被误删')
  }
  const a = resource({ id: 'res_cap_a', sourceCaptureId: 'cap-a', link: 'https://a.example', customFields: {} })
  const b = resource({ id: 'res_cap_b', sourceCaptureId: 'cap-b', link: 'https://b.example', customFields: {} })
  const data = { resources: [a, b] }
  dedupe.reconcileCapturedResources(data)
  return data.resources.filter(row => !row.deletedAt).length === 2
})

check('V421-8（V4.3.0 退役重指）★旧数据兼容仍识别两代溯源字段：sourceCaptureId 与 customFields.captureInboxId / capture_inbox_id 任一命中都在去重合并时复用旧卡，并把缺失的链接、标签、描述补回旧卡而不新建第二张', () => {
  const identity = read('/shared/utils/captureIdentity.ts')
  const dedupe = read('/shared/storage/captureDedupe.ts')
  return identity.includes("const CAPTURE_FIELD_KEYS = ['captureInboxId', 'capture_inbox_id'] as const")
    && identity.includes('export function cardMatchesCaptureId')
    && identity.includes('export function ensureCaptureIdentity')
    && dedupe.includes('captureIdOfCard')
    && dedupe.includes('ensureCaptureIdentity(keeper, captureId)')
    && dedupe.includes('keeper.link = duplicate.link')
    && dedupe.includes('keeper.description = duplicate.description')
    && dedupe.includes('keeper.tags = uniqueStrings([keeper.tags, duplicate.tags])')
    && dedupe.includes('export function reconcileCapturedResources(data: AppData): number')
})

check('V421-9 ★去重挂在三个入库边界而非单一读路径：启动加载、云恢复与数据包导入都会执行；字段配置缺失也不再触发 visibleFields 运行错误', () => {
  const repo = read('/shared/storage/repository.ts')
  const pkg = read('/newtab/views/settings/dataPackage.ts')
  const fields = read('/shared/utils/fields.ts')
  return repo.includes("import { reconcileCapturedResources } from './captureDedupe'")
    && repo.includes('try { reconcileCapturedResources(data) } catch')
    && repo.includes('try { reconcileCapturedResources(opts.nextData) } catch')
    && pkg.includes('reconcileCapturedResources(d)')
    && fields.includes("return (cfg?.[type] || [])")
    && fields.includes("return [...(cfg?.[type] || [])]")
})
