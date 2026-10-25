<script setup lang="ts">
/**
 * ★V3.9.20 · GlobalPopups 第二梯队拆分 · 第二块：快速添加家族（任务速记 + 好奇采集）。
 * 模式照抄 V3.9.6 的 GlobalPopupsShortcuts.vue：宿主只管「当前是不是这个面板」与「关掉」，
 * 交互、类名与 DOM 结构一字未改（E2E/theme-audit/回归的锚全部不动的承诺就建立在这条上）。
 *
 * 拆走了什么：tcForm/tcProjects/tcMetrics/saveTaskCapture/tcOpenBoard/resetTcForm、
 * curioForm/saveCurio、开面板初始化（预填 / 选中文本捕获 / 最近网页标签来源）、saved 态键盘。
 * 宿主仍保留：PanelType 状态机（'taskcapture'/'curio' 字面量在壳，R55-9 前半锚不动）、
 * onSavedKeydown 的转发（savedKey 经 defineExpose 上交）。
 */
import { ref, computed, reactive, watch, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { useAppStore } from '@/newtab/stores/app'
import { uid } from '@/shared/utils'
import { showToast } from '@/shared/components/toast'
import { getRecentWebTab } from '@/shared/utils/recentWebTab'
import Icon from '@/shared/components/Icon.vue'
import type { CuriosityCard } from '@/shared/models'

const props = defineProps<{
  /** 任务速记面板当前是否打开 */
  taskActive: boolean
  /** 好奇采集面板当前是否打开 */
  curioActive: boolean
  /** 宿主 openPanel 时带来的预填（R172-T11：复盘报告「生成任务」预填进任务速记，仍要用户点保存） */
  prefill?: { title?: string; description?: string }
}>()

const emit = defineEmits<{ (e: 'close'): void }>()

const router = useRouter()
const store = useAppStore()
const d = computed(() => store.data!)

function closeAll() { emit('close') }

// ===== R55-C：快速采集任务（四字段全非必填，直存全域任务；未挂项目=未归档） =====
const tcTitleInput = ref<HTMLInputElement | null>(null)
const curioInput = ref<HTMLTextAreaElement | null>(null)
const tcForm = reactive({ title: '', description: '', projectId: '', metricId: '' })
const tcSaved = ref(false)
let tcSavedTimer: ReturnType<typeof setTimeout> | null = null
/* ★随迁备案（V3.9.20 拆分）：完成口径与壳内搜索用的 isProjectDone 同形（R52-BUG-2：手动 done/archived
   或全任务完成派生）——壳那份继续服务检索计数，这里服务 tcProjects 下拉，两处口径必须同形维护。 */
function isProjectDone(p: { status: string; id: string }): boolean {
  if (p.status === 'done' || p.status === 'archived') return true
  const ts = d.value.tasks.filter(t => !t.deletedAt && t.projectId === p.id)
  return ts.length > 0 && ts.every(t => t.status === 'done')
}
const showDoneProjects = computed(() => (store.ui as any)?.showDoneProjects !== false)
const tcProjects = computed(() => d.value.compass.directions.flatMap(dir => dir.projects).filter(p => showDoneProjects.value || !isProjectDone(p)))
const tcMetrics = computed(() => tcProjects.value.find(p => p.id === tcForm.projectId)?.metrics || [])
watch(() => tcForm.projectId, () => { tcForm.metricId = '' })
function saveTaskCapture() {
  const now = Date.now()
  const task = {
    id: uid('tk'), kind: 'task' as const,
    title: tcForm.title.trim() || '快速任务',
    description: tcForm.description.trim(),
    status: 'todo' as const, priority: 'medium' as const,
    projectId: tcForm.projectId || undefined,
    metricId: tcForm.metricId || undefined,
    customFields: {}, tags: [] as string[], pinned: false,
    createdAt: now, updatedAt: now
  }
  d.value.tasks.unshift(task)
  if (task.metricId) {
    for (const dir of d.value.compass.directions) for (const p of dir.projects) for (const m of p.metrics)
      if (m.id === task.metricId && !m.taskIds.includes(task.id)) m.taskIds.push(task.id)
  }
  store.persist()
  tcSaved.value = true
  if (tcSavedTimer) clearTimeout(tcSavedTimer)
  tcSavedTimer = setTimeout(() => { closeAll(); tcSaved.value = false }, 5000)
}
function tcOpenBoard() {
  resetTcForm()
  closeAll()
  // R117（04-61 C1）：任务调度面板已迁调度台底部 tab ⇒ 改走 ?bottom=task（原 /compass?zone=task 失效）
  router.push({ path: '/deck/task' })
}
function resetTcForm() {
  tcForm.title = ''; tcForm.description = ''; tcForm.projectId = ''; tcForm.metricId = ''
  if (tcSavedTimer) { clearTimeout(tcSavedTimer); tcSavedTimer = null }
  tcSaved.value = false
}

// ===== 第十七轮：好奇心采集（仅当选中文本时附带来源；无选中 → 链接为空，不预设默认值） =====
const curioForm = reactive({ text: '', sourceTitle: '', sourceUrl: '' })

function saveCurio() {
  if (!curioForm.text.trim()) { showToast('请输入内容'); return }
  const c: CuriosityCard = {
    id: uid('cur'), kind: 'curiosity', question: curioForm.text.trim(),
    sourceUrl: curioForm.sourceUrl || undefined, sourceTitle: curioForm.sourceTitle || undefined,
    status: 'todo', pinned: false, customFields: {},
    createdAt: Date.now(), updatedAt: Date.now()
  }
  d.value.curiosities.unshift(c)
  store.persist()
  curioForm.text = ''
  closeAll()
  showToast('好奇心+1')
}

// ===== 开面板初始化（原宿主 openPanel 的两段分支随拆分迁入，逻辑一字未改） =====
watch(() => props.taskActive, v => {
  if (!v) return
  tcSaved.value = false
  tcForm.title = props.prefill?.title || ''
  tcForm.description = props.prefill?.description || ''
  tcForm.projectId = ''
  tcForm.metricId = ''
  void nextTick(() => tcTitleInput.value?.focus())
})
watch(() => props.curioActive, v => {
  if (!v) return
  curioForm.sourceTitle = ''
  curioForm.sourceUrl = ''
  const sel = window.getSelection?.()?.toString().trim()
  if (sel) {
    if (!curioForm.text.trim()) curioForm.text = sel
    getRecentWebTab().then(t => {
      if (t && props.curioActive) {
        curioForm.sourceTitle = t.title || ''
        curioForm.sourceUrl = t.url || ''
      }
    })
  }
  void nextTick(() => curioInput.value?.focus())
})

/** 「已保存」态键盘（宿主 onSavedKeydown 的 taskcapture 分支原样迁入）：返回是否已消费 */
function savedKey(e: KeyboardEvent): boolean {
  if (!props.taskActive || !tcSaved.value) return false
  if (e.key === 'Enter') { e.preventDefault(); tcOpenBoard(); return true }
  if (e.key === 'Escape') { e.preventDefault(); resetTcForm(); closeAll(); return true }
  return false
}
defineExpose({ savedKey })
</script>

<template>
  <!-- 快速采集任务（R55-C：四字段全非必填，直存全域任务；保存后 Enter=打开任务管理） -->
  <div class="gp-overlay" :class="{open: taskActive}" @click.self="closeAll">
    <div class="gp-panel gp-panel-narrow">
      <template v-if="!tcSaved">
        <div class="gp-cap-head">
          <div class="gp-cap-icon res"><Icon name="zap" :size="13"/></div>
          <div class="gp-cap-titles">
            <div class="gp-cap-title">快速采集任务</div>
            <div class="gp-cap-sub">四项皆可留空 · 存入全域任务统一管理</div>
          </div>
          <button class="gp-cap-close" @click="closeAll">×</button>
        </div>
        <div class="gp-cap-body">
          <div class="gp-field">
            <label class="gp-field-label">任务名称</label>
            <input ref="tcTitleInput" type="text" class="gp-field-input" v-model="tcForm.title" placeholder="要做什么（可留空）"
              @keydown.ctrl.enter.prevent="saveTaskCapture" @keydown.meta.enter.prevent="saveTaskCapture">
          </div>
          <div class="gp-field">
            <label class="gp-field-label">任务内容</label>
            <textarea class="gp-field-input gp-cap-desc" v-model="tcForm.description"
              placeholder="补充说明、上下文、验收标准（可留空）"
              @keydown.ctrl.enter.prevent="saveTaskCapture" @keydown.meta.enter.prevent="saveTaskCapture"></textarea>
          </div>
          <div class="gp-field-row">
            <div class="gp-field">
              <label class="gp-field-label">所属项目（可留空）</label>
              <select class="gp-status-select" v-model="tcForm.projectId">
                <option value="">未关联项目</option>
                <option v-for="p in tcProjects" :key="p.id" :value="p.id"><Icon name="package" :size="13"/> {{ p.name }}</option>
              </select>
            </div>
            <div class="gp-field">
              <label class="gp-field-label">所属指标（可留空）</label>
              <select class="gp-status-select" v-model="tcForm.metricId" :disabled="!tcForm.projectId">
                <option value="">暂不归属</option>
                <option v-for="m in tcMetrics" :key="m.id" :value="m.id"><Icon name="target" :size="13"/> {{ m.title }}</option>
              </select>
            </div>
          </div>
        </div>
        <div class="gp-cap-foot">
          <button class="gp-btn gp-btn-ghost" @click="closeAll">取消</button>
          <button class="gp-btn gp-btn-primary" @click="saveTaskCapture"><Icon name="zap" :size="13"/> 保存任务（Ctrl+Enter）</button>
        </div>
      </template>
      <template v-else>
        <div class="gp-saved">
          <div class="gp-saved-icon"><Icon name="zap" :size="13"/></div>
          <div class="gp-saved-title">任务已保存</div>
          <div class="gp-saved-sub">{{ tcForm.projectId ? '已挂项目/指标 · 全域任务统一管理' : '暂为未归档任务 · 可随时在方向台归档' }}</div>
          <div class="gp-saved-hint">按 <kbd>Enter</kbd> 打开任务管理</div>
          <div class="gp-saved-sub">按 <kbd>Esc</kbd> 关闭 · 5 秒后自动关闭</div>
          <div class="gp-saved-actions">
            <button class="gp-btn gp-btn-ghost" @click="resetTcForm(); closeAll()">关闭</button>
            <button class="gp-btn gp-btn-primary" @click="tcOpenBoard">打开任务管理（Enter）</button>
          </div>
        </div>
      </template>
    </div>
  </div>

  <!-- 采集好奇心 -->
  <div class="gp-overlay" :class="{open: curioActive}" @click.self="closeAll">
    <div class="gp-panel gp-panel-curio">
      <div class="gp-cap-head">
        <div class="gp-cap-icon curio"><Icon name="bulb" :size="13"/></div>
        <div class="gp-cap-titles">
          <div class="gp-cap-title">采集好奇心</div>
          <div class="gp-cap-sub">从好奇出发，向源头求证</div>
        </div>
        <button class="gp-cap-close" @click="closeAll">×</button>
      </div>
      <div class="gp-cap-body">
        <div class="gp-field">
          <label class="gp-field-label">你的问题或想法</label>
          <textarea ref="curioInput" class="gp-field-input gp-curio-text" v-model="curioForm.text"
            placeholder="看到什么、想到什么、想探索什么？&#10;按 Enter 换行，Ctrl+Enter 保存"
            @keydown.ctrl.enter.prevent="saveCurio"></textarea>
          <div class="gp-field gp-field-sep">
            <label class="gp-field-label"><Icon name="link" :size="13"/> 来源链接{{ curioForm.sourceUrl ? '（已自动捕获，可编辑）' : '（可选，留空即无来源）' }}</label>
            <input type="text" class="gp-field-input" v-model="curioForm.sourceUrl" placeholder="https://…">
          </div>
          <div class="gp-field">
            <label class="gp-field-label"><Icon name="filetext" :size="13"/> 来源标题</label>
            <input type="text" class="gp-field-input" v-model="curioForm.sourceTitle" placeholder="来源页面标题（可选）">
          </div>
        </div>
      </div>
      <div class="gp-cap-foot">
        <button class="gp-btn gp-btn-ghost" @click="closeAll">取消</button>
        <button class="gp-btn gp-btn-primary" @click="saveCurio"><Icon name="save" :size="13"/> 保存到罗盘</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* ★V3.9.20 拆分随迁：以下规则自 GlobalPopups.vue 原样复制（scoped 随模板走）。
   gp-cap、gp-field、gp-btn 三族是「快速添加 + 采集」家族共享件——壳里的采集面板仍持有自己的
   同名 scoped 副本；Stage 3（采集面板拆出）时两份并一。值未改，双份暂存有备案。 */
.gp-overlay { position: fixed; inset: 0; z-index: var(--z-global); display: flex; align-items: flex-start; justify-content: center;
  padding-top: 12vh; opacity: 0; pointer-events: none; transition: opacity .22s ease;
  background: var(--overlay-bg); backdrop-filter: blur(20px) saturate(1.4); -webkit-backdrop-filter: blur(20px) saturate(1.4); }
.gp-overlay.open { opacity: 1; pointer-events: auto; }
.gp-panel { position: relative; width: 680px; max-width: 92vw; background: var(--surface); border-radius: var(--radius);
  border: 1px solid var(--border);
  box-shadow: var(--shadow-lg);
  transform: translateY(-12px) scale(.98); opacity: 0; transition: all var(--dur) var(--ease-emphasis); overflow: hidden; }
.gp-overlay.open .gp-panel { transform: translateY(0) scale(1); opacity: 1; }
.gp-panel-narrow { width: 400px; max-height: 600px; overflow-y: auto; }
.gp-panel-curio { width: 640px; }
.gp-cap-desc { min-height: 64px; }
.gp-saved { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 52px 24px 44px; text-align: center; }
.gp-saved-icon { width: 52px; height: 52px; border-radius: 50%; background: var(--tag-ok-bg); color: var(--tag-ok-text); font-size: 24px; font-weight: 700; display: flex; align-items: center; justify-content: center; margin-bottom: 14px; animation: gp-pop .35s var(--ease-spring); }
@keyframes gp-pop { 0% { transform: scale(.5); opacity: 0; } 100% { transform: scale(1); opacity: 1; } }
.gp-saved-title { font-size: 16px; font-weight: 700; color: var(--text); margin-bottom: 6px; }
.gp-saved-hint { font-size: var(--fs-body); color: var(--accent); font-weight: 600; }
.gp-saved-hint kbd, .gp-saved-sub kbd { background: var(--surface-3); border: 1px solid var(--border); border-radius: 5px; padding: 1px 7px; font-family: inherit; font-size: var(--fs-caption); color: var(--text-2); }
.gp-saved-sub { font-size: var(--fs-sub); color: var(--text-3); margin-top: 4px; }
.gp-saved-actions { display: flex; gap: 10px; margin-top: 20px; }
.gp-cap-head { padding: 22px 24px 0; display: flex; align-items: flex-start; gap: 12px; }
.gp-cap-icon { width: 40px; height: 40px; border-radius: 12px; display: flex; align-items: center; justify-content: center;
  font-size: 19px; flex-shrink: 0; }
.gp-cap-icon.res { background: var(--accent-light); }
.gp-cap-icon.curio { background: var(--curio-bg); }
.gp-cap-titles { flex: 1; min-width: 0; }
.gp-cap-title { font-size: 16px; font-weight: 700; color: var(--text); letter-spacing: -.2px; }
.gp-cap-sub { font-size: var(--fs-sub); color: var(--text-3); margin-top: 2px; }
.gp-cap-close { width: 30px; height: 30px; border-radius: 8px; display: flex; align-items: center; justify-content: center;
  cursor: pointer; color: var(--text-3); font-size: 18px; transition: all var(--dur-fast); flex-shrink: 0; background: transparent;
  border: none; font-family: inherit; }
.gp-cap-close:hover { background: var(--surface-3); color: var(--text); }
.gp-cap-body { padding: 18px 24px 20px; }
.gp-field { margin-bottom: 14px; }
.gp-field:last-child { margin-bottom: 0; }
.gp-field.gp-field-sep { margin-top: 10px; }
.gp-field-label { display: block; font-size: var(--fs-sub); font-weight: 600; color: var(--text-3); margin-bottom: 6px; letter-spacing: .2px; }
.gp-field-input { width: 100%; border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 10px 13px; font-size: var(--fs-body);
  color: var(--text); background: var(--surface); outline: none; font-family: inherit; transition: all var(--dur); line-height: 1.5; }
.gp-field-input::placeholder { color: var(--text-4); }
.gp-field-input:focus { border-color: var(--accent); box-shadow: 0 0 0 3.5px color-mix(in srgb, var(--accent) 14%, transparent); }
textarea.gp-field-input { resize: vertical; min-height: 90px; font-size: 14px; line-height: 1.65; }
.gp-curio-text { min-height: 120px; }
.gp-field-row { display: flex; gap: 10px; }
.gp-field-row .gp-field { flex: 1; }
.gp-status-select { width: 100%; border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 10px 13px; font-size: var(--fs-body);
  color: var(--text); background: var(--surface); outline: none; font-family: inherit; cursor: pointer; transition: all var(--dur);
  appearance: none; background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%239AA0A6' stroke-width='2.5' stroke-linecap='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E");
  background-repeat: no-repeat; background-position: right 13px center; }
.gp-status-select:focus { border-color: var(--accent); box-shadow: 0 0 0 3.5px color-mix(in srgb, var(--accent) 14%, transparent); }
.gp-cap-foot { display: flex; gap: 10px; padding: 14px 24px; border-top: 1px solid var(--border); background: var(--surface-2); align-items: center; }
.gp-btn { padding: 9px 18px; border-radius: var(--radius-sm); font-size: var(--fs-body); font-weight: 600; cursor: pointer; font-family: inherit;
  transition: all var(--dur); border: 1px solid transparent; display: inline-flex; align-items: center; gap: 6px; }
.gp-btn-ghost { background: var(--surface); border-color: var(--border); color: var(--text-2); }
.gp-btn-ghost:hover { border-color: var(--border-strong); color: var(--text); }
.gp-btn-primary { background: var(--accent); color: #fff; border-color: var(--accent); margin-left: auto;
  box-shadow: 0 1px 2px color-mix(in srgb, var(--accent) 20%, transparent), 0 4px 12px color-mix(in srgb, var(--accent) 15%, transparent); }
.gp-btn-primary:hover { background: var(--accent-hover); transform: translateY(-1px);
  box-shadow: 0 2px 4px color-mix(in srgb, var(--accent) 25%, transparent), 0 8px 20px color-mix(in srgb, var(--accent) 20%, transparent); }
.gp-btn-primary:active { transform: translateY(0); }
</style>
