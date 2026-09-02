<script setup lang="ts">
/**
 * 第卅六轮 REQ-039：资源卡只读预览抽屉
 * - 由 zy-open-drawer 总线（kind='res'）触发打开
 * - 仅展示，不直接编辑；点"全屏编辑"跳到 Workspace 打开其原编辑抽屉
 */
import { computed, ref, onMounted, onUnmounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useAppStore } from '../stores/app'
import { onOpenDrawer, type DrawerPayload } from '@/shared/utils/bus'
import { recordResourceOpen } from '@/shared/storage/stats'

const router = useRouter()
const store = useAppStore()

const open = ref(false)
const resId = ref<string | null>(null)
const highlight = ref(false)

const resource = computed(() => {
  if (!resId.value || !store.data) return null
  return store.data.resources.find(r => r.id === resId.value) || null
})
const workspace = computed(() => {
  const r = resource.value
  if (!r) return null
  return store.workspaces.find(w => w.id === r.workspaceId) || null
})
const category = computed(() => {
  const r = resource.value
  if (!r) return null
  return store.data?.categories.find(c => c.id === r.categoryId) || null
})
const mountedTasks = computed(() => {
  const r = resource.value
  if (!r || !store.data) return []
  return store.data.tasks.filter(t => !t.deletedAt && t.mountedResourceIds?.includes(r.id))
})

function showOverlay() { return open.value }

function fmtTs(ts?: number): string {
  if (!ts) return '-'
  const d = new Date(ts)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}
function linkIcon(lt?: string): string {
  return lt === 'file' ? '📁' : lt === 'obsidian' ? '📝' : '🔗'
}
function linkLabel(lt?: string): string {
  return lt === 'file' ? '本地文件' : lt === 'obsidian' ? 'Obsidian' : 'URL'
}
function openLink() {
  const r = resource.value
  if (!r) return
  if (typeof chrome !== 'undefined' && chrome.tabs?.create) chrome.tabs.create({ url: r.link })
  else window.open(r.link, '_blank')
  if (store.data) recordResourceOpen(store.data, r)
  store.persist()
}
function copyLink() {
  const r = resource.value
  if (!r) return
  navigator.clipboard?.writeText(r.link).then(() => {}).catch(() => {})
}
function close() {
  open.value = false
  resId.value = null
  highlight.value = false
}
function jumpToWorkspaceEdit() {
  const r = resource.value
  if (!r) return
  router.push({ path: `/workspace/${r.workspaceId}`, query: { hl: r.id } })
  close()
}

function onBus(p: DrawerPayload) {
  if (p.kind !== 'res' || !p.id) return
  resId.value = p.id
  open.value = true
  highlight.value = true
  setTimeout(() => { highlight.value = false }, 1800)
}

let unsub: (() => void) | null = null
onMounted(() => { unsub = onOpenDrawer(onBus) })
onUnmounted(() => { unsub?.(); unsub = null })

watch(() => resource.value?.id, (n) => {
  if (open.value && n) highlight.value = true
})
</script>

<template>
  <Teleport to="body">
    <div class="rdd-overlay" :class="{ open: showOverlay() }" @click="close"></div>
    <div class="rdd-drawer" :class="{ open, highlight }" role="dialog" aria-label="资源卡详情">
      <div class="rdd-header">
        <div class="rdd-title-row">
          <span class="rdd-icon">{{ linkIcon(resource?.linkType) }}</span>
          <h3 class="rdd-title">{{ resource?.title || '（已删除）' }}</h3>
          <button class="rdd-close" @click="close" aria-label="关闭">×</button>
        </div>
        <div class="rdd-meta">
          <span class="rdd-chip">{{ linkLabel(resource?.linkType) }}</span>
          <span class="rdd-chip" v-if="workspace">📁 {{ workspace.name }}</span>
          <span class="rdd-chip" v-if="category">📂 {{ category.name }}</span>
          <span class="rdd-chip" v-if="resource?.pinned">📌 置顶</span>
          <span class="rdd-chip" v-if="resource?.starred">⭐ 星标</span>
        </div>
        <div class="rdd-tags" v-if="resource?.tags?.length">
          <span v-for="t in resource.tags" :key="t" class="rdd-tag">#{{ t }}</span>
        </div>
      </div>

      <div class="rdd-body">
        <section v-if="resource?.link" class="rdd-section">
          <div class="rdd-label">链接</div>
          <div class="rdd-link"><a :href="resource.link" target="_blank" rel="noreferrer" @click="openLink">{{ resource.link }}</a></div>
        </section>

        <section v-if="resource?.description" class="rdd-section">
          <div class="rdd-label">📝 注解</div>
          <div class="rdd-note">{{ resource.description }}</div>
        </section>

        <section v-if="resource?.callCount != null" class="rdd-section">
          <div class="rdd-label">📊 使用统计</div>
          <div class="rdd-stats">
            <span>打开 <b>{{ resource.callCount }}</b> 次</span>
            <span v-if="resource.lastCalledAt">· 最近 {{ fmtTs(resource.lastCalledAt) }}</span>
          </div>
        </section>

        <section v-if="resource" class="rdd-section">
          <div class="rdd-label">📋 被任务挂载 ({{ mountedTasks.length }})</div>
          <div class="rdd-mounted" v-if="mountedTasks.length">
            <div v-for="t in mountedTasks" :key="t.id" class="rdd-mounted-item">
              <span class="rdd-mi-icon">📋</span>{{ t.title }}
            </div>
          </div>
          <div class="rdd-empty" v-else>暂无任务挂载</div>
        </section>

        <section v-if="resource" class="rdd-section">
          <div class="rdd-time">🕐 创建 {{ fmtTs(resource.createdAt) }} ｜ 更新 {{ fmtTs(resource.updatedAt) }}</div>
        </section>
      </div>

      <div class="rdd-footer">
        <button class="rdd-btn" @click="copyLink" :disabled="!resource">🔗 复制链接</button>
        <button class="rdd-btn" @click="openLink" :disabled="!resource">↗ 打开</button>
        <button class="rdd-btn primary" @click="jumpToWorkspaceEdit" :disabled="!resource">↗ 全屏编辑</button>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.rdd-overlay { position: fixed; inset: 0; background: rgba(0,0,0,.4); opacity: 0; pointer-events: none; transition: opacity .2s; z-index: 9998; }
.rdd-overlay.open { opacity: 1; pointer-events: auto; }
.rdd-drawer { position: fixed; top: 0; right: 0; bottom: 0; width: 440px; max-width: 90vw; background: var(--surface-1); box-shadow: -4px 0 24px rgba(0,0,0,.2); transform: translateX(100%); transition: transform .25s cubic-bezier(.4,0,.2,1); z-index: 9999; display: flex; flex-direction: column; }
.rdd-drawer.open { transform: translateX(0); }
.rdd-drawer.highlight { box-shadow: -4px 0 0 2px var(--accent), -4px 0 24px rgba(94,106,210,.3); }

.rdd-header { padding: 18px 18px 12px; border-bottom: 1px solid var(--border); }
.rdd-title-row { display: flex; align-items: center; gap: 8px; }
.rdd-icon { font-size: 20px; }
.rdd-title { flex: 1; margin: 0; font-size: 16px; font-weight: 600; line-height: 1.4; color: var(--text); word-break: break-word; }
.rdd-close { width: 28px; height: 28px; border-radius: 6px; border: none; background: transparent; color: var(--text-3); cursor: pointer; font-size: 20px; line-height: 1; }
.rdd-close:hover { background: var(--surface-3); color: var(--text); }

.rdd-meta { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 10px; }
.rdd-chip { font-size: 11px; padding: 2px 8px; background: var(--surface-2); border: 1px solid var(--border); border-radius: 99px; color: var(--text-2); }
.rdd-tags { margin-top: 8px; display: flex; flex-wrap: wrap; gap: 4px; }
.rdd-tag { font-size: 11px; color: var(--accent); background: rgba(94,106,210,.08); padding: 1px 7px; border-radius: 4px; }

.rdd-body { flex: 1; overflow-y: auto; padding: 16px 18px; }
.rdd-section { margin-bottom: 18px; }
.rdd-label { font-size: 11px; color: var(--text-3); margin-bottom: 6px; text-transform: uppercase; letter-spacing: .04em; }
.rdd-link { font-size: 13px; word-break: break-all; }
.rdd-link a { color: var(--accent); text-decoration: none; }
.rdd-link a:hover { text-decoration: underline; }
.rdd-note { font-size: 13px; line-height: 1.7; white-space: pre-wrap; background: var(--surface-2); padding: 10px 12px; border-radius: 8px; color: var(--text); }
.rdd-stats { display: flex; flex-wrap: wrap; gap: 6px; font-size: 12px; color: var(--text-2); }
.rdd-mounted-item { padding: 6px 10px; background: var(--surface-2); border-radius: 6px; font-size: 12px; color: var(--text); margin-bottom: 4px; }
.rdd-mi-icon { margin-right: 4px; }
.rdd-empty { font-size: 12px; color: var(--text-3); padding: 4px 0; }
.rdd-time { font-size: 11px; color: var(--text-3); }

.rdd-footer { display: flex; gap: 8px; padding: 12px 18px; border-top: 1px solid var(--border); background: var(--surface-1); }
.rdd-btn { flex: 1; padding: 8px 12px; border: 1px solid var(--border); border-radius: 6px; background: var(--surface-2); color: var(--text); cursor: pointer; font-size: 12.5px; transition: all .15s; }
.rdd-btn:hover:not(:disabled) { background: var(--surface-3); }
.rdd-btn.primary { background: var(--accent); color: #fff; border-color: var(--accent); }
.rdd-btn.primary:hover:not(:disabled) { background: var(--accent); opacity: .9; }
.rdd-btn:disabled { opacity: .4; cursor: not-allowed; }
</style>
