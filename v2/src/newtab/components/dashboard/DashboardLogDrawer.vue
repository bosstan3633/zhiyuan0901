<script setup lang="ts">
import Icon from '@/shared/components/Icon.vue'
import { tablesToCsv, exportName } from '@/shared/utils/exportView'
import { downloadText } from '@/shared/utils/download'
/**
 * R172-T8（04-66 §5.5 / 04-67 F18~F20 / F36）：全量记录抽屉 —— 记录能力的**唯一新居所**。
 *
 * 为什么独立成组件：T9 把调度台右上角的「今日入台 / 移出 / 调出 / 写入记录」四格与今日记录抽屉整体删除，
 * 那四类记录能力**必须等价承接**（04-67 F36 验收）——按日过滤由日详情（`DayDetail.vue`）承担，
 * 全量 + 三维筛选由本组件承担。于是「删」不是能力丢失，而是把入口从"当日四格"升级为"任意区间 + 任意类型"。
 *
 * 刻意**不碰 store**：数据（时间线 + 卡片反查）全部由宿主以 prop 传入 —— 与概览带同一条纪律
 * （R172-9 性能红线：聚合层不许自行扫全库）。展开明细需要卡片上下文，故收 `data` 一个只读 prop。
 *
 * F18 硬判据：动作下拉**必须含「调出」**（旧设置页缺这一项，`call` 事件将无从筛出）。
 * F20 硬判据：容量提示与 `EVENT_LOG_CAP` **同源**（不写死 5000）。
 */
import './dashboard.css'
import { computed, ref, watch } from 'vue'
import type { AppData } from '@/shared/models'
import { EVENT_ACT_LABEL, EVENT_LOG_CAP, type CardEvent, type EventAction } from '@/shared/utils/eventLog'
import Drawer from '@/shared/components/Drawer.vue'

/** 打开时的预设筛选（四类记录入口 / 日详情「查看全部记录 ›」） */
export interface LogPreset {
  kind: 'all' | 'resource' | 'task' | 'curiosity'
  action: 'all' | EventAction
  from: string
  to: string
  /** 预设来源的一句话说明（显示在抽屉头部下方） */
  note?: string
  /**
   * W13-F28/T7（2026-10-16）：主攻动作预设——原 ProfileInsights.dynDrawer「focus-acts」语义平移：
   * 只留归属主攻项目任务的 create/call/status 三类动作（系统摘要与删除/恢复等不动主攻的事件排除）。
   * 动作集在此固定（不走 action 单值筛选），时间窗仍由 from/to 表达。
   */
  focusOnly?: boolean
}
const props = defineProps<{
  open: boolean
  /** 全量时间线（新 → 旧） */
  events: CardEvent[]
  /** 卡片上下文（仅用于展开明细与 CSV 归属列反查） */
  data: AppData
  preset?: LogPreset
}>()
const emit = defineEmits<{ (e: 'close'): void }>()

const kind = ref<'all' | 'resource' | 'task' | 'curiosity'>('all')
const action = ref<'all' | EventAction>('all')
const from = ref('')
const to = ref('')
const expanded = ref('')
const presetNote = ref('')
/* W13-F28：主攻动作模式（focusOnly 预设打开时为 true，随打开沿重置） */
const focusOnly = ref(false)

/** 每次「打开」都按宿主给的预设重置筛选（同一天连点两次也生效 ⇒ 用 open 的上升沿而非值比较） */
watch(() => props.open, (v) => { if (v) applyPreset() }, { immediate: true })
function applyPreset() {
  const p = props.preset
  kind.value = p?.kind || 'all'
  action.value = p?.action || 'all'
  from.value = p?.from || ''
  to.value = p?.to || ''
  presetNote.value = p?.note || ''
  focusOnly.value = !!p?.focusOnly
  expanded.value = ''
}

/* W13-F28 focusOnly 过滤口径（与原 ProfileInsights.focus-acts 同构）：
   主攻项目集 = isFocused && 未归档；事件须是任务事件且 projectId 命中主攻集；动作只留 create/call/status。 */
const focusIds = computed(() => {
  const s = new Set<string>()
  for (const d of props.data.compass?.directions || [])
    for (const p of d.projects || []) if (p.isFocused && p.status !== 'archived') s.add(p.id)
  return s
})
const taskProj = computed(() => {
  const m = new Map<string, string | undefined>()
  for (const t of props.data.tasks || []) if (!t.deletedAt) m.set(t.id, t.projectId)
  return m
})

const filtered = computed<CardEvent[]>(() => {
  const f = from.value ? new Date(from.value + 'T00:00:00').getTime() : 0
  const t = to.value ? new Date(to.value + 'T23:59:59').getTime() : Infinity
  return props.events.filter(e => {
    if (focusOnly.value) {
      if (e.kind === 'system') return false
      if (e.action !== 'create' && e.action !== 'call' && e.action !== 'status') return false
      const pid = taskProj.value.get(e.cardId)
      if (!pid || !focusIds.value.has(pid)) return false
    }
    // 系统摘要事件（批量导入/回滚）不属于任何单一卡类 ⇒ 类筛选下不隐藏它（否则"日志对不上账"）
    if (kind.value !== 'all' && e.kind !== kind.value && e.kind !== 'system') return false
    if (action.value !== 'all' && e.action !== action.value) return false
    if (e.ts < f || e.ts > t) return false
    return true
  })
})

const ACT_BADGE: Record<EventAction, string> = {
  create: '+ 新增', call: '↗ 调出', delete: '− 删除', restore: '↩ 恢复', status: '◐ 状态变更', purge: '永久删除'
}
const KIND_LABEL: Record<CardEvent['kind'], string> = { resource: '资源', task: '任务', curiosity: '好奇', system: '系统' }
const pad2 = (n: number): string => String(n).padStart(2, '0')
function fmtTime(ts: number): string {
  const d = new Date(ts)
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`
}

/** 展开明细：卡片 ID + 归属/链接/状态（老数据卡片可能已永久删除） */
function detailLines(e: CardEvent): string[] {
  const lines: string[] = [`卡片 ID：${e.cardId || '—'}`, `动作：${EVENT_ACT_LABEL[e.action]}${e.to ? `（→ ${e.to}）`: ''}`]
  const d = props.data
  let found = false
  if (e.kind === 'resource') {
    const r = d.resources.find(x => x.id === e.cardId)
    if (r) {
      found = true
      const ws = d.workspaces.find(w => w.id === r.workspaceId)?.name || '—'
      lines.push(`归属：${ws} / ${d.categories.find(c => c.id === r.categoryId)?.name || '待分类'}`)
      if (r.link) lines.push(`链接：${r.link}`)
    }
  } else if (e.kind === 'task') {
    const t = d.tasks.find(x => x.id === e.cardId)
    if (t) {
      found = true
      lines.push(`状态：${t.status === 'done' ? '已完成' : t.status === 'doing' ? '进行中' : '待办'}`)
    }
  } else if (e.kind === 'curiosity') {
    const c = d.curiosities.find(x => x.id === e.cardId)
    if (c) {
      found = true
      lines.push(`探索状态：${c.status === 'done' ? '已求证' : c.status === 'doing' ? '探索中' : c.status === 'shelf' ? '已搁置' : '待探索'}`)
    }
  }
  if (!found && e.kind !== 'system') lines.push('（卡片已不在库中：可能已永久删除）')
  return lines
}
function ownerOf(e: CardEvent): string {
  if (e.kind !== 'resource') return ''
  const r = props.data.resources.find(x => x.id === e.cardId)
  if (!r) return ''
  const ws = props.data.workspaces.find(w => w.id === r.workspaceId)?.name || ''
  return `${ws} / ${props.data.categories.find(c => c.id === r.categoryId)?.name || '待分类'}`
}

/* ---------- F19 CSV 导出：导出对象 = **当前筛选结果**（不是全量） ----------
   R172-T12：引号转义与 BOM 收进 `exportView.tablesToCsv` + `download.downloadText`，
   与复盘段 / 热力图段共用一套出口（此前两处各写一遍，改文件名口径时必然漏一处）。 */
const exported = ref(0)
function exportCsv() {
  downloadText(exportName('操作记录', 'csv'), tablesToCsv([{
    header: ['时间', '动作', '卡片类型', '标题', '归属', '卡片ID'],
    rows: filtered.value.map(e => [fmtTime(e.ts), ACT_BADGE[e.action], KIND_LABEL[e.kind], e.title, ownerOf(e), e.cardId])
  }]), 'csv')
  exported.value = filtered.value.length
}
</script>

<template>
  <Drawer :open="open" icon="clock" title="全部记录" width="560px" @close="emit('close')">
    <div class="dz-log">
      <div v-if="presetNote" class="dz-log-note">{{ presetNote }}</div>

      <!-- F18 三维筛选：类型 × 动作 × 时间区间 -->
      <div class="dz-log-filters">
        <span class="fl">类型</span>
        <select v-model="kind" class="sel">
          <option value="all">全部</option><option value="resource">资源</option><option value="task">任务</option><option value="curiosity">好奇</option>
        </select>
        <span class="fl">动作</span>
        <select v-model="action" class="sel">
          <option value="all">全部</option><option value="create">新增</option><option value="call">调出</option>
          <option value="delete">删除</option><option value="restore">恢复</option><option value="purge">永久删除</option><option value="status">状态变更</option>
        </select>
        <span class="fl">时间</span>
        <input type="date" class="sel" v-model="from" /><span class="tilde">~</span><input type="date" class="sel" v-model="to" />
        <span class="dz-sp"></span>
        <button class="dz-btn sm" @click="kind = 'all'; action = 'all'; from = ''; to = ''">重置</button>
        <button class="dz-btn sm pri" @click="exportCsv"><Icon name="download" :size="13"/> 导出 CSV</button>
      </div>
      <div class="dz-log-count">
        <b>{{ filtered.length }}</b> 条匹配 · 列表按时间倒序 · 单击行展开明细
        <span v-if="exported" class="ok"><Icon name="check" :size="13"/> 已导出 {{ exported }} 条</span>
      </div>

      <div class="dz-log-list">
        <template v-for="e in filtered.slice(0, 200)" :key="e.id">
          <div class="dz-log-row" @click="expanded = expanded === e.id ? '' : e.id">
            <span class="tm">{{ fmtTime(e.ts) }}</span>
            <span class="bd" :class="e.action">{{ ACT_BADGE[e.action] }}</span>
            <span class="kd">{{ KIND_LABEL[e.kind] }}</span>
            <span class="ti">{{ e.title }}</span>
            <span class="go">{{ expanded === e.id ? '▾' : '▸' }}</span>
          </div>
          <div v-if="expanded === e.id" class="dz-log-detail">
            <div v-for="line in detailLines(e)" :key="line">{{ line }}</div>
          </div>
        </template>
        <div v-if="!filtered.length" class="dz-log-empty">当前筛选下没有操作记录</div>
        <div v-if="filtered.length > 200" class="dz-log-empty">仅显示最近 200 条 · 导出 CSV 可获得完整筛选结果</div>
      </div>

      <!-- F20 容量提示：与 EVENT_LOG_CAP 同源 -->
      <div class="dz-log-foot">
        <Icon name="package" :size="13"/> 日志容量 <b>{{ events.length }}</b> / {{ EVENT_LOG_CAP }} 条滚动保留（含恢复与永久删除）；老数据无日志时自动回退为卡片时间派生。<br>
        导出为 UTF-8+BOM CSV，可直接导入 Airtable。
      </div>
    </div>
  </Drawer>
</template>
