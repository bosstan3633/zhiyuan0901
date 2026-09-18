<script setup lang="ts">
/**
 * 第卅七轮 REQ-042：资源卡可编辑详情抽屉（搜索单击触发）
 * - 由 zy-open-drawer 总线（kind='res'）触发打开
 * - 容器改用共享 Drawer.vue（圆角/动效/遮罩与 ProjectDetailDrawer 同款）
 * - 第卅九轮 V2.15.0：编辑表单主体抽至共享 ResourceEditForm.vue（与 Workspace 内联抽屉合一）
 *   宿主保留：Drawer 容器 / 开关态 / 统计区(extra 插槽) / footer 动作(删除/复制/打开/保存)
 */
import { computed, reactive, ref, onMounted, onUnmounted, watch } from 'vue'
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

let unsub: (() => void) | null = null
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
      <button class="red-btn primary" @click="save">✓ 保存</button>
    </template>
  </Drawer>
</template>

<style scoped>
/* 宿主残留样式：统计区 + footer 动作条（字段区样式已迁入 ResourceEditForm） */
.red-section { margin-bottom: 16px; }
.red-label { font-size: 11px; color: var(--text-3); margin-bottom: 8px; text-transform: uppercase; letter-spacing: .04em; }
.red-stats { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; font-size: 12px; color: var(--text-2); }
.red-stat-chip { font-size: 11px; padding: 2px 8px; background: var(--surface-2); border: 1px solid var(--border); border-radius: 99px; }

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
