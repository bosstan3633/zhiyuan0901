<script setup lang="ts">
/**
 * 第卅九轮 V2.15.0（技术债，第卅七轮 REQ-042 拍板）：资源卡编辑表单（共享单份）
 * - 合一对象：Workspace 内联抽屉（原 dr-* 字段区/标题/footer）与 ResourceDetailDrawer（原 red-* 全套）
 * - 范围：标题 / 链接(类型·输入·file 告警) / 分类 / TagPicker / 描述(拖拽记忆) /
 *         附件(REQ-048) / extra 插槽(宿主差异内容，如使用统计) / 创建更新时刻
 *         （R162：被任务挂载区块随任务↔资源挂载关系退役）
 * - R165-A（方案 A 标准）：**删「策展台」下拉**——资源台里恒为真身、零信息，且唯一动作与 ADR-08 矛盾
 *         （曾致真身静默迁移 BUG，见下方历史注释）；分类升整行。AI 主上下文动作与链接动作改由宿主经
 *         **title-extra / link-actions 插槽**注入（页脚只留 删除+保存 两钮）。
 * - 行为约定：
 *   ① 标题/链接/描述 Ctrl+Enter 保存（emit save）
 *   ③ 附件变更即时持久化：已入库卡(idx>=0)写回 + persist；新建未入库仅暂挂 model（宿主保存时统一入库）
 * - 宿主保留：容器与开关态（Drawer.vue 或自绘 overlay/drawer）、主标题（DetailTitle）、AI 入口条、save/delete/open/copy handler
 */
import { computed, nextTick, ref } from 'vue'
import TagPicker from '@/shared/components/TagPicker.vue'
import AssetManager from '@/shared/components/AssetManager.vue'
// R169-老账①：分类改自绘选择器（点开才展开）——原生 select 的 <option> 无法懒渲染，
// 真库 88+ 分类每次开抽屉都是一整列常驻节点（R168 交付说明 §七遗留）
import CatPicker from '@/shared/components/CatPicker.vue'
import { showToast } from '@/shared/components/toast'
import { useAppStore } from '../stores/app'
import { useTaHeight } from '@/shared/utils/taHeight'
// R87（R7）：链接三态判据收敛到 shared/utils/link（此前 isFullPath 是本组件私有函数，卡片视图用不到）
import { linkStateOf, LINK_SLOT_TABS, linkPlaceholderFor, slotFillOf, switchLinkSlot, setLinkSlot } from '@/shared/utils/link'
import type { ResourceCard, Category, AssetMeta } from '@/shared/models'

const props = defineProps<{
  /** 编辑中的资源卡（宿主 reactive 对象，字段直接 v-model 生效） */
  model: ResourceCard
  /** 描述框高度记忆键（如 'ws-note' / 'res-drawer-note'，保留两处既有拖拽记忆） */
  heightKey: string
}>()
const emit = defineEmits<{
  /** Ctrl+Enter 快捷保存（宿主执行保存+关闭） */
  (e: 'save'): void
}>()

const store = useAppStore()
const d = computed(() => store.data!)
const { taH: noteH, startTaResize: startNoteResize } = useTaHeight(props.heightKey, store.ui)

/**
 * R165-A：「策展台」下拉退役。
 * 历史（R90/R17 注释存档）：此下拉在资源台里恒为「资源台（真身）」——零信息控件，
 * 且唯一动作是把卡片 `workspaceId` 改写、真身静默迁去策展台（镜像原地不动），与 ADR-08 矛盾。
 * 字段本身仍随卡持久化（归属不变），只是不再有 UI 改它；分类候选按卡当前所在台过滤。
 */
const catOptions = computed(() => treeCatOptions((d.value.categories || []).filter(c => c.workspaceId === props.model.workspaceId)))
// R169-T2：三槽的文案与占位符取自 LINK_SLOT_TABS（唯一真源），不再在本组件里按 linkType 分支写死
const linkPlaceholder = computed(() => linkPlaceholderFor(props.model.linkType))
/** 三槽填写状态（●=有值 / ○=空），点 tab 时一眼看出另外两条挂没挂 */
const slotFill = computed(() => slotFillOf(props.model))
/** 当前槽空着：这不是"断链"，别拿断链文案吓人（旧缺陷正是切到空槽立刻报"仅存文件名"） */
const slotEmpty = computed(() => !(props.model.link || '').trim())

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
  // R169-T2：挂载附件是"换槽写值"，不是"连写两个字段"——原先直写 linkType + link，
  // 卡上原本那条 URL 会被就地冲掉（切回 URL 槽发现空了）。
  setLinkSlot(props.model, 'file', `zy-asset://${meta.id}`)
  showToast(meta.kind === 'pdf'
    ? '✓ 已挂载 PDF：双击卡片即可在新标签页打开（Chrome 内置 viewer）'
    : '✓ 已挂载 HTML：双击卡片即可在新标签页完整打开')
  onAssetsChange(props.model.assets)
}

function fmtTs(ts?: number): string {
  return ts ? new Date(ts).toLocaleString('zh-CN', { hour12: false }) : '—'
}
</script>

<template>
  <!-- R167：三块分组面板（链接与归档 / 我的注解=焦点 / 关联与凭证）。
       ★主标题不在这里：它属于抽屉头（DetailTitle），两宿主各有一份头 ⇒ 表单只管内容分区，
         标题若在表单里再留一份，就会出现"头部一份可编辑 + 正文一份可编辑"同屏两处。 -->
  <div class="ref-form">
    <section class="ds-pnl">
      <div class="ds-pnl-h"><b>链接与归档</b><i>双击卡片即打开 · Ctrl+↩ 保存</i></div>
      <div class="ds-kv"><span class="k">链接</span><span class="v">
        <div class="ds-seg">
          <span v-for="tb in LINK_SLOT_TABS" :key="tb.t" :class="{ on: model.linkType === tb.t }"
            :title="tb.label + ' 槽：' + (slotFill[tb.t] || '空')" @click="switchLinkSlot(model, tb.t)">
            {{ tb.label }}<i class="ds-seg-dot">{{ slotFill[tb.t] ? '●' : '○' }}</i>
          </span>
        </div>
        <input ref="linkInputRef" type="text" class="ds-in" v-model="model.link" :placeholder="linkPlaceholder"
          @keydown.ctrl.enter.prevent="emit('save')" @keydown.meta.enter.prevent="emit('save')">
        <slot name="link-actions" />
      </span></div>
      <div v-if="slotEmpty" class="ds-slot-empty">
        这一槽是空的 —— 三条链接各自独立（URL / 本地 / Obsidian），切过去没有就说明还没填，双击不会去打另一条。
      </div>
      <div v-if="linkIncomplete" class="ref-warn">
        ⚠ 当前仅存文件名，双击打开前请补全完整路径（如 D:\docs\file.pdf）
      </div>
      <div class="ds-kv"><span class="k">分类</span><span class="v">
        <!-- R169-老账①：原生 select（88+ option 常驻）→ CatPicker 自绘（点开才挂，可搜索/Esc/↑↓/Enter） -->
        <CatPicker v-model="model.categoryId" :options="catOptions" :title="'真身只在资源台，策展台以镜像呈现'" />
      </span></div>
      <div class="ds-kv"><span class="k">标签</span><span class="v"><TagPicker v-model="model.tags" /></span></div>
    </section>

    <section class="ds-pnl hero">
      <div class="ds-pnl-h"><b>我的注解</b><i>为什么收藏它 · 点进去即编辑</i><span class="r">{{ (model.description || '').length }} 字</span></div>
      <div class="ref-ta-wrap">
        <textarea class="ds-hero-note" v-model="model.description" :style="{ height: noteH + 'px' }" placeholder="对这个资源的注解、思考、摘录..."
          @keydown.ctrl.enter.prevent="emit('save')" @keydown.meta.enter.prevent="emit('save')"></textarea>
        <div class="ref-ta-resize" @mousedown="startNoteResize" title="拖拽调节高度（记忆保存）"></div>
      </div>
    </section>

    <section class="ds-pnl">
      <div class="ds-pnl-h"><b>关联与凭证</b><i>附件、使用记录与时间</i></div>
      <!-- 宿主差异内容（RDD：使用统计 + 支持的任务只读反查） -->
      <slot name="extra" />
      <details class="ds-details">
        <summary>附件 <span v-if="model.assets?.length" class="cnt">({{ model.assets.length }})</span>
          <span class="right">图片弹窗预览 / HTML 新标签打开</span>
        </summary>
        <AssetManager v-model="model.assets" :owner-id="model.id" @update:model-value="onAssetsChange" @html-added="onHtmlAdded" />
        <!-- R167：附件上限从「? tooltip」搬进展开区（说明该在看得见的地方，不该藏在一次悬停里） -->
        <div class="ref-limits">图片 ≤9 张（单张 ≤10MB）· HTML 单卡 1 个（≤20MB，重复上传=替换）· PDF 单卡 1 份（≤100MB）· 双击文件名在浏览器中打开</div>
      </details>
      <div v-if="model.createdAt" class="ds-meta" style="padding:8px 0 4px">
        <span>创建 {{ fmtTs(model.createdAt) }}</span>
        <span>更新 {{ fmtTs(model.updatedAt) }}</span>
      </div>
    </section>
  </div>
</template>

<style scoped>
/* R167：面板自带 margin-bottom，容器不再叠 gap（两处都给 ⇒ 面板间 32px，读起来是三段不是一块） */
.ref-form { display: flex; flex-direction: column; }

/* R167：标题行退役（`.ref-title*` / `.ref-close` / `.ref-title-assets`）——主标题进抽屉头（DetailTitle），
   附件凭证进「关联与凭证」面板的展开区计数，关闭钮归容器 ×。留着只会让人以为表单还管标题。 */

/* R167：链接行/分类/标签的控件语言统一搬到 detail-sheet.css 的 ds-* 分组面板体系；
   这里只留本表单独有的告警条与附件上限说明。 */
.ref-warn { margin: 6px 0; font-size: var(--fs-sub); color: var(--danger); background: var(--danger-bg-soft); padding: 6px 10px; border-radius: 6px; }
/* R169-T2：空槽是"还没填"，不是"坏了"——与 .ref-warn 分两档，别用告警色吓人 */
.ds-slot-empty { margin: 6px 0; font-size: var(--fs-caption); color: var(--text-3); background: var(--surface-2); border: 1px dashed var(--border); padding: 6px 10px; border-radius: 6px; line-height: 1.6; }
.ref-limits { padding: 6px 0 8px; font-size: var(--fs-caption); color: var(--text-4); line-height: 1.6; }
.ref-ta-wrap { position: relative; display: flex; flex: 1; min-height: 0; }
.ref-ta-resize {
  position: absolute; right: 4px; bottom: 2px; width: 14px; height: 14px; cursor: ns-resize;
  opacity: .5; background: linear-gradient(135deg, transparent 50%, var(--text-3) 50%);
}
</style>
