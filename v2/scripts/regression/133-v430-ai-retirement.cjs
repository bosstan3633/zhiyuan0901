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

check('V430-1（V4.3.1 重指）周期 AI 分析整体退役：今天 / 本周 / 本月 / 本年均不挂 PiAiReview，年度热力图与事实统计仍在', () => {
  const files = [
    '/newtab/components/profile/PiToday.vue',
    '/newtab/components/profile/PiRhythm.vue',
    '/newtab/components/profile/PiMonth.vue',
    '/newtab/components/profile/PiYear.vue',
  ]
  const year = read('/newtab/components/profile/PiYear.vue')
  return files.every(file => {
    const source = read(file)
    return !source.includes('PiAiReview') && source.includes('class="strip4"')
  })
    && year.includes('<Heatmap') && year.includes('<LifecyclePanel')
    && !exists('/newtab/components/profile/PiAiReview.vue')
})

check('V430-2（V4.3.1 重指）周期 AI 状态机物理删除：usePeriodAiReview 与 periodReview 工具文件均不存在，宿主零残留', () => {
  const host = codeOnly(read('/newtab/views/useProfileInsights.ts'))
  return !exists('/newtab/composables/usePeriodAiReview.ts')
    && !exists('/shared/utils/periodReview.ts')
    && !host.includes('usePeriodAiReview')
    && !host.includes('currentPeriodAi')
    && !host.includes('onPeriodAiAction')
})

check('V430-3（V4.3.1 重指）周期 AI 工厂整体删除：select 与 scenarios 不再暴露 buildPeriodReviewJob / periodReviewSystem', () => {
  const source = read('/shared/ai/select.ts')
  const scenarios = read('/shared/ai/scenarios.ts')
  return !source.includes('buildPeriodReviewJob')
    && !source.includes('parsePeriodReview')
    && !scenarios.includes('periodReviewSystem')
})

check('V430-4（V4.3.1 重指）周期 AI 能力登记清零：jobs registry 无 period-review，画像宿主不再传 insight / ai 事件', () => {
  const registry = read('/shared/ai/jobs/registry.ts')
  const profile = read('/newtab/views/ProfileInsights.vue')
  return !registry.includes("id: 'period-review'")
    && !registry.includes('buildPeriodReviewJob')
    && !profile.includes(':insight="concise.')
    && !profile.includes(':ai="currentPeriodAi"')
})

check('V430-5（V4.3.1 重指）事实统计保留、AI 分析不回填：四个周期组件均无 ai-* emits，画像页不再出现周期 AI 操作出口', () => {
  const files = [
    '/newtab/components/profile/PiToday.vue',
    '/newtab/components/profile/PiRhythm.vue',
    '/newtab/components/profile/PiMonth.vue',
    '/newtab/components/profile/PiYear.vue',
  ]
  const host = read('/newtab/views/useProfileInsights.ts')
  return files.every(file => !read(file).includes("'ai-"))
    && !host.includes('currentPeriodAi')
    && !host.includes('regeneratePeriodAi')
    && !host.includes('openAiConfig')
    && !host.includes('applyPeriodReview')
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

