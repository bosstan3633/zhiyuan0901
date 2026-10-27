import { ref, reactive, computed, watch, watchEffect, onMounted, shallowRef } from 'vue'
import { wsDisplayNameOf, wsNameById } from '@/shared/utils/wsName'
import { useRouter, useRoute } from 'vue-router'
import { useAppStore } from '../stores/app'
import { saveUIPrefs, loadUIPrefs, getBytesInUse, subscribeSaveError, getLastSaveError, clearLastSaveError, hasUnlimitedStorage, stripRetiredCardKeys, normalizeLegacyCards } from '@/shared/storage/repository'
import { useConfirm } from '@/shared/components/confirm'
import { showToast } from '@/shared/components/toast'
import { testConnection, runSync, quotaHint, catPathOf, DEFAULT_TAG_COLUMN } from '@/shared/storage/airtable'
import { CHANGELOG, kindGroupsOf } from '../changelog-data'
import { uid, dateKey, weekStartKey } from '@/shared/utils'
import { getMutationSeq } from '@/shared/storage/repository'
import { freshTagsOf, knownTagSet, canonicalTagsOf } from '@/shared/utils/tags'
import type { FieldDef, AppData, ResourceCard, TaskCard, CuriosityCard, Workspace, Category, TagNode, ID } from '@/shared/models'
import Drawer from '@/shared/components/Drawer.vue'
import type { AiJob, AiRow } from '@/shared/ai/job'
import { aiConfig, loadAiConfig, patchAiConfig, aiReady, type AiDepth } from '@/shared/ai/config'
import { listModels, testConnection as aiTestConnection, chatStream, extractJson } from '@/shared/ai/llm'
import { projectCards, projectLibrary, catPathOf as aiCatPathOf } from '@/shared/ai/project'
import { batchEnrichSystem, diagnosisSystem, allPersonas, personaOverrides, sanitizeRefs, type EnrichSuggestion } from '@/shared/ai/scenarios'
import { buildTagGovernJob, buildTrashRescueJob, buildTagBlueprintJob, buildTagAssignJob, consumeTagBlueprintAdopted, getTagReviseBackup, restoreTagReviseBackup , reviseSnips } from '@/shared/ai/govern'
import { buildReviewJob } from '@/shared/ai/select'
import { withReport } from '@/shared/ai/reports'
import { listJobStates, clearFinished, type JobState } from '@/shared/ai/runner'
import { buildDeliverJob } from '@/shared/ai/batchG'
import { useBookmarkImport } from '@/newtab/composables/useBookmarkImport'
import { toOpenableUrl, openExternalLink } from '@/shared/utils/link'
import { recordResourceOpen } from '../stores/compass'
import { openHtmlAsset } from '@/shared/utils/htmlAsset'
import { useGlobalSettingsPanels } from './useGlobalSettingsPanels'

export interface NavItem { key: string; icon?: string; label: string; route?: string; mark?: boolean }
export interface TagNodeLite { id: string; name: string; children?: TagNodeLite[] }
export interface FlatT { id: string; name: string; depth: number; node: TagNodeLite; parent: TagNodeLite | null }
export interface TtRow { kind: 'resource' | 'task' | 'curiosity'; id: string; title: string; sub: string; link?: string; desc?: string; status?: string; tags: string[] }

export function useGlobalSettings() {
const logoUrl = '/icons/icon128.png' // R174-2 减重：与 public/icons/icon128.png 逐字节同源，走公共路径不再重复入库
// R63-4：Airtable 单向同步（连接测试 / 立即同步 / 配额提示）
// V3.8.42 P0-3：「一封信」子域随迁（letter-data 仍留在原处，仅模板与下载函数搬出）
// V3.8.42 P0-3：已搬出的子域组件（判据锚点由 helpers 的设置页聚合读取层接住，214 处读设置页正文的判据零改动）
// R63-1/63-2：全景两级（资源台/策展台）与导出镜像卡适配
/* ★W9 退役重指带备案：标签管理面板的「卡片详情」抽屉仍在本页（ttDetail），Drawer 壳的 import 不随
   仪表盘/生命周期两组抽屉一起删——本轮漏删导致模板 <Drawer> 无对应 import，被 R113-2 孤儿组件护栏抓到。 */
// R113-N2：资源生命周期聚合页（入口从三宿主收敛至此；内嵌式面板 + 三类卡聚合 + 跨台定位）
// V3.8.9（W9）：资源生命周期聚合页退役 —— LifecyclePanel + 宿主逻辑迁至画像洞察页 /profile §3。
// R110-LC-3/4 门禁带退役重指备案改写。
// R134-F（批次 F）：AI 助手——地基三件套（config/llm/projector/scenarios）+ 建议评审抽屉。
// 性能纪律：shared/ai 只被懒加载路由（设置页/详情抽屉）静态消费，不进启动链；密钥存独立键 zy_ai_v1 不随导出。

const router = useRouter()
const route = useRoute()
const store = useAppStore()
const shortcutsUrl = 'chrome://extensions/shortcuts'


// ---- 导航 ----
/** R146（回退契约 ⑨）：导航项可挂路由出口——回收站是整页（列表+批量操作），设置页内不重复实现一份 */
function onNavClick(item: NavItem) {
  if (item.route) { router.push(item.route); return }
  activePage.value = item.key
}
// V3.8.9（W9）：默认首屏改为「资源卡」——原「知源仪表盘」退役迁至画像洞察页（/profile），
// 「资源生命周期」面板同步迁出；R44-6 门禁带退役重指备案改写。
/** 附件包导入的**中转**：实现随「导出数据」子域搬走了（连附件统计刷新一起），
 *  而驱动它的是导入页那枚 zip input。两个子域不能互相引用（会成环），
 *  所以由宿主当一次转发点：import emit → 这里 → export 的 expose。 */
const exportRef = ref<{ handleAssetPackImport?: (e: Event) => void } | null>(null)
function onAssetPack(e: Event) { exportRef.value?.handleAssetPackImport?.(e) }

const activePage = ref('resource')
/** 深链：/settings?page=tags 直达指定面板（TagPicker 空体系引导跳转用） */
function pageFromQuery(): string | null {
  const p = route.query.page
  if (typeof p !== 'string') return null
  return navGroups.some(g => g.items.some(i => i.key === p && !i.route)) ? p : null
}
onMounted(() => {
  const p = pageFromQuery(); if (p) activePage.value = p
  // 第卅六轮 REQ-038：关于页容量水位 + 保存错误订阅 + 备份提醒状态
  refreshStorage()
  // REQ-048：深链直达导出页时初始化附件统计
  const unsub = subscribeSaveError((e) => { saveError.value = e })
  // 卸载时取消订阅（实例可能被路由复用）
  return () => unsub && unsub()
})

/** 第卅六轮 REQ-038：关于页运行时版本号 + 数据水位 + 错误显示 */
const runtimeVersion = (() => {
  try {
    const m = (chrome as any)?.runtime?.getManifest?.()
    return m?.version || '?'
  } catch { return '?' }
})()

/**
 * S5 / V3.8.38：更新日志展示顺序——**当前版本恒在首位**，其余按数据原序（倒序）。
 * 为什么显式排而不靠数组顺序：数据文件本就倒序，「当前版本在首」目前是巧合；
 * 一旦有人把数组改成正序、或某版本尚未发 tag 就先进表，首位就不再是当前版本，
 * 「当前版本一眼可见」这条验收会静默失效。这里把展示顺序与数据顺序解耦。
 */
const orderedChangelog = (() => {
  const cur = CHANGELOG.find(e => e.version === runtimeVersion)
  if (!cur) return CHANGELOG
  return [cur, ...CHANGELOG.filter(e => e.version !== runtimeVersion)]
})()
const bytesInUse = ref(0)
const unlimitedStorage = ref(hasUnlimitedStorage())
const saveError = ref(getLastSaveError())
async function refreshStorage() {
  bytesInUse.value = await getBytesInUse()
}
function markSaveErrorRead() {
  clearLastSaveError()
  saveError.value = null
  showToast('已清除异常标记')
}
function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / (1024 * 1024)).toFixed(2)} MB`
}
function saveErrorLabel(k: 'quota' | 'serial' | 'unknown'): string {
  return k === 'quota' ? '配额超限' : k === 'serial' ? '序列化失败' : '写入异常'
}

watch(() => route.query.page, () => { const p = pageFromQuery(); if (p) activePage.value = p })
const navGroups: { title: string; items: NavItem[] }[] = [
  // R54-E1（修订第卌四轮五组拍板）：总览 = 知源仪表盘 + 策展台全景并列，「整理」组取消
  // R178（原型 sns-group-title）：分组对齐设置中心原型——通用与度量 / 卡片与字段 / AI 认知协作者 / 数据与信任 / 系统信息（条目与功能零增减）
  { title: '通用与度量', items: [
    // V3.8.9（W9）：知源仪表盘（key: dashboard）与资源生命周期（key: lifecycle）退役——
    // 前者整体迁画像洞察页 /profile（概览带+复盘段+操作记录），后者迁 /profile §3。R110-LC-3/4 带退役备案改写。
    // 本组暂空；「通用与度量」语义由画像洞察页承担（/profile）。
  ]},
  { title: '卡片与字段', items: [
    { key: 'resource', icon: 'filetext', label: '资源卡' },
    { key: 'task', icon: 'checksquare', label: '任务卡' },
    { key: 'curiosity', icon: 'bulb', label: '好奇心卡' },
    // R62-3：策展主题卡字段组（isThesis 资源卡专用）
    { key: 'thesis', icon: 'landmark', label: '策展主题卡' },
    // 第卌四轮 Q-6：标签管理上移——它服务卡片呈现，与三卡同组
    { key: 'tags', icon: 'tag', label: '标签管理' },
  ]},
  // R178：AI 认知协作者独立成组（原型分组口径）
  { title: 'AI 认知协作者', items: [
    // R134-F：AI 助手（接入配置 + 沉睡唤醒 + 一键诊断）· R146/R152：入口徽标统一（真源 AiMark.vue）
    { key: 'ai', mark: true, label: 'AI 助手' },
  ]},
  { title: '数据与信任', items: [
    { key: 'import', icon: 'download', label: '导入数据' },
    { key: 'export', icon: 'upload', label: '导出数据' },
    // R146-⑨：删除有两条路（回收站可反悔 / 永久删除不可逆），入口必须常驻左栏而不是埋在危险区里
    { key: 'recycle', icon: 'trash', label: '回收站', route: '/recycle' },
    { key: 'reset', icon: 'rotateccw', label: '重置与回滚' },
  ]},
  { title: '系统信息', items: [
    { key: 'extension', icon: 'settings', label: '扩展设置' },
    { key: 'shortcuts', icon: 'zap', label: '快捷键设置' },
    // R178：Airtable 归入「数据与信任」语义组（原型口径；同键不动，仅分组位置）
    { key: 'airtable', icon: 'refresh', label: 'Airtable 同步' },
    { key: 'manual', icon: 'book', label: '使用手册' },
    { key: 'letter', icon: 'mail', label: '一封信' },
    // W5（V3.8.5）：产品更新日志——时间线看版本演变
    { key: 'changelog', icon: 'clipboard', label: '产品更新日志' },
    { key: 'about', icon: 'question', label: '关于' },
  ]},
]

// ---- 字段配置 ----
const fields = computed({
  get: () => store.data!.fieldConfig,
  set: (v) => { if (store.data) { store.data.fieldConfig = v; store.persist() } }
})
function onFieldChange() { store.persist() }
function onFieldNotify(msg: string) { showToast(msg) }

// ============================================================
// V3.8.9（W9）：资源生命周期聚合页退役 —— LifecyclePanel + 宿主逻辑（lcCards/onLcArchive/
// onLcSnooze/onLcReactivate/onLcSetDays/阈值弹窗）整体迁至画像洞察页 /profile §3。
// R110-LC-3/4 门禁带退役重指备案改写。
// ============================================================

// ============================================================
// V3.8.9（W9）：知源仪表盘退役 —— 概览带/复盘段/操作记录/全量抽屉/两个下钻抽屉/错误日志
// 整体迁至画像洞察页 /profile。R44/R46/R48/R51/R172-T6 系列门禁带退役重指备案改写。
// 保留：gWsName/gCatName（导出页复用）、readErrorLog 相关（关于页/导出页仍用）。
// ============================================================
// V3.8.9（W9）：readEventLog/readErrorLog/subscribeErrorLog/curioCumulativeSince/countCurioCumulative/
// EVENT_LOG_CAP/CardEvent 随仪表盘退役迁至 ProfileInsights.vue（错误日志徽标+导出也迁走）。
// R156：主题「跟随系统」——导入界面偏好包时 ui.theme 可为 'auto'，落 data-theme 前统一解析

const gd = computed(() => store.data!)

// V3.8.9（W9）：仪表盘专属脚本已整体迁至 ProfileInsights.vue（概览带数据桥/复盘段依赖/
// 操作记录/四类入口/全量抽屉/核心指标下钻/动态条下钻/错误日志徽标/dzHl 高亮）。
// 本文件保留的通用能力：gWsName/gCatName（导出页）、readErrorLog（关于页）、
// useBookmarkImport（导入页）、recordResourceOpen / toOpenableUrl / openHtmlAsset（卡片预览）。

// V3.8.9（W9）：仪表盘脚本（gFlat/todayAdd/weekAdd/事件日志/timelineEvents/dash 数据桥/
// 复盘段依赖/报告出口/openLog/核心指标下钻/动态条下钻/错误日志徽标）已整体迁 ProfileInsights.vue。
// 保留：gWsName/gCatName（导出页 L1870 复用）。
function gWsName(id: string): string { return wsNameById(gd.value.workspaces, id) || '' }
function gCatName(id: string): string { return gd.value.categories.find(c => c.id === id)?.name || '' }

// ---- 资源卡实时预览（对齐原型） ----
const previewMode = ref<'card' | 'list' | 'kanban'>('card')
const previewModes = [
  { key: 'card' as const, label: '卡片' },
  { key: 'list' as const, label: '列表' },
  { key: 'kanban' as const, label: '看板' }
]
const previewModeLabel = computed(() => previewModes.find(m => m.key === previewMode.value)?.label || '')

/**
 * 字段管理 › 实时预览的骨架 HTML。
 *
 * ★V3.8.25（B1-a）：这一段里的样式**必须靠 `:deep()` 才生效**。
 *   本组件的样式块是 scoped 的，编译后选择器是 `.gs-pv-field[data-v-xxxx]`；而这里的 HTML 走
 *   `v-html` 注入，注入节点没有 `data-v-xxxx` 属性 ⇒ 原来的 8 条 `.gs-pv-*` 规则**一条都没命中**，
 *   预览卡实际只吃了那几个内联 style，标签是一串纯文字而不是胶囊。
 *   故：① 8 条规则改成 `.gs-preview-card :deep(.gs-pv-*)`（宿主 `.gs-preview-card` 带 scope id，
 *   `:deep()` 放行其内部）；② 原先散在字符串里的内联 style 一并收成 `.gs-pv-*` 类。
 *   边界：v-html 里的内容不许再写内联 style —— 写在这里的类是有规则的，写内联是绕过令牌的。
 *   注意：注释里不要出现 style 标签的字面量写法。`scripts/dead-css-scan.cjs` 用一条非贪婪正则抽样式块，
 *   脚本区里只要出现一句"样式标签"注释，就会被它当成真样式块的起点，于是整段 TS 被当 CSS 解析
 *   （本轮实测：规则数从 3721 涨到 4051，报出 16 条假的"祖先断"）。
 */
const resourcePreviewHtml = computed(() => {
  const visible = [...fields.value.resource].sort((a, b) => a.order - b.order).filter(f => f.visible)
  const has = (key: string) => visible.some(f => f.key === key)

  if (previewMode.value === 'card') {
    let html = ''
    if (has('title')) html += '<div class="gs-pv-field gs-pv-field-title">知源调度台V2.12全产品PRD手册</div>'
    if (has('link')) html += '<div class="gs-pv-field"><span class="gs-pv-field-link"> D:\\zhiyuan-V2.12\\PRD手册.docx</span></div>'
    if (has('description')) html += '<div class="gs-pv-field"><span class="gs-pv-field-text gs-pv-desc">完整记录V2.12版本的功能设计、交互规范和数据模型...</span></div>'
    if (has('sourceType')) html += '<div class="gs-pv-field"><span class="gs-pv-field-label">来源:</span><span class="gs-pv-field-text">学术</span></div>'
    if (has('tags')) html += '<div class="gs-pv-field"><span class="gs-pv-field-tags"><span class="gs-pv-tag">#PRD</span><span class="gs-pv-tag">#产品设计</span></span></div>'
    if (has('createdAt')) html += '<div class="gs-pv-field"><span class="gs-pv-field-label">添加:</span><span class="gs-pv-field-text">2026-08-28</span></div>'
    return html
  }
  if (previewMode.value === 'list') {
    let html = '<div class="gs-pv-list">'
    if (has('title')) html += '<span class="gs-pv-name">知源调度台V2.12全产品PRD手册</span>'
    if (has('link')) html += '<span class="gs-pv-field-link"></span>'
    if (has('description')) html += '<span class="gs-pv-meta">PRD手册...</span>'
    if (has('sourceType')) html += '<span class="gs-pv-meta">学术</span>'
    if (has('tags')) html += '<span class="gs-pv-tag">#PRD</span>'
    if (has('createdAt')) html += '<span class="gs-pv-meta">08-28</span>'
    html += '</div>'
    return html
  }
  // kanban
  let html = ''
  if (has('title')) html += '<div class="gs-pv-field gs-pv-field-title gs-pv-field-title--sm">知源调度台V2.12全产品PRD手册</div>'
  if (has('tags')) html += '<div class="gs-pv-field"><span class="gs-pv-field-tags"><span class="gs-pv-tag">#PRD</span></span></div>'
  if (has('link')) html += '<div class="gs-pv-field"><span class="gs-pv-field-link gs-pv-field-link--sm"> PRD手册.docx</span></div>'
  if (has('description')) html += '<div class="gs-pv-field"><span class="gs-pv-meta">功能设计、交互规范...</span></div>'
  if (has('sourceType')) html += '<div class="gs-pv-field"><span class="gs-pv-meta">学术</span></div>'
  if (has('createdAt')) html += '<div class="gs-pv-field"><span class="gs-pv-meta">08-28</span></div>'
  return html
})


/** 解析 Netscape 书签 HTML（浏览器导出格式） */
/** R47-A2：全量并集合并——罗盘（愿景/使命/方向→项目→指标）+ 引擎数据 + 全部关系字段
 *  原则：卡片/指标按 id 去重合并；「关系列表」（taskIds/linkedResourceIds 等）一律取并集；
 *        计数类（stats.wrr）取最大值；标量以导入方覆盖（无 updatedAt 的层级按导入值合并）。 */






// ---- Airtable 同步（R63-4） ----
const atBusy = ref(false)
const atTableName = ref('')
const atPat = ref('')
const atBaseId = ref('')
const atTableId = ref('')
const atTagColumn = ref('')
const atTagColumnDefault = DEFAULT_TAG_COLUMN
/* ★标签列名是改完即写的，与 PAT/Base/Table 三条不同：那三条是半成品凭据，存一半会污染连接测试；
   列名不存在「半截」这件事，且同步只在点「立即同步」时发生，失焦即写是唯一不丢改动的做法。 */
let atTagTouched = false
function applyTagColumn() {
  const st = store.data?.airtableSync
  atTagTouched = true
  if (!st) return
  st.tagColumn = atTagColumn.value.trim()
  store.persist()
}
// 配置回填（不在模板直接 v-model 到 storage——「改完即写」会把半截 PAT 存库；失焦/操作时统一写回）
/* ★S3（V3.8.29）：PAT 不再回填进输入框。原先那段回填把存储里的明文塞回 DOM，
   `type=password` 只是把它画成圆点——value 仍是明文，选中即可复制，开发者工具里也直接可见。
   规范要求「不显示密钥明文 + 已保存替换需重填」，因此改为：storage 里有凭据时只置 atPatSaved，
   输入框留空并以提示说明「已保存，替换请重填」；syncAtConfig 遇空不回写，避免把旧密钥清掉。 */
const atPatSaved = ref(false)
watchEffect(() => {
  const s = store.data?.airtableSync
  if (!s) return
  if (s.pat) atPatSaved.value = true
  if (!atBaseId.value) atBaseId.value = s.baseId
  if (!atTableId.value) atTableId.value = s.tableId
  if (s.tableName && !atTableName.value) atTableName.value = s.tableName
  /* ★只在用户没碰过这一栏时回填。加了「改完即写」之后这条必须带 touched 门，否则：
     用户把列名清空的那一刻，watchEffect 看见空值就把 storage 里的旧列名灌回输入框，
     清空这个动作被静默撤销（E2E-34 首轮就是这么抓到的）。 */
  if (!atTagTouched && s.tagColumn) atTagColumn.value = s.tagColumn
})
function syncAtConfig() {
  const s = store.data!.airtableSync!
  // 空 = 用户没填新密钥（沿用已保存的），不是「要清空」
  const typedPat = atPat.value.trim()
  if (typedPat) s.pat = typedPat
  s.baseId = atBaseId.value.trim()
  s.tableId = atTableId.value.trim()
  store.persist()
}
/** 连接凭据是否可用：已存过 PAT，或本次填了新的 */
const atCredReady = computed(() => !!atPat.value.trim() || atPatSaved.value)
const atPatPlaceholder = computed(() => atPatSaved.value
  ? '已保存（不回显）· 替换请直接重填'
  : 'pat…（需 data.records 读写 + schema.bases 写权限）')
/** 字段级内联校验：只在「填了东西但格式不对」时报，未填交给三态徽章说「未连接」 */
const atFieldErr = computed<Record<string, string>>(() => {
  const e: Record<string, string> = {}
  const pat = atPat.value.trim(), base = atBaseId.value.trim(), tbl = atTableId.value.trim()
  if (pat && !pat.startsWith('pat')) e.pat = 'PAT 以 pat 开头——请从 Airtable 账户页「创建令牌」后整段复制'
  if (base && !base.startsWith('app')) e.base = 'Base ID 以 app 开头——在表 URL 的 /appXXXX/ 段里'
  if (tbl && !tbl.startsWith('tbl')) e.tbl = 'Table ID 以 tbl 开头——在表 URL 的 /tblXXXX/ 段里'
  return e
})
const atState = computed(() => store.data!.airtableSync!)
const atPoll = computed(() => !!atState.value.pollEnabled)
const atLog = computed(() => atState.value.log || [])
const quotaText = computed(() => quotaHint(atState.value))
const atStatusText = computed(() => {
  const s = atState.value
  if (!s.lastSyncAt) return ''
  const parts = [new Date(s.lastSyncAt).toLocaleString('zh-CN')]
  if (s.lastSyncedCount != null) parts.push(`推送 ${s.lastSyncedCount} 条`)
  if (s.lastSyncMs != null) parts.push(`耗时 ${(s.lastSyncMs / 1000).toFixed(1)}s`)
  if (s.lastSyncCalls != null) parts.push(`调用 ${s.lastSyncCalls} 次`)
  return parts.join('· ')
})
const atErrorText = computed(() => atState.value.lastError || '')
/* ★S3（V3.8.29）：三态徽章。优先级 异常 > 已连接 > 未连接 —— 一次推送失败比"上次连通过"更该先说。
   绿只给"已连接"、琥珀只给"推送异常"，这两个是状态而非评价（同 B3 的镜子口径）。 */
const atBadge = computed(() => {
  if (atErrorText.value) return { cls: 'error', label: '推送异常', tip: atErrorText.value }
  if (atTableName.value) return { cls: 'connected', label: '已连接', tip: `已连上「${atTableName.value}」` }
  return { cls: 'idle', label: '未连接', tip: '填好 PAT / Base ID / Table ID 后点「测试连接」' }
})

async function testAtConnection() {
  if (atBusy.value) return
  atBusy.value = true
  try {
    syncAtConfig()
    const name = await testConnection(atState.value)
    atTableName.value = name
    atState.value.tableName = name
    store.persist()
    showToast('连接成功：' + name)
  } catch (e) {
    showToast('' + (e instanceof Error ? e.message : String(e)))
  } finally { atBusy.value = false }
}

async function runAtSync() {
  if (atBusy.value) return
  if (!atCredReady.value || !atBaseId.value.trim() || !atTableId.value.trim()) { showToast('请先填写完整连接配置'); return }
  atBusy.value = true
  try {
    syncAtConfig()
    const r = await runSync(store.data!)
    store.persist()
    showToast(`同步完成：推送 ${r.pushed} 条 · 调用 ${r.calls} 次`)
  } catch (e) {
    store.persist()
    showToast('同步失败：' + (e instanceof Error ? e.message : String(e)))
  } finally { atBusy.value = false }
}

function toggleAtPoll() {
  const s = atState.value
  s.pollEnabled = !s.pollEnabled
  store.persist()
  // 轮询注册由 background 监听 storage 变化自管（63-10）
  showToast(s.pollEnabled ? '已开启 3 小时自动轮询' : '已关闭自动轮询')
}


// ---- N4 标签管理 ----
const tagTree = computed<TagNodeLite[]>(() => (store.data?.tagTree || []).filter(n => n && typeof n.id === 'string'))
const ttCollapsed = ref<Set<string>>(new Set())
const ttEditing = ref<{ id: string | null; parentId: string | null; value: string } | null>(null)
const ttFlashId = ref<string | null>(null)
function ttFlash(id: string) { ttFlashId.value = id; setTimeout(() => { if (ttFlashId.value === id) ttFlashId.value = null }, 2000) }
const vFocus = { mounted: (el: HTMLInputElement) => el.focus() }

// B30b：遍历前过滤 null/残缺节点（用户数据中可能存在残缺标签导致渲染崩溃）
function safeNodes(nodes: TagNodeLite[] | undefined): TagNodeLite[] {
  return (nodes || []).filter(n => n && typeof n.id === 'string')
}
function tagFlat(): FlatT[] {
  const out: FlatT[] = []
  const walk = (nodes: TagNodeLite[], parent: TagNodeLite | null, depth: number) =>
    safeNodes(nodes).forEach(n => { out.push({ id: n.id, name: n.name || '未命名标签', depth, node: n, parent }); if (n.children?.length) walk(n.children, n, depth + 1) })
  walk(tagTree.value, null, 0)
  return out
}
function tagDepth(id: string): number { return tagFlat().find(t => t.id === id)?.depth || 0 }
/** B30b：模板子级遍历同样过滤残缺节点 */
function safeChildren(root: TagNodeLite): TagNodeLite[] { return safeNodes(root.children) }
function findTagNode(id: string): { node: TagNodeLite; parent: TagNodeLite | null; list: TagNodeLite[]; index: number } | null {
  // B37a：必须遍历 store 原始数组并返回其引用——否则根级 splice 落在过滤副本上，
  // 删除/拖拽不落库（子级 children 是真实引用所以此前只有根级坏）
  const walk = (nodes: TagNodeLite[], parent: TagNodeLite | null): { node: TagNodeLite; parent: TagNodeLite | null; list: TagNodeLite[]; index: number } | null => {
    for (let i = 0; i < nodes.length; i++) {
      const n = nodes[i]
      if (!n || typeof n.id !== 'string') continue
      if (n.id === id) return { node: n, parent, list: nodes, index: i }
      if (Array.isArray(n.children) && n.children.length) { const r = walk(n.children, n); if (r) return r }
    }
    return null
  }
  return walk(store.data!.tagTree || [], null)
}
function tagSubtreeIds(id: string): string[] {
  const out: string[] = []
  const walk = (n: TagNodeLite) => { out.push(n.id); n.children?.forEach(walk) }
  const hit = findTagNode(id)
  if (hit) walk(hit.node)
  return out
}
/**
 * R130-T1 → R151：卡片-标签命中判据唯一口径（左树角标与右列 ttRows 共用）。
 * R151 用户拍板改口径：**根标签角标 = 含子树合计**（卡存「父/子」时也要计入「父」），
 * 这样「整体梳理」蓝图里本地核算的预估张数与页头角标是同一个数——两处对不上，用户就没法信方案。
 * 仍排除回收站软删卡；一张卡在同一节点的子树里出现多次只算一次。
 */
function cardHasTag(tags: string[] | undefined, name: string): boolean {
  if (!Array.isArray(tags) || !tags.length) return false
  const leaf = name.split('/').pop() || name
  return tags.some(t => t === name || t === leaf || t.startsWith(name + '/'))
}
/**
 * R148-P1b：一次遍历建表（原来按节点各调一次 = O(标签数 × 全部卡)）。
 * R151：表键 = **树节点路径**（顶层名 / 「父/子」），命中子标签时同时给祖先计数；
 * 树里没有的裸标签仍按原样入表（右列「未入树」分组要用），不至于悄悄丢数。
 * 失效依据 = repository 的内存脏计数（每次 persist 同步自增）+ 树版本戳。
 */
let tagUseCache: { seq: number; size: number; rev: number; map: Map<string, number> } | null = null
function tagUsageMap(): Map<string, number> {
  const d = store.data!
  const size = d.resources.length + d.tasks.length + d.curiosities.length
  const seq = getMutationSeq()
  const rev = d.tagTreeRevision || 0
  if (tagUseCache && tagUseCache.seq === seq && tagUseCache.size === size && tagUseCache.rev === rev) return tagUseCache.map
  const map = new Map<string, number>()
  const bump = (k: string) => map.set(k, (map.get(k) || 0) + 1)
  // 叶子名 → 树路径（可能同名多父，全部算命中）
  const leafIndex = new Map<string, string[]>()
  const pathSet = new Set<string>()
  for (const r of d.tagTree || []) {
    pathSet.add(r.name)
    for (const c of r.children || []) {
      const p = r.name + '/' + c.name
      pathSet.add(p)
      leafIndex.set(c.name, [...(leafIndex.get(c.name) || []), p])
    }
  }
  const walk = (arr?: { deletedAt?: number; tags?: string[] }[]) => {
    for (const x of arr || []) {
      if (x.deletedAt || !Array.isArray(x.tags)) continue
      const nodes = new Set<string>()
      for (const t of x.tags) {
        if (typeof t !== 'string' || !t) continue
        const lf = t.split('/').pop() || t
        if (pathSet.has(t)) nodes.add(t)
        for (const p of leafIndex.get(lf) || []) nodes.add(p)
        if (!pathSet.has(t) && !(leafIndex.get(lf) || []).length) nodes.add(t)   // 树外裸标签：原样计数
      }
      for (const n of nodes) { bump(n); const i = n.indexOf('/'); if (i > 0) bump(n.slice(0, i)) }
    }
  }
  walk(d.resources as unknown as { deletedAt?: number; tags?: string[] }[])
  walk(d.tasks as unknown as { deletedAt?: number; tags?: string[] }[])
  walk(d.curiosities as unknown as { deletedAt?: number; tags?: string[] }[])
  tagUseCache = { seq, size, rev, map }
  return map
}
function tagUsage(name: string): number {
  return tagUsageMap().get(name) || 0
}
function ttToggle(id: string) {
  const set = new Set(ttCollapsed.value)
  set.has(id) ? set.delete(id) : set.add(id)
  ttCollapsed.value = set
}
/** B16：行内新建根标签 */
function ttAddRoot() {
  ttEditing.value = { id: null, parentId: null, value: '' }
}
/** B16：行内新建子标签 */
function ttAddChild(parentId: string) {
    if (tagDepth(parentId) >= 1) { showToast('最多两级标签，子标签下不能再新建'); return }
  ttEditing.value = { id: null, parentId, value: '' }
  ttCollapsed.value = new Set([...ttCollapsed.value].filter(x => x !== parentId))
}
// ---- R127：标签管理双栏——左树选中 + 右列卡片（三卡合一 / 类型过滤 / 搜索 / 多选拖拽移动=替换语义） ----
const ttActiveTag = ref('')
const ttCardKind = ref<'all' | 'resource' | 'task' | 'curiosity'>('all')
const ttCardQ = ref('')
const ttPicked = ref<Set<string>>(new Set())
// R130-T3：拖拽视觉反馈——目标标签行 dragover 高亮（对齐全景页 .drop 样式）+ 被拖卡片行降透明度
const ttDropTarget = ref('')
const ttCardDragging = ref(false)
const ttDetail = ref<TtRow | null>(null)
function selectTtTag(path: string) { ttActiveTag.value = path; ttPicked.value = new Set() }
function ttTogglePick(id: string) { const s = new Set(ttPicked.value); if (s.has(id)) s.delete(id); else s.add(id); ttPicked.value = s }
const ttRows = computed<TtRow[]>(() => {
  const tag = ttActiveTag.value
  if (!tag) return []
  const q = ttCardQ.value.trim().toLowerCase()
  const kind = ttCardKind.value
  const out: TtRow[] = []
  if (kind === 'all' || kind === 'resource') {
    for (const r of store.data!.resources || []) {
      if (r.deletedAt || !cardHasTag(r.tags, tag)) continue
      out.push({ kind: 'resource', id: r.id, title: r.title, sub: `${gWsName(r.workspaceId)} / ${gCatName(r.categoryId || '')}`, link: r.link, desc: r.description, tags: r.tags || [] })
    }
  }
  if (kind === 'all' || kind === 'task') {
    for (const t of store.data!.tasks || []) {
      if (t.deletedAt || !cardHasTag(t.tags, tag)) continue
      out.push({ kind: 'task', id: t.id, title: t.title, sub: t.status === 'done' ? '已完成' : t.status === 'doing' ? '进行中' : '待开始', status: t.status, tags: t.tags || [] })
    }
  }
  if (kind === 'all' || kind === 'curiosity') {
    for (const c of store.data!.curiosities || []) {
      if (c.deletedAt || !cardHasTag(c.tags, tag)) continue
      out.push({ kind: 'curiosity', id: c.id, title: c.question, sub: c.status === 'done' ? '已求证' : c.status === 'doing' ? '探索中' : c.status === 'shelf' ? '已搁置' : '待探索', status: c.status, tags: c.tags || [] })
    }
  }
  return q ? out.filter(x => (x.title + '' + x.sub + '' + (x.link || '')).toLowerCase().includes(q)) : out
})
  const { onTtRowClick, ttAllChecked, toggleTtAll, ttDragId, ttCardDragIds, aiJob, aiJobKey, aiModels, aiBusy, aiMsg, aiGenre, aiPersonas, aiPersonaSel, aiPersonaSynced, aiNewP, aiAddPersona, aiRemovePersona, aiEditP, aiPersonaCfg, aiPatchPersona, aiCustomPatch, aiOpenJob, aiTray, aiOpenState, aiTrayClear, aiTagGovern, aiReviseBak, aiTagRevise, aiJobClosed, aiCheckReviseBak, aiRestoreRevise, aiTrashRescue, aiWeeklyReview, aiDeliver, aiErr, aiGuard, aiFetchModels, aiTestConn, aiTogglePersona, aiCatVocab, aiTtEnrich, aiEnrichIds, aiDiagnose, onTtRowDblClick, onTtRowDragStart, onTtRowDragEnd, ttMoveCards, openCardLink, ttRename, ttConfirm, ttCancel, ttRemove, ttDragStart, ttDragEnd, ttDrop, ttUnnest, ttCollectFromCards, activeManualSec } = useGlobalSettingsPanels({ ttTogglePick, ttRows, ttPicked, activePage, gd, store, ttDetail, ttCardDragging, ttDropTarget, ttActiveTag, findTagNode, ttEditing, tagFlat, ttCollapsed, ttFlash, tagTree, tagSubtreeIds, tagDepth, safeChildren })
  return {
    logoUrl, router, route, store, shortcutsUrl,
    onNavClick, exportRef, onAssetPack, activePage, pageFromQuery,
    runtimeVersion, orderedChangelog, bytesInUse, unlimitedStorage, saveError,
    refreshStorage, markSaveErrorRead, formatBytes, saveErrorLabel, navGroups,
    fields, onFieldChange, onFieldNotify, gd, gWsName,
    gCatName, previewMode, previewModes, previewModeLabel, resourcePreviewHtml,
    atBusy, atTableName, atPat, atBaseId, atTableId,
    atTagColumn, atTagColumnDefault, atTagTouched, applyTagColumn, atPatSaved,
    syncAtConfig, atCredReady, atPatPlaceholder, atFieldErr, atState,
    atPoll, atLog, quotaText, atStatusText, atErrorText,
    atBadge, testAtConnection, runAtSync, toggleAtPoll, tagTree,
    ttCollapsed, ttEditing, ttFlashId, ttFlash, ttDragId,
    vFocus, safeNodes, tagFlat, tagDepth, safeChildren,
    findTagNode, tagSubtreeIds, cardHasTag, tagUseCache, tagUsageMap,
    tagUsage, ttToggle, ttAddRoot, ttAddChild, ttActiveTag,
    ttCardKind, ttCardQ, ttPicked, ttDropTarget, ttCardDragging,
    ttDetail, ttCardDragIds, selectTtTag, ttTogglePick, ttRows,
    onTtRowClick, ttAllChecked, toggleTtAll, aiJob, aiJobKey,
    aiModels, aiBusy, aiMsg, aiGenre, aiPersonas,
    aiPersonaSel, aiPersonaSynced, aiNewP, aiAddPersona, aiRemovePersona,
    aiEditP, aiPersonaCfg, aiPatchPersona, aiCustomPatch, aiOpenJob,
    aiTray, aiOpenState, aiTrayClear, aiTagGovern, aiReviseBak,
    aiTagRevise, aiJobClosed, aiCheckReviseBak, aiRestoreRevise, aiTrashRescue,
    aiWeeklyReview, aiDeliver, aiErr, aiGuard, aiFetchModels,
    aiTestConn, aiTogglePersona, aiCatVocab, aiTtEnrich, aiEnrichIds,
    aiDiagnose, onTtRowDblClick, onTtRowDragStart, onTtRowDragEnd, ttMoveCards,
    openCardLink, ttRename, ttConfirm, ttCancel, ttRemove,
    ttDragStart, ttDragEnd, ttDrop, ttUnnest, ttCollectFromCards,
    activeManualSec,
  }
}
