/**
 * G-03 / G-04 / G-10 长期回归夹具。
 *
 * 这一片只锁“产品行为合同”，不锁临时实现细节：
 * - 好奇心 ↔ 资源卡：独立关联表、导入合并、解绑不动源卡；
 * - 四段画像 AI：四入口、懒载入、只读、失败保留本地诊断、事实白名单；
 * - 更新日志：左目录 / 右内容、可定位、可键盘操作、窄屏单列；
 * - 策展长期夹具：L1–L4、公开/非公开链接、附件、空节点、两种布局、拖拽子树与回导。
 */
const { check, read, codeOnly } = require('./helpers.cjs')

console.log('【G-03 / G-04 / G-10 · 长期体验回归】')

const MODELS = read('/shared/models/index.ts')
const REPO = read('/shared/storage/repository.ts')
const SUPPORT = read('/shared/utils/supportLinks.ts')
const CURIO = read('/newtab/components/compass/CuriosityPanel.vue')
const RANGE_AI = read('/newtab/composables/useRangeAiInsight.ts')
const PROFILE = read('/newtab/views/ProfileInsights.vue')
const REPORT = read('/newtab/views/profileInsightsReport.ts')
const SELECT = read('/shared/ai/select.ts')
const REGISTRY = read('/shared/ai/jobs/registry.ts')
const CHANGELOG = read('/newtab/views/settings/SettingsChangelogPanel.vue')
const SHARE_DATA = read('/shared/utils/curationShareData.ts')
const SHARE_IMPORT = read('/newtab/composables/useCurationShareImport.ts')
const MIND = read('/newtab/composables/useCurationMindMap.ts')
const MIND_UI = read('/newtab/components/curation/CurationMindMap.vue')

check('G102-1 好奇心资源支撑是独立表：AppData.curioSupportLinks + 记录型关联，三卡本体不持有 resourceId / curioId', () => {
  const curiosity = MODELS.slice(MODELS.indexOf('export interface CuriosityCard'), MODELS.indexOf('export type AnyCard'))
  return MODELS.includes('export interface CurioSupportLink')
    && MODELS.includes('curioSupportLinks?: CurioSupportLink[]')
    && MODELS.includes("from: 'ai' | 'manual'")
    && !curiosity.includes('resourceId')
    && !curiosity.includes('supportLinks')
    && SUPPORT.includes('curioByCurio')
    && SUPPORT.includes('curioByResource');
});

check('G102-2 好奇心资源支撑导入合并：curioSupportLinks 走按 id 并集，不把关联记录塞进三卡对象', () => {
  return REPO.includes('curioSupportLinks: mergeByIdArr(cur.curioSupportLinks || [], snap.curioSupportLinks || [], ext.curioSupportLinks || [])')
    && REPO.includes('supportLinks: mergeByIdArr(cur.supportLinks || [], snap.supportLinks || [], ext.supportLinks || [])')
    && !REPO.includes('curiosity.resourceId')
    && !REPO.includes('resource.curioId');
});

check('G102-3 好奇心资源支撑 add/remove/purge：新增去重、解绑只删记录、硬删按两端 id 清卫生，均不碰源卡字段', () => {
  const add = SUPPORT.slice(SUPPORT.indexOf('export function addCurioSupportLink'), SUPPORT.indexOf('export function removeCurioSupportLink'))
  const remove = SUPPORT.slice(SUPPORT.indexOf('export function removeCurioSupportLink'), SUPPORT.indexOf('export function purgeCurioSupportLinks'))
  const purge = SUPPORT.slice(SUPPORT.indexOf('export function purgeCurioSupportLinks'), SUPPORT.indexOf('/** 某任务'))
  return add.includes('list.some(x => x.curioId === input.curioId && x.resourceId === input.resourceId)')
    && add.includes("id: uid('csl')")
    && add.includes('why: input.why.slice(0, 120)')
    && !add.includes('.deletedAt =')
    && !add.includes('.updatedAt =')
    && remove.includes('list.splice(i, 1)')
    && !remove.includes('resourceId =')
    && !remove.includes('deletedAt =')
    && purge.includes('curioIds && opt.curioIds.has(l.curioId)')
    && purge.includes('resourceIds && opt.resourceIds.has(l.resourceId)')
    && purge.includes('d.curioSupportLinks = kept');
});

check('G102-4 好奇心资源支撑索引软删过滤：任一端的卡软删后隐藏关联，恢复后无需重建记录即可回挂', () => {
  return SUPPORT.includes('const liveCurio = new Set((d.curiosities || []).filter(c => c && !c.deletedAt).map(c => c.id))')
    && SUPPORT.includes('const liveRes = new Set((d.resources || []).filter(r => r && !r.deletedAt).map(r => r.id))')
    && SUPPORT.includes('if (!l || !liveCurio.has(l.curioId) || !liveRes.has(l.resourceId)) continue')
    && SUPPORT.includes('pushCurio(idx.curioByCurio, l.curioId, l)')
    && SUPPORT.includes('pushCurio(idx.curioByResource, l.resourceId, l)');
});

check('G102-5 好奇详情“资源支撑”交互完整：搜索资源、显示当前关联、28px 可点解绑、打开原文；解绑文案明说源卡未变', () => {
  return CURIO.includes('<b>资源支撑</b>')
    && CURIO.includes('buildSupportIndex(d.value)')
    && CURIO.includes('listByCurio(curioSupportIdx.value, curio.id)')
    && CURIO.includes('curioSupportDraft')
    && CURIO.includes('curioSupportCands')
    && CURIO.includes('addCurioSupportLink(d.value')
    && CURIO.includes('removeCurioSupportLink(d.value, linkId)')
    && CURIO.includes('class="ds-sup-remove"')
    && CURIO.includes('aria-label="解除资源关联"')
    && CURIO.includes('.ds-sup-remove { flex: none; width: 28px; height: 28px;')
    && CURIO.includes('资源卡本体未变动')
    && CURIO.includes('openCurioSupportResource(row.resource)');
});

check('G102-6 四段 AI 续写入口存在且只在点击后动态载入：today/week/month/year 四段各有一枚，AI 工厂与配置均走 import()', () => {
  return ['PiToday', 'PiRhythm', 'PiMonth', 'PiYear'].every(name => PROFILE.includes(`<${name}`))
    && (PROFILE.match(/@ai-insight="openRangeAi"/g) || []).length === 4
    && PROFILE.includes('useRangeAiInsight({')
    && RANGE_AI.includes("import('@/shared/ai/config')")
    && RANGE_AI.includes("import('@/shared/ai/select')")
    && !/import\s+(?!type\b)[^\n]*from\s+['"]@\/shared\/ai\/select['"]/.test(RANGE_AI)
    && !RANGE_AI.includes("from '@/shared/ai/config'");
});

check('G102-7 四段 AI 只读：buildRangeInsightJob adoptable:false、无 apply、无 withReport，不自动落卡', () => {
  const body = SELECT.slice(SELECT.indexOf('export function buildRangeInsightJob'), SELECT.indexOf('\nexport function', SELECT.indexOf('export function buildRangeInsightJob') + 10))
  return body.includes('adoptable: false')
    && body.includes('rawText: true')
    && body.includes('promptScope: `insight:${range}`')
    && !body.includes('withReport(')
    && !body.includes('apply:')
    && !body.includes('persist()');
});

check('G102-8 四段 AI 入口登记：range-insight 指向 useRangeAiInsight，能力声明与源码一致', () => {
  const at = REGISTRY.indexOf("id: 'range-insight'")
  const body = REGISTRY.slice(at, REGISTRY.indexOf('\n  },', at) + 4)
  return at >= 0
    && body.includes("factory: 'buildRangeInsightJob'")
    && body.includes("factoryFile: 'shared/ai/select.ts'")
    && body.includes("hosts: ['newtab/composables/useRangeAiInsight.ts']")
    && body.includes('before: true')
    && body.includes("paneMode: 'context'")
    && body.includes('rawText: true')
    && body.includes('adoptable:false')
    && body.includes('不自动落卡');
});

check('G102-9 四段 AI 失败保留本地：配置缺失与工厂失败只 toast，不覆盖 concise 本地诊断，不写 store', () => {
  const fn = RANGE_AI.slice(RANGE_AI.indexOf('async function open'), RANGE_AI.indexOf('return { job'))
  return fn.includes("if (!aiReady.value)")
    && fn.includes('showToast(')
    && fn.includes('return')
    && fn.includes('catch (error)')
    && fn.includes('showToast(')
    && !fn.includes('concise')
    && !fn.includes('persist()')
    && !fn.includes('job.value = null')
    && PROFILE.includes(':insight="concise.today"')
    && PROFILE.includes(':insight="concise.week"')
    && PROFILE.includes(':insight="concise.month"')
    && PROFILE.includes(':insight="concise.year"');
});

check('G102-10 四段 AI 事实白名单：事实全部由 profileRangeFacts 产出，函数只读已算好的本地读数，不新增统计口径', () => {
  const fact = REPORT.slice(REPORT.indexOf('export function profileRangeFacts'), REPORT.indexOf('export function profileExportLines'))
  return fact.includes("if (range === 'today')")
    && fact.includes("else if (range === 'week')")
    && fact.includes("else if (range === 'month')")
    && fact.includes('本年高价值冷却卡')
    && fact.includes('本地诊断：')
    && fact.includes('今日入台')
    && fact.includes('本周有效动作')
    && fact.includes('本月入池')
    && fact.includes('当前存活卡片共')
    && !fact.includes('fetch(')
    && !fact.includes('readEventLog')
    && !fact.includes('useAppStore')
    && PROFILE.includes('facts: range => profileRangeFacts(range, {');
});

check('G102-11 更新日志双栏结构：gs-cl-shell 左目录 button + data-version 内容 + active/current 双态 + 右侧独立滚动', () => {
  return CHANGELOG.includes('class="gs-cl-shell"')
    && CHANGELOG.includes('<nav class="gs-cl-dir" aria-label="更新日志版本目录">')
    && CHANGELOG.includes('<button v-for="e in orderedChangelog"')
    && CHANGELOG.includes('class="gs-cl-dir-item"')
    && CHANGELOG.includes(':data-version="e.version"')
    && CHANGELOG.includes("{ current: e.version === runtimeVersion, active: activeVersion === e.version }")
    && CHANGELOG.includes('ref="contentRef" class="gs-cl-list"')
    && CHANGELOG.includes('overflow: auto')
    && CHANGELOG.includes('max-height: min(72vh, 720px)')
    && CHANGELOG.includes('class="gs-cl-entry-body"')
    && CHANGELOG.includes('grid-template-columns: repeat(2, minmax(0, 1fr))');
});

check('G102-12 更新日志目录可定位且同步高亮：点击 scrollTo 对应 data-version，滚动只走同一套位置口径更新 active（不得再用 IntersectionObserver 抢选中）；目录项 44px 键盘可达', () => {
  return CHANGELOG.includes('querySelector<HTMLElement>(`[data-version="${version}"]`)')
    && CHANGELOG.includes("root.scrollTo({ top: Math.max(0, top), behavior: 'smooth' })")
    && CHANGELOG.includes('activeVersion.value = version')
    && CHANGELOG.includes('jumpLock = Date.now() + 900')
    && CHANGELOG.includes('if (Date.now() < jumpLock) return')
    && !CHANGELOG.includes('new IntersectionObserver')
    && CHANGELOG.includes('requestAnimationFrame(() => {')
    && CHANGELOG.includes('syncActiveFromScroll()')
    // 最早的版本通常短于视口高度，滚到底时不会跨过高亮探测线；底边必须直接选中末条。
    && CHANGELOG.includes("const atBottom = root.scrollTop + root.clientHeight >= root.scrollHeight - 2")
    && CHANGELOG.includes("root.querySelector<HTMLElement>('.gs-cl-item:last-child')")
    && CHANGELOG.includes('.gs-cl-dir-item { position: relative; width: 100%; min-height: 44px;')
    && CHANGELOG.includes(':focus-visible')
    && CHANGELOG.includes(':aria-current="activeVersion === e.version ? \'true\' : undefined"');
});

check('G102-13 更新日志窄屏单列：720px 以下目录在上、内容在下，目录限高 190px，画布不再双列挤压', () => {
  const media = CHANGELOG.slice(CHANGELOG.indexOf('@media (max-width: 720px)'))
  return media.includes('.gs-cl-shell { grid-template-columns: 1fr; gap: 12px; }')
    && media.includes('.gs-cl-dir { position: static; max-height: none; }')
    && media.includes('.gs-cl-dir-list { max-height: 190px; }')
    && media.includes('.gs-cl-list { max-height: none; overflow: visible;');
});

check('G102-14 策展长期夹具的结构合同：共享树保留 L1–L4、公开/无公开 URL、附件、空节点、金字塔/树状两布局', () => {
  return SHARE_DATA.includes('level: number')
    && SHARE_DATA.includes('maxLevel: 4')
    && SHARE_DATA.includes('url: safeUrl(card.link) || undefined')
    && SHARE_DATA.includes('assets: (card.assets || []).map(asset => ({')
    && SHARE_DATA.includes('children: CurationRenderNode[]')
    && MIND.includes("export type CurationCanvasLayout = 'pyramid' | 'tree'")
    && MIND.includes('const layout = ref<CurationCanvasLayout>(\'pyramid\')')
    && MIND_UI.includes("emit('update:layout', 'pyramid')")
    && MIND_UI.includes("emit('update:layout', 'tree')")
    && MIND_UI.includes(':data-layout="layout"');
});

check('G102-15 策展长期夹具的操作合同：拖拽移动整棵子树、剪切/粘贴共用 validateDrop，树形结构随 parentId 改变后再次构建', () => {
  return MIND.includes('function descendantsOf(id: string)')
    && MIND.includes('catIdx.value.descendants(id)')
    && MIND.includes('function validateDrop(dragId: string, targetId: string)')
    && MIND.includes('catIdx.value.descendants(dragId).includes(targetId)')
    && MIND.includes('nodeLevel(target) + nodeHeight(dragged)')
    && MIND.includes('dragged.parentId = target.id')
    && MIND.includes('normalizeSiblings(oldParent)')
    && MIND.includes('normalizeSiblings(target.id)')
    && MIND.includes('function cutNode(id: string)')
    && MIND.includes('function pasteInto(targetId: string)')
    && MIND.includes('const moved = moveNode(id, targetId)')
    && MIND_UI.includes('@drop="onDrop"')
    && MIND_UI.includes("emit('move', source, id)");
});

check('G102-16 策展回导闭环：导入 HTML 走同一解析快照，新建/合并都按节点树回归，公开 URL 与附件边界不泄露本地资产', () => {
  return SHARE_IMPORT.includes('parseCurationShareHtml')
    && SHARE_IMPORT.includes('function importNew()')
    && SHARE_IMPORT.includes('function importMerge()')
    && SHARE_IMPORT.includes('const walk = (nodes: CurationImportNode[]')
    && SHARE_IMPORT.includes('walk(snap.nodes)')
    && SHARE_IMPORT.includes('createPoolCard(raw, now)')
    && SHARE_IMPORT.includes("linkType: 'url'")
    && SHARE_IMPORT.includes('link: raw.url || \'\'')
    && !SHARE_IMPORT.includes('zy-asset://')
    && !SHARE_IMPORT.includes('localStorage');
});
