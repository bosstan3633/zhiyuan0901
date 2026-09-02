<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useAppStore } from '../stores/app'
import { showToast } from '@/shared/components/toast'
import { deleteAsset } from '@/shared/storage/assets'
import type { ResourceCard, TaskCard, CuriosityCard, AssetMeta } from '@/shared/models'

/** 第卅三轮 REQ-018：回收站页面（三类卡软删数据直接复用：models 的 deletedAt）
 *  列表 + 恢复 + 永久删除 + 清空；入口在全局设置危险操作区
 */
const router = useRouter()
const store = useAppStore()
const d = computed(() => store.data!)

const tab = ref<'res' | 'task' | 'curio'>('res')

const res = computed(() =>
  d.value.resources.filter(r => r.deletedAt).sort((a, b) => (b.deletedAt || 0) - (a.deletedAt || 0)))
const tasks = computed(() =>
  d.value.tasks.filter(t => t.deletedAt).sort((a, b) => (b.deletedAt || 0) - (a.deletedAt || 0)))
const curios = computed(() =>
  d.value.curiosities.filter(c => c.deletedAt).sort((a, b) => (b.deletedAt || 0) - (a.deletedAt || 0)))

function wsNameOf(id: string): string {
  return d.value.workspaces.find(w => w.id === id)?.name.replace(/^[^\s]+\s/, '') || '未知工作台'
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
function restoreRes(r: ResourceCard) {
  r.deletedAt = undefined
  r.updatedAt = Date.now()
  store.persist()
  show(`✓ 已恢复「${r.title.slice(0, 20)}」`)
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
  show(`✓ 已恢复「${t.title.slice(0, 20)}」`)
}
function restoreCurio(c: CuriosityCard) {
  c.deletedAt = undefined
  c.updatedAt = Date.now()
  store.persist()
  show(`✓ 已恢复「${c.question.slice(0, 20)}」`)
}

// ---- 永久删除 ----
/** REQ-048：硬删前清理该卡附件本体（IndexedDB；软删保留，恢复后仍可打开）
 *  第卌一轮 REQ-057：业务吞错收敛——本体删除失败累计计数并提示（Blob 残留可去设置页清理孤儿） */
async function purgeAssetsOf(metas: AssetMeta[] | null | undefined) {
  const arr = metas || []
  let failed = 0
  for (const m of arr) {
    try { await deleteAsset(m.id) } catch (err) { console.error('[recycle] delete asset failed:', err); failed++ }
  }
  if (failed > 0) show(`⚠ ${failed} 个附件本体删除失败（孤儿可到「设置 · 数据管理」清理）`)
}
async function purgeRes(r: ResourceCard) {
  await purgeAssetsOf(r.assets)
  d.value.resources = d.value.resources.filter(x => x.id !== r.id)
  store.persist()
  show('🗑 已永久删除')
}
async function purgeTask(t: TaskCard) {
  await purgeAssetsOf(t.assets)
  // 从所有指标 taskIds 摘除引用，再移除实体
  for (const dir of d.value.compass.directions) {
    for (const proj of dir.projects) {
      for (const m of proj.metrics) m.taskIds = m.taskIds.filter(id => id !== t.id)
    }
  }
  d.value.tasks = d.value.tasks.filter(x => x.id !== t.id)
  store.persist()
  show('🗑 已永久删除')
}
async function purgeCurio(c: CuriosityCard) {
  await purgeAssetsOf(c.assets)
  d.value.curiosities = d.value.curiosities.filter(x => x.id !== c.id)
  store.persist()
  show('🗑 已永久删除')
}

// ---- 全部恢复 / 清空 ----
function restoreAll() {
  const cur = tab.value
  if (cur === 'res') res.value.forEach(r => restoreRes(r))
  else if (cur === 'task') tasks.value.forEach(t => restoreTask(t))
  else curios.value.forEach(c => restoreCurio(c))
  store.persist()
}
async function purgeAll() {
  const cur = tab.value
  if (cur === 'res') {
    for (const r of res.value) await purgeAssetsOf(r.assets)
    d.value.resources = d.value.resources.filter(r => !r.deletedAt)
  } else if (cur === 'task') {
    for (const t of tasks.value) await purgeAssetsOf(t.assets)
    for (const dir of d.value.compass.directions) {
      for (const proj of dir.projects) {
        for (const m of proj.metrics) m.taskIds = m.taskIds.filter(id => !d.value.tasks.some(t => t.id === id && t.deletedAt))
      }
    }
    d.value.tasks = d.value.tasks.filter(t => !t.deletedAt)
  }
  else {
    for (const c of curios.value) await purgeAssetsOf(c.assets)
    d.value.curiosities = d.value.curiosities.filter(c => !c.deletedAt)
  }
  store.persist()
  show('✓ 当前分区已清空')
}
const tabMeta = computed(() => [
  { k: 'res' as const, label: '📄 资源卡', list: res.value, n: res.value.length },
  { k: 'task' as const, label: '📋 任务卡', list: tasks.value, n: tasks.value.length },
  { k: 'curio' as const, label: '💡 好奇心卡', list: curios.value, n: curios.value.length }
])
</script>

<template>
  <div class="rb-page">
    <div class="rb-head">
      <button class="rb-back" @click="router.push('/settings')">← 返回设置</button>
      <div class="rb-title">🗑 回收站</div>
      <div class="rb-desc">删除的卡片软删除移入此处，可恢复；永久删除不可撤销</div>
      <div class="rb-actions">
        <button class="rb-btn" @click="restoreAll">♻ 恢复当前分区全部</button>
        <button class="rb-btn danger" @click="purgeAll">🗑 清空当前分区</button>
      </div>
    </div>

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
          <div class="rb-item-meta">📂 {{ wsNameOf(r.workspaceId) }} · {{ catNameOf(r.categoryId) }} · 🕓 删除于 {{ fmt(r.deletedAt) }}</div>
        </div>
        <div class="rb-item-ops">
          <button class="rb-btn sm" @click="restoreRes(r)">恢复</button>
          <button class="rb-btn sm danger" @click="purgeRes(r)">永久删除</button>
        </div>
      </div>
      <div v-if="!res.length" class="rb-empty">回收站空空如也 ✨</div>
    </div>

    <!-- 任务卡 -->
    <div v-else-if="tab === 'task'" class="rb-list">
      <div v-for="t in tasks" :key="t.id" class="rb-item">
        <div class="rb-item-main">
          <div class="rb-item-title">{{ t.title }}</div>
          <div class="rb-item-meta">🎯 {{ metricNameOf(t.metricId) }} · {{ t.status === 'done' ? '✅ 已完成' : t.status === 'doing' ? '◐ 进行中' : '○ 待开始' }} · 🕓 删除于 {{ fmt(t.deletedAt) }}</div>
        </div>
        <div class="rb-item-ops">
          <button class="rb-btn sm" @click="restoreTask(t)">恢复</button>
          <button class="rb-btn sm danger" @click="purgeTask(t)">永久删除</button>
        </div>
      </div>
      <div v-if="!tasks.length" class="rb-empty">回收站空空如也 ✨</div>
    </div>

    <!-- 好奇心卡 -->
    <div v-else class="rb-list">
      <div v-for="c in curios" :key="c.id" class="rb-item">
        <div class="rb-item-main">
          <div class="rb-item-title">{{ c.question }}</div>
          <div class="rb-item-meta">🕓 删除于 {{ fmt(c.deletedAt) }}</div>
        </div>
        <div class="rb-item-ops">
          <button class="rb-btn sm" @click="restoreCurio(c)">恢复</button>
          <button class="rb-btn sm danger" @click="purgeCurio(c)">永久删除</button>
        </div>
      </div>
      <div v-if="!curios.length" class="rb-empty">回收站空空如也 ✨</div>
    </div>

    
  </div>
</template>

<style scoped>
.rb-page { max-width: 860px; margin: 0 auto; padding: 28px 20px 60px; }
.rb-head { margin-bottom: 20px; }
.rb-back { border: 1px solid var(--border); background: var(--surface); color: var(--text-2); border-radius: 8px; padding: 6px 14px; font-size: 12px; cursor: pointer; font-family: inherit; margin-bottom: 14px; transition: all .15s; }
.rb-back:hover { border-color: var(--accent); color: var(--accent); }
.rb-title { font-size: 22px; font-weight: 700; color: var(--text); margin-bottom: 6px; }
.rb-desc { font-size: 12.5px; color: var(--text-3); margin-bottom: 16px; }
.rb-actions { display: flex; gap: 8px; }
.rb-btn { border: 1px solid var(--border); background: var(--surface); color: var(--text-2); border-radius: 8px; padding: 8px 14px; font-size: 12.5px; font-weight: 600; cursor: pointer; font-family: inherit; transition: all .15s; }
.rb-btn:hover { border-color: var(--accent); color: var(--accent); }
.rb-btn.sm { padding: 5px 10px; font-size: 11.5px; }
.rb-btn.danger { border-color: color-mix(in srgb, #e5484d 40%, transparent); color: #e5484d; }
.rb-btn.danger:hover { background: #e5484d; color: #fff; }

.rb-tabs { display: flex; gap: 8px; margin-bottom: 14px; }
.rb-tab { flex: 1; padding: 10px 0; border: 1px solid var(--border); background: var(--surface); color: var(--text-2); border-radius: 10px; font-size: 13px; font-weight: 600; cursor: pointer; font-family: inherit; transition: all .15s; }
.rb-tab.on { border-color: var(--accent); background: var(--accent-light); color: var(--accent); }
.rb-count { display: inline-block; min-width: 22px; padding: 1px 7px; background: var(--surface-2); border-radius: 99px; font-size: 11px; margin-left: 4px; }

.rb-list { display: flex; flex-direction: column; gap: 8px; }
.rb-item { display: flex; align-items: center; gap: 12px; padding: 12px 14px; background: var(--surface); border: 1px solid var(--border); border-radius: 10px; transition: all .15s; }
.rb-item:hover { border-color: color-mix(in srgb, var(--accent) 45%, transparent); }
.rb-item-main { flex: 1; min-width: 0; }
.rb-item-title { font-size: 13.5px; font-weight: 600; color: var(--text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; margin-bottom: 3px; }
.rb-item-meta { font-size: 11.5px; color: var(--text-3); }
.rb-item-ops { display: flex; gap: 6px; flex-shrink: 0; }
.rb-empty { text-align: center; color: var(--text-3); font-size: 13px; padding: 60px 0; }
</style>
