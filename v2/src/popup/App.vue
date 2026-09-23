<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { K } from '@/shared/storage/keys'
import { uid } from '@/shared/utils'
import { loadData, saveDataNow } from '@/shared/storage/repository'
import type { AppData } from '@/shared/models'

const mode = ref<'capture' | 'curiosity' | 'task'>('capture')
const title = ref('')
const linkType = ref<'url' | 'file' | 'obsidian'>('url')
const link = ref('')
const description = ref('')
const workspaceId = ref('')
const categoryId = ref('')
const curiosityText = ref('')
const curioSource = ref({ title: '', url: '' })
const workspaces = ref<{id: string; name: string}[]>([])
// R55-C：快速采集任务（popup 降级；四字段全非必填）
const taskTitle = ref('')
const taskDesc = ref('')
const taskProjectId = ref('')
const taskMetricId = ref('')
const taskProjects = ref<{ id: string; name: string; metrics: { id: string; title: string }[] }[]>([])
const saved = ref(false)
const savedWsId = ref('')
const savedResourceId = ref('')
let savedTimer: ReturnType<typeof setTimeout> | null = null

onMounted(async () => {
  if (typeof chrome !== 'undefined' && chrome.storage?.session) {
    const prefill = await chrome.storage.session.get(K.QC_PREFILL)
    const p = prefill.zy_qc_prefill as { title?: string; url?: string; mode?: string } | undefined
    if (p) {
      title.value = p.title || ''
      link.value = p.url || ''
      if (p.mode === 'curiosity') {
        mode.value = 'curiosity'
        // 第廿二轮：降级路径好奇心同样附带来源（标题+链接）
        curioSource.value = { title: p.title || '', url: p.url || '' }
      }
      if (p.mode === 'task') { mode.value = 'task' }
    }
  }
  if (typeof chrome !== 'undefined' && chrome.storage?.local) {
    const data = await chrome.storage.local.get(K.DATA)
    const d = data.zy_data_v2 as AppData | undefined
    if (d?.workspaces) {
      workspaces.value = d.workspaces.filter(w => !w.archived)
      if (workspaces.value[0]) workspaceId.value = workspaces.value[0].id
    }
    if (d?.compass?.directions) {
      const list: { id: string; name: string; metrics: { id: string; title: string }[] }[] = []
      for (const dir of d.compass.directions) for (const proj of dir.projects || []) list.push({ id: proj.id, name: proj.name, metrics: proj.metrics || [] })
      taskProjects.value = list
    }
  }
  // 自动聚焦：好奇心/任务聚焦文本域或标题，采集聚焦标题
  setTimeout(() => {
    if (mode.value === 'curiosity') {
      const ta = document.getElementById('cz-textarea') as HTMLTextAreaElement
      ta?.focus()
    } else if (mode.value === 'task') {
      const ti = document.getElementById('task-title') as HTMLInputElement
      ti?.focus()
    } else {
      const ti = document.getElementById('cap-title') as HTMLInputElement
      ti?.focus(); ti?.select()
    }
  }, 100)
})

onMounted(() => window.addEventListener('keydown', onSavedKeydown, true))
onUnmounted(() => window.removeEventListener('keydown', onSavedKeydown, true))

function onSavedKeydown(e: KeyboardEvent) {
  if (!saved.value) return
  if (e.key === 'Enter') { e.preventDefault(); openBoard() }
  else if (e.key === 'Escape') { e.preventDefault(); closeWindow(0) }
}

async function getData(): Promise<AppData | null> {
  // R70：改走 repository——此前直读 chrome.storage.local 全量，绕过仓库缓存与序列化口径
  if (typeof chrome === 'undefined') return null
  try { return await loadData() } catch { return null }
}

async function setData(): Promise<void> {
  // R70：改走 repository——此前直写 chrome.storage.local 有两个实质问题：
  //  ① 绕过 flushCardEvents，popup 新建的卡不会进操作事件日志；
  //  ② 是无合并保护的全量读-改-写，与主界面并发保存会互相覆盖（现在统一走仓库落盘链路）。
  await saveDataNow()
}

function closeWindow(delay = 0) {
  setTimeout(() => {
    if (typeof chrome !== 'undefined' && chrome.windows) {
      chrome.windows.getCurrent((w) => w.id && chrome.windows.remove(w.id))
    }
  }, delay)
}

/** 已保存状态：Enter 打开看板（background 单例定位后关闭本窗口） */
function openBoard() {
  if (typeof chrome !== 'undefined' && chrome.runtime) {
    chrome.runtime.sendMessage({ type: 'zy-locate-workspace', wsId: savedWsId.value, hl: savedResourceId.value })
  }
  closeWindow(50)
}

async function save() {
  if (mode.value === 'task') {
    // R55-C：快速采集任务（popup 降级；四字段全非必填）
    const d = await getData()
    if (d) {
      const task = {
        id: uid('tk'),
        kind: 'task' as const,
        title: taskTitle.value.trim() || '快速任务',
        description: taskDesc.value.trim(),
        status: 'todo' as const,
        priority: 'medium' as const,
        projectId: taskProjectId.value || undefined,
        metricId: taskMetricId.value || undefined,
        mountedResourceIds: [] as string[],
        mountedCuriosityIds: [] as string[],
        customFields: {},
        tags: [] as string[],
        pinned: false,
        createdAt: Date.now(),
        updatedAt: Date.now()
      }
      d.tasks.unshift(task)
      if (task.metricId) {
        for (const dir of d.compass.directions) for (const p of dir.projects) for (const m of p.metrics)
          if (m.id === task.metricId && !m.taskIds.includes(task.id)) m.taskIds.push(task.id)
      }
      await setData()
    }
    saved.value = true
    if (savedTimer) clearTimeout(savedTimer)
    savedTimer = setTimeout(() => closeWindow(0), 5000)
    return
  }
  if (mode.value === 'curiosity') {
    if (!curiosityText.value.trim()) return
    const d = await getData()
    if (d) {
      d.curiosities.unshift({
        id: uid('cz'),
        kind: 'curiosity',
        question: curiosityText.value.trim(),
        sourceUrl: curioSource.value.url || undefined,
        sourceTitle: curioSource.value.title || undefined,
        status: 'todo',
        pinned: false,
        relatedResourceIds: [],
        customFields: {},
        createdAt: Date.now(),
        updatedAt: Date.now()
      })
      await setData()
    }
    saved.value = true
    if (savedTimer) clearTimeout(savedTimer)
    savedTimer = setTimeout(() => closeWindow(0), 5000)
  } else {
    if (!title.value.trim()) return
    const d = await getData()
    if (d) {
      const cat = d.categories.find(c => c.workspaceId === workspaceId.value && c.name === '待分类')
      const resource = {
        id: uid('rc'),
        kind: 'resource' as const,
        title: title.value.trim(),
        linkType: linkType.value,
        link: link.value.trim(),
        workspaceId: workspaceId.value,
        categoryId: categoryId.value || cat?.id || '',
        description: description.value.trim(),
        tags: [],
        customFields: {},
        pinned: false,
        callCount: 0,
        createdAt: Date.now(),
        updatedAt: Date.now()
      }
      d.resources.unshift(resource)
      await setData()
      savedWsId.value = resource.workspaceId
      savedResourceId.value = resource.id
    }
    saved.value = true
    if (savedTimer) clearTimeout(savedTimer)
    savedTimer = setTimeout(() => closeWindow(0), 5000)
  }
}
</script>

<template>
  <div class="popup-shell">
    <!-- 已保存状态：Enter 打开看板 / Esc 关闭 / 5 秒自动关闭 -->
    <div v-if="saved" class="save-state">
      <div class="save-icon">{{ mode === 'task' ? '⚡' : mode === 'curiosity' ? '✓' : '✓' }}</div>
      <div class="save-title">{{ mode === 'task' ? '⚡任务已保存' : mode === 'curiosity' ? '💗好奇心+1' : '资源卡已保存' }}</div>
      <template v-if="mode === 'task'">
        <div class="save-sub">{{ taskProjectId ? '已挂项目/指标 · 全域任务统一管理' : '暂为未归档任务 · 可随时在方向台归档' }}</div>
        <div class="save-sub">窗口即将自动关闭…</div>
      </template>
      <template v-else-if="mode === 'capture'">
        <div class="save-hint">按 <kbd>Enter</kbd> 打开看板 · 定位新卡片</div>
        <div class="save-sub">按 <kbd>Esc</kbd> 关闭 · 5 秒后自动关闭</div>
        <div class="save-actions">
          <button class="btn-ghost" @click="closeWindow(0)">关闭</button>
          <button class="btn-primary" @click="openBoard">打开看板（Enter）</button>
        </div>
      </template>
      <div v-else class="save-sub">窗口即将自动关闭…</div>
    </div>

    <template v-else>
      <div class="popup-head">
        <div class="popup-icon">{{ mode === 'capture' ? '📥' : mode === 'task' ? '⚡' : '💡' }}</div>
        <div class="popup-titles">
          <div class="popup-title">{{ mode === 'capture' ? '快速采集资源卡' : mode === 'task' ? '快速采集任务' : '采集好奇心' }}</div>
          <div class="popup-sub">{{ mode === 'capture' ? '把当前页面收进你的来源网络' : mode === 'task' ? '四项皆可留空 · 存入全域任务' : '从好奇出发，向源头求证' }}</div>
        </div>
      </div>
      <div class="popup-body">
        <template v-if="mode === 'task'">
          <div class="field">
            <label class="field-label">任务名称</label>
            <input id="task-title" v-model="taskTitle" class="field-input" placeholder="要做什么（可留空）"
              @keydown.ctrl.enter.prevent="save" @keydown.meta.enter.prevent="save" />
          </div>
          <div class="field">
            <label class="field-label">任务内容</label>
            <textarea v-model="taskDesc" class="field-input" rows="3" placeholder="补充说明、上下文、验收标准（可留空）"
              @keydown.ctrl.enter.prevent="save" @keydown.meta.enter.prevent="save"></textarea>
          </div>
          <div class="field-row">
            <div class="field">
              <label class="field-label">所属项目（可留空）</label>
              <select v-model="taskProjectId" class="field-select">
                <option value="">未关联项目</option>
                <option v-for="p in taskProjects" :key="p.id" :value="p.id">📦 {{ p.name }}</option>
              </select>
            </div>
            <div class="field">
              <label class="field-label">所属指标（可留空）</label>
              <select v-model="taskMetricId" class="field-select" :disabled="!taskProjectId">
                <option value="">暂不归属</option>
                <option v-for="m in (taskProjects.find(p => p.id === taskProjectId)?.metrics || [])" :key="m.id" :value="m.id">🎯 {{ m.title }}</option>
              </select>
            </div>
          </div>
          <div class="field-hint">Ctrl+Enter 快速保存 · 未挂项目 = 未归档任务</div>
        </template>
        <template v-else-if="mode === 'capture'">
          <div class="field">
            <label class="field-label">标题</label>
            <input id="cap-title" v-model="title" class="field-input" placeholder="资源卡标题"
              @keydown.enter.prevent="save" @keydown.ctrl.enter.prevent="save" @keydown.meta.enter.prevent="save" />
          </div>
          <div class="field">
            <label class="field-label">链接类型</label>
            <div class="seg-control">
              <button v-for="t in (['url','file','obsidian'] as const)" :key="t"
                class="seg-btn" :class="{active: linkType === t}" @click="linkType = t">
                {{ t === 'url' ? '🔗 URL' : t === 'file' ? '📁 本地文件' : '📝 Obsidian' }}
              </button>
            </div>
            <input v-model="link" class="field-input" :placeholder="linkType === 'url' ? 'https://…' : linkType === 'file' ? 'D:\\folder\\file.pdf' : 'obsidian://open?vault=…'"
              @keydown.enter.prevent="save" @keydown.ctrl.enter.prevent="save" @keydown.meta.enter.prevent="save" />
          </div>
          <div class="field">
            <label class="field-label">描述（可编辑）</label>
            <textarea v-model="description" class="field-input" rows="2" placeholder="对该资源的注解、摘录、引用…"
              @keydown.ctrl.enter.prevent="save" @keydown.meta.enter.prevent="save"></textarea>
          </div>
          <div class="field-row">
            <div class="field">
              <label class="field-label">存入台面</label>
              <select v-model="workspaceId" class="field-select">
                <option v-for="w in workspaces" :key="w.id" :value="w.id">{{ w.name }}</option>
              </select>
            </div>
            <div class="field">
              <label class="field-label">分类</label>
              <select v-model="categoryId" class="field-select">
                <option value="">📥 待分类</option>
              </select>
            </div>
          </div>
        </template>
        <template v-else>
          <div class="field">
            <label class="field-label">你的问题或想法</label>
            <textarea id="cz-textarea" v-model="curiosityText" class="field-input" rows="4"
              placeholder="看到什么、想到什么、想探索什么？纯文本即可…"
              @keydown.ctrl.enter="save" @keydown.meta.enter="save" />
            <div class="field-hint">Ctrl+Enter 快速保存</div>
          </div>
        </template>
      </div>
      <div class="popup-foot">
        <button class="btn-ghost" @click="closeWindow(0)">取消</button>
        <button class="btn-primary" @click="save">💾 保存（Enter）</button>
      </div>
    </template>
  </div>
</template>

<style scoped>
.popup-shell { font-family: -apple-system, BlinkMacSystemFont, "PingFang SC", "Segoe UI", sans-serif; position: relative; }
.popup-head { padding: 22px 24px 0; display: flex; align-items: flex-start; gap: 12px; }
.popup-icon { width: 40px; height: 40px; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 19px; flex-shrink: 0; background: var(--accent-light); }
.popup-title { font-size: 16px; font-weight: 700; color: var(--text); }
.popup-sub { font-size: var(--fs-sub); color: var(--text-3); margin-top: 2px; }
.popup-body { padding: 18px 24px 20px; }
.field { margin-bottom: 14px; }
.field:last-child { margin-bottom: 0; }
.field-label { display: block; font-size: var(--fs-sub); font-weight: 600; color: var(--text-3); margin-bottom: 6px; }
.field-input { width: 100%; border: 1px solid var(--border); border-radius: 11px; padding: 10px 13px; font-size: var(--fs-body); color: var(--text); background: var(--surface); outline: none; font-family: inherit; transition: all var(--dur); line-height: 1.5; box-sizing: border-box; }
.field-input:focus { border-color: var(--accent); box-shadow: 0 0 0 3.5px var(--accent-glow); }
textarea.field-input { resize: vertical; min-height: 60px; font-size: 14px; line-height: 1.65; }
.field-hint { font-size: var(--fs-caption); color: var(--text-3); margin-top: 5px; text-align: right; }
.seg-control { display: flex; gap: 3px; background: var(--surface-2); border-radius: 10px; padding: 3px; margin-bottom: 8px; }
.seg-btn { flex: 1; padding: 7px 8px; border-radius: 8px; border: none; background: transparent; font-size: var(--fs-sub); color: var(--text-3); cursor: pointer; transition: all var(--dur); font-family: inherit; font-weight: 500; }
.seg-btn:hover { color: var(--text-2); }
.seg-btn.active { background: var(--surface); color: var(--accent); font-weight: 600; box-shadow: 0 1px 3px rgba(0,0,0,.06); }
.field-row { display: flex; gap: 10px; }
.field-row .field { flex: 1; }
.field-select { width: 100%; border: 1px solid var(--border); border-radius: 11px; padding: 10px 13px; font-size: var(--fs-body); color: var(--text); background: var(--surface); outline: none; font-family: inherit; cursor: pointer; }
.field-select:focus { border-color: var(--accent); box-shadow: 0 0 0 3.5px var(--accent-glow); }
.popup-foot { display: flex; gap: 10px; padding: 14px 24px; border-top: 1px solid var(--border); background: var(--surface-2); }
.btn-ghost { padding: 9px 18px; border-radius: 10px; font-size: var(--fs-body); font-weight: 600; cursor: pointer; border: 1px solid var(--border); background: var(--surface); color: var(--text-2); font-family: inherit; transition: all var(--dur); }
.btn-ghost:hover { border-color: var(--border-strong); color: var(--text); }
.btn-primary { margin-left: auto; padding: 9px 18px; border-radius: 10px; font-size: var(--fs-body); font-weight: 600; cursor: pointer; border: 1px solid var(--accent); background: var(--accent); color: #fff; font-family: inherit; transition: all var(--dur); box-shadow: 0 1px 2px rgba(14,122,78,.2), 0 4px 12px rgba(14,122,78,.15); }
.btn-primary:hover { background: var(--accent-hover); transform: translateY(-1px); }

/* 已保存状态 */
.save-state { position: absolute; inset: 0; background: var(--surface); display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; z-index: 10; border-radius: 16px; padding: 24px; text-align: center; }
.save-icon { width: 52px; height: 52px; border-radius: 50%; background: var(--tag-ok-bg); color: var(--tag-ok-text); font-size: 24px; font-weight: 700; display: flex; align-items: center; justify-content: center; animation: pop .3s var(--ease-spring); }
.save-title { font-size: 16px; font-weight: 700; color: var(--text); }
.save-hint { font-size: var(--fs-body); color: var(--accent); font-weight: 600; }
.save-hint kbd, .save-sub kbd { background: var(--surface-3); border: 1px solid var(--border); border-radius: 5px; padding: 1px 7px; font-family: inherit; font-size: var(--fs-caption); color: var(--text-2); }
.save-sub { font-size: var(--fs-sub); color: var(--text-3); }
.save-actions { display: flex; gap: 10px; margin-top: 14px; }
@keyframes pop { 0% { transform: scale(.5); opacity: 0; } 100% { transform: scale(1); opacity: 1; } }
</style>
