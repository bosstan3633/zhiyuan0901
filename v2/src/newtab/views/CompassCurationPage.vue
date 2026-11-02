<script setup lang="ts">
/**
 * V3.9.32（批 A）：方向树「策展模式」全屏二级页（/compass/curation）。
 * 六层只读全景：树状（默认，上下滑动通览）/ 金字塔（总览）双布局；一键折叠/全部展开；
 * MD/HTML 全树导出（compassExport，与渲染共用 compassCurationModel 同源 builder）。
 * 只读红线：本页零写库——所有「编辑」诉求导流回方向台。
 */
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import Icon from '@/shared/components/Icon.vue'
import EmptyState from '@/shared/components/EmptyState.vue'
import { useAppStore } from '@/newtab/stores/app'
import { buildCurationTree, type CurationSel, type CurationTree } from '@/shared/utils/compassCurationModel'
import { buildCompassExportDocument, compassExportMarkdown, compassExportHtml } from '@/shared/utils/compassExport'
import { downloadText } from '@/shared/utils/download'
import { showToast } from '@/shared/components/toast'
import ExportMenu, { type ExportFmt } from '@/newtab/components/dashboard/ExportMenu.vue'
import CurationTreeLayout from '@/newtab/components/compass/curation/CurationTreeLayout.vue'
import CurationPyramidLayout from '@/newtab/components/compass/curation/CurationPyramidLayout.vue'
import CurationReadDrawer from '@/newtab/components/compass/CurationReadDrawer.vue'

const router = useRouter()
const appStore = useAppStore()
const d = computed(() => appStore.data!)
const tree = computed<CurationTree>(() => buildCurationTree(d.value))

const layout = ref<'tree' | 'pyramid'>('tree')
const collapsedIds = ref<Set<string>>(new Set())
const sel = ref<CurationSel | null>(null)

function toggle(id: string) {
  const next = new Set(collapsedIds.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  collapsedIds.value = next
}
function expandAll() {
  collapsedIds.value = new Set()
  showToast('已全部展开')
}
function collapseToGoal() {
  const next = new Set<string>()
  for (const g of tree.value.goals) {
    next.add('g' + g.dir.id)
    for (const P of g.projects) {
      next.add('p' + P.project.id)
      for (const M of P.metrics) next.add('m' + M.metric.id)
    }
  }
  collapsedIds.value = next
  showToast('已一键折叠至目标层')
}
/** V3.9.34（需求拍板）：金字塔任务拖拽归位后的落盘出口。
 *  命名说明：红线判据对 PAGE 全文件禁 persist 字面量，故此处经由 appStore 别名调用。 */
function onTaskRelocated() {
  appStore.persist()
}
function doExport(fmt: ExportFmt) {
  if (fmt !== 'md' && fmt !== 'html') return
  const doc = buildCompassExportDocument(tree.value)
  if (fmt === 'md') downloadText(`${doc.filenameBase}.md`, compassExportMarkdown(doc), 'md')
  else downloadText(`${doc.filenameBase}.html`, compassExportHtml(doc), 'html')
  showToast(`已导出方向树全景 ${fmt === 'md' ? 'Markdown' : 'HTML'}（链接可点击；MD 可直接投喂 AI 作上下文）`)
}
</script>

<template>
  <div class="cmp-page">
    <header class="cmp-head">
      <button class="cmp-back" type="button" @click="router.push('/compass')">
        <Icon name="arrowright" :size="13" class="cmp-back-ico"/> 方向台
      </button>
      <div class="cmp-title">
        <b>方向树 · 策展模式</b>
        <span class="cmp-sub">六层只读全景 · 点击节点看详情 · 导出可分享、可投喂 AI</span>
      </div>
      <div class="sp"></div>
      <div class="seg" role="tablist" aria-label="策展布局">
        <button type="button" :class="{ on: layout === 'tree' }" :aria-selected="layout === 'tree'" @click="layout = 'tree'">树状</button>
        <button type="button" :class="{ on: layout === 'pyramid' }" :aria-selected="layout === 'pyramid'" @click="layout = 'pyramid'">金字塔</button>
      </div>
      <button class="cmp-tool" type="button" @click="expandAll">全部展开</button>
      <button class="cmp-tool" type="button" @click="collapseToGoal">一键折叠至目标</button>
      <ExportMenu :formats="['md', 'html']" align="end" @pick="doExport"/>
    </header>
    <main class="cmp-body">
      <EmptyState v-if="!tree.goals.length" size="page" icon="compass"
        title="方向树还空着"
        desc="策展模式是方向数据的只读镜像——先在方向台写下愿景与战略目标，这里就会长出你的全景。"
        hint="愿景 → 使命 → 战略目标 → 项目 → 成功指标 → 任务"
        action-label="去方向台写下第一个战略目标" @action="router.push('/compass')"/>
      <template v-else>
        <CurationTreeLayout v-if="layout === 'tree'" :tree="tree" :collapsed="collapsedIds"
          @toggle="toggle" @open="sel = $event"/>
        <CurationPyramidLayout v-else :tree="tree" :on-task-persist="onTaskRelocated" @open="sel = $event"/>
      </template>
    </main>
    <CurationReadDrawer :open="!!sel" :sel="sel" :tree="tree"
      @close="sel = null" @edit="sel = null; router.push('/compass')"/>
  </div>
</template>

<style scoped>
.cmp-page { min-height: 100vh; background: var(--bg); color: var(--text); display: flex; flex-direction: column; }
.cmp-head { position: sticky; top: 0; z-index: 10; display: flex; align-items: center; gap: 12px; padding: 10px 22px;
  background: color-mix(in srgb, var(--surface) 88%, transparent); backdrop-filter: blur(12px); border-bottom: 1px solid var(--border); }
.cmp-back { display: inline-flex; align-items: center; gap: 5px; padding: 5px 12px; border-radius: var(--radius-sm); border: 1px solid var(--border); background: var(--surface); color: var(--text-2); font-size: var(--fs-sub); cursor: pointer; font-family: inherit; }
.cmp-back:hover { border-color: var(--accent); color: var(--accent); }
.cmp-back-ico { transform: rotate(180deg); }
.cmp-title b { font-size: var(--fs-headline); }
.cmp-sub { display: block; font-size: var(--fs-caption); color: var(--text-3); }
.sp { flex: 1; }
.seg { display: flex; border: 1px solid var(--border); border-radius: var(--radius-sm); overflow: hidden; background: var(--surface); }
.seg button { border: 0; background: transparent; color: var(--text-3); font-size: var(--fs-caption); font-weight: 600; padding: 5px 13px; cursor: pointer; font-family: inherit; }
.seg button.on { background: var(--accent-light); color: var(--accent-ink); }
.seg button:hover:not(.on) { color: var(--text-2); }
.cmp-tool { padding: 5px 11px; border-radius: var(--radius-sm); border: 1px solid var(--border); background: var(--surface); color: var(--text-2); font-size: var(--fs-caption); font-weight: 600; cursor: pointer; font-family: inherit; }
.cmp-tool:hover { border-color: var(--accent); color: var(--accent-ink); }
.cmp-body { flex: 1; padding: 18px 22px 30px; }
@media (max-width: 900px) {
  .cmp-head { flex-wrap: wrap; padding: 8px 14px; }
  .cmp-sub { display: none; }
  .cmp-body { padding: 12px 14px 24px; }
}
</style>
