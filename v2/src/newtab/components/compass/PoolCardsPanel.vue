<script setup lang="ts">
/**
 * R2-③ 建面板 → R2-④⑤ 收口 → R2-⑧ 管理面收编：资源卡池面板
 * —— 资源台退役后，池卡的唯一管理面。
 * 已有：搜索 + 网格 + 单击开详情（记一次调出）+ 软删带撤销 + `?hl=&hk=res` 定位高亮。
 * R2-⑧ 补：新建单卡 / 本地文件导入入口重落（R179 parked 的那条）/ 批量选择（打标签·删除）/ 增量渲染上限。
 * R3-Ca 补：列表视图 / 「待打标」筛选（R179 迁移时承诺的兜底出口）/ 批量反选 / 右键菜单（置顶·复制链接·删除）。
 * ★有意偏离记账（更新）：**看板视图仍不做**——资源卡没有状态字段，看板无列可分；列表视图已补上，
 *   它与网格不是"信息重叠"而是密度差（列表标签全展开、一屏看得多）。
 * 数据口径：workspaceId=CURATION_WS_ID（隐藏池 id，R179 定案）且未软删。
 */
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAppStore } from '../../stores/app'
import { CURATION_WS_ID, type ResourceCard } from '@/shared/models'
import { uid } from '@/shared/utils'
import { emitOpenDrawer } from '@/shared/utils/bus'
import { showToast } from '@/shared/components/toast'
import ContextMenu from '@/shared/components/ContextMenu.vue'
import NewBadge from '@/shared/components/NewBadge.vue'
import { useWorkspaceImport } from '../../composables/useWorkspaceImport'

const store = useAppStore()
const route = useRoute()
const router = useRouter()

const query = ref('')
/** R3-Ca：视图两档（网格/列表）——与任务、好奇面板同口径存组件内 ref，不落盘（三面板一致，别在这里单开持久化） */
const viewMode = ref<'card' | 'list'>('card')
/** R3-Ca：「待打标」筛选——池卡由标签组织，无标签=召回不上的存量，这条是 R179 迁移时承诺的兜底出口 */
const onlyUntagged = ref(false)
const poolCards = computed(() => {
  const q = query.value.trim().toLowerCase()
  return (store.data?.resources || [])
    .filter(r => !r.deletedAt && r.workspaceId === CURATION_WS_ID)
    .filter(r => !q || r.title.toLowerCase().includes(q) || (r.tags || []).some(t => t.toLowerCase().includes(q)))
    .filter(r => !onlyUntagged.value || !(r.tags || []).length)
    .sort((a, b) => (Number(b.pinned) - Number(a.pinned)) || (b.updatedAt || 0) - (a.updatedAt || 0))
})
const poolTotal = computed(() => (store.data?.resources || []).filter(r => !r.deletedAt && r.workspaceId === CURATION_WS_ID).length)
const untaggedCount = computed(() => (store.data?.resources || []).filter(r => !r.deletedAt && r.workspaceId === CURATION_WS_ID && !(r.tags || []).length).length)

/* ===== R2-⑧ 增量渲染：默认一屏 60 张，滚动到底自动追加（260 张实测 449ms/longtask 0，
   但线性上涨到 500+ 就是首屏成本——上限先立住，不必等它变慢再补） ===== */
const PAGE = 60
const visibleCount = ref(PAGE)
watch(query, () => { visibleCount.value = PAGE })
const rendered = computed(() => poolCards.value.slice(0, visibleCount.value))
const hasMore = computed(() => poolCards.value.length > visibleCount.value)
function renderMore() { if (hasMore.value) visibleCount.value += PAGE }
let sentinel: HTMLElement | null = null
let io: IntersectionObserver | null = null
const setSentinel = (el: unknown) => {
  if (io) { io.disconnect(); io = null }
  sentinel = (el as HTMLElement | null) ?? null
  if (!sentinel || typeof IntersectionObserver === 'undefined') return
  io = new IntersectionObserver((es) => { if (es.some(e => e.isIntersecting)) renderMore() }, { rootMargin: '240px' })
  io.observe(sentinel)
}
onBeforeUnmount(() => { io?.disconnect(); io = null })

/**
 * R2-④：`?hl=&hk=res` 卡片定位消费者（⌘K / 网页浮层 / AI 面板直达同一条链路）。
 * 纪律照 `useWsLocate.ts:61-68`：**hk 指明别的卡型就让路**——调度台同页挂着任务卡与好奇卡两个
 * hl 消费者，抢着处理会把别人的定位抹掉（R152 真机报过的那类 bug）。
 */
const highlightId = ref<string | null>(null)
watch(() => route.query.hl, (hl) => {
  if (!hl || typeof hl !== 'string') return
  const hk = typeof route.query.hk === 'string' ? route.query.hk : ''
  if (hk && hk !== 'res') return
  const hit = (store.data?.resources || []).find(r => r.id === hl && !r.deletedAt)
  if (!hit) return
  if (hit.workspaceId !== CURATION_WS_ID) { showToast('⚠ 这张卡不在资源卡池（在策展台内）'); return }
  query.value = '' // 过滤态下目标卡可能根本不在渲染列表里，定位先清过滤
  visibleCount.value = Math.max(visibleCount.value, poolCards.value.findIndex(r => r.id === hl) + 1) // 目标卡在分页之外时先把它渲出来
  highlightId.value = hl
  nextTick(() => {
    setTimeout(() => {
      document.querySelector(`[data-rid="${hl}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      setTimeout(() => { highlightId.value = null }, 2000)
    }, 120)
  })
  router.replace({ path: route.path })
}, { immediate: true })

function openCard(r: { id: string }) {
  if (batchMode.value) { toggleSel(r.id); return }
  emitOpenDrawer({ kind: 'res', id: r.id })
}
function removeCard(r: { id: string; title: string }) {
  const live = (store.data?.resources || []).find(x => x.id === r.id)
  if (!live) return
  live.deletedAt = Date.now()
  store.persist()
  showToast(`已删除「${live.title.slice(0, 20)}」`, { label: '撤销', cb: () => {
    const cur = (store.data?.resources || []).find(x => x.id === r.id)
    if (cur && cur.deletedAt) { cur.deletedAt = undefined; store.persist() }
  } })
}

/* ===== R3-Ca 右键菜单（与好奇面板共用 ContextMenu 单根；池卡此前只有单击开详情，
   置顶/复制链接这类"不想开详情"的动作没有出口） ===== */
const ctx = ref({ open: false, x: 0, y: 0 })
const ctxItems = ref<{ label: string; icon?: string; danger?: boolean; cb: () => void }[]>([])
function openCtx(e: MouseEvent, r: ResourceCard) {
  e.preventDefault()
  ctxItems.value = [
    { label: '打开详情', icon: 'eye', cb: () => emitOpenDrawer({ kind: 'res', id: r.id }) },
    { label: r.pinned ? '取消置顶' : '📌 置顶', cb: () => { r.pinned = !r.pinned; r.updatedAt = Date.now(); store.persist() } },
    ...(r.link ? [{ label: '复制链接', cb: () => { void navigator.clipboard?.writeText(r.link).then(() => showToast('✓ 链接已复制'), () => showToast('⚠ 复制失败（浏览器未授权剪贴板）')) } }] : []),
    { label: '删除（进回收站）', icon: 'trash', danger: true, cb: () => removeCard(r) }
  ]
  ctx.value = { open: true, x: Math.min(e.clientX, window.innerWidth - 190), y: Math.min(e.clientY, window.innerHeight - 220) }
}

/* ===== R2-⑧ 新建单卡（标题必填，链接/标签可选；采集仍是主要入口，这里补「我知道要什么」的场景） ===== */
const newOpen = ref(false)
const newDraft = ref({ title: '', link: '', tags: '' })
function openNew() {
  newDraft.value = { title: '', link: '', tags: '' }
  newOpen.value = true
}
function parseTags(s: string): string[] {
  return Array.from(new Set(s.split(/[,，;；]/).map(t => t.trim()).filter(Boolean)))
}
function createCard() {
  const title = newDraft.value.title.trim()
  if (!title) { showToast('请输入标题'); return }
  const link = newDraft.value.link.trim()
  const now = Date.now()
  const card: ResourceCard = {
    id: uid('rc'), kind: 'resource', title,
    linkType: /^file:\/\//i.test(link) ? 'file' : /^obsidian:/i.test(link) ? 'obsidian' : 'url',
    link, workspaceId: CURATION_WS_ID, categoryId: '',
    description: '', tags: parseTags(newDraft.value.tags), assets: [], customFields: {},
    pinned: false, callCount: 0, createdAt: now, updatedAt: now
  }
  store.data!.resources.unshift(card)
  store.persist()
  newOpen.value = false
  query.value = ''
  showToast(`✓ 已入池「${title.slice(0, 20)}」`)
}

/* ===== R2-⑧ 本地文件导入：入口重落到这里（R179 把链路 parked 在 Workspace.vue:673，
   并写明「本地文件导入迁调度台 3张卡『新建』弹窗」）。实现仍复用 useWorkspaceImport 一条口径，
   只是把 workspaceId 钉成池 id、分类留空（池卡由标签组织，R179 已删分类控件）。 ===== */
const { fileImportInput, fileImport, handleFileImport } = useWorkspaceImport({
  d: computed(() => store.data!),
  workspaceId: computed(() => CURATION_WS_ID),
  newCardCatId: () => '',
  persist: () => store.persist()
})

/* ===== R2-⑧ 批量：选择 → 打标签 / 软删（打标签只加不删，与拖拽打标同口径） ===== */
const batchMode = ref(false)
const selected = ref<Set<string>>(new Set())
const tagDraft = ref('')
function toggleBatch() {
  batchMode.value = !batchMode.value
  if (!batchMode.value) selected.value = new Set()
}
function toggleSel(id: string) {
  const s = new Set(selected.value)
  if (s.has(id)) s.delete(id); else s.add(id)
  selected.value = s
}
function selectAll() {
  selected.value = poolCards.value.length === selected.value.size ? new Set() : new Set(poolCards.value.map(r => r.id))
}
/** R3-Ca 反选：在**当前过滤结果**内取反（不是全池）——过滤态下"反选全池"会把看不见的卡卷进来 */
function invertSel() {
  const s = new Set(selected.value)
  const next = new Set<string>()
  for (const r of poolCards.value) if (!s.has(r.id)) next.add(r.id)
  selected.value = next
}
function applyTagToSelected() {
  const t = tagDraft.value.trim()
  if (!t) { showToast('先写一个标签'); return }
  if (!selected.value.size) { showToast('还没选中卡片'); return }
  let n = 0
  for (const r of store.data!.resources) {
    if (!selected.value.has(r.id) || r.deletedAt) continue
    r.tags = Array.from(new Set([...(r.tags || []), t]))
    r.updatedAt = Date.now()
    n++
  }
  store.persist()
  tagDraft.value = ''
  showToast(`✓ 已给 ${n} 张卡加标签「${t}」（只加不减，去标签到卡详情里改）`)
}
function deleteSelected() {
  const ids = Array.from(selected.value)
  if (!ids.length) { showToast('还没选中卡片'); return }
  const now = Date.now()
  for (const r of store.data!.resources) if (ids.includes(r.id) && !r.deletedAt) r.deletedAt = now
  store.persist()
  selected.value = new Set()
  showToast(`已删除 ${ids.length} 张卡 · 进回收站`, { label: '撤销', cb: () => {
    for (const r of store.data!.resources) if (ids.includes(r.id) && r.deletedAt === now) r.deletedAt = undefined
    store.persist()
  } })
}
</script>

<template>
  <div class="pcp">
    <div class="pcp-toolbar">
      <div class="pcp-search"><span>🔍</span><input v-model="query" placeholder="快速过滤标题 / 标签..."></div>
      <div class="pcp-views">
        <button class="pcp-btn sm" :class="{ on: viewMode === 'card' }" @click="viewMode = 'card'" title="网格视图">▦ 网格</button>
        <button class="pcp-btn sm" :class="{ on: viewMode === 'list' }" @click="viewMode = 'list'" title="列表视图（一屏看更多，标签全展开）">☰ 列表</button>
      </div>
      <button class="pcp-btn" :class="{ on: onlyUntagged }" :title="`无标签的卡在任何筛选下都召回不到——这里单独捞出来补标（当前 ${untaggedCount} 张）`" @click="onlyUntagged = !onlyUntagged">🏷 待打标 {{ untaggedCount }}</button>
      <button class="pcp-btn primary" @click="openNew">＋ 新建卡</button>
      <button class="pcp-btn" title="图片 / HTML / PDF，一文件一卡（本体存本地 IndexedDB）" @click="fileImport()">📥 导入本地文件</button>
      <button class="pcp-btn" :class="{ on: batchMode }" @click="toggleBatch">{{ batchMode ? '退出批量' : '批量' }}</button>
      <span class="pcp-count"><b>{{ poolCards.length }}</b> / 全部 {{ poolTotal }} 张</span>
    </div>

    <div v-if="batchMode" class="pcp-batch">
      <button class="pcp-btn sm" @click="selectAll">{{ poolCards.length && poolCards.length === selected.size ? '取消全选' : '全选本池' }}</button>
      <button class="pcp-btn sm" :disabled="!poolCards.length" title="在当前过滤结果内反选" @click="invertSel">反选</button>
      <span class="pcp-sel">已选 {{ selected.size }} 张</span>
      <input v-model="tagDraft" class="pcp-tagin" placeholder="加一个标签，回车应用" @keydown.enter="applyTagToSelected">
      <button class="pcp-btn sm" :disabled="!selected.size" @click="applyTagToSelected">应用标签</button>
      <button class="pcp-btn sm danger" :disabled="!selected.size" @click="deleteSelected">🗑 删除（进回收站）</button>
    </div>

    <!-- 新建单卡浮层：v-if 不开即零节点（全站浮层纪律） -->
    <div v-if="newOpen" class="pcp-mask" @click.self="newOpen = false">
      <div class="pcp-pop">
        <div class="pcp-pop-h">＋ 新建资源卡<span class="pcp-pop-x" @click="newOpen = false">×</span></div>
        <label>标题<input v-model="newDraft.title" placeholder="这张卡叫什么" @keydown.enter="createCard"></label>
        <label>链接<input v-model="newDraft.link" placeholder="https://…（可留空，之后在详情里补）"></label>
        <label>标签<input v-model="newDraft.tags" placeholder="逗号分隔，如 AI工具/知识库,写作"></label>
        <div class="pcp-pop-f">
          <span class="pcp-pop-hint">采集仍走 Ctrl+Shift+J（带网页上下文）；这里只补「我知道要什么」的卡</span>
          <button class="pcp-btn primary" @click="createCard">存入卡池</button>
        </div>
      </div>
    </div>

    <div v-if="!poolCards.length" class="pcp-empty">
      <template v-if="onlyUntagged">没有待打标的卡——池里每张卡都有标签了</template>
      <template v-else-if="query">没有匹配「{{ query }}」的资源卡——试试清空过滤</template>
      <template v-else>资源卡池还空着——用 <b>Ctrl+Shift+J</b> 从任意网页采集第一张卡，或点上面「＋ 新建卡」</template>
    </div>

    <!-- R3-Ca 列表视图：一屏看更多 + 标签全展开（网格留作默认，两档共用同一份 poolCards 与分页） -->
    <div v-else-if="viewMode === 'list'" class="pcp-list">
      <div v-for="r in rendered" :key="r.id" class="pcp-row" :class="{ flash: highlightId === r.id, picked: selected.has(r.id) }" :data-rid="r.id"
        :title="batchMode ? '点击选中 / 取消' : r.title + ' · 单击打开详情 · 右键更多'" @click="openCard(r)" @contextmenu="openCtx($event, r)">
        <span v-if="batchMode" class="pcp-check">{{ selected.has(r.id) ? '✓' : '' }}</span>
        <span class="pcp-r-title"><NewBadge :at="r.createdAt" /><span v-if="r.pinned" class="pcp-pin" title="已置顶">📌</span>{{ r.title }}</span>
        <span class="pcp-r-tags">
          <span v-if="!(r.tags || []).length" class="pcp-tag-none" title="无标签——任何筛选都召回不到它">无标签</span>
          <span v-for="t in (r.tags || [])" :key="t" class="pcp-tag">{{ t }}</span>
        </span>
        <span class="pcp-r-marks">
          <span v-if="r.link" class="pcp-mark" title="已挂链接">🔗</span>
          <span v-if="r.assets?.length" class="pcp-mark" title="有附件">📎{{ r.assets.length }}</span>
        </span>
        <span class="pcp-date">{{ new Date(r.updatedAt || r.createdAt || Date.now()).toLocaleDateString('zh-CN') }}</span>
        <button v-if="!batchMode" class="pcp-del" title="删除（进回收站，可撤销）" @click.stop="removeCard(r)">🗑</button>
      </div>
    </div>

    <div v-else class="pcp-grid">
      <div v-for="r in rendered" :key="r.id" class="pcp-card" :class="{ flash: highlightId === r.id, picked: selected.has(r.id) }" :data-rid="r.id"
        :title="batchMode ? '点击选中 / 取消' : r.title + ' · 单击打开详情 · 右键更多'" @click="openCard(r)" @contextmenu="openCtx($event, r)">
        <div class="pcp-top">
          <div class="pcp-title">
            <NewBadge :at="r.createdAt" />
            <span v-if="r.pinned" class="pcp-pin" title="已置顶">📌</span>{{ r.title }}
          </div>
          <span v-if="batchMode" class="pcp-check">{{ selected.has(r.id) ? '✓' : '' }}</span>
          <button v-else class="pcp-del" title="删除（进回收站，可撤销）" @click.stop="removeCard(r)">🗑</button>
        </div>
        <div class="pcp-foot">
          <span v-if="r.link" class="pcp-mark" title="已挂链接">🔗</span>
          <span v-if="r.assets?.length" class="pcp-mark" title="有附件">📎</span>
          <span v-for="t in (r.tags || []).slice(0, 3)" :key="t" class="pcp-tag">{{ t }}</span>
          <span class="pcp-date">{{ new Date(r.updatedAt || r.createdAt || Date.now()).toLocaleDateString('zh-CN') }}</span>
        </div>
      </div>
    </div>

    <ContextMenu :state="ctx" :items="ctxItems" @close="ctx.open = false" />

    <div v-if="hasMore" :ref="setSentinel" class="render-more" @click="renderMore">
      ↓ 已显示 {{ rendered.length }} / {{ poolCards.length }} 张 —— 点此加载更多
    </div>
    <input ref="fileImportInput" type="file" multiple accept="image/*,.png,.jpg,.jpeg,.gif,.webp,.svg,.bmp,.avif,.ico,.html,.htm,.pdf,application/pdf,text/html" style="display:none" @change="handleFileImport">
  </div>
</template>

<style scoped>
/* R2-③：池卡网格——与 DeckTabs 卡片语言同款（surface + hairline + hover 抬升） */
.pcp { min-height: 120px; }
.pcp-toolbar { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; flex-wrap: wrap; }
.pcp-search { display: flex; align-items: center; gap: 6px; padding: 5px 11px; border: 1px solid var(--border); border-radius: var(--radius-sm); background: var(--surface-2); }
.pcp-search:focus-within { border-color: var(--accent); }
.pcp-search input { border: none; outline: none; font-size: var(--fs-sub); width: 190px; background: transparent; color: var(--text); font-family: inherit; }
.pcp-count { margin-left: auto; font-size: var(--fs-sub); color: var(--text-3); font-variant-numeric: tabular-nums; }
.pcp-count b { color: var(--text-2); }
.pcp-btn { border: 1px solid var(--border); background: var(--surface); color: var(--text-2); border-radius: var(--radius-sm); padding: 5px 11px; font-size: var(--fs-sub); font-weight: 600; cursor: pointer; font-family: inherit; transition: all var(--dur); }
.pcp-btn:hover:not(:disabled) { border-color: var(--border-strong); color: var(--text); }
.pcp-btn:disabled { opacity: var(--opacity-disabled); cursor: not-allowed; }
.pcp-btn.primary { border-color: var(--accent); color: var(--accent); background: var(--accent-light); }
.pcp-btn.on { border-color: var(--text); background: var(--text); color: var(--bg); }
.pcp-btn.sm { padding: 4px 9px; font-size: var(--fs-caption); }
.pcp-btn.danger { border-color: var(--danger-border); color: var(--danger); }
.pcp-batch { display: flex; align-items: center; gap: 8px; padding: 8px 10px; margin-bottom: 12px; border: 1px solid var(--border); border-radius: var(--radius-sm); background: var(--surface-2); flex-wrap: wrap; }
.pcp-sel { font-size: var(--fs-sub); color: var(--text-2); font-variant-numeric: tabular-nums; }
.pcp-tagin { border: 1px solid var(--border); background: var(--surface); color: var(--text); border-radius: var(--radius-sm); padding: 4px 9px; font-size: var(--fs-sub); font-family: inherit; outline: none; width: 180px; }
.pcp-tagin:focus { border-color: var(--accent); }
.pcp-mask { position: fixed; inset: 0; background: rgba(0, 0, 0, .45); display: flex; align-items: center; justify-content: center; z-index: 60; }
.pcp-pop { width: min(420px, 92vw); background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-md); padding: 16px 18px; box-shadow: var(--shadow-lg); }
.pcp-pop-h { font-size: var(--fs-body); font-weight: 700; color: var(--text); margin-bottom: 12px; display: flex; align-items: center; }
.pcp-pop-x { margin-left: auto; cursor: pointer; color: var(--text-3); font-size: var(--fs-body); padding: 0 6px; }
.pcp-pop label { display: block; font-size: var(--fs-caption); color: var(--text-3); margin-bottom: 10px; }
.pcp-pop input { display: block; width: 100%; margin-top: 4px; border: 1px solid var(--border); background: var(--surface-2); color: var(--text); border-radius: var(--radius-sm); padding: 6px 9px; font-size: var(--fs-sub); font-family: inherit; outline: none; }
.pcp-pop input:focus { border-color: var(--accent); }
.pcp-pop-f { display: flex; align-items: center; gap: 10px; margin-top: 6px; }
.pcp-pop-hint { font-size: var(--fs-caption); color: var(--text-4); flex: 1; }
.pcp-empty { padding: 26px; text-align: center; font-size: var(--fs-sub); color: var(--text-3); }
.pcp-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 12px; }
.pcp-card { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-md); padding: 12px 14px; min-height: 94px; display: flex; flex-direction: column; justify-content: space-between; gap: 8px; cursor: pointer; transition: all var(--dur) ease; }
.pcp-card:hover { border-color: var(--border-strong); transform: translateY(-1px); box-shadow: var(--shadow-sm); }
.pcp-card.picked { border-color: var(--accent); background: var(--accent-light); }
/* R2-④：定位高亮——与 workspace.css 的 .res-card.flash 同一视觉语言（该表在调度台不加载，故本地定义） */
.pcp-card.flash, .pcp-row.flash { animation: pcp-flash 2s ease-out; }
@keyframes pcp-flash {
  0% { box-shadow: 0 0 0 3px var(--accent), 0 4px 20px color-mix(in srgb, var(--accent) 35%, transparent); background: var(--accent-light); }
  60% { box-shadow: 0 0 0 3px var(--accent); background: var(--accent-light); }
  100% { box-shadow: none; }
}
.pcp-top { display: flex; align-items: flex-start; gap: 6px; }
.pcp-title { flex: 1; min-width: 0; font-size: var(--fs-body); font-weight: 600; line-height: 1.4; color: var(--text); display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; word-break: break-word; }
.pcp-pin { flex-shrink: 0; font-size: var(--fs-tiny); }
.pcp-check { flex-shrink: 0; width: 18px; height: 18px; border: 1px solid var(--border-strong); border-radius: 5px; display: inline-flex; align-items: center; justify-content: center; font-size: var(--fs-caption); color: var(--accent); }
.pcp-del { border: none; background: transparent; color: var(--text-3); cursor: pointer; font-size: var(--fs-caption); border-radius: 5px; padding: 2px 5px; flex-shrink: 0; opacity: 0; transition: opacity var(--dur-fast); font-family: inherit; }
.pcp-card:hover .pcp-del { opacity: 1; }
.pcp-del:hover { color: var(--danger); background: var(--danger-bg-soft); }
.pcp-foot { display: flex; align-items: center; gap: 5px; font-size: var(--fs-tiny); color: var(--text-3); flex-wrap: wrap; }
.pcp-mark { flex-shrink: 0; }
.pcp-tag { padding: 0 6px; border-radius: 99px; background: var(--surface-3); color: var(--text-2); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 110px; }
.pcp-date { margin-left: auto; font-variant-numeric: tabular-nums; flex-shrink: 0; }
/* R3-Ca：视图切换段控件 + 列表视图（行高固定、标签全展开、hover 才出删除——与网格同一套令牌） */
.pcp-views { display: inline-flex; gap: 2px; padding: 2px; border: 1px solid var(--border); border-radius: var(--radius-sm); background: var(--surface-2); }
.pcp-views .pcp-btn { border-color: transparent; background: transparent; }
.pcp-views .pcp-btn.on { border-color: var(--border); background: var(--surface); color: var(--text); box-shadow: var(--shadow-sm); }
.pcp-list { display: flex; flex-direction: column; gap: 4px; }
.pcp-row { display: flex; align-items: center; gap: 8px; padding: 7px 10px; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-sm); cursor: pointer; transition: border-color var(--dur) ease, background var(--dur) ease; }
.pcp-row:hover { border-color: var(--border-strong); }
.pcp-row.picked { border-color: var(--accent); background: var(--accent-light); }
.pcp-r-title { flex: 0 1 auto; min-width: 120px; font-size: var(--fs-sub); font-weight: 600; color: var(--text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.pcp-r-tags { flex: 1 1 auto; min-width: 0; display: inline-flex; gap: 4px; overflow: hidden; }
.pcp-r-marks { flex-shrink: 0; display: inline-flex; gap: 4px; font-size: var(--fs-tiny); color: var(--text-3); }
.pcp-tag-none { padding: 0 6px; border-radius: 99px; background: var(--tag-warn-bg); color: var(--tag-warn-text); white-space: nowrap; font-size: var(--fs-tiny); }
.render-more { margin-top: 12px; padding: 9px; text-align: center; font-size: var(--fs-sub); color: var(--text-3); border: 1px dashed var(--border); border-radius: var(--radius-sm); cursor: pointer; }
.render-more:hover { color: var(--accent); border-color: var(--accent); }
</style>
