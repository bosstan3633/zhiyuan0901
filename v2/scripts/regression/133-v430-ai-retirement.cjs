/**
 * V4.3.0 · AI 周期复盘与 Inbox / PWA 退役。
 *
 * 两条产品边界：
 * 1. 今天 / 本周 / 本月 / 本年只给 AI 洞察与安全导航，不自动改归属、绑卡或完成任务。
 * 2. 采集主线只保留浏览器扩展，移动 PWA 与 PC Inbox 物理退役；旧数据字段仍可读取。
 */
const fs = require('fs')
const path = require('path')
const { check, read, codeOnly, exists } = require('./helpers.cjs')

console.log('【V4.3.0 · AI 周期复盘与 Inbox / PWA 退役】')

check('V430-1 四周期全部挂载同一个 PiAiReview：今天 / 本周 / 本月 / 本年不再各写一套诊断条', () => {
  const files = [
    '/newtab/components/profile/PiToday.vue',
    '/newtab/components/profile/PiRhythm.vue',
    '/newtab/components/profile/PiMonth.vue',
    '/newtab/components/profile/PiYear.vue',
  ]
  return files.every(file => {
    const source = read(file)
    return source.includes("import PiAiReview from './PiAiReview.vue'")
      && source.includes('<PiAiReview')
      && source.includes("@navigate=\"emit('ai-navigate', $event)\"")
  })
})

check('V430-2 周期 AI 由统一状态机驱动：四个 range、按需动态加载 AI、运行结果只进入页面状态与缓存', () => {
  const source = codeOnly(read('/newtab/composables/usePeriodAiReview.ts'))
  return source.includes("const RANGES: PeriodReviewRange[] = ['today', 'week', 'month', 'year']")
    && source.includes("import('@/shared/ai/config')")
    && source.includes("import('@/shared/ai/select')")
    && source.includes("import('@/shared/ai/llm')")
    && source.includes('select.buildPeriodReviewJob(range, context)')
    && source.includes('loadCached(range, context)')
    && !source.includes('saveData(')
    && !source.includes('store.persist(')
    && !source.includes('applyPeriod')
})

check('V430-3 AI 工厂明确只读：adoptable:false，输出结构是洞察与导航目标，不暴露采纳写库入口', () => {
  const source = read('/shared/ai/select.ts')
  const start = source.indexOf('export function buildPeriodReviewJob')
  const end = source.indexOf('export function buildSearchRerankJob', start)
  const body = source.slice(start, end > start ? end : source.length)
  return start > 0
    && body.includes('adoptable: false')
    && body.includes('parsePeriodReview(String(raw')
    && body.includes('badge: \'洞察\'')
    && !body.includes('apply:')
    && !body.includes('saveData(')
})

check('V430-4 复盘上下文确由账号级战报、方向树与策展状态组成，动作目标只取白名单并消毒', () => {
  const source = read('/shared/utils/periodReview.ts')
  return source.includes('countEvents(input.events, window.start, window.end)')
    && source.includes('directionTree: {')
    && source.includes('curation: {')
    && source.includes('activity: {')
    && source.includes('allowedTargets: buildAllowedTargets(data, directions)')
    && source.includes('ctx.allowedTargets.find(')
    && source.includes('parsePeriodReview')
})

check('V430-5 本地降级边界：未配置或失败时 PiAiReview 只显示事实基线，不伪造洞察', () => {
  const view = read('/newtab/components/profile/PiAiReview.vue')
  const host = read('/newtab/views/useProfileInsights.ts')
  return view.includes('本地事实基线')
    && view.includes('AI 尚未配置')
    && view.includes('props.fallback')
    && host.includes('currentPeriodAi')
    && host.includes('onPeriodAiAction')
    && !host.includes('applyPeriodReview')
    && !host.includes('autoMount')
})

check('V430-6 移动采集 PWA 整体退役：源码、静态资源、独立配置与 GitHub Pages 工作流均不存在', () => {
  const pkg = fs.readFileSync(path.resolve(__dirname, '..', '..', 'package.json'), 'utf8')
  return !exists('/mobile/App.vue')
    && !fs.existsSync(path.resolve(__dirname, '..', '..', 'mobile-public'))
    && !fs.existsSync(path.resolve(__dirname, '..', '..', 'vite.mobile.config.ts'))
    && !fs.existsSync(path.resolve(__dirname, '..', '..', 'tsconfig.mobile.json'))
    && !fs.existsSync(path.resolve(__dirname, '..', '..', '..', '.github', 'workflows', 'mobile-pages.yml'))
    && !pkg.includes('build:pwa')
})

check('V430-7 PC Inbox 整体退役：组件与 composable 物理移除，首页只留三池，旧深链回首页，云端不再请求 capture_inbox', () => {
  const home = codeOnly(read('/newtab/views/CompassHome.vue'))
  const deck = codeOnly(read('/newtab/views/CompassDeckView.vue'))
  const router = read('/newtab/router.ts')
  const cloud = codeOnly(read('/shared/cloud/client.ts'))
  const sync = codeOnly(read('/shared/cloud/sync.ts'))
  const settings = codeOnly(read('/newtab/views/settings/SettingsCloudSync.vue'))
  return !exists('/newtab/components/compass/InboxPanel.vue')
    && !exists('/newtab/components/compass/InboxCaptureDrawer.vue')
    && !exists('/newtab/components/compass/InboxCountBadge.vue')
    && !exists('/newtab/composables/useInbox.ts')
    && home.includes("handTab === 'task'")
    && home.includes("handTab === 'curiosity'")
    && home.includes("handTab === 'resource'")
    && !home.includes('handTab === \'inbox\'')
    && deck.includes("type DeckKind = 'task' | 'curiosity' | 'resource'")
    && !deck.includes('InboxPanel')
    && router.includes("path: '/deck/inbox'")
    && router.includes("redirect: '/'")
    && !cloud.includes('capture_inbox')
    && !sync.includes('capture_inbox')
    && !settings.includes('capture_inbox')
})

check('V430-8 浏览器采集成主线且旧数据兼容：三型采集仍直接入池，两代 capture 溯源字段在去重时继续可读', () => {
  const capture = codeOnly(read('/content/overlay-capture.ts'))
  const identity = read('/shared/utils/captureIdentity.ts')
  const dedupe = read('/shared/storage/captureDedupe.ts')
  const model = read('/shared/models/index.ts')
  return capture.includes('workspaceId: CURATION_WS_ID')
    && capture.includes('d2.tasks?.unshift(task)')
    && capture.includes('d.curiosities?.unshift')
    && capture.includes('d2.resources?.unshift(resource)')
    && identity.includes("const CAPTURE_FIELD_KEYS = ['captureInboxId', 'capture_inbox_id'] as const")
    && identity.includes('sourceCaptureId')
    && dedupe.includes('reconcileCapturedResources')
    && model.includes('sourceCaptureId?: string')
})

check('V430-9 策展分享抽屉只在打开时校验树深：超限显示可读提示，不在进入策展台时触发全局渲染错误', () => {
  const source = codeOnly(read('/newtab/components/curation/CurationShareDrawer.vue'))
  return source.includes('if (!props.open) return { tree: EMPTY_RENDER_TREE, error: \'\' }')
    && source.includes('catch (error)')
    && source.includes('const renderError = computed(() => renderState.value.error)')
    && source.includes('v-if="renderError"')
    && source.includes('disabled="imageBusy || !!renderError')
})

