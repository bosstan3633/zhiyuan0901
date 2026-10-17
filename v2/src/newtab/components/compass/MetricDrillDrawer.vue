<script setup lang="ts">
/**
 * R51-F14/F15/F17 指标下钻右侧抽屉：四格各自明细 + 条目点击定位
 * - dhi：各战略目标行（主攻/在轨/推进）→ 定位主航线对应行（闪烁高亮）
 * - wce：激活好奇项清单 → 跳调度台好奇心培育定位（route.query.hl）
 * - wrr：周期内调出资源 → 跳所属策展台定位（query.hl）
 * - unarch：未归档任务清单（口径同 NorthStarPanel O23）→ 就地级联归档 + 跳任务调度定位
 */
import Icon from '@/shared/components/Icon.vue'
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import Drawer from '@/shared/components/Drawer.vue'
import { useCompass } from '../../stores/compass'
import { useAppStore } from '../../stores/app'
import { resourceLocateRoute } from '@/shared/utils/locate'
import { showToast } from '@/shared/components/toast'

const props = defineProps<{ cell: '' | 'dhi' | 'wce' | 'wrr' | 'unarch'; period: 'day' | 'week' | 'all' }>()
const emit = defineEmits<{ close: [] }>()
const { d, taskArchiveIssue, unarchivedTaskCount } = useCompass()
const store = useAppStore()
const router = useRouter()

const titles = { dhi: '战略目标 / 推进项目 · 明细', wce: 'WCE 好奇探索 · 明细', wrr: 'WRR 资源复用 · 明细', unarch: '未归档任务 · 待归档清单' } as const
const periodLabel = computed(() => (props.period === 'day' ? '今日' : props.period === 'week' ? '本周' : '累计'))

/** 周期起点 */
const windowStart = computed(() => {
  const now = Date.now()
  if (props.period === 'day') { const s = new Date(); s.setHours(0, 0, 0, 0); return s.getTime() }
  if (props.period === 'week') return now - 7 * 86400_000
  return 0
})

/** 方向状态明细（R64 口径）：各战略目标 → 项目数 / 推进中项目数（挂有非软删任务即推进） */
const dhiRows = computed(() => {
  return d.value.compass.directions.filter(dir => dir.status !== 'archived').map((dir) => {
    const projs = dir.projects.filter(p => p.status !== 'archived')
    const pushing = projs.filter(p => d.value.tasks.some(t => !t.deletedAt && t.projectId === p.id)).length
    return { id: dir.id, name: dir.name, pinned: projs.length, active: pushing, pct: projs.length ? Math.round((pushing / projs.length) * 100) : 0 }
  })
})

/** WCE：激活好奇项（探索中/已求证） */
const wceRows = computed(() => {
  const list = d.value.curiosities
    .filter(c => !c.deletedAt && (c.status === 'doing' || c.status === 'done'))
    .slice()
    .sort((a, b) => b.updatedAt - a.updatedAt)
  const newInPeriod = list.filter(c => c.createdAt >= windowStart.value).length
  return { list, newInPeriod }
})

/** WRR：周期内被打开的资源（按最近打开降序） */
const wrrRows = computed(() => {
  return d.value.resources
    .filter(r => !r.deletedAt && (r.lastCalledAt || 0) >= windowStart.value)
    .slice()
    .sort((a, b) => (b.lastCalledAt || 0) - (a.lastCalledAt || 0))
})

/** 未归档任务（口径同 NorthStarPanel O23） */
const unarchRows = computed(() => d.value.tasks.filter(t => !t.deletedAt && taskArchiveIssue(t)))

function metricsOf(projectId: string) {
  for (const dir of d.value.compass.directions) {
    const p = dir.projects.find(x => x.id === projectId)
    if (p) return p.metrics
  }
  return []
}
function changeTaskProject(taskId: string, e: Event) {
  const t = d.value.tasks.find(x => x.id === taskId)
  if (!t) return
  const v = (e.target as HTMLSelectElement).value
  t.projectId = v || undefined
  if (!v) t.metricId = undefined
  t.updatedAt = Date.now()
  store.persist()
}
function changeTaskMetric(taskId: string, e: Event) {
  const t = d.value.tasks.find(x => x.id === taskId)
  if (!t) return
  const v = (e.target as HTMLSelectElement).value
  t.metricId = v || undefined
  for (const dir of d.value.compass.directions) for (const p of dir.projects) for (const m of p.metrics) {
    if (m.taskIds.includes(t.id) && m.id !== v) m.taskIds = m.taskIds.filter(id => id !== t.id)
  }
  if (v) {
    const pm = metricsOf(t.projectId || '').find(x => x.id === v)
    if (pm && !pm.taskIds.includes(t.id)) pm.taskIds.push(t.id)
  }
  t.updatedAt = Date.now()
  store.persist()
}
/** 就地级联归档的项目选项 */
const projOptions = computed(() => {
  const list: { id: string; name: string }[] = []
  for (const dir of d.value.compass.directions) for (const p of dir.projects) list.push({ id: p.id, name: p.name })
  return list
})

/** 定位 */
const fmtDay = (ts?: number) => (ts ? new Date(ts).toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' }) : '—')
function locateGoal(dirId: string) {
  emit('close')
  // R3-B1：原 `zy-locate-goal` 窗口事件只有主航线在听，而主航线住在 /compass、本抽屉挂在调度台首页
  // ——**在 / 上点「定位」什么都不会发生**（既没跳转也没有监听者）。改走与 locateCurio 同一条深链口径，
  // 由方向台的 ?hl 消费者滚动 + 闪烁，事件链整条退役。
  router.push({ path: '/compass', query: { hl: dirId } })
}
function locateCurio(id: string) {
  emit('close')
  router.push({ path: '/', query: { hl: id } })
}
/**
 * R4-Dk：资源卡定位落点改走唯一算式 `resourceLocateRoute`。
 * 改前这里自己拼 `/workspace/${wsId}`，而 V3.7.0 起资源卡真身默认住隐藏池——
 * 于是「指标下钻 → 点击佐证行」对**池卡**（今天的常态）恒落 `workspace/zy-curation`：
 * 存量库里渲染出一枚看不到这张卡的退役「资源台」台面，没有 hub 实体的库里是「策展台不存在」。
 * ★locate.ts 的注释早写明 R2-④「漏了这个共享算式本身，修在算式里一次修完所有调用点」——
 *   但本函数没接进算式，就是那个"所有调用点"里漏掉的第五个。兜底 `store.workspaces[0]` 同删：
 *   卡不在库里就不该跳去别人的台（与 locateCard 的 null 语义一致）。
 */
function locateRes(id: string) {
  const r = d.value.resources.find(v => v.id === id)   // 与 locateTargetOf 同口径：只有整张卡不在库里才算取不到（软删卡仍在库，只是住回收站）
  emit('close')
  if (!r) { showToast('这张卡已不在库里'); return }
  const t = resourceLocateRoute(r.workspaceId, r.categoryId || '')
  router.push({ path: t.path, query: { ...t.query, hl: id } })
}
function locateTask(id: string) {
  emit('close')
  // R117（04-61 C1）：任务调度面板已迁调度台底部 tab（与好奇心培育并列）⇒ 定位改为
  // 「调度台 + 切任务 tab + 高亮目标任务」；原 /compass?zone=task 随模块搬迁失效。
  router.push({ path: '/', query: { hl: id, hk: 'task' } })
}
</script>

<template>
  <Drawer :open="!!cell" :title="cell ? `${titles[cell]}（${periodLabel}）` : ''" width="520px" @close="emit('close')">
    <!-- 战略目标行明细（R70：原 DHI 口径已于 R64 退役） -->
    <template v-if="cell === 'dhi'">
      <div class="md-list">
        <div v-for="row in dhiRows" :key="row.id" class="md-row clickable" title="点击定位到主航线对应行" @click="locateGoal(row.id)">
          <div class="md-main">
            <span class="md-title"><Icon name="target" :size="13"/> {{ row.name }}</span>
            <span class="md-sub"><Icon name="package" :size="13"/> 项目 {{ row.pinned }} · 推进中 {{ row.active }}</span>
          </div>
          <div class="md-right">
            <span class="md-pct" :class="{ warn: row.pinned && row.pct < 50 }">{{ row.pct }}%</span>
            <span class="md-go">定位 ›</span>
          </div>
        </div>
        <div v-if="!dhiRows.length" class="md-empty">暂无战略目标——去完整方向树创建</div>
      </div>
      <div class="md-tip">推进中 = 该项目下挂有任务（任务数 ≠ 0）。点击行定位到主航线对应战略目标。</div>
    </template>

    <!-- WCE：激活好奇项 -->
    <template v-else-if="cell === 'wce'">
      <div class="md-head-count">{{ wceRows.list.length }} 项激活 · {{ periodLabel }}新增 {{ wceRows.newInPeriod }}</div>
      <div class="md-list">
        <div v-for="c in wceRows.list" :key="c.id" class="md-row clickable" title="点击定位到调度台好奇心培育卡" @click="locateCurio(c.id)">
          <div class="md-main">
            <span class="md-title"><Icon v-if="c.status === 'done'" name="checksquare" :size="14"/><Icon v-else name="search" :size="14"/> {{ c.question || '（无标题）' }}</span>
            <span class="md-sub">捕获 {{ fmtDay(c.createdAt) }}</span>
          </div>
          <span class="md-go">定位 ›</span>
        </div>
        <div v-if="!wceRows.list.length" class="md-empty">暂无激活的好奇心——去调度台捕获</div>
      </div>
      <div class="md-tip">R127 起 WCE = 好奇卡「创建 + 状态变更 + 删除」的事件数（主数字）；此清单为当前激活好奇项（探索中/已求证），点击行跳转定位。</div>
    </template>

    <!-- WRR：调出资源 -->
    <template v-else-if="cell === 'wrr'">
      <div class="md-head-count">{{ wrrRows.length }} 张资源被打开</div>
      <div class="md-list">
        <div v-for="r in wrrRows" :key="r.id" class="md-row clickable" title="点击定位到资源卡所在策展台" @click="locateRes(r.id)">
          <div class="md-main">
            <span class="md-title"><Icon name="link" :size="13"/> {{ r.title }}</span>
            <span class="md-sub">最近打开 {{ fmtDay(r.lastCalledAt) }} · 累计 {{ r.callCount || 0 }} 次</span>
          </div>
          <span class="md-go">定位 ›</span>
        </div>
        <div v-if="!wrrRows.length" class="md-empty">{{ periodLabel }}没有资源被打开</div>
      </div>
      <div class="md-tip">WRR = 资源卡被打开次数。点击行跳转所属策展台并定位卡片。</div>
    </template>

    <!-- 未归档任务 -->
    <template v-else-if="cell === 'unarch'">
      <div class="md-list">
        <div v-for="t in unarchRows" :key="t.id" class="md-task">
          <div class="md-row">
            <div class="md-main">
              <span class="md-title clickable" title="点击定位到调度台任务调度" @click="locateTask(t.id)"><Icon name="filetext" :size="13"/> {{ t.title }}</span>
              <span class="md-sub warn">{{ taskArchiveIssue(t) }}</span>
            </div>
          </div>
          <div class="md-task-links">
            <select class="md-select" :value="t.projectId || ''" @change="changeTaskProject(t.id, $event)">
              <option value=""><Icon name="package" :size="13"/> 未关联项目</option>
              <option v-for="p in projOptions" :key="p.id" :value="p.id"><Icon name="package" :size="13"/> {{ p.name }}</option>
            </select>
            <select class="md-select" :value="t.metricId || ''" :disabled="!t.projectId" @change="changeTaskMetric(t.id, $event)" title="关联成功指标后即完成归档">
              <option value=""><Icon name="target" :size="13"/> 未关联指标</option>
              <option v-for="m in metricsOf(t.projectId || '')" :key="m.id" :value="m.id"><Icon name="target" :size="13"/> {{ m.title }}</option>
            </select>
          </div>
        </div>
        <div v-if="!unarchRows.length" class="md-empty"><Icon name="star" :size="13"/> 没有未归档任务——所有任务都已挂到成功指标</div>
      </div>
      <div class="md-tip">未归档 = 未挂项目/指标或引用失效的任务。选项目›选指标即完成归档，任务即时从清单消失。点击标题跳任务调度定位。</div>
    </template>
  </Drawer>
</template>

<style scoped>
.md-head-count { font-size: var(--fs-sub); color: var(--text-2); margin-bottom: 10px; }
.md-list { display: flex; flex-direction: column; gap: 6px; }
.md-row { display: flex; align-items: center; gap: 10px; padding: 10px 12px; background: var(--surface-2); border: 1px solid var(--border); border-radius: 10px; }
.md-row.clickable { cursor: pointer; transition: all var(--dur-fast); }
.md-row.clickable:hover { border-color: var(--accent); background: var(--surface-3); }
.md-main { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px; }
.md-title { font-size: var(--fs-body); font-weight: 600; color: var(--text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.md-title.clickable:hover { color: var(--accent); }
.md-sub { font-size: var(--fs-caption); color: var(--text-3); }
.md-sub.warn { color: var(--tag-warn-text); }
.md-right { display: flex; align-items: center; gap: 10px; flex-shrink: 0; }
.md-pct { font-size: var(--fs-title); font-weight: 700; color: var(--success); font-variant-numeric: tabular-nums; }
.md-pct.warn { color: var(--tag-warn-text); }
.md-go { font-size: var(--fs-sub); color: var(--text-3); flex-shrink: 0; }
.md-row.clickable:hover .md-go { color: var(--accent); }
.md-empty { text-align: center; padding: 30px 10px; font-size: var(--fs-body); color: var(--text-3); }
.md-tip { margin-top: 14px; font-size: var(--fs-caption); color: var(--text-3); line-height: 1.7; background: var(--surface-2); border-radius: 8px; padding: 10px 12px; }
.md-task { display: flex; flex-direction: column; gap: 6px; padding: 10px 12px; background: var(--surface-2); border: 1px solid var(--border); border-radius: 10px; }
.md-task .md-row { padding: 0; background: transparent; border: none; }
.md-task-links { display: flex; gap: 8px; }
.md-select { flex: 1; min-width: 0; padding: 7px 10px; background: var(--surface); border: 1px solid var(--border); border-radius: 8px; font-size: var(--fs-sub); color: var(--text); outline: none; cursor: pointer; font-family: inherit; }
.md-select:focus { border-color: var(--accent); }
</style>
