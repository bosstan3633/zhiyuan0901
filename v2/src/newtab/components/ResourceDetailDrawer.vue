<script setup lang="ts">
/**
 * 第卅七轮 REQ-042：资源卡可编辑详情抽屉（搜索单击触发）
 * - 由 zy-open-drawer 总线（kind='res'）触发打开
 * - 容器改用共享 Drawer.vue（圆角/动效/遮罩与 ProjectDetailDrawer 同款）
 * - 第卅九轮 V2.15.0：编辑表单主体抽至共享 ResourceEditForm.vue（与 Workspace 内联抽屉合一）
 *   宿主保留：Drawer 容器 / 开关态 / 统计区(extra 插槽) / footer 动作(删除/复制/打开/保存)
 */
import { computed, defineAsyncComponent, reactive, ref, onMounted, onUnmounted, watch } from 'vue'
import { wsDisplayNameOf } from '@/shared/utils/wsName'
import { useRouter } from 'vue-router'
import Drawer from '@/shared/components/Drawer.vue'
import ResourceEditForm from './ResourceEditForm.vue'
import { showToast } from '@/shared/components/toast'
import { useAppStore } from '../stores/app'
import { onOpenDrawer, type DrawerPayload } from '@/shared/utils/bus'
import { recordResourceOpen } from '@/shared/storage/stats'
import { toOpenableUrl, openExternalLink } from '@/shared/utils/link'
import type { ResourceCard, TaskCard } from '@/shared/models'
// R134-F（批次 F）：单卡 AI 补全。★本组件被 App.vue 静态挂载（全局抽屉宿主）——AI 依赖必须全懒：
// 抽屉 defineAsyncComponent、shared/ai 模块点击时才 dynamic import，否则整条 AI 栈会被卷进启动 chunk（R134 首版踩坑已修）。
// 建议进评审抽屉（内存态），采纳只回填本表单，用户核对后自行保存。
const AiDrawer = defineAsyncComponent(() => import('./AiSuggestionDrawer.vue'))
type AiJobLite = import('@/shared/ai/job').AiJob
type AiRowLite = import('@/shared/ai/job').AiRow

const router = useRouter()
const store = useAppStore()

const open = ref(false)
const resId = ref<string | null>(null)
const highlight = ref(false)
const isNewResource = ref(false)
let drawerOriginalWsId = ''
let deleting = false

const editing = reactive<ResourceCard>(emptyResource())

function emptyResource(): ResourceCard {
  return { id: '', kind: 'resource', title: '', linkType: 'url', link: '', workspaceId: '', categoryId: '', description: '', tags: [], customFields: {}, pinned: false, callCount: 0, createdAt: 0, updatedAt: 0 }
}

const resource = computed(() => {
  if (!resId.value || !store.data) return null
  return store.data.resources.find(r => r.id === resId.value) || null
})

function openFromId(id: string) {
  const r = store.data?.resources.find(x => x.id === id)
  if (!r) return
  resId.value = id
  Object.assign(editing, JSON.parse(JSON.stringify(r)))
  drawerOriginalWsId = editing.workspaceId
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
  const wsChanged = !!drawerOriginalWsId && editing.workspaceId !== drawerOriginalWsId
  editing.updatedAt = Date.now()
  if (!store.data) return
  const idx = store.data.resources.findIndex(r => r.id === editing.id)
  if (idx >= 0) store.data.resources[idx] = { ...editing }
  store.persist()
  close()
  if (wsChanged) {
    const target = store.workspaces.find(w => w.id === editing.workspaceId)
    showToast(`✓ 已保存并迁移至「${wsDisplayNameOf(target) || '目标策展台'}」`)
  } else {
    showToast('✓ 已保存')
  }
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
  store.persist()
  const url = toOpenableUrl(r.linkType, r.link)
  if (!url) { showToast('⚠ 请先补全链接（本地文件需完整路径，如 D:\\docs\\file.pdf）'); return }
  openExternalLink(url)
}

function copyLink() {
  if (!editing.link) { showToast('链接为空'); return }
  navigator.clipboard?.writeText(editing.link).then(() => showToast('✓ 链接已复制')).catch(() => {})
}

function goToTask(t: TaskCard) {
  router.push('/')
  showToast(`已跳转任务中心：${t.title}`)
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
async function aiEnrich() {
  const card = resource.value
  const d = store.data
  if (!card || !d) return
  const [{ loadAiConfig, aiReady, aiConfig }, { projectCard, catPathOf }, { enrichSystem, sanitizeRefs }] = await Promise.all([
    import('@/shared/ai/config'), import('@/shared/ai/project'), import('@/shared/ai/scenarios'),
  ])
  await loadAiConfig()
  if (!aiReady.value) { showToast('请先在 设置 → AI 助手 完成接入（地址/Key/模型）'); return }
  const cats = d.categories.filter(c => !c.deletedAt && c.workspaceId === card.workspaceId)
  const catList = cats.slice(0, 60).map(c => `categoryId=${c.id}：${catPathOf(d, c.id)}`).join('\n')
  aiJob.value = {
    title: `AI 补全 · ${card.title.slice(0, 20) || '（无名卡）'}`,
    hint: '建议会回填到下方编辑表单（描述仅在为空时填充），保存前你可再改。',
    build: () => ({ messages: [
      { role: 'system', content: enrichSystem(cats.length > 0) },
      { role: 'user', content: projectCard(d, card, aiConfig.value.depth) + (catList ? `\n\n【分类候选】\n${catList}` : '') },
    ] }),
    parse: (raw) => {
      const s = sanitizeRefs((raw || {}) as import('@/shared/ai/scenarios').EnrichSuggestion, d)
      const rows: AiRowLite[] = []
      const newTags = (s.tags || []).filter(t => typeof t === 'string' && t.trim() && !(card.tags || []).includes(t))
      if (newTags.length) rows.push({ key: 'tags', badge: '标签', main: newTags.join('、'), data: { tags: newTags } })
      if (s.description?.trim() && !card.description) rows.push({ key: 'desc', badge: '描述', main: s.description.trim(), data: { description: s.description.trim() } })
      if (s.categoryId && s.categoryId !== card.categoryId) rows.push({ key: 'cat', badge: '分类', main: catPathOf(d, s.categoryId), data: { categoryId: s.categoryId } })
      return rows
    },
    apply: (rows) => {
      for (const r of rows) {
        const s = r.data as import('@/shared/ai/scenarios').EnrichSuggestion
        if (s.tags) editing.tags = [...new Set([...(editing.tags || []), ...s.tags])].slice(0, 10)
        if (s.description) editing.description = s.description
        if (s.categoryId) editing.categoryId = s.categoryId
      }
      return '✓ 建议已回填表单，核对后点「保存」'
    },
  }
}

let unsub: (() => void) | null = null

/** R140：全方位优化（先抓链接网页正文再一体建议，采纳=回填表单）；复用 select 工厂、改写 apply 为回填 */
async function aiOptimize() {
  const card = resource.value
  const d = store.data
  if (!card || !d) return
  const [{ loadAiConfig, aiReady, aiConfig }, { buildFullOptimizeJob }] = await Promise.all([import('@/shared/ai/config'), import('@/shared/ai/select')])
  await loadAiConfig()
  if (!aiReady.value) { showToast('请先在 设置 → AI 助手 完成接入（地址/Key/模型）'); return }
  const job = buildFullOptimizeJob(card, { d, depth: aiConfig.value.depth, persist: () => store.persist() })
  job.apply = (rows) => {
    for (const r of rows) {
      const s = r.data as { title?: string; description?: string; tags?: string[] }
      if (s.title) editing.title = s.title
      if (s.description) editing.description = s.description
      if (s.tags) editing.tags = [...new Set([...(editing.tags || []), ...s.tags])].slice(0, 10)
    }
    return '✓ 建议已回填表单，核对后点「保存」'
  }
  aiJob.value = job
}
onMounted(() => { unsub = onOpenDrawer(onBus) })
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
      @goto-task="goToTask"
    >
      <!-- 使用统计（RDD 特有；Workspace 内联抽屉无统计，不注入） -->
      <template #extra>
        <div class="red-section" v-if="resource">
          <div class="red-label">📊 使用统计</div>
          <div class="red-stats">
            <span>打开 <b>{{ resource.callCount }}</b> 次</span>
            <span v-if="resource.lastCalledAt">· 最近 {{ fmtTs(resource.lastCalledAt) }}</span>
            <span class="red-stat-chip" v-if="resource.pinned">📌 置顶</span>
            <span class="red-stat-chip" v-if="resource.starred">⭐ 星标</span>
          </div>
        </div>
      </template>
    </ResourceEditForm>

    <template #footer>
      <button class="red-btn danger" @click="remove">🗑 删除</button>
      <button class="red-btn" @click="copyLink">🔗 复制链接</button>
      <button class="red-btn" @click="openLink">↗ 打开</button>
      <button class="red-btn" :disabled="!resource" title="AI 建议标签/描述/分类，回填表单后由你核对保存" @click="aiEnrich">🤖 补全</button>
      <button class="red-btn" :disabled="!resource" title="先抓取链接网页正文（仅 http(s)、点了才抓），再整体优化标题/描述/标签并回填表单" @click="aiOptimize">🤖 分析（读网页）</button>
      <button class="red-btn primary" @click="save">✓ 保存</button>
    </template>
  </Drawer>
  <AiDrawer v-if="aiJob" :job="aiJob" @close="aiJob = null" />
</template>

<style scoped>
/* 宿主残留样式：统计区 + footer 动作条（字段区样式已迁入 ResourceEditForm） */
.red-section { margin-bottom: 16px; }
.red-label { font-size: 11px; color: var(--text-3); margin-bottom: 8px; text-transform: uppercase; letter-spacing: .04em; }
.red-stats { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; font-size: 12px; color: var(--text-2); }
.red-stat-chip { font-size: 11px; padding: 2px 8px; background: var(--surface-2); border: 1px solid var(--border); border-radius: 99px; }

.red-btn {
  flex: 1; padding: 9px 7px; border: 1px solid var(--border); border-radius: 6px;
  background: var(--surface-2); color: var(--text); cursor: pointer; font-size: 12px; transition: all var(--dur); white-space: nowrap;
}
.red-btn:disabled { opacity: var(--opacity-disabled); cursor: not-allowed; }
.red-btn:hover { background: var(--surface-3); }
.red-btn.primary { background: var(--accent); color: #fff; border-color: var(--accent); }
.red-btn.primary:hover { opacity: .9; }
.red-btn.danger { background: transparent; border-color: var(--danger); color: var(--danger); }
.red-btn.danger:hover { background: var(--danger-bg-soft); }
</style>
