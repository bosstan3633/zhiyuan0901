import { ref, computed, reactive, watch, nextTick, onMounted, onUnmounted, shallowRef, defineAsyncComponent } from 'vue'
import type { Ref, ComputedRef, ShallowRef, DefineComponent } from 'vue'
import { showToast } from '@/shared/components/toast'
import { uid, normalizeUrl } from '@/shared/utils'
import { CURATION_WS_ID } from '@/shared/models'
import { toOpenableUrl, toOpenableRawLink, openExternalLink, linkPlaceholderFor } from '@/shared/utils/link'
import { useConfirm } from '@/shared/components/confirm'
import type { ResourceCard, TaskCard, CuriosityCard, Workspace, Category, AnyCard } from '@/shared/models'
import type { useGlobalPopups, DormantVerdictGP } from './useGlobalPopups'

export function useGlobalPopupsCapture(deps: Pick<ReturnType<typeof useGlobalPopups>, 'd' | 'closeAll' | 'store' | 'onSavedKeydown'>): {
  capForm: { title: string; linkType: 'url' | 'file' | 'obsidian'; link: string; description: string; workspaceId: string; categoryId: string }
  capSaved: Ref<boolean>
  savedResourceId: Ref<string>
  savedWsId: Ref<string>
  savedTimer: Ref<ReturnType<typeof setTimeout> | null>
  capLinkPlaceholder: ComputedRef<string>
  resetCaptureForm: () => void
  saveCapture: () => Promise<void>
  AiDrawerGP: any
  aiEnrichJob: ShallowRef<import('@/shared/ai/job').AiJob | null>
  aiAdviceJob: ShallowRef<import('@/shared/ai/job').AiJob | null>
  gpAiJob: ComputedRef<import('@/shared/ai/job').AiJob | null>
  gpAiJobClose: () => void
  capEnrichOn: Ref<boolean>
  capEnrichReady: Ref<boolean>
  lastEnrichCard: ResourceCard | null
  runCardEnrich: (card: ResourceCard) => Promise<void>
  aiReopenEnrich: () => Promise<void>
  capEnrichSave: (e: Event) => Promise<void>
  aiAdviceBusy: Ref<boolean>
  aiAdviceDormantDays: Ref<number>
  aiAdviceRun: (entryId: 'cross-deck' | 'thesis-drift' | 'dormant-scan') => Promise<void>
  linkShort: (link: string) => string
  linkIconName: (type: string) => 'link' | 'filetext' | 'book' | 'layers'
  allProjects: () => { id: string; name: string; nextStep?: string; isFocused: boolean; startDate?: string; endDate?: string; progress: number; status: 'archived' | 'done' | 'active' | 'paused'; retrospective?: string; order?: number; pinned?: boolean; metrics: { id: string; title: string; target?: string; acceptance?: string; taskIds: string[] }[] }[]
  isProjectDone: (p: { status: string; id: string }) => boolean
} {
  const { d, closeAll, store, onSavedKeydown } = deps
// ===== 采集资源卡 =====
const capForm = reactive({
  title: '', linkType: 'url' as 'url'|'file'|'obsidian', link: '', description: '',
  workspaceId: '', categoryId: ''
})
/** 保存后的「已保存」状态：Enter=打开看板，Esc=关闭，5 秒无操作自动消失 */
const capSaved = ref(false)
const savedResourceId = ref('')
const savedWsId = ref('')
/* R181：savedTimer 改为 ref —— closeAll 在宿主、saveCapture 在本域，跨域共享同一句柄。 */
const savedTimer = ref<ReturnType<typeof setTimeout> | null>(null)

/* ★V3.9.20：快速采集任务段（tcForm/tcProjects/tcMetrics/saveTaskCapture/tcOpenBoard/resetTcForm）
   随面板拆入 GlobalPopupsQuickAdd.vue——R55-9 / R172-T11 判据锚已随迁备案。 */

// R169-T2：占位符与详情抽屉同源（LINK_SLOT_TABS），不再各写一份分支
const capLinkPlaceholder = computed(() => linkPlaceholderFor(capForm.linkType))

watch(() => capForm.workspaceId, () => { capForm.categoryId = '' })

function resetCaptureForm() {
  capForm.title = ''; capForm.link = ''; capForm.description = ''; capForm.categoryId = ''
  savedResourceId.value = ''
  savedWsId.value = ''
}

async function saveCapture() {
  if (!capForm.title.trim()) { showToast('请输入标题'); return }
  // B5 去重：相同归一化链接 → 只能跳转，不新建副本
  if (capForm.linkType === 'url' && capForm.link.trim()) {
    const fp = normalizeUrl(capForm.link.trim())
    const dup = d.value.resources.find(r => !r.deletedAt && r.linkType === 'url' && r.link && normalizeUrl(r.link) === fp)
    if (dup) {
      if (!(await useConfirm({ title: '重复采集', message: `该页面已收录为「${dup.title.slice(0, 40)}」。\n点击确认将定位到已有卡片。`, confirmText: '定位到卡片' }))) { return }
      chrome.runtime.sendMessage({ type: 'zy-locate-workspace', wsId: dup.workspaceId, hl: dup.id })
      resetCaptureForm()
      closeAll()
      return
    }
  }
  const r: ResourceCard = {
    id: uid('res'), kind: 'resource', title: capForm.title.trim(),
    linkType: capForm.linkType, link: capForm.link.trim(),
    // V3.7.0（R179）：统一入池——workspaceId 固定池 id，categoryId 遗留字段置空
    workspaceId: CURATION_WS_ID,
    categoryId: '', description: capForm.description.trim(),
    tags: [], customFields: {}, pinned: false, callCount: 0,
    createdAt: Date.now(), updatedAt: Date.now()
  }
  d.value.resources.unshift(r)
  store.persist()
  // 进入「已保存」状态条：Enter=打开看板·定位新卡，Esc=关闭，5 秒自动消失
  savedResourceId.value = r.id
  savedWsId.value = r.workspaceId
  capSaved.value = true
  if (savedTimer.value) clearTimeout(savedTimer.value)
  savedTimer.value = setTimeout(() => { resetCaptureForm(); closeAll() }, 5000)
  // R138-H1′：勾选「保存后补全」→ 自动拉起 AI 评审抽屉（采纳才写库；不勾不拦保存主流程）
  if (capEnrichOn.value) void runCardEnrich(r)
}

// R138-H1′：采集后补全——AiSuggestionDrawer/ai 栈全懒（GP 在启动 chunk，静态引会把 AI 卷进首屏）
const AiDrawerGP = defineAsyncComponent(() => import('./AiSuggestionDrawer.vue'))
const aiEnrichJob = shallowRef<import('@/shared/ai/job').AiJob | null>(null)
// R158：AI 建议面板的评审 job 与采集补全共用同一懒抽屉实例（同一时刻只会有一份在跑）
const aiAdviceJob = shallowRef<import('@/shared/ai/job').AiJob | null>(null)
const gpAiJob = computed(() => aiEnrichJob.value || aiAdviceJob.value)
function gpAiJobClose() { aiEnrichJob.value = null; aiAdviceJob.value = null }
const capEnrichOn = ref(true)
const capEnrichReady = ref(false)
let lastEnrichCard: ResourceCard | null = null
async function runCardEnrich(card: ResourceCard) {
  lastEnrichCard = card
  capEnrichReady.value = false
  const [{ loadAiConfig, aiReady, aiConfig }, { buildResourceEnrichJob }] = await Promise.all([import('@/shared/ai/config'), import('@/shared/ai/select')])
  await loadAiConfig()
  if (!aiReady.value) { showToast('AI 尚未接入（设置 → AI 助手），卡已正常保存'); return }
  aiEnrichJob.value = buildResourceEnrichJob(card, { d: d.value, depth: aiConfig.value.depth, persist: () => store.persist() })
  capEnrichReady.value = true
}
async function aiReopenEnrich() { if (lastEnrichCard) await runCardEnrich(lastEnrichCard) }
async function capEnrichSave(e: Event) {
  const on = (e.target as HTMLInputElement).checked
  capEnrichOn.value = on
  const m = await import('@/shared/ai/config')
  m.patchAiConfig({ captureEnrich: on })
}

// ===== R158：AI 建议面板（被动 3 入口：cross-deck / thesis-drift / dormant-scan） =====
// 照 runCardEnrich 先例：AI 工厂全懒 import，面板本体只含字面量文案，启动零 AI 不变。
// job 构造参数与设置页原实现逐项一致（GlobalSettings 原三函数随入口迁移退役）。
const aiAdviceBusy = ref(false)
const aiAdviceDormantDays = ref(90)
/** 沉睡卡逐行结论（revive=唤醒置顶 / archive=送回收站 / keep=不动） */
async function aiAdviceRun(entryId: 'cross-deck' | 'thesis-drift' | 'dormant-scan') {
  if (aiAdviceBusy.value) return
  const [{ loadAiConfig, aiReady, aiConfig }, { sanitizeRefs, dormantSystem }, gov, proj] = await Promise.all([
    import('@/shared/ai/config'),
    import('@/shared/ai/scenarios'),
    import('@/shared/ai/govern'),
    import('@/shared/ai/project'),
  ]) as [typeof import('@/shared/ai/config'), typeof import('@/shared/ai/scenarios'), typeof import('@/shared/ai/govern'), typeof import('@/shared/ai/project')];
  await loadAiConfig()
  if (!aiReady.value) { showToast('AI 尚未接入（设置 → AI 助手）'); return }
  const dd = d.value
  const depth = aiConfig.value.depth
  const persist = () => store.persist()
  const jobOf = (j: import('@/shared/ai/job').AiJob | null, emptyMsg: string) => {
    if (!j) { showToast(emptyMsg); return }
    aiAdviceJob.value = j
  }
  aiAdviceBusy.value = true
  try {
    if (entryId === 'cross-deck') {
      jobOf(gov.buildCrossDeckJob({ d: dd, depth, persist }), '资源卡池还没有卡，无法做跨台镜像发现')
    } else if (entryId === 'thesis-drift') {
      jobOf(gov.buildThesisJob({ d: dd, depth, persist }), '还没有带主题卡的策展台')
    } else {
      const days = Math.min(Math.max(aiAdviceDormantDays.value || 90, 14), 365)
      const { text, count, scanned } = proj.projectDormant(dd, days, depth)
      if (!count) { showToast(`没有沉睡卡：${days} 天内全库 ${scanned} 张都在活跃窗口内`); return }
      aiAdviceJob.value = {
        key: 'dormant:' + days,
        title: `沉睡资源唤醒（${count} 张候选）`,
        hint: `判定口径：${days} 天未打开且未置顶/星标。模型对照进行中任务与战略目标逐卡给结论；「唤醒」=置顶回到视野，「归档」=送回收站（可反悔）。`,
        build: () => ({ messages: [{ role: 'system', content: dormantSystem() }, { role: 'user', content: text }] }),
        parse: (raw: unknown) => {
          const items = Array.isArray((raw as { items?: unknown })?.items) ? (raw as { items: DormantVerdictGP[] }).items : []
          const rows: import('@/shared/ai/job').AiRow[] = []
          for (const v0 of items) {
            const v = sanitizeRefs({ cardId: v0.cardId } as { cardId?: string }, dd)
            if (!v.cardId || !['revive', 'archive', 'keep'].includes(v0.verdict)) continue
            const card = dd.resources.find(r => r.id === v.cardId)!
            rows.push({
              key: v.cardId,
              badge: v0.verdict === 'revive' ? '唤醒' : v0.verdict === 'archive' ? '归档' : '保留',
              badgeType: v0.verdict === 'revive' ? 'ok' : v0.verdict === 'archive' ? 'danger' : 'neutral',
              main: card.title,
              sub: [v0.reason, v0.actionHint && `➜ ${v0.actionHint}`].filter(Boolean).join('\n'),
              data: v0,
            })
          }
          return rows
        },
        apply: (rows: import('@/shared/ai/job').AiRow[]) => {
          const dd2 = d.value
          let pin = 0, rec = 0
          for (const r of rows) {
            const v = r.data as DormantVerdictGP
            const card = dd2.resources.find(x => x.id === v.cardId && !x.deletedAt)
            if (!card || v.verdict === 'keep') continue
            if (v.verdict === 'revive') { card.pinned = true; pin++ }
            else { card.deletedAt = Date.now(); rec++ }
          }
          if (pin || rec) store.persist()
          return `唤醒置顶 ${pin} 张 · 归档 ${rec} 张（回收站可反悔）`
        },
      }
    }
  } finally { aiAdviceBusy.value = false }
}

// ===== 采集好奇心 =====
/* ★V3.9.20：好奇心采集段（curioForm/saveCurio）随面板拆入 GlobalPopupsQuickAdd.vue（R23-4 锚随迁）。 */

// ===== 工具函数 =====
function linkShort(link: string) {
  if (link.startsWith('http')) return link.replace(/^https?:\/\//,'').substring(0,30)
  if (link.startsWith('obsidian')) return 'Obsidian笔记'
  const parts = link.split(/[\\/]/)
  return parts[parts.length-1].substring(0,25)
}
/** 链接类型 → 图标名（★G1(V3.8.25)：原先把图标名塞进数据对象的 icon 字段，剥离 emoji 后三支全空，
 *  模板里就只剩一个孤儿空格 + 文本。图标属于渲染层，不该存在数据对象里，故改为按 type 现算。 */
function linkIconName(type: string) {
  return type === 'url' ? 'link' : type === 'file' ? 'filetext' : type === 'obsidian' ? 'book' : 'layers'
}

/** R49-G：跨方向扁平项目列表（复用 useCompass 口径，避免多处手写双循环漂移） */
function allProjects() {
  return d.value.compass.directions.flatMap(dir => dir.projects)
}
/** R52-BUG-2：项目完成口径与 useCompass.isProjectDone 一致（手动 done/archived 或全任务完成派生） */
function isProjectDone(p: { status: string; id: string }): boolean {
  if (p.status === 'done' || p.status === 'archived') return true
  const ts = d.value.tasks.filter(t => !t.deletedAt && t.projectId === p.id)
  return ts.length > 0 && ts.every(t => t.status === 'done')
}

// 快捷键由 App.vue 统一管理，通过 openPanel/closeAll 暴露方法
// 「已保存」状态下捕获 Enter / Esc
onMounted(() => window.addEventListener('keydown', onSavedKeydown, true))
onUnmounted(() => window.removeEventListener('keydown', onSavedKeydown, true))


  return {
    capForm, capSaved, savedResourceId, savedWsId, savedTimer, capLinkPlaceholder, resetCaptureForm, saveCapture, AiDrawerGP, aiEnrichJob, aiAdviceJob, gpAiJob, gpAiJobClose, capEnrichOn, capEnrichReady, lastEnrichCard, runCardEnrich, aiReopenEnrich, capEnrichSave, aiAdviceBusy, aiAdviceDormantDays, aiAdviceRun, linkShort, linkIconName, allProjects, isProjectDone,
  }
}
