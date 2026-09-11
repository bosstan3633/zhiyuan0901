<script setup lang="ts">
/**
 * 第卅九轮 V2.15.0（技术债，第卅七轮 REQ-042 拍板）：资源卡编辑表单（共享单份）
 * - 合一对象：Workspace 内联抽屉（原 dr-* 字段区/标题/footer）与 ResourceDetailDrawer（原 red-* 全套）
 * - 范围：标题 / 链接(类型·输入·file 告警) / 策展台 / 分类(随台联动) / TagPicker / 描述(拖拽记忆) /
 *         附件(REQ-048) / extra 插槽(宿主差异内容，如使用统计) / 被任务挂载 / 创建更新时刻 / footer 动作条
 * - 行为约定（与两宿主原实现完全一致）：
 *   ① 标题/链接/描述 Ctrl+Enter 保存（emit save）
 *   ② 切换策展台 → 清空分类（REQ-005）
 *   ③ 附件变更即时持久化：已入库卡(idx>=0)写回 + persist；新建未入库仅暂挂 model（宿主保存时统一入库）
 *   ④ 挂载任务点击 → 跳任务中心（emit goto-task）
 *   ⑤ footer：删除/复制链接/打开链接/保存 → 宿主各自 handler（新建/编辑差异、deleting 锁差异在宿主）
 * - 宿主保留：容器与开关态（Drawer.vue 或自绘 overlay/drawer）、save/delete/open/copy handler、highlight 触发
 */
import { computed, nextTick, ref } from 'vue'
import TagPicker from '@/shared/components/TagPicker.vue'
import AssetManager from '@/shared/components/AssetManager.vue'
import AssetBadge from '@/shared/components/AssetBadge.vue'
import { showToast } from '@/shared/components/toast'
import { useAppStore } from '../stores/app'
import { useTaHeight } from '@/shared/utils/taHeight'
// R87（R7）：链接三态判据收敛到 shared/utils/link（此前 isFullPath 是本组件私有函数，卡片视图用不到）
import { linkStateOf } from '@/shared/utils/link'
import { CURATION_WS_ID } from '@/shared/models'
import type { ResourceCard, TaskCard, Category, AssetMeta } from '@/shared/models'

const props = defineProps<{
  /** 编辑中的资源卡（宿主 reactive 对象，字段直接 v-model 生效） */
  model: ResourceCard
  /** 描述框高度记忆键（如 'ws-note' / 'res-drawer-note'，保留两处既有拖拽记忆） */
  heightKey: string
  /** 标题右侧是否显示关闭按钮（自绘容器用；Drawer.vue 宿主传 false 由容器 × 关闭） */
  showClose?: boolean
  /** 标题高亮（RDD 搜索定位使用） */
  highlight?: boolean
}>()
const emit = defineEmits<{
  /** Ctrl+Enter 快捷保存（宿主执行保存+关闭） */
  (e: 'save'): void
  /** 挂载任务点击 → 宿主跳任务中心 */
  (e: 'goto-task', t: TaskCard): void
  /** 自绘容器（无 header ×）点关闭 */
  (e: 'close'): void
}>()

const store = useAppStore()
const d = computed(() => store.data!)
const { taH: noteH, startTaResize: startNoteResize } = useTaHeight(props.heightKey, store.ui)

/**
 * 策展台选项（store.workspaces 已过滤 archived + 排序）
 *
 * R90（R17）：`store.workspaces` **显式排除资源台**（`stores/app.ts:18` `w.id !== CURATION_WS_ID`）。
 * 于是在资源台打开一张真身卡时，`v-model` 的值在选项列表里**不存在** ⇒ 下拉显示空白；
 * 用户随手改选并保存，卡片 `workspaceId` 被改写 ⇒ **真身静默迁去策展台**，
 * 而 `curationProjections` 里指向它的镜像仍留在原地。
 * 故在 `model.workspaceId === CURATION_WS_ID` 时于**首位注入**「资源台（真身）」并自然选中。
 *
 * ⚠ 不改 `store.workspaces` 本体——那是**全局口径**，别处出现的"策展台列表"
 * （GlobalSettings 的搬家目标台、overlay 的台计数）都不该混入资源台。此处只是表单层的局部补救。
 */
const wsOptions = computed(() => {
  const list = store.workspaces
  if (props.model.workspaceId !== CURATION_WS_ID) return list
  return [{ id: CURATION_WS_ID, name: '🗂 资源台（真身）' } as (typeof list)[number], ...list]
})
/** 分类随所选策展台联动（REQ-005） */
const catOptions = computed(() => treeCatOptions((d.value.categories || []).filter(c => c.workspaceId === props.model.workspaceId)))
/** 被任务挂载（只读，点击跳任务中心） */
const mountedTasks = computed(() => d.value.tasks.filter(t => !t.deletedAt && (t.mountedResourceIds || []).includes(props.model.id)))
const linkPlaceholder = computed(() => {
  if (props.model.linkType === 'url') return 'https://...'
  if (props.model.linkType === 'file') return 'D:\\path\\to\\file.pdf'
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

// R87（R7）：本地 isFullPath 退役 —— 判据迁至 shared/utils/link 的 linkStateOf。
// 行为差异（**修正既有缺陷**）：zy-asset:// 附件卡（R80 起本地文件导入的标准形态）linkType 是 file 但
// 走预览通道打开，此前会被误报「仅存文件名，请补全完整路径」；现 linkStateOf 判为 ok，告警不再出现。
const linkIncomplete = computed(() => linkStateOf(props.model.linkType, props.model.link) === 'incomplete')

/** R87（R7-②）：一键补全入口——宿主点卡片上的 ⚠ 徽标后调到此处，直接把光标送进链接输入框 */
const linkInputRef = ref<HTMLInputElement | null>(null)
function focusLink() {
  nextTick(() => { linkInputRef.value?.focus(); linkInputRef.value?.select() })
}
defineExpose({ focusLink })

/** 切换策展台后清空分类（REQ-005） */
function onWsChange() {
  props.model.categoryId = ''
}

/** REQ-048：附件变更即时持久化（本体已写 IndexedDB；此处同步 meta 引用。新建未入库仅暂挂 model） */
function onAssetsChange(v: AssetMeta[] | null | undefined) {
  props.model.assets = v || []
  if (!store.data || !props.model.id) return
  const idx = store.data.resources.findIndex(r => r.id === props.model.id)
  if (idx >= 0) { store.data.resources[idx] = { ...props.model }; store.persist() }
}

/**
 * 第卌二轮 REQ-061：HTML 上传联动（拍板 q-2：仅空标题/等于旧文件名时覆盖，保护手打标题）
 * 第卌四轮 T-08：泛化支持 PDF（AssetManager 对 HTML/PDF 均发 html-added 事件）
 * - 标题：空 或 等于旧文档文件名（去扩展名）→ 自动取新文件名（去扩展名）；否则保留并 Toast 提示
 * - 链接属性：linkType → 'file'（本地文件）；link → 'zy-asset://<id>'（内部附件引用，不暴露本机路径）
 */
const DOC_NAME_RE = /\.(html?|pdf)$/i
function onHtmlAdded(meta: AssetMeta, replacedOld: AssetMeta | null) {
  const stem = (meta.name || '').replace(DOC_NAME_RE, '')
  const oldStems = [replacedOld, ...(props.model.assets || []).filter(a => a.kind === meta.kind && a.id !== meta.id)]
    .filter((a): a is AssetMeta => !!a)
    .map(a => (a.name || '').replace(DOC_NAME_RE, ''))
  const cur = (props.model.title || '').trim()
  if (!cur || oldStems.includes(cur)) {
    if (stem) props.model.title = stem
  } else {
    showToast(`已替换原 ${meta.kind === 'pdf' ? 'PDF' : 'HTML'}；标题保留手打内容，可自行编辑`)
  }
  props.model.linkType = 'file'
  props.model.link = `zy-asset://${meta.id}`
  showToast(meta.kind === 'pdf'
    ? '✓ 已挂载 PDF：双击卡片即可在新标签页打开（Chrome 内置 viewer）'
    : '✓ 已挂载 HTML：双击卡片即可在新标签页完整打开')
  onAssetsChange(props.model.assets)
}

function goOpenTask(t: TaskCard) { emit('goto-task', t) }

function fmtTs(ts?: number): string {
  return ts ? new Date(ts).toLocaleString('zh-CN', { hour12: false }) : '—'
}
</script>

<template>
  <!-- R48 详情重设计：链接区为 Hero（类型紧凑切换），策展台/分类双列，注解上移，附件/挂载折叠 -->
  <div class="ref-form">
    <div class="ref-title-row" :class="{ highlight }">
      <textarea class="ref-title" v-model="model.title" rows="2" placeholder="资源卡标题..."
        @keydown.ctrl.enter.prevent="emit('save')" @keydown.meta.enter.prevent="emit('save')"></textarea>
      <AssetBadge v-if="model.assets?.length" :assets="model.assets" class="ref-title-assets" />
      <div v-if="showClose" class="ref-close" @click="emit('close')">×</div>
    </div>

    <!-- Hero：链接（资源卡的存在意义就是快速回到它） -->
    <div class="ref-section">
      <div class="ds-hero-label">链接 <span class="hint">— 双击卡片即可打开 · Ctrl+↩ 保存</span></div>
      <div class="ref-link-type">
        <div class="ref-link-type-btn" :class="{ active: model.linkType === 'url' }" @click="model.linkType = 'url'">URL</div>
        <div class="ref-link-type-btn" :class="{ active: model.linkType === 'file' }" @click="model.linkType = 'file'">📁 本地</div>
        <div class="ref-link-type-btn" :class="{ active: model.linkType === 'obsidian' }" @click="model.linkType = 'obsidian'">📝 Obsidian</div>
      </div>
      <input ref="linkInputRef" type="text" class="ref-link-input" v-model="model.link" :placeholder="linkPlaceholder"
        @keydown.ctrl.enter.prevent="emit('save')" @keydown.meta.enter.prevent="emit('save')">
      <div v-if="linkIncomplete" class="ref-warn">
        ⚠ 当前仅存文件名，双击打开前请补全完整路径（如 D:\docs\file.pdf）
      </div>
    </div>

    <!-- 属性双列：策展台 / 分类（切换保存后即跨台迁移；级联不变） -->
    <div class="ds-props2">
      <div class="ds-prop-field">
        <label class="ds-prop-label">🗂 策展台</label>
        <select class="ds-prop-select" v-model="model.workspaceId" @change="onWsChange">
          <option v-for="w in wsOptions" :key="w.id" :value="w.id">{{ w.name }}</option>
        </select>
      </div>
      <div class="ds-prop-field">
        <label class="ds-prop-label">📁 分类</label>
        <select class="ds-prop-select" v-model="model.categoryId">
          <option value="">📥 待分类</option>
          <option v-for="opt in catOptions" :key="opt.id" :value="opt.id">📂 {{ opt.label }}</option>
        </select>
      </div>
    </div>

    <div class="ref-section" style="margin-top:12px">
      <TagPicker v-model="model.tags" />
    </div>

    <!-- 注解上移：紧跟属性，定位「为什么收藏它」 -->
    <div class="ref-section" style="margin-top:12px">
      <div class="ds-hero-label">我的注解 <span class="hint">— 为什么收藏它 · 拖右下角调高</span></div>
      <div class="ref-ta-wrap">
        <textarea class="ds-desc" v-model="model.description" :style="{ height: noteH + 'px' }" placeholder="对这个资源的注解、思考、摘录..."
          @keydown.ctrl.enter.prevent="emit('save')" @keydown.meta.enter.prevent="emit('save')"></textarea>
        <div class="ref-ta-resize" @mousedown="startNoteResize" title="拖拽调节高度（记忆保存）"></div>
      </div>
    </div>

    <!-- 附件折叠 -->
    <details class="ds-details" style="margin-top:12px">
      <summary>📎 附件 <span v-if="model.assets?.length" class="cnt">({{ model.assets.length }})</span><span class="right">图片弹窗预览 / HTML 新标签打开</span></summary>
      <AssetManager v-model="model.assets" @update:model-value="onAssetsChange" @html-added="onHtmlAdded" />
    </details>

    <!-- 宿主差异内容（如 RDD 使用统计）：插在附件与挂载之间，保持原字段顺序 -->
    <slot name="extra" />

    <details class="ds-details" style="margin-top:12px">
      <summary>📋 被任务挂载 <span v-if="mountedTasks.length" class="cnt">({{ mountedTasks.length }})</span></summary>
      <div v-if="mountedTasks.length" class="ref-mounted-list">
        <div v-for="t in mountedTasks" :key="t.id" class="ref-mounted-item" @click="goOpenTask(t)">
          <span class="ref-mi-icon">📋</span> {{ t.title }}
        </div>
      </div>
      <div v-else class="ref-empty">暂无任务挂载此资源</div>
    </details>

    <div v-if="model.createdAt" class="ds-meta" style="margin-top:6px">
      <span>创建 {{ fmtTs(model.createdAt) }}</span>
      <span>更新 {{ fmtTs(model.updatedAt) }}</span>
    </div>
  </div>
</template>

<style scoped>
.ref-form { display: flex; flex-direction: column; gap: 16px; }
.ref-section { margin: 0; }

.ref-title-row { display: flex; align-items: flex-start; gap: 8px; }
.ref-title {
  flex: 1; width: 100%; box-sizing: border-box; resize: none; border: 1px solid var(--border);
  border-radius: 8px; background: var(--surface-2); color: var(--text);
  padding: 10px 12px; font-size: 15px; font-weight: 600; line-height: 1.5; font-family: inherit;
}
.ref-title:focus { outline: none; border-color: var(--accent); }
.ref-title-row.highlight .ref-title { box-shadow: 0 0 0 2px var(--accent); }
.ref-close { width: 26px; height: 26px; display: flex; align-items: center; justify-content: center; border-radius: 6px; cursor: pointer; color: var(--text-3); font-size: 18px; transition: all .15s; flex-shrink: 0; }
.ref-title-assets { margin-top: 10px; flex-shrink: 0; }
.ref-close:hover { background: var(--surface-3); color: var(--text); }

.ref-label { font-size: 11px; color: var(--text-3); margin-bottom: 8px; text-transform: uppercase; letter-spacing: .04em; }
.ref-label-row { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.ref-link-type { display: flex; gap: 6px; margin-bottom: 8px; }
.ref-link-type-btn {
  flex: 1; padding: 7px 0; text-align: center; font-size: 12.5px; cursor: pointer;
  border: 1px solid var(--border); border-radius: 6px; background: var(--surface-2); color: var(--text-2);
  transition: all .15s;
}
.ref-link-type-btn.active { background: var(--accent); color: #fff; border-color: var(--accent); }
.ref-link-input {
  width: 100%; box-sizing: border-box; padding: 8px 12px; border: 1px solid var(--border);
  border-radius: 6px; background: var(--surface-2); color: var(--text); font-size: 13px; font-family: inherit;
}
.ref-link-input:focus { outline: none; border-color: var(--accent); }
.ref-warn { margin-top: 8px; font-size: 12px; color: var(--danger); background: rgba(229,72,77,.08); padding: 6px 10px; border-radius: 6px; }

.ref-select {
  width: 100%; box-sizing: border-box; padding: 8px 12px; border: 1px solid var(--border);
  border-radius: 6px; background: var(--surface-2); color: var(--text); font-size: 13px; font-family: inherit;
}
.ref-select:focus { outline: none; border-color: var(--accent); }

.ref-ta-wrap { position: relative; }
.ref-note {
  width: 100%; box-sizing: border-box; resize: none; border: 1px solid var(--border);
  border-radius: 8px; background: var(--surface-2); color: var(--text);
  padding: 10px 12px; font-size: 13px; line-height: 1.7; font-family: inherit;
}
.ref-note:focus { outline: none; border-color: var(--accent); }
.ref-ta-resize {
  position: absolute; right: 4px; bottom: 2px; width: 14px; height: 14px; cursor: ns-resize;
  opacity: .5; background: linear-gradient(135deg, transparent 50%, var(--text-3) 50%);
}

.ref-mounted-list { display: flex; flex-direction: column; gap: 4px; }
.ref-mounted-item { padding: 6px 10px; background: var(--surface-2); border-radius: 6px; font-size: 12px; color: var(--text); cursor: pointer; }
.ref-mounted-item:hover { background: var(--surface-3); }
.ref-mi-icon { margin-right: 4px; }
.ref-empty { font-size: 12px; color: var(--text-3); padding: 4px 0; }
.ref-time { font-size: 11px; color: var(--text-3); }
</style>
