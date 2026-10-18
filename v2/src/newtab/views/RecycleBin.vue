<script setup lang="ts">
// R148-P1a：显式实例名——纳入 KeepAlive（切模块免重挂载与免重算首屏）
defineOptions({ name: 'RecycleBinView' })
import Icon from '@/shared/components/Icon.vue'

import { ref, computed } from 'vue'
import { wsDisplayNameOf, wsNameById } from '@/shared/utils/wsName'
import { useRouter } from 'vue-router'
import { useAppStore } from '../stores/app'
import { showToast } from '@/shared/components/toast'
import { useConfirm } from '@/shared/components/confirm'
import AiEntryButton from '@/shared/components/AiEntryButton.vue'
import EmptyState from '@/shared/components/EmptyState.vue'
import { purgeCardsCompletely, type PurgeTargets } from '@/shared/storage/purge'
import type { ResourceCard, TaskCard, CuriosityCard, ArgumentCard, ID } from '@/shared/models'
import { CURATION_WS_ID } from '@/shared/models'
// R137-H2：AI 捞回清单（懒路由，可直接静态引 AI 栈；采纳=恢复 deletedAt 置空，与手工恢复同字段）
import AiSuggestionDrawer from '@/newtab/components/AiSuggestionDrawer.vue'
import type { AiJob } from '@/shared/ai/job'
import { aiConfig, loadAiConfig, aiReady } from '@/shared/ai/config'
import { buildTrashRescueJob } from '@/shared/ai/govern'

const aiJob = ref<AiJob | null>(null)
async function aiRescue() {
  await loadAiConfig()
  if (!aiReady.value) { showToast('请先在 设置 → AI 助手 完成接入（地址/Key/模型）'); return }
  const job = buildTrashRescueJob({ d: store.data!, depth: aiConfig.value.depth, persist: () => store.persist() })
  if (!job) { showToast('回收站里没有资源卡'); return }
  aiJob.value = job
}

/** 第卅三轮 REQ-018：回收站页面（三类卡软删数据直接复用：models 的 deletedAt）
 *  列表 + 恢复 + 永久删除 + 清空；入口在全局设置危险操作区
 */
const router = useRouter()
const store = useAppStore()
const d = computed(() => store.data!)

const tab = ref<'res' | 'task' | 'curio' | 'cat' | 'arg'>('res')
/** R109（F12-b）：软删分类（删除分类/删除策展台/合并重复 均走 deletedAt）——恢复 = 清 deletedAt */
const cats = computed(() =>
  d.value.categories.filter(c => c.deletedAt).sort((a, b) => (b.deletedAt || 0) - (a.deletedAt || 0)))
function restoreCat(c: { id: ID; deletedAt?: number }) {
  c.deletedAt = undefined
  store.persist()
  show('↩ 分类已恢复（其下卡片仍在待分类/回收站，可手动归位）')
}

/** R2-⑤：论证节点卡（第 4 种卡）进回收站族——R1.5 的「硬删不可恢复」旁路到此为止 */
const args = computed(() =>
  (d.value.argCards || []).filter(a => a.deletedAt).sort((a, b) => (b.deletedAt || 0) - (a.deletedAt || 0)))
function restoreArg(a: ArgumentCard) {
  a.deletedAt = undefined
  a.updatedAt = Date.now()
  store.persist()
  show(`已恢复「${a.title.slice(0, 20)}」${d.value.workspaces.some(w => w.id === a.workspaceId) ? '' : '（原策展台已删除，回台面需先恢复该台）'}`)
}

const res = computed(() =>
  d.value.resources.filter(r => r.deletedAt).sort((a, b) => (b.deletedAt || 0) - (a.deletedAt || 0)))
const tasks = computed(() =>
  d.value.tasks.filter(t => t.deletedAt).sort((a, b) => (b.deletedAt || 0) - (a.deletedAt || 0)))
const curios = computed(() =>
  d.value.curiosities.filter(c => c.deletedAt).sort((a, b) => (b.deletedAt || 0) - (a.deletedAt || 0)))

function wsNameOf(id: string): string {
  return wsNameById(d.value.workspaces, id) || '未知策展台'
}
function catNameOf(id: string): string {
  return d.value.categories.find(c => c.id === id)?.name || '待分类'
}
function metricNameOf(metricId?: string): string {
  if (!metricId) return '未归类'
  for (const dir of d.value.compass.directions) {
    for (const proj of dir.projects) {
      const m = proj.metrics.find(x => x.id === metricId)
      if (m) return m.title
    }
  }
  return '已删除指标'
}
function fmt(t?: number): string {
  if (!t) return '—'
  const dt = new Date(t)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${dt.getFullYear()}-${p(dt.getMonth() + 1)}-${p(dt.getDate())} ${p(dt.getHours())}:${p(dt.getMinutes())}`
}
function show(msg: string) { showToast(msg) }

// ---- 恢复 ----
/** R58-B1：恢复时原策展台/分类可能已随「删除策展台」消失——回落到第一个可用策展台的未分类，保证卡片可见可用 */
function rehomeIfOrphan(r: ResourceCard): string {
  let note = ''
  if (!d.value.workspaces.some(w => w.id === r.workspaceId)) {
    const fallback = d.value.workspaces.find(w => w.id !== CURATION_WS_ID) || d.value.workspaces[0]
    if (fallback) { r.workspaceId = fallback.id; note = '（原策展台已删除，已移入「' + wsDisplayNameOf(fallback) + '」未分类）' }
  } else if (r.categoryId && !d.value.categories.some(c => c.id === r.categoryId)) {
    r.categoryId = ''
    note = '（原分类已删除，已移入未分类）'
  }
  return note
}
function restoreRes(r: ResourceCard) {
  r.deletedAt = undefined
  const note = rehomeIfOrphan(r)
  r.updatedAt = Date.now()
  store.persist()
  show(`已恢复「${r.title.slice(0, 20)}」${note}`)
}
function restoreTask(t: TaskCard) {
  t.deletedAt = undefined
  t.updatedAt = Date.now()
  // 原指标仍存在则回填 taskIds（与删除撤销口径一致）
  if (t.metricId) {
    for (const dir of d.value.compass.directions) {
      for (const proj of dir.projects) {
        for (const m of proj.metrics) {
          if (m.id === t.metricId && !m.taskIds.includes(t.id)) m.taskIds.push(t.id)
        }
      }
    }
  }
  store.persist()
  show(`已恢复「${t.title.slice(0, 20)}」`)
}
function restoreCurio(c: CuriosityCard) {
  c.deletedAt = undefined
  /** R167：恢复即撤销这次转化——清掉转化戳，否则池里多一条卡、头部「已转化」却还记着它（两头都对不上） */
  c.convertedAt = undefined
  c.convertedTo = undefined
  c.updatedAt = Date.now()
  store.persist()
  show(`已恢复「${c.question.slice(0, 20)}」`)
}

// ---- 永久删除（R146：全应用唯一真正不可逆的动作，必须逐次确认 + 回执点名）----
/** R128-A3：硬删四类副作用（附件本体 / metric.taskIds / 数组移除 / 悬空投射）统一到
 *  shared/storage/purge.purgeCardsCompletely——与设置页「清空回收站」共用一份口径。
 *  附件本体不再无条件删除：仍被其他卡（含回收站待恢复卡）引用的共享本体保留（REQ-050 转卡引用拷贝）。 */
async function purge(targets: PurgeTargets): Promise<number> {
  const r = await purgeCardsCompletely(d.value, targets)
  store.persist()
  if (r.assetsFailed > 0) show(`${r.assetsFailed} 个附件本体删除失败（孤儿可到「设置 · 数据管理」清理）`)
  return r.cards
}
async function purgeWith(what: string, name: string, targets: PurgeTargets) {
  if (!(await useConfirm({ title: '永久删除', message: `确定永久删除${what}「${name}」？\n此操作不可恢复：卡片本体、其附件（若无其它卡引用）与镜像投射记录一并清除。`, confirmText: '永久删除' }))) return
  const n = await purge(targets)
  show(n ? `已永久删除${what}「${name.slice(0, 16)}」· 不可恢复` : `${what}「${name.slice(0, 16)}」已不在回收站`)
}
function purgeRes(r: ResourceCard) { void purgeWith('资源卡', r.title, { resources: [r] }) }
function purgeTask(t: TaskCard) { void purgeWith('任务卡', t.title, { tasks: [t] }) }
function purgeCurio(c: CuriosityCard) { void purgeWith('好奇心卡', c.question, { curiosities: [c] }) }
/** R146：分类分区补上永久删除（原先只有恢复——四类对象两套口径） */
function purgeCat(c: { id: ID; name: string }) { void purgeWith('分类', c.name, { categories: [c as never] }) }
/** R2-⑤：论证卡同口径（永久删除逐次确认 + 回执点名） */
function purgeArg(a: ArgumentCard) { void purgeWith('论证卡', a.title, { argCards: [a] }) }

// ---- 全部恢复 / 清空 ----
/** 恢复是安全动作：不弹确认，但一次动作只报一条账（原实现每条各弹一次 toast，互相顶掉） */
function restoreAll() {
  const cur = tab.value
  const list = cur === 'res' ? res.value : cur === 'task' ? tasks.value : cur === 'cat' ? cats.value : cur === 'arg' ? args.value : curios.value
  if (!list.length) { show('该分区没有可恢复的条目'); return }
  const now = Date.now()
  for (const x of list as { deletedAt?: number; updatedAt?: number; convertedAt?: number; convertedTo?: 'task' | 'res' }[]) {
    x.deletedAt = undefined
    if (x.updatedAt !== undefined) x.updatedAt = now
    /** R167：批量恢复同样撤销转化戳（只对好奇卡存在这两个字段，其余恒为 undefined，无副作用） */
    x.convertedAt = undefined
    x.convertedTo = undefined
  }
  store.persist()
  show(`已恢复 ${list.length} 项（${tabLabelOf(cur)}）· 归属需手动归位的见各条说明`)
}
function tabLabelOf(k: typeof tab.value) { return k === 'res' ? '资源卡' : k === 'task' ? '任务卡' : k === 'cat' ? '分类' : k === 'arg' ? '论证卡' : '好奇心卡' }
async function purgeAll() {
  const cur = tab.value
  const list = cur === 'res' ? res.value : cur === 'task' ? tasks.value : cur === 'cat' ? cats.value : cur === 'arg' ? args.value : curios.value
  if (!list.length) { show('该分区已是空的'); return }
  if (!(await useConfirm({ title: '清空回收站分区', message: `确定永久删除本分区全部 ${list.length} 项（${tabLabelOf(cur)}）？\n不可恢复，且会一并清除仅被这些卡引用的附件本体。`, confirmText: `清空 ${list.length} 项` }))) return
  const targets: PurgeTargets =
    cur === 'cat' ? { categories: list as never }
    : cur === 'res' ? { resources: list as ResourceCard[] }
    : cur === 'task' ? { tasks: list as TaskCard[] }
    : cur === 'arg' ? { argCards: list as ArgumentCard[] }
    : { curiosities: list as CuriosityCard[] }
  const n = await purge(targets)
  show(n ? `已永久删除 ${n} 项（${tabLabelOf(cur)}）· 不可恢复` : '该分区已是空的')
}
const tabMeta = computed(() => [
  { k: 'res' as const, label: '资源卡', list: res.value, n: res.value.length },
  { k: 'cat' as const, label: '分类', list: cats.value, n: cats.value.length },
  { k: 'task' as const, label: '任务卡', list: tasks.value, n: tasks.value.length },
  { k: 'curio' as const, label: '好奇心卡', list: curios.value, n: curios.value.length },
  { k: 'arg' as const, label: '论证卡', list: args.value, n: args.value.length }
])
</script>

<template>
  <div class="rb-page">
    <div class="rb-head">
      <button class="rb-back" @click="router.push('/settings')">← 返回设置</button>
      <div class="rb-title"><Icon name="trash" :size="13"/> 回收站</div>
      <div class="rb-desc">删除的卡片软删除移入此处，可恢复；永久删除不可撤销</div>
      <div class="rb-actions">
        <button class="rb-btn" @click="aiRescue" title="AI 对照现存卡与活跃目标，逐条判定值得恢复/建议清除"><AiEntryButton variant="inline" label="值得捞回" /></button>
        <button class="rb-btn" @click="restoreAll"><Icon name="refresh" :size="13"/> 恢复当前分区全部</button>
        <button class="rb-btn danger" @click="purgeAll"><Icon name="trash" :size="13"/> 清空当前分区</button>
      </div>
    </div>
    <AiSuggestionDrawer v-if="aiJob" :job="aiJob" @close="aiJob = null" />

    <div class="rb-tabs">
      <button v-for="m in tabMeta" :key="m.k" class="rb-tab" :class="{on: tab === m.k}" @click="tab = m.k">
        {{ m.label }} <span class="rb-count">{{ m.n }}</span>
      </button>
    </div>

    <!-- 资源卡 -->
    <div v-if="tab === 'res'" class="rb-list">
      <div v-for="r in res" :key="r.id" class="rb-item">
        <div class="rb-item-main">
          <div class="rb-item-title">{{ r.title }}</div>
          <div class="rb-item-meta"><Icon name="folderopen" :size="13"/> {{ wsNameOf(r.workspaceId) }} · {{ catNameOf(r.categoryId || "") }} · <Icon name="clock" :size="13"/> 删除于 {{ fmt(r.deletedAt) }}</div>
        </div>
        <div class="rb-item-ops">
          <button class="rb-btn sm" @click="restoreRes(r)">恢复</button>
          <button class="rb-btn sm danger" @click="purgeRes(r)">永久删除</button>
        </div>
      </div>
      <!-- G3/D3（V3.8.27）：五类共用一个契约，且是"无主行动"特例——
           这里不该催用户"去做点什么"，只说明这是什么、删除物的去向。 -->
            <!-- ★D3（V3.8.37）回收站空态：五处原本逐字相同（"这一类还没有删除项"），
           用户切到任一分区看到的都是同一句话，等于没分区。本批按 tabMeta 的五个分区别写文案。

           ★★否决原文「可在 30 天内找回」——这条不能照抄：
           规范 D3 原文写「删除的任务、好奇与资源可在 30 天内找回」，但**产品里没有这个机制**。
           逐条核过源码：软删只写 deletedAt，全库没有 purge/expire/cleanup/retention 任何定时或过期逻辑，
           也没有任何地方按天数清理；母版里 "30 天" 出现 0 次。
           真实口径是**软删永久保留**，只有用户主动点「永久删除」或「清空回收站」才真正不可逆。
           照抄 30 天等于在空态里对用户撒一个不存在的谎——用户会以为第 31 天卡就没了，
           反而不敢把重要内容放进回收站。改成"没有期限"是把机制说准，不是偷懒。

           ★幽灵按钮按原文 D3 的备选做「回到调度台」：回收站空时唯一合理的事就是离开，
           主行动位留空（D3 原文「无主行动（或回到调度台幽灵按钮）」），不硬凑一个操作。 -->
<EmptyState v-if="!res.length" class="rb-empty" size="page" icon="trash"
title="这台删除过的资源卡会停在这里"
        hint="没有期限——软删不会自己过期。只有你点「永久删除」或清空回收站，卡才真正离开本机。"
        secondary-label="回到调度台" @secondary="router.push('/')" />
    </div>

    <!-- 任务卡 -->
    <div v-else-if="tab === 'task'" class="rb-list">
      <div v-for="t in tasks" :key="t.id" class="rb-item">
        <div class="rb-item-main">
          <div class="rb-item-title">{{ t.title }}</div>
          <div class="rb-item-meta"><Icon name="target" :size="13"/> {{ metricNameOf(t.metricId) }} · <Icon :name="t.status === 'done' ? 'check' : t.status === 'doing' ? 'half' : 'circle'" :size="11"/>{{ t.status === 'done' ? '已完成' : t.status === 'doing' ? '进行中' : '待开始' }} · <Icon name="clock" :size="13"/> 删除于 {{ fmt(t.deletedAt) }}</div>
        </div>
        <div class="rb-item-ops">
          <button class="rb-btn sm" @click="restoreTask(t)">恢复</button>
          <button class="rb-btn sm danger" @click="purgeTask(t)">永久删除</button>
        </div>
      </div>
      <EmptyState v-if="!tasks.length" class="rb-empty" size="page" icon="trash"
title="这台删除过的任务卡会停在这里"
        hint="没有期限——软删不会自己过期。只有你点「永久删除」或清空回收站，卡才真正离开本机。"
        secondary-label="回到调度台" @secondary="router.push('/')" />
    </div>

    <!-- 好奇心卡 -->
    <div v-else-if="tab === 'curio'" class="rb-list">
      <div v-for="c in curios" :key="c.id" class="rb-item">
        <div class="rb-item-main">
          <div class="rb-item-title">{{ c.question }}</div>
          <div class="rb-item-meta">
            <span v-if="c.convertedTo" class="rb-conv">{{ c.convertedTo === 'task' ? '→ 已转为任务' : '→ 已归档为资源' }}（{{ fmt(c.convertedAt) }}）· 恢复 = 撤销这次转化</span>
            <span v-else><Icon name="clock" :size="13"/> 删除于 {{ fmt(c.deletedAt) }}</span>
          </div>
        </div>
        <div class="rb-item-ops">
          <button class="rb-btn sm" @click="restoreCurio(c)">恢复</button>
          <button class="rb-btn sm danger" @click="purgeCurio(c)">永久删除</button>
        </div>
      </div>
      <EmptyState v-if="!curios.length" class="rb-empty" size="page" icon="trash"
title="这台删除过的好奇心卡会停在这里"
        hint="没有期限——软删不会自己过期。只有你点「永久删除」或清空回收站，卡才真正离开本机。"
        secondary-label="回到调度台" @secondary="router.push('/')" />
    </div>

    <!-- R109（F12-b）：分类分区（删除分类/删除策展台/合并重复 均走软删；恢复=清 deletedAt） -->
    <div v-else-if="tab === 'cat'" class="rb-list">
      <div v-for="c in cats" :key="c.id" class="rb-item">
        <div class="rb-item-main">
          <div class="rb-item-title"><Icon name="folder" :size="13"/> {{ c.name }}</div>
          <div class="rb-item-meta"><Icon name="folder" :size="13"/> {{ wsNameOf(c.workspaceId) }} · <Icon name="clock" :size="13"/> 删除于 {{ fmt(c.deletedAt) }}<span class="rb-note"> · 恢复后其下卡片不会自动归位（仍在待分类/回收站）</span></div>
        </div>
        <div class="rb-item-ops">
          <button class="rb-btn sm" @click="restoreCat(c)">恢复</button>
          <button class="rb-btn sm danger" @click="purgeCat(c)">永久删除</button>
        </div>
      </div>
      <EmptyState v-if="!cats.length" class="rb-empty" size="page" icon="trash"
title="这台删除过的分类会停在这里"
        hint="没有期限——软删不会自己过期。只有你点「永久删除」或清空回收站，卡才真正离开本机。"
        secondary-label="回到调度台" @secondary="router.push('/')" />
    </div>

    <!-- R2-⑤：论证卡分区（台内原生第 4 种卡，软删后与三卡同一条恢复/永久删除通道） -->
    <div v-else-if="tab === 'arg'" class="rb-list">
      <div v-for="a in args" :key="a.id" class="rb-item">
        <div class="rb-item-main">
          <div class="rb-item-title"><Icon name="compass" :size="13"/> {{ a.title }}</div>
          <div class="rb-item-meta"><Icon name="folder" :size="13"/> {{ wsNameOf(a.workspaceId) }} · <Icon name="clock" :size="13"/> 删除于 {{ fmt(a.deletedAt) }}<span class="rb-note"> · 论证卡随策展台存续，台若已删需先恢复台</span></div>
        </div>
        <div class="rb-item-ops">
          <button class="rb-btn sm" @click="restoreArg(a)">恢复</button>
          <button class="rb-btn sm danger" @click="purgeArg(a)">永久删除</button>
        </div>
      </div>
      <EmptyState v-if="!args.length" class="rb-empty" size="page" icon="trash"
title="这台删除过的论证卡会停在这里"
        hint="没有期限——软删不会自己过期。只有你点「永久删除」或清空回收站，卡才真正离开本机。"
        secondary-label="回到调度台" @secondary="router.push('/')" />
    </div>

    
  </div>
</template>

<style scoped>
.rb-page { max-width: 860px; margin: 0 auto; padding: 28px 20px 60px; }
.rb-head { margin-bottom: 20px; }
.rb-back { border: 1px solid var(--border); background: var(--surface); color: var(--text-2); border-radius: 8px; padding: 6px 14px; font-size: var(--fs-sub); cursor: pointer; font-family: inherit; margin-bottom: 14px; transition: all var(--dur); }
.rb-back:hover { border-color: var(--accent); color: var(--accent); }
.rb-title { font-size: var(--fs-display); font-weight: 700; color: var(--text); margin-bottom: 6px; }
.rb-desc { font-size: var(--fs-body); color: var(--text-3); margin-bottom: 16px; }
.rb-actions { display: flex; gap: 8px; }
.rb-btn { border: 1px solid var(--border); background: var(--surface); color: var(--text-2); border-radius: 8px; padding: 8px 14px; font-size: var(--fs-body); font-weight: 600; cursor: pointer; font-family: inherit; transition: all var(--dur); }
.rb-btn:hover { border-color: var(--accent); color: var(--accent); }
.rb-btn.sm { padding: 5px 10px; font-size: var(--fs-sub); }
.rb-btn.danger { border-color: var(--danger-border); color: var(--danger); }
.rb-btn.danger:hover { background: var(--danger); color: #fff; }

.rb-tabs { display: flex; gap: 8px; margin-bottom: 14px; }
.rb-tab { flex: 1; padding: 10px 0; border: 1px solid var(--border); background: var(--surface); color: var(--text-2); border-radius: 10px; font-size: var(--fs-body); font-weight: 600; cursor: pointer; font-family: inherit; transition: all var(--dur); }
.rb-tab.on { border-color: var(--accent); background: var(--accent-light); color: var(--accent-ink); }
.rb-count { display: inline-block; min-width: 22px; padding: 1px 7px; background: var(--surface-2); border-radius: 99px; font-size: var(--fs-caption); margin-left: 4px; }

.rb-list { display: flex; flex-direction: column; gap: 8px; }
.rb-item { display: flex; align-items: center; gap: 12px; padding: 12px 14px; background: var(--surface); border: 1px solid var(--border); border-radius: 10px; transition: all var(--dur); }
.rb-item:hover { border-color: color-mix(in srgb, var(--accent) 45%, transparent); }
.rb-item-main { flex: 1; min-width: 0; }
.rb-item-title { font-size: var(--fs-body); font-weight: 600; color: var(--text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; margin-bottom: 3px; }
.rb-item-meta { font-size: var(--fs-sub); color: var(--text-3); }
/* B1-c：说明性后缀弱一档（原两处内联 color） */
.rb-note { color: var(--text-4); }
/* R167：转化出场的卡要读得出"它不是被删掉的，是转出去的"——恢复=撤销这次转化 */
.rb-conv { color: var(--accent); font-weight: 600; }
.rb-item-ops { display: flex; gap: 6px; flex-shrink: 0; }
/* G3（V3.8.27）：.rb-empty 的视觉已由 EmptyState 接管，class 只留作语义锚点 */
</style>
