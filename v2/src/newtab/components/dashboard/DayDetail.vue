<script setup lang="ts">
/**
 * R172-T6（04-66 §5.4 / 04-67 F12~F17）：日详情 —— 四类指标下钻 + 库容变化条 + 当日流水。
 *
 * 三个信息层，从上到下回答三件事：
 *   ① 那天我做了什么  → 采集 / 调出 / 状态变更 / 推进（四列可点开下钻到内容卡片）
 *   ② 库因此变成了什么样 → 该日库容变化 + 截至该日库容（与概览带时间绑定同源）
 *   ③ 原始凭证 → 当日流水（来自 zy_event_log 的明细，按日过滤）
 *
 * 分数一律**从当日事件现算**（而不是只读 `DayRec` 的聚合数）：因为状态变更的权重分目标态，
 * 而 `DayRec.s` 只存了分卡种的条数 —— 现算才能让"这一列多少分"经得起核对。
 *
 * R172-T7 修订：折叠逻辑（同卡多次 `×N` + 首末时刻）上移到 `shared/utils/drillRows.ts`，
 * 与复盘段 KPI 下钻共用**同一实现** —— 顺带修掉一个真缺陷：本地版返回 `t1/t2` 而
 * `DrillCardList` 读 `time/time2`，日详情下钻的时间列此前恒为空白。
 */
import './dashboard.css'
import { computed, ref } from 'vue'
import { useAppStore } from '@/newtab/stores/app'
import type { CardEvent, CardKind } from '@/shared/utils/eventLog'
import { EVENT_ACT_LABEL } from '@/shared/utils/eventLog'
import {
  W, actsOf, deltaOf, emptyDay, levelName, levelDesc, levelRange, stockAt,
  type DailyStats
} from '@/shared/utils/dailyStats'
import { groupEventRows, hm, dayOfTs, type DrillRow } from '@/shared/utils/drillRows'
import DrillCardList from './DrillCardList.vue'

const props = defineProps<{
  stats: DailyStats
  day: string
  events: CardEvent[]
  liveLink: number
}>()
const emit = defineEmits<{ (e: 'close'): void; (e: 'open-log', day: string): void }>()

const store = useAppStore()
type MetricKey = 'create' | 'call' | 'status' | 'deliver'
const sel = ref<MetricKey>('create')

const WD = ['一', '二', '三', '四', '五', '六', '日']

const rec = computed(() => props.stats.days[props.day] || emptyDay())
const dayEvents = computed(() => props.events.filter(e => dayOfTs(e.ts) === props.day))
const lv = computed(() => levelName(rec.value.w))

/** 状态变更的目标态权重（与 dailyStats 的分值表同源；`todo` 回退不计分） */
function statusW(kind: CardKind, to?: string): number {
  if (kind === 'curiosity') return to === 'doing' ? W.sCurioDoing : to === 'done' ? W.sCurioDone : to === 'shelf' ? W.sCurioShelf : 0
  if (kind === 'task') return to === 'doing' ? W.sTaskDoing : to === 'done' ? W.sTaskDone : 0
  return 0
}

const createRows = computed<DrillRow[]>(() => groupEventRows(dayEvents.value.filter(e => e.action === 'create'), () => '采集'))
/** 调出（同卡当天多次由 ×N 徽标承载，其计分权重即防刷分后的 1.0/0.5） */
const callRows = computed<DrillRow[]>(() => groupEventRows(dayEvents.value.filter(e => e.action === 'call'), () => '调出'))
const statusRows = computed<DrillRow[]>(() => groupEventRows(dayEvents.value.filter(e => e.action === 'status'), e => (e.to ? `→ ${e.to}` : '状态变更')))

/** 推进（F12 第四列）：三个来源都不是事件 ⇒ 从卡字段按时间戳归日（与 dailyStats 同一口径） */
const deliverRows = computed<DrillRow[]>(() => {
  const out: DrillRow[] = []
  const d = store.data
  if (!d) return out
  for (const slots of Object.values(d.dailyFocus || {})) {
    for (const s of slots || []) {
      if (s && s.done && s.doneAt && dayOfTs(s.doneAt) === props.day) {
        out.push({ kind: s.sourceType === 'text' ? 'task' : s.sourceType, id: s.sourceId || s.id, title: s.text, icon: '★', tag: '三件事完成', n: 1, time: hm(s.doneAt) })
      }
    }
  }
  const resTitle = new Map((d.resources || []).map(r => [r.id, r.title]))
  const taskTitle = new Map((d.tasks || []).map(t => [t.id, t.title]))
  for (const l of d.supportLinks || []) {
    if (l && l.createdAt && dayOfTs(l.createdAt) === props.day) {
      out.push({ kind: 'task', id: l.taskId, title: `${taskTitle.get(l.taskId) || '任务'} ← ${resTitle.get(l.resourceId) || '资源'}`, icon: '🔗', tag: '任务↔资源关联', n: 1, time: hm(l.createdAt) })
    }
  }
  for (const t of d.tasks || []) {
    for (const s of t.subtasks || []) {
      if (s && s.done && s.doneAt && dayOfTs(s.doneAt) === props.day) {
        out.push({ kind: 'task', id: t.id, title: `${t.title} · ${s.title}`, icon: '☑', tag: '子任务完成', n: 1, time: hm(s.doneAt) })
      }
    }
  }
  return out.sort((a, b) => (a.time || '').localeCompare(b.time || ''))
})

/** 四列得分：一律从当日事件现算（见文件头注释） */
const scores = computed(() => {
  const creates = dayEvents.value.filter(e => e.action === 'create')
  const scCreate = creates.reduce((s, e) => s + (e.kind === 'resource' ? W.cRes : e.kind === 'curiosity' ? W.cCurio : W.cTask), 0)
  const calls = dayEvents.value.filter(e => e.action === 'call')
  const seen = new Set<string>()
  const scCall = calls.reduce((s, e) => { const first = !seen.has(e.cardId); seen.add(e.cardId); return s + (first ? W.call : W.call * 0.5) }, 0)
  const scStatus = dayEvents.value.filter(e => e.action === 'status').reduce((s, e) => s + statusW(e.kind as CardKind, e.to), 0)
  const scDeliver = deliverRows.value.reduce((s, r) => s + (r.tag === '子任务完成' ? W.subtask : r.tag === '三件事完成' ? W.focus : W.link), 0)
  return { create: scCreate, call: scCall, status: scStatus, deliver: scDeliver }
})

const metrics = computed(() => {
  const r = rec.value
  const cN = r.c.res + r.c.curio + r.c.task
  const sN = r.s.curio + r.s.task
  const dN = deliverRows.value.length
  return [
    { k: 'create' as const, h: '采集', n: cN, u: '张', sc: scores.value.create, bd: `资源 ${r.c.res} · 好奇 ${r.c.curio} · 任务 ${r.c.task}`, rows: createRows.value, total: cN },
    { k: 'call' as const, h: '调出', n: r.u, u: '次', sc: scores.value.call, bd: '资源 / 任务 / 好奇 合计', rows: callRows.value, total: r.u },
    { k: 'status' as const, h: '状态变更', n: sN, u: '次', sc: scores.value.status, bd: `好奇 ${r.s.curio} · 任务 ${r.s.task}`, rows: statusRows.value, total: sN },
    { k: 'deliver' as const, h: '推进成果', n: dN, u: '项', sc: scores.value.deliver, bd: `子任务 ${r.sub} · 三件事 ${r.focus} · 关联 ${r.link}`, rows: deliverRows.value, total: dN }
  ]
})
const cur = computed(() => metrics.value.find(m => m.k === sel.value)!)

const dl = computed(() => deltaOf(props.stats, props.day))
const st = computed(() => stockAt(props.stats, props.day, props.liveLink))
const wd = computed(() => WD[(new Date(props.day.replace(/-/g, '/')).getDay() + 6) % 7])

/** 当日流水（F16）：倒序 + 动作徽标；总数与 zy_event_log 当日明细一致 */
const flow = computed(() => [...dayEvents.value].sort((a, b) => b.ts - a.ts))
</script>

<template>
  <div class="dz-day">
    <div class="dz-day-head">
      <span class="d">{{ day }}</span><span class="w">周{{ wd }}</span>
      <span class="dz-badge" :class="{ hi: ['冲刺', '满格'].includes(lv) }" :title="levelDesc(rec.w)">
        {{ lv }} · 强度 {{ Math.min(100, Math.round(rec.w / 55 * 100)) }}
      </span>
      <span class="dz-badge">加权 {{ rec.w }} 分 · {{ levelRange(rec.w) }}</span>
      <span class="dz-badge">有效动作 {{ actsOf(rec) }} 件</span>
      <span class="dz-sp"></span>
      <button class="dz-btn ghost sm" @click="emit('close')">收起 ×</button>
    </div>

    <div class="dz-hintline">▸ 点击下方任一指标 → 展开该类<b>内容卡片</b>；卡片<b>单击看详情</b> · <b>双击直达链接</b>（与资源台 / 任务中心一致）</div>

    <div class="dz-mcols">
      <button v-for="m in metrics" :key="m.k" class="dz-mcol" :class="{ on: sel === m.k }" @click="sel = m.k">
        <div class="h"><span class="dot"></span>{{ m.h }}<span class="go">{{ sel === m.k ? '▾ 已展开' : '▸' }}</span></div>
        <div class="n">{{ m.n }}<small>{{ m.u }}</small></div>
        <div class="sc">{{ m.sc.toFixed(1) }} 分</div>
        <div class="bd">{{ m.bd }}</div>
      </button>
    </div>

    <div class="dz-dstock">
      <div class="t">📦 <b>该日库容变化</b> —— 截至 {{ day }} 库容：总 <b>{{ st.total.toLocaleString() }}</b> 张
        <span style="color:var(--text-4)">（资源 {{ st.res }} · 任务 {{ st.task }} · 好奇 {{ st.curio }} · 链接 {{ st.link }}）</span></div>
      <div class="row">
        <span class="it"><span class="k">当天入台</span><span class="v up">+{{ dl.add }}</span></span>
        <span class="it"><span class="k">当天移出</span><span class="v" :class="{ dn: dl.del > 0 }">{{ dl.del ? '-' + dl.del : '0' }}</span></span>
        <span style="width:1px;background:var(--border)"></span>
        <span class="it"><span class="k">资源</span><span class="v" :class="dl.res > 0 ? 'up' : dl.res < 0 ? 'dn' : ''">{{ dl.res > 0 ? '+' : '' }}{{ dl.res }}</span></span>
        <span class="it"><span class="k">任务</span><span class="v" :class="dl.task > 0 ? 'up' : dl.task < 0 ? 'dn' : ''">{{ dl.task > 0 ? '+' : '' }}{{ dl.task }}</span></span>
        <span class="it"><span class="k">好奇</span><span class="v" :class="dl.curio > 0 ? 'up' : dl.curio < 0 ? 'dn' : ''">{{ dl.curio > 0 ? '+' : '' }}{{ dl.curio }}</span></span>
        <span class="it"><span class="k">链接</span><span class="v">±0</span></span>
      </div>
    </div>

    <DrillCardList :rows="cur.rows" :label="cur.h" :total="cur.total" plain />

    <div class="dz-tl">
      <div class="th">当日原始记录流水（倒序）<span class="dz-sp"></span>
        <span style="color:var(--text-4)">共 {{ flow.length }} 条 · 明细来自 zy_event_log</span>
        <button class="dz-btn sm" @click="emit('open-log', day)">查看全部记录 ›</button>
      </div>
      <div v-if="!flow.length" class="dz-row"><span class="ti" style="color:var(--text-3)">当天无记录</span></div>
      <div v-for="e in flow" :key="e.id" class="row">
        <span class="tm">{{ hm(e.ts) }}</span>
        <span class="ac">{{ EVENT_ACT_LABEL[e.action] }}</span>
        <span class="ti">{{ e.title }}</span>
        <span class="pt"></span>
      </div>
    </div>
  </div>
</template>
