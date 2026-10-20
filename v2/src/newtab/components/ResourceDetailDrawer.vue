<script setup lang="ts">
/**
 * 第卅七轮 REQ-042：资源卡可编辑详情抽屉（搜索单击触发）
 * - 由 zy-open-drawer 总线（kind='res'）触发打开
 * - 容器改用共享 Drawer.vue（圆角/动效/遮罩与 ProjectDetailDrawer 同款）
 * - 第卅九轮 V2.15.0：编辑表单主体抽至共享 ResourceEditForm.vue（与 Workspace 内联抽屉合一）
 *   宿主保留：Drawer 容器 / 开关态 / 统计区(extra 插槽) / footer 动作
 *
 * R167（OPPO 质感 · 模块化重排）三处结构变更：
 *  ① **主标题搬进抽屉头**（Drawer 的 title 插槽）——原状是头部一份只读、正文一份 textarea，
 *     同屏两处标题且头部那份长标题被截断；现在全抽屉只有一处标题，且就地可编辑。
 *  ② **AI 入口从标题行降到正文首行的「一行两格」**：与 R166 任务卡三入口同语言，
 *     标题行不再被两枚按钮 + chip 挤爆；两枚=「AI 补全」（原补全与全方位优化并成一枚，http(s) 才抓正文）
 *     与「关联任务」（新，资源侧反向写 SupportLink）。
 *  ③ 抽屉宽 460 → 520：上半部收紧后腾出的高度给「我的注解」这块焦点区。
 */
import Icon from '@/shared/components/Icon.vue'
import { computed, reactive, ref, onMounted, onUnmounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import Drawer from '@/shared/components/Drawer.vue'
import ResourceEditForm from './ResourceEditForm.vue'
import ArmDeleteButton from '@/shared/components/ArmDeleteButton.vue'
import { showToast } from '@/shared/components/toast'
import { useAppStore } from '../stores/app'
import { onOpenDrawer, consumePendingDrawer, type DrawerPayload } from '@/shared/utils/bus'
import { recordResourceOpen } from '@/shared/storage/stats'
import { toOpenableUrl, openExternalLink } from '@/shared/utils/link'
import { projectCardToBoard } from '@/shared/storage/hub'
import { togglePinOf } from '@/newtab/composables/useResourcePin'
import { CURATION_WS_ID } from '@/shared/models'
import type { ResourceCard, TaskCard } from '@/shared/models'
import ThesisBlock from '@/newtab/components/ThesisBlock.vue'
import SupportTasksPanel from '@/shared/components/SupportTasksPanel.vue'
// R167：主标题与 AI 入口条都换成共享件（两宿主同源）；AI 依赖零静态引用这条由
// ResourceAiStrip 内部守住（懒评审抽屉 + 点击时 dynamic import），本宿主不再自己拉 AI 栈。
import DetailTitle from './DetailTitle.vue'
import ResourceAiStrip from './ResourceAiStrip.vue'
import ResourceMirrorModal from './ResourceMirrorModal.vue'

const router = useRouter()
const store = useAppStore()

const open = ref(false)
const resId = ref<string | null>(null)
const highlight = ref(false)
let deleting = false

const editing = reactive<ResourceCard>(emptyResource())

function emptyResource(): ResourceCard {
  return { id: '', kind: 'resource', title: '', linkType: 'url', link: '', workspaceId: '', categoryId: '', description: '', tags: [], customFields: {}, pinned: false, callCount: 0, createdAt: 0, updatedAt: 0, assets: [] }
}

/** R162（同 useResourceDrawer）：单例 reactive 复用先清键——否则上一张卡的 assets 会残留给下一张卡 */
function resetEditing(src: ResourceCard): void {
  for (const k of Object.keys(editing)) delete (editing as unknown as Record<string, unknown>)[k]
  Object.assign(editing, JSON.parse(JSON.stringify(src)))
}

const resource = computed(() => {
  if (!resId.value || !store.data) return null
  return store.data.resources.find(r => r.id === resId.value) || null
})

function openFromId(id: string) {
  const data = store.data
  const r = data?.resources.find(x => x.id === id)
  if (!r || !data) return
  resId.value = id
  resetEditing(r)
  open.value = true
  highlight.value = true
  /* R2-⑤（★口径合一）：此前 App 级抽屉只在「↗ 打开链接」时记调出，而内联抽屉宿主
     （useResourceDrawer.openResource:191-198）把「单击打开详情」就算一次调用——同一个用户动作
     两个宿主两套口径，池卡（唯一走本抽屉的卡群）因此系统性不进热力图/复盘的「调出」维度。
     现两宿主合一：打开详情即一次调出。落盘随下一次保存带出（热度小载荷通道 persistHot 另有一个
     既存缺陷：hotStats 摘走 set 丢了 StorageArea 接收者 → Illegal invocation 被静默 catch 吞掉，
     本轮已定位、单独一轮修，修好后这里就是 250ms 内落盘）。 */
  recordResourceOpen(data, r)
  store.persistHot()
  setTimeout(() => { highlight.value = false }, 1800)
}

function close() {
  open.value = false
  resId.value = null
  highlight.value = false
}

function save() {
  if (!editing.title.trim()) { showToast('请输入标题'); return }
  editing.updatedAt = Date.now()
  if (!store.data) return
  const idx = store.data.resources.findIndex(r => r.id === editing.id)
  if (idx >= 0) store.data.resources[idx] = { ...editing }
  store.persist()
  close()
  showToast('已保存')
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
  store.persistHot()
  const url = toOpenableUrl(r.linkType, r.link)
  if (!url) { showToast('请先补全链接（本地文件需完整路径，如 D:\\docs\\file.pdf）'); return }
  openExternalLink(url)
}

/** ★W17-C07：抽屉头部图钉——置顶切换立即写库生效，不依赖底部「保存」。
 *  ★陷阱：editing 是源卡的深拷贝，save() 会用整份 editing 覆盖库内记录；
 *  只改库内对象不同步 editing.pinned，用户随后点保存会把置顶状态覆盖回去 ⇒ 两处同改。 */
function togglePinnedHere() {
  const src = resource.value
  if (!src) return
  const { label } = togglePinOf({ card: src, draft: editing, persist: () => store.persist() })
  showToast(label)
}
function copyLink() {
  if (!editing.link) { showToast('链接为空'); return }
  navigator.clipboard?.writeText(editing.link).then(() => showToast('链接已复制')).catch(() => {})
}

/* ★W17-C06（2026-10-20 用户拍板）：镜像入口统一到共享弹窗 ResourceMirrorModal。
   原先本抽屉是「行内选台下拉 + 一枚动作」，与资源卡池的行内浮层各写一套，且都已镜像时还提示成功。
   现在两个宿主（本抽屉 / 资源卡池）共用同一个多选弹窗：勾选=镜像、取消勾选=移出、可多选。 */
const mirrorOpen = ref(false)
function gotoTaskOwner(t: TaskCard): void {
  close()
  router.push(t.projectId ? `/compass/projects?p=${t.projectId}` : '/compass')
}

function fmtTs(ts?: number): string {
  return ts ? new Date(ts).toLocaleString('zh-CN', { hour12: false }) : '—'
}

function onBus(p: DrawerPayload) {
  if (p.kind !== 'res' || !p.id) return
  openFromId(p.id)
}

// ---- R167：单卡 AI 两枚入口（补全 / 关联任务）已收进共享 ResourceAiStrip ----
/** 采纳后把表单同步成已落库的值（抽屉还开着，不能显示旧字） */
function syncForm(): void {
  const live = resource.value
  if (!live) return
  editing.title = live.title
  editing.description = live.description
  editing.tags = [...(live.tags || [])]
  editing.categoryId = live.categoryId
  editing.aiTouchedAt = live.aiTouchedAt
}

let unsub: (() => void) | null = null
onMounted(() => { unsub = onOpenDrawer(onBus); const p = consumePendingDrawer(); if (p) onBus(p) })
onUnmounted(() => { unsub?.(); unsub = null })

watch(() => resource.value?.id, (n) => {
  if (open.value && n) highlight.value = true
})

/** 抽屉头的 kicker：说清这张卡在哪、归哪类，头部就不再重复放标题 */
const kicker = computed(() => {
  const c = resource.value
  if (!c) return '资源卡'
  const ws = (store.data?.workspaces || []).find(w => w.id === c.workspaceId)
  const cat = (store.data?.categories || []).find(x => x.id === c.categoryId)
  return ['资源卡', ws ? (ws.id === 'zy-curation' ? '资源卡池' : '策展台镜像') : '资源卡池', cat?.name].filter(Boolean).join('· ')
})
</script>

<template>
  <Drawer :open="open" width="520px" @close="close">
    <!-- R167 ①：主标题只在这里出现一次（就地可编辑，回车/Ctrl+↩ 皆保存） -->
    <template #title>
      <DetailTitle :model-value="editing.title" :kicker="kicker" :highlight="highlight" placeholder="资源卡标题..."
        @update:model-value="editing.title = $event" @enter="save" />
    </template>
    <template #title-extra>
      <!-- ★W17-C07：置顶从只读文字改为可点按钮（可置顶、可取消） -->
      <button class="ds-ib ds-pin-btn" :class="{ on: editing.pinned }"
        :title="editing.pinned ? '已置顶，点击取消' : '置顶（排到池内最前）'"
        @click.stop="togglePinnedHere"><Icon name="pin" :size="13"/></button>
      <span v-if="editing.starred" class="ds-ai-when">星标</span>
    </template>

    <!-- R167 ②：AI 入口一行两格（正文首行），与 Workspace 内联抽屉同一组件（一份承诺） -->
    <ResourceAiStrip :card="resource" :on-adopted="syncForm" />

    <ResourceEditForm
      :model="editing"
      height-key="res-drawer-note"
      @save="save"
    >
      <template #link-actions>
        <button class="ds-ib" title="打开链接" @click="openLink"><Icon name="external" :size="13"/></button>
        <button class="ds-ib" title="复制链接" @click="copyLink">⧉</button>
        <!-- ★W15-T3（用户拍板 2026-10-16）：镜像到策展台从「关联与凭证」面板提到**链接工具行常驻** ——
             原入口埋在属性区里，用户找不到（列表侧同期补了行内 🪞，两处同口径 projectCardToBoard）。 -->
        <template v-if="(store.data?.workspaces || []).some(w => w.kind !== 'resource' && w.id !== CURATION_WS_ID && !w.archived)">
          <button class="ds-ib" title="镜像到策展台（可多选，取消勾选即移出）" @click="mirrorOpen = true"><Icon name="mirror" :size="13"/></button>
        </template>
      </template>
      <!-- 宿主差异内容：落在「关联与凭证」面板内 -->
      <template #extra>
        <ThesisBlock v-if="resource?.isThesis" :text="editing.description" :ws-id="editing.workspaceId" />
        <div class="rd-kv"><span class="k">打开</span><span class="v"><b>{{ resource?.callCount || 0 }}</b> 次<span v-if="resource?.lastCalledAt" class="rd-last"> · 最近 {{ fmtTs(resource.lastCalledAt) }}</span></span></div>
        <!-- R166 T7：资源侧「支持的任务」只读反查（解绑只在任务侧，定案 10） -->
        <SupportTasksPanel v-if="resource && store.data" :d="store.data" :resource="resource" @open-task="gotoTaskOwner" />
      </template>
    </ResourceEditForm>

    <!-- R165-A：页脚收敛两钮——删除（二次确认）+ 保存（Ctrl+↩）；其余动作已贴对象/进正文 -->
    <template #footer>
      <ArmDeleteButton @confirm="remove" />
      <button class="red-save" @click="save"><Icon name="check" :size="13"/> 保存<span class="red-kbd">Ctrl+<Icon name="arrowleft" :size="13"/></span></button>
    </template>
  </Drawer>

  <!-- ★W17-C06：与资源卡池同一枚镜像弹窗（一份实现） -->
  <ResourceMirrorModal :open="mirrorOpen" :card-id="resId" :card-title="editing.title" @close="mirrorOpen = false" />
</template>

<style scoped>
/* 抽屉头里的主标题由 DetailTitle（detail-sheet.css 的 .ds-h1）承担，宿主不再补样式 */
.rd-kv { display: flex; align-items: center; gap: 6px; min-height: 34px; font-size: var(--fs-sub); border-bottom: 1px solid var(--border); color: var(--text-2); }
.rd-kv > .k { width: 34px; flex-shrink: 0; font-size: var(--fs-caption); color: var(--text-4); letter-spacing: var(--tracking-sm); }
.rd-kv > .v { flex: 1; min-width: 0; }
.rd-kv > .v b { color: var(--text); font-weight: 600; }
/* B1-c：「最近调用」时间戳弱一档（原内联 color） */
.rd-last { color: var(--text-4); }
.rd-kv .ds-ib:disabled { opacity: var(--opacity-disabled); cursor: not-allowed; }
.red-save {
  flex: 1; padding: 10px 0; border-radius: var(--radius-sm); border: 1px solid var(--accent); background: var(--accent); color: #fff;
  font-size: var(--fs-body); font-weight: 600; cursor: pointer; transition: all var(--dur); white-space: nowrap;
}
.red-save:hover { background: var(--accent-hover); border-color: var(--accent-hover); }
.red-kbd { font-size: var(--fs-tiny); opacity: .7; margin-left: 6px; font-weight: 400; }
/* ★W17-C07：抽屉头部图钉（置顶态与池内图钉同一语言） */
.ds-pin-btn.on { color: var(--accent-ink); background: var(--accent-light); border-color: var(--accent); }
</style>
