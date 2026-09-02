<script setup lang="ts">
/**
 * 第卅七轮 REQ-042：资源卡可编辑详情抽屉（搜索单击触发）
 * - 由 zy-open-drawer 总线（kind='res'）触发打开
 * - 容器改用共享 Drawer.vue（圆角/动效/遮罩与 ProjectDetailDrawer 同款）
 * - 内嵌完整编辑表单（标题/链接/工作台/分类/标签/注解），与工作台内联抽屉同款逻辑
 * - 底部：删除（软删走回收站）/ 复制链接 / 打开 / 保存
 */
import { computed, reactive, ref, onMounted, onUnmounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import Drawer from '@/shared/components/Drawer.vue'
import TagPicker from '@/shared/components/TagPicker.vue'
import { showToast } from '@/shared/components/toast'
import { useAppStore } from '../stores/app'
import { onOpenDrawer, type DrawerPayload } from '@/shared/utils/bus'
import { recordResourceOpen } from '@/shared/storage/stats'
import { toOpenableUrl, openExternalLink } from '@/shared/utils/link'
import { useTaHeight } from '@/shared/utils/taHeight'
import type { ResourceCard, Category } from '@/shared/models'

const router = useRouter()
const store = useAppStore()
const { taH: noteH, startTaResize: startNoteResize } = useTaHeight('res-drawer-note', store.ui)

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
const wsOptions = computed(() => store.workspaces)
/** 分类选项随抽屉中所选工作台联动（REQ-005：仅展示目标工作台的分类集合） */
const catOptions = computed(() => treeCatOptions((store.data?.categories || []).filter(c => c.workspaceId === editing.workspaceId)))
/** 被任务挂载（只读，点击跳任务中心） */
const mountedTasks = computed(() => {
  if (!store.data) return []
  return store.data.tasks.filter(t => !t.deletedAt && (t.mountedResourceIds || []).includes(editing.id))
})
const linkPlaceholder = computed(() => {
  if (editing.linkType === 'url') return 'https://...'
  if (editing.linkType === 'file') return 'D:\\path\\to\\file.pdf'
  return 'obsidian://open?vault=...'
})

function treeCatOptions(cats: Category[]): { id: string; label: string }[] {
  const roots = cats.filter(c => !c.parentId || !cats.some(p => p.id === c.parentId)).sort((a, b) => a.order - b.order)
  const out: { id: string; label: string }[] = []
  for (const r0 of roots) {
    out.push({ id: r0.id, label: r0.name })
    for (const ch of cats.filter(c => c.parentId === r0.id).sort((a, b) => a.order - b.order)) {
      out.push({ id: ch.id, label: '└ ' + ch.name })
    }
  }
  return out
}

function isFullPath(link: string): boolean {
  return /^([a-zA-Z]:[\\/]|file:\/\/|\/)/.test(link.trim())
}

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

function onDrawerWorkspaceChange() {
  editing.categoryId = ''
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
    showToast(`✓ 已保存并迁移至「${target?.name.replace(/^[^\s]+\s/, '') || '目标工作台'}」`)
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

function goToTask(title: string) {
  router.push('/compass/actions')
  showToast(`已跳转任务中心：${title}`)
}

function fmtTs(ts?: number): string {
  return ts ? new Date(ts).toLocaleString('zh-CN', { hour12: false }) : '—'
}

function onBus(p: DrawerPayload) {
  if (p.kind !== 'res' || !p.id) return
  openFromId(p.id)
}

let unsub: (() => void) | null = null
onMounted(() => { unsub = onOpenDrawer(onBus) })
onUnmounted(() => { unsub?.(); unsub = null })

watch(() => resource.value?.id, (n) => {
  if (open.value && n) highlight.value = true
})
</script>

<template>
  <Drawer :open="open" :title="editing.title || '编辑资源卡'" width="460px" @close="close">
    <div class="red-drawer" :class="{ highlight }">
      <div class="red-section">
        <textarea class="red-title" v-model="editing.title" rows="2" placeholder="资源卡标题..."
          @keydown.ctrl.enter.prevent="save" @keydown.meta.enter.prevent="save"></textarea>
      </div>

      <div class="red-section">
        <div class="red-label">🔗 链接（双击卡片即可打开）</div>
        <div class="red-link-type">
          <div class="red-link-type-btn" :class="{ active: editing.linkType === 'url' }" @click="editing.linkType = 'url'">🔗 URL</div>
          <div class="red-link-type-btn" :class="{ active: editing.linkType === 'file' }" @click="editing.linkType = 'file'">📁 本地文件</div>
          <div class="red-link-type-btn" :class="{ active: editing.linkType === 'obsidian' }" @click="editing.linkType = 'obsidian'">📝 Obsidian</div>
        </div>
        <input type="text" class="red-link-input" v-model="editing.link" :placeholder="linkPlaceholder"
          @keydown.ctrl.enter.prevent="save" @keydown.meta.enter.prevent="save">
        <div v-if="editing.linkType === 'file' && editing.link && !isFullPath(editing.link)" class="red-warn">
          ⚠ 当前仅存文件名，双击打开前请补全完整路径（如 D:\docs\file.pdf）
        </div>
      </div>

      <div class="red-section">
        <div class="red-label">🗂 所属工作台（切换保存后即跨工作台迁移）</div>
        <select class="red-select" v-model="editing.workspaceId" @change="onDrawerWorkspaceChange">
          <option v-for="w in wsOptions" :key="w.id" :value="w.id">{{ w.name }}</option>
        </select>
      </div>

      <div class="red-section">
        <div class="red-label">📁 所属分类（随所属工作台联动）</div>
        <select class="red-select" v-model="editing.categoryId">
          <option value="">📥 待分类</option>
          <option v-for="opt in catOptions" :key="opt.id" :value="opt.id">📂 {{ opt.label }}</option>
        </select>
      </div>

      <div class="red-section">
        <div class="red-label"># 标签（来自标签管理体系）</div>
        <TagPicker v-model="editing.tags" />
      </div>

      <div class="red-section">
        <div class="red-label">📝 我的注解</div>
        <div class="red-ta-wrap">
          <textarea class="red-note" v-model="editing.description" :style="{ height: noteH + 'px' }" placeholder="对这个资源的注解、思考、摘录..."
            @keydown.ctrl.enter.prevent="save" @keydown.meta.enter.prevent="save"></textarea>
          <div class="red-ta-resize" @mousedown="startNoteResize" title="拖拽调节高度（记忆保存）"></div>
        </div>
      </div>

      <div class="red-section" v-if="resource">
        <div class="red-label">📊 使用统计</div>
        <div class="red-stats">
          <span>打开 <b>{{ resource.callCount }}</b> 次</span>
          <span v-if="resource.lastCalledAt">· 最近 {{ fmtTs(resource.lastCalledAt) }}</span>
          <span class="red-stat-chip" v-if="resource.pinned">📌 置顶</span>
          <span class="red-stat-chip" v-if="resource.starred">⭐ 星标</span>
        </div>
      </div>

      <div class="red-section">
        <div class="red-label">📋 被任务挂载 ({{ mountedTasks.length }})</div>
        <div v-if="mountedTasks.length" class="red-mounted-list">
          <div v-for="t in mountedTasks" :key="t.id" class="red-mounted-item" @click="goToTask(t.title)">
            <span class="red-mi-icon">📋</span> {{ t.title }}
          </div>
        </div>
        <div v-else class="red-empty">暂无任务挂载此资源</div>
      </div>

      <div class="red-section" v-if="editing.createdAt">
        <div class="red-time">🕐 创建 {{ fmtTs(editing.createdAt) }} ｜ 更新 {{ fmtTs(editing.updatedAt) }}</div>
      </div>
    </div>

    <template #footer>
      <button class="red-btn danger" @click="remove">🗑 删除</button>
      <button class="red-btn" @click="copyLink">🔗 复制链接</button>
      <button class="red-btn" @click="openLink">↗ 打开</button>
      <button class="red-btn primary" @click="save">✓ 保存</button>
    </template>
  </Drawer>
</template>

<style scoped>
.red-drawer { display: flex; flex-direction: column; gap: 16px; }
.red-drawer.highlight .red-title { box-shadow: 0 0 0 2px var(--accent); }

.red-title {
  width: 100%; box-sizing: border-box; resize: none; border: 1px solid var(--border);
  border-radius: 8px; background: var(--surface-2); color: var(--text);
  padding: 10px 12px; font-size: 15px; font-weight: 600; line-height: 1.5; font-family: inherit;
}
.red-title:focus { outline: none; border-color: var(--accent); }

.red-label { font-size: 11px; color: var(--text-3); margin-bottom: 8px; text-transform: uppercase; letter-spacing: .04em; }
.red-link-type { display: flex; gap: 6px; margin-bottom: 8px; }
.red-link-type-btn {
  flex: 1; padding: 7px 0; text-align: center; font-size: 12.5px; cursor: pointer;
  border: 1px solid var(--border); border-radius: 6px; background: var(--surface-2); color: var(--text-2);
  transition: all .15s;
}
.red-link-type-btn.active { background: var(--accent); color: #fff; border-color: var(--accent); }
.red-link-input {
  width: 100%; box-sizing: border-box; padding: 8px 12px; border: 1px solid var(--border);
  border-radius: 6px; background: var(--surface-2); color: var(--text); font-size: 13px; font-family: inherit;
}
.red-link-input:focus { outline: none; border-color: var(--accent); }
.red-warn { margin-top: 8px; font-size: 12px; color: var(--danger); background: rgba(229,72,77,.08); padding: 6px 10px; border-radius: 6px; }

.red-select {
  width: 100%; box-sizing: border-box; padding: 8px 12px; border: 1px solid var(--border);
  border-radius: 6px; background: var(--surface-2); color: var(--text); font-size: 13px; font-family: inherit;
}
.red-select:focus { outline: none; border-color: var(--accent); }

.red-ta-wrap { position: relative; }
.red-note {
  width: 100%; box-sizing: border-box; resize: none; border: 1px solid var(--border);
  border-radius: 8px; background: var(--surface-2); color: var(--text);
  padding: 10px 12px; font-size: 13px; line-height: 1.7; font-family: inherit;
}
.red-note:focus { outline: none; border-color: var(--accent); }
.red-ta-resize {
  position: absolute; right: 4px; bottom: 2px; width: 14px; height: 14px; cursor: ns-resize;
  opacity: .5; background: linear-gradient(135deg, transparent 50%, var(--text-3) 50%);
}

.red-stats { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; font-size: 12px; color: var(--text-2); }
.red-stat-chip { font-size: 11px; padding: 2px 8px; background: var(--surface-2); border: 1px solid var(--border); border-radius: 99px; }

.red-mounted-list { display: flex; flex-direction: column; gap: 4px; }
.red-mounted-item { padding: 6px 10px; background: var(--surface-2); border-radius: 6px; font-size: 12px; color: var(--text); cursor: pointer; }
.red-mounted-item:hover { background: var(--surface-3); }
.red-mi-icon { margin-right: 4px; }
.red-empty { font-size: 12px; color: var(--text-3); padding: 4px 0; }
.red-time { font-size: 11px; color: var(--text-3); }

.red-btn {
  flex: 1; padding: 9px 12px; border: 1px solid var(--border); border-radius: 6px;
  background: var(--surface-2); color: var(--text); cursor: pointer; font-size: 12.5px; transition: all .15s;
}
.red-btn:hover { background: var(--surface-3); }
.red-btn.primary { background: var(--accent); color: #fff; border-color: var(--accent); }
.red-btn.primary:hover { opacity: .9; }
.red-btn.danger { background: transparent; border-color: var(--danger); color: var(--danger); }
.red-btn.danger:hover { background: rgba(229,72,77,.1); }
</style>
