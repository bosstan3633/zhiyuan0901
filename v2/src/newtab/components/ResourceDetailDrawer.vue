<script setup lang="ts">
/**
 * 第卅七轮 REQ-042：资源卡可编辑详情抽屉（搜索单击触发）
 * - 由 zy-open-drawer 总线（kind='res'）触发打开
 * - 容器改用共享 Drawer.vue（圆角/动效/遮罩与 ProjectDetailDrawer 同款）
 * - 第卅九轮 V2.15.0：编辑表单主体抽至共享 ResourceEditForm.vue（与 Workspace 内联抽屉合一）
 *   宿主保留：Drawer 容器 / 开关态 / 统计区(extra 插槽) / footer 动作(删除/复制/打开/保存)
 */
import { computed, defineAsyncComponent, reactive, ref, onMounted, onUnmounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import Drawer from '@/shared/components/Drawer.vue'
import ResourceEditForm from './ResourceEditForm.vue'
import ArmDeleteButton from '@/shared/components/ArmDeleteButton.vue'
import AiTouchedChip from '@/shared/components/AiTouchedChip.vue'
import { showToast } from '@/shared/components/toast'
import { useAppStore } from '../stores/app'
import { onOpenDrawer, consumePendingDrawer, type DrawerPayload } from '@/shared/utils/bus'
import { recordResourceOpen } from '@/shared/storage/stats'
import { toOpenableUrl, openExternalLink } from '@/shared/utils/link'
import type { ResourceCard, TaskCard } from '@/shared/models'
import AiEntryButton from '@/shared/components/AiEntryButton.vue'
import ThesisBlock from '@/newtab/components/ThesisBlock.vue'
import SupportTasksPanel from '@/shared/components/SupportTasksPanel.vue'
// R134-F（批次 F）：单卡 AI 补全。★本组件被 App.vue 静态挂载（全局抽屉宿主）——AI 依赖必须全懒：
// 抽屉 defineAsyncComponent、shared/ai 模块点击时才 dynamic import，否则整条 AI 栈会被卷进启动 chunk（R134 首版踩坑已修）。
// R154（拍板①）：补全/优化一律走 select 工厂，采纳=直接写库（写完把表单同步成已落库的值），不再"回填等二次保存"。
const AiDrawer = defineAsyncComponent(() => import('./AiSuggestionDrawer.vue'))
type AiJobLite = import('@/shared/ai/job').AiJob

const router = useRouter()
const store = useAppStore()

const open = ref(false)
const resId = ref<string | null>(null)
const highlight = ref(false)
const isNewResource = ref(false)
let deleting = false

const editing = reactive<ResourceCard>(emptyResource())

function emptyResource(): ResourceCard {
  return { id: '', kind: 'resource', title: '', linkType: 'url', link: '', workspaceId: '', categoryId: '', description: '', tags: [], customFields: {}, pinned: false, callCount: 0, createdAt: 0, updatedAt: 0, assets: [] }
}

/** R162（同 useResourceDrawer）：单例 reactive 复用先清键——否则上一张卡的 assets 会残留给下一张卡 */
function resetEditing(src: ResourceCard): void {
  for (const k of Object.keys(editing)) delete (editing as unknown as Record<string, unknown>)[k]
  Object.assign(editing, JSON.parse(JSON.stringify(src)))
}

const resource = computed(() => {
  if (!resId.value || !store.data) return null
  return store.data.resources.find(r => r.id === resId.value) || null
})

function openFromId(id: string) {
  const r = store.data?.resources.find(x => x.id === id)
  if (!r) return
  resId.value = id
  resetEditing(r)
  isNewResource.value = false
  open.value = true
  highlight.value = true
  setTimeout(() => { highlight.value = false }, 1800)
}

function close() {
  open.value = false
  resId.value = null
  highlight.value = false
}

function save() {
  if (!editing.title.trim()) { showToast('请输入标题'); return }
  editing.updatedAt = Date.now()
  if (!store.data) return
  const idx = store.data.resources.findIndex(r => r.id === editing.id)
  if (idx >= 0) store.data.resources[idx] = { ...editing }
  store.persist()
  close()
  showToast('✓ 已保存')
}

function remove() {
  if (deleting || !store.data) return
  const idx = store.data.resources.findIndex(r => r.id === editing.id)
  if (idx < 0) { close(); return }
  deleting = true
  const target = store.data.resources[idx]
  const old = target.deletedAt
  target.deletedAt = Date.now()
  store.persist()
  close()
  showToast(`已删除「${target.title.slice(0, 20)}」`, { label: '撤销', cb: () => {
    const cur = store.data?.resources.find(x => x.id === editing.id)
    if (cur) { cur.deletedAt = old; store.persist() }
    deleting = false
  } })
  setTimeout(() => { deleting = false }, 4000)
}

function openLink() {
  const r = editing
  if (!store.data) return
  recordResourceOpen(store.data, r)
  store.persistHot()
  const url = toOpenableUrl(r.linkType, r.link)
  if (!url) { showToast('⚠ 请先补全链接（本地文件需完整路径，如 D:\\docs\\file.pdf）'); return }
  openExternalLink(url)
}

function copyLink() {
  if (!editing.link) { showToast('链接为空'); return }
  navigator.clipboard?.writeText(editing.link).then(() => showToast('✓ 链接已复制')).catch(() => {})
}

/**
 * R166 T7：反查行点击=去那个任务的归属项目页看它（有项目直达二级页，没有回方向台）。
 * 这是**读操作**：不改任务、不改关联，所以资源侧只读边界没有被破。
 */
function gotoTaskOwner(t: TaskCard): void {
  close()
  router.push(t.projectId ? `/compass/projects?p=${t.projectId}` : '/compass')
}

function fmtTs(ts?: number): string {
  return ts ? new Date(ts).toLocaleString('zh-CN', { hour12: false }) : '—'
}

function onBus(p: DrawerPayload) {
  if (p.kind !== 'res' || !p.id) return
  openFromId(p.id)
}

// ---- R134-F：单卡智能补全（AI 栈全懒：点击时才拉 shared/ai） ----
const aiJob = ref<AiJobLite | null>(null)
/** R146-b：补全/优化两枚入口共用一把互斥锁——动态 import + 读配置这段真空期徽标转起来，且不吃第二次点击 */
const aiEntry = ref<'enrich' | 'optimize' | ''>('')
async function aiEnrich() {
  if (aiEntry.value) return
  const card = resource.value
  const d = store.data
  if (!card || !d) return
  aiEntry.value = 'enrich'
  /**
   * R154（拍板①）：这里原本自带一份与 `buildCardEnrichJob` 平行的 inline job，
   * 且把采纳做成"回填表单等你点保存"——同一件事在资源台卡面上直接落库、在详情抽屉里却要二次保存。
   * 现在统一走工厂（左栏/配对/可编辑/指令作用域随工厂一并到位），采纳即写库，写完把表单同步成已落库的值。
   */
  const [{ loadAiConfig, aiReady, aiConfig }, { buildCardEnrichJob }] = await Promise.all([
    import('@/shared/ai/config'), import('@/shared/ai/select'),
  ])
  await loadAiConfig()
  if (!aiReady.value) { aiEntry.value = ''; showToast('请先在 设置 → AI 助手 完成接入（地址/Key/模型）'); return }
  const job = buildCardEnrichJob(card, { d, depth: aiConfig.value.depth, persist: () => store.persist() })
  const baseApply = job.apply!
  job.apply = (rows) => {
    const out = baseApply(rows)
    const live = store.data?.resources.find(x => x.id === card.id && !x.deletedAt)
    if (live) {
      editing.title = live.title; editing.description = live.description
      editing.tags = [...(live.tags || [])]; editing.categoryId = live.categoryId
    }
    return out
  }
  aiJob.value = job
  aiEntry.value = ''
}

let unsub: (() => void) | null = null

/** R140：全方位优化（先抓链接网页正文再一体建议）；R154 起采纳=直接写库，只包一层把表单同步成已落库值 */
const aiOptPersona = ref('default')
async function aiOptimize() {
  if (aiEntry.value) return
  const card = resource.value
  const d = store.data
  if (!card || !d) return
  aiEntry.value = 'optimize'
  const [{ loadAiConfig, aiReady, aiConfig }, { buildFullOptimizeJob }] = await Promise.all([import('@/shared/ai/config'), import('@/shared/ai/select')])
  await loadAiConfig()
  if (!aiReady.value) { aiEntry.value = ''; showToast('请先在 设置 → AI 助手 完成接入（地址/Key/模型）'); return }
  if (aiOptPersona.value === 'default' && aiConfig.value.defaultPersona) aiOptPersona.value = aiConfig.value.defaultPersona
  const job = buildFullOptimizeJob(card, { d, depth: aiConfig.value.depth, persist: () => store.persist(), personaId: aiOptPersona.value, onPersona: (id) => { aiOptPersona.value = id; void aiOptimize() } })
  /**
   * R154（用户拍板①）：采纳=直接写库，不再"回填表单等你点保存"——
   * 同一个入口在资源台卡面上是直接落库、在这里却要二次保存，两套口径必然有人踩。
   * 工厂的 apply 原样用，只在写完后把表单同步成已落库的值（避免抽屉还开着却显示旧字）。
   */
  const baseApply = job.apply!
  job.apply = (rows) => {
    const out = baseApply(rows)
    const live = store.data?.resources.find(x => x.id === card.id && !x.deletedAt)
    if (live) {
      editing.title = live.title; editing.description = live.description
      editing.tags = [...(live.tags || [])]; editing.categoryId = live.categoryId
    }
    return out
  }
  aiJob.value = job
  aiEntry.value = ''
}
onMounted(() => { unsub = onOpenDrawer(onBus); const p = consumePendingDrawer(); if (p) onBus(p) })
onUnmounted(() => { unsub?.(); unsub = null })

watch(() => resource.value?.id, (n) => {
  if (open.value && n) highlight.value = true
})
</script>

<template>
  <Drawer :open="open" :title="editing.title || '编辑资源卡'" width="460px" @close="close">
    <ResourceEditForm
      :model="editing"
      height-key="res-drawer-note"
      :highlight="highlight"
      @save="save"
    >
      <!-- R165-A（方案 A 标准）：AI 主上下文动作进标题行——补全（不抓网页，快）+ 优化（读链接正文）；已动过翻「↻ 重新优化」+ chip -->
      <template #title-extra>
        <button class="red-ai-btn" :disabled="!resource || aiEntry !== ''" title="AI 建议标签/描述/分类：左栏是这张卡的现状，勾选采纳即直接写库" @click="aiEnrich"><AiEntryButton variant="inline" label="补全" :spin="aiEntry === 'enrich'" /></button>
        <button class="red-ai-btn primary" :disabled="!resource || aiEntry !== ''" title="先抓取链接网页正文（仅 http(s)、点了才抓），再整体优化标题/描述/标签；采纳即直接写库" @click="aiOptimize"><AiEntryButton variant="inline" :label="resource?.aiTouchedAt ? '↻ 重新优化' : 'AI 优化'" :spin="aiEntry === 'optimize'" /></button>
        <AiTouchedChip :ts="resource?.aiTouchedAt" />
      </template>
      <!-- 链接动作贴对象：打开/复制不再放页脚 -->
      <template #link-actions>
        <button class="red-icon-btn" title="打开链接" @click="openLink">↗</button>
        <button class="red-icon-btn" title="复制链接" @click="copyLink">⧉</button>
      </template>
      <!-- 使用统计（RDD 特有；Workspace 内联抽屉无统计，不注入） -->
      <template #extra>
        <!-- R147-e：论点卡的结构化只读预览（解析不出就不渲染，原文照旧在描述里） -->
        <ThesisBlock v-if="resource?.isThesis" :text="editing.description" :ws-id="editing.workspaceId" />
        <div class="red-section" v-if="resource">
          <div class="red-label">📊 使用统计</div>
          <div class="red-stats">
            <span>打开 <b>{{ resource.callCount }}</b> 次</span>
            <span v-if="resource.lastCalledAt">· 最近 {{ fmtTs(resource.lastCalledAt) }}</span>
            <span class="red-stat-chip" v-if="resource.pinned">📌 置顶</span>
            <span class="red-stat-chip" v-if="resource.starred">⭐ 星标</span>
          </div>
        </div>
        <!-- R166 T7：资源侧「支持的任务」只读反查（解绑只在任务侧，定案 10） -->
        <SupportTasksPanel v-if="resource && store.data" :d="store.data" :resource="resource" @open-task="gotoTaskOwner" />
      </template>
    </ResourceEditForm>

    <!-- R165-A：页脚收敛两钮——删除（二次确认）+ 保存（Ctrl+↩）；其余动作已贴对象/进标题行 -->
    <template #footer>
      <ArmDeleteButton @confirm="remove" />
      <button class="red-save" @click="save">✓ 保存<span class="red-kbd">Ctrl+↩</span></button>
    </template>
  </Drawer>
  <AiDrawer v-if="aiJob" :job="aiJob" @close="aiJob = null" />
</template>

<style scoped>
/* 宿主残留样式：统计区 + 标题行 AI 钮 + 链接动作钮 + 页脚保存钮（字段区样式在 ResourceEditForm） */
.red-section { margin-bottom: 16px; }
.red-label { font-size: var(--fs-caption); color: var(--text-3); margin-bottom: 8px; text-transform: uppercase; letter-spacing: .04em; }
.red-stats { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; font-size: var(--fs-sub); color: var(--text-2); }
.red-stat-chip { font-size: var(--fs-caption); padding: 2px 8px; background: var(--surface-2); border: 1px solid var(--border); border-radius: 99px; }

.red-ai-btn {
  display: inline-flex; align-items: center; padding: 7px 11px; border-radius: 9px; cursor: pointer;
  font-size: var(--fs-sub); font-weight: 600; border: 1px solid var(--border-strong); background: var(--surface-2);
  color: var(--text-2); font-family: inherit; transition: all var(--dur); flex-shrink: 0; margin-top: 4px; white-space: nowrap;
}
.red-ai-btn:hover { border-color: var(--accent); color: var(--accent); }
.red-ai-btn.primary { border-color: var(--accent); color: var(--accent); background: var(--accent-light); }
.red-ai-btn.primary:hover { background: var(--accent); color: #fff; box-shadow: 0 0 0 3px var(--accent-glow); }
.red-ai-btn:disabled { opacity: var(--opacity-disabled); cursor: not-allowed; box-shadow: none; }
.red-icon-btn {
  width: 32px; height: 32px; flex-shrink: 0; border: 1px solid var(--border); border-radius: 8px; background: var(--surface-2);
  color: var(--text-2); cursor: pointer; font-size: var(--fs-body); transition: all var(--dur);
}
.red-icon-btn:hover { color: var(--accent); border-color: var(--accent); background: var(--accent-light); }
.red-save {
  flex: 1; padding: 10px 0; border-radius: 9px; border: 1px solid var(--accent); background: var(--accent); color: #fff;
  font-size: var(--fs-body); font-weight: 600; cursor: pointer; transition: all var(--dur); white-space: nowrap;
}
.red-save:hover { background: var(--accent-hover); border-color: var(--accent-hover); }
.red-kbd { font-size: var(--fs-tiny); opacity: .7; margin-left: 6px; font-weight: 400; }
</style>
