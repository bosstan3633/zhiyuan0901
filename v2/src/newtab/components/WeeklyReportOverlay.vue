<script setup lang="ts">
/**
 * R111 · 调度画像周报全屏浮层（04-58 方向③）
 * - 四段式：调度总览（4 大数字+环比）/ 方向活跃度 / 资源调用 TOP 5 / 好奇心转化漏斗 + 💡洞察
 * - 全部数字可下钻：emit('drill', ReportDrillEvent) 由宿主（调度台）执行定位/跳转
 * - 本周 / 上周切换；ESC 关闭；全屏浮层（fixed inset 0）
 */
import { ref, watch, nextTick, onMounted, onUnmounted, defineAsyncComponent, shallowRef } from 'vue'
import { useAppStore } from '../stores/app'
import { readEventLog } from '@/shared/utils/eventLog'
import { buildWeeklyReport, weekWindow, type ReportPeriod, type ReportDrillEvent, type WeeklyReport } from '@/shared/utils/weeklyReport'
import { showToast } from '@/shared/components/toast'

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{
  (e: 'close'): void
  (e: 'drill', ev: ReportDrillEvent): void
}>()

const store = useAppStore()
const period = ref<ReportPeriod>(0)
const report = ref<WeeklyReport | null>(null)
const loading = ref(false)
const rootRef = ref<HTMLDivElement | null>(null)

const periodLabel = ref('')

async function rebuild() {
  if (!props.open) return
  loading.value = true
  try {
    const events = await readEventLog()
    report.value = buildWeeklyReport(store.data!, events.map(e => ({ ts: e.ts, action: e.action, kind: e.kind })), period.value)
    periodLabel.value = weekWindow(period.value).label
  } finally {
    loading.value = false
  }
}

watch(() => props.open, (v) => {
  if (v) {
    period.value = 0
    nextTick(rebuild)
    setTimeout(() => rootRef.value?.focus(), 60)
  }
})
watch(period, rebuild)

function setPeriod(p: ReportPeriod) { period.value = p }
function onEsc(e: KeyboardEvent) {
  if (e.key === 'Escape' && props.open) { e.preventDefault(); emit('close') }
}
onMounted(() => document.addEventListener('keydown', onEsc, true))
onUnmounted(() => document.removeEventListener('keydown', onEsc, true))

function deltaText(o: { delta: number; up: boolean; prev: number }): string {
  if (!o.prev && !o.delta) return '—'
  return (o.delta >= 0 ? '↑ ' : '↓ ') + Math.abs(o.delta) + ' vs 上周'
}
function drillOverview(key: 'created' | 'called' | 'done' | 'unarchived') {
  emit('close')
  emit('drill', { kind: key })
}
function drillDirection(dirId: string) {
  emit('close')
  emit('drill', { kind: 'direction', dirId })
}
function drillTop(id: string, workspaceId: string) {
  emit('close')
  emit('drill', { kind: 'top-card', cardId: id, workspaceId })
}
function drillFunnel(stage: string) {
  emit('close')
  emit('drill', { kind: 'funnel', stage })
}
// ---- R139-#6：深度洞察（AI 懒栈：点击时才 dynamic import，评审抽屉采纳=存资源卡） ----
const AiDrawer = defineAsyncComponent(() => import('@/newtab/components/AiSuggestionDrawer.vue'))
const aiJob = shallowRef<import('@/shared/ai/job').AiJob | null>(null)
async function aiInsight() {
  const [{ loadAiConfig, aiReady, aiConfig }, { buildInsightJob }] = await Promise.all([import('@/shared/ai/config'), import('@/shared/ai/select')])
  await loadAiConfig()
  if (!aiReady.value) { showToast('请先在 设置 → AI 助手 完成接入（地址/Key/模型）'); return }
  if (!store.data) return
  const job = buildInsightJob({ d: store.data, depth: aiConfig.value.depth, persist: () => store.persist() })
  if (!job) { showToast('⚠ 近 7 天台账还是空的，先推进点实事再来洞察'); return }
  aiJob.value = job
}
</script>

<template>
  <Teleport to="body">
    <Transition name="wr-fade">
      <div v-if="open" ref="rootRef" class="wr-overlay" tabindex="-1" @click.self="emit('close')">
        <div class="wr-shell">
          <div class="wr-head">
            <span class="wr-title">📊 调度画像</span>
            <span class="wr-period">{{ periodLabel }}</span>
            <button class="wr-ai" title="AI 深度洞察：只体检投入与重心（近 7 天台账），采纳=存资源卡" @click="aiInsight">🤖 深度洞察</button>
            <div class="wr-switch">
              <button class="wr-sw" :class="{ on: period === 0 }" @click="setPeriod(0)">本周</button>
              <button class="wr-sw" :class="{ on: period === -1 }" @click="setPeriod(-1)">上周</button>
            </div>
            <button class="wr-close" title="关闭（Esc）" @click="emit('close')">×</button>
          </div>

          <div class="wr-body" v-if="report">
            <!-- ① 调度总览 -->
            <div class="wr-sec">
              <div class="wr-sec-title">① 调度总览 <span class="wr-hint">点击数字下钻</span></div>
              <div class="wr-bignums">
                <div class="wr-bn clickable" title="本周入台卡片明细" @click="drillOverview('created')">
                  <div class="num">{{ report.overview[0].num }}</div><div class="lbl">入台卡片</div>
                  <div class="trend" :class="report.overview[0].up ? 'up' : 'down'">{{ deltaText(report.overview[0]) }}</div>
                </div>
                <div class="wr-bn clickable" title="本周被调用的资源 · 点击下钻" @click="drillOverview('called')">
                  <div class="num">{{ report.overview[1].num }}</div><div class="lbl">资源调用</div>
                  <div class="trend" :class="report.overview[1].up ? 'up' : 'down'">{{ deltaText(report.overview[1]) }}</div>
                </div>
                <div class="wr-bn clickable" title="本周完成任务 · 点击下钻" @click="drillOverview('done')">
                  <div class="num">{{ report.overview[2].num }}</div><div class="lbl">完成任务</div>
                  <div class="trend" :class="report.overview[2].up ? 'up' : 'down'">{{ deltaText(report.overview[2]) }}</div>
                </div>
                <div class="wr-bn clickable" title="未归档任务 · 点击去归档" @click="drillOverview('unarchived')">
                  <div class="num" :class="{ warn: report.overview[3].num > 0 }">{{ report.overview[3].num }}</div><div class="lbl">未归档</div>
                  <div class="trend">{{ deltaText(report.overview[3]) }}</div>
                </div>
              </div>
            </div>

            <!-- ② 方向活跃度 -->
            <div class="wr-sec">
              <div class="wr-sec-title">② 方向活跃度（{{ report.window.label }}任务完成）<span class="wr-hint">点击方向查看</span></div>
              <div class="wr-bars">
                <div v-for="b in report.directionBars" :key="b.dirId" class="wr-bar-row clickable" :title="'查看方向：' + b.name" @click="drillDirection(b.dirId)">
                  <span class="name">{{ b.name }}</span>
                  <div class="bar-wrap"><div class="bar" :style="{ width: (report.directionBars[0]?.done ? (b.done / report.directionBars[0].done) * 100 : 0) + '%' }">{{ b.done || '' }}</div></div>
                </div>
                <div v-if="!report.directionBars.length" class="wr-empty">暂无战略目标——去方向台创建</div>
              </div>
            </div>

            <!-- ③ 资源调用 TOP 5 -->
            <div class="wr-sec">
              <div class="wr-sec-title">③ 资源调用 TOP 5 <span class="wr-hint">点击卡片定位</span></div>
              <div class="wr-top5">
                <div v-for="(t, i) in report.topCalled" :key="t.id" class="wr-top-item clickable" :title="'定位到卡片：' + t.title" @click="drillTop(t.id, t.workspaceId)">
                  <span class="rank">{{ i + 1 }}</span><span class="title">{{ t.title }}</span>
                  <div class="mini-bar"><i :style="{ width: (report.topCalled[0]?.callCount ? (t.callCount / report.topCalled[0].callCount) * 100 : 0) + '%' }"></i></div>
                  <span class="fire">🔥 {{ t.callCount }}</span>
                </div>
                <div v-if="!report.topCalled.length" class="wr-empty">本周暂无资源调用——Ctrl+K 把收藏变成生产力</div>
              </div>
            </div>

            <!-- ④ 好奇心转化漏斗 -->
            <div class="wr-sec">
              <div class="wr-sec-title">④ 好奇心转化漏斗 <span class="wr-hint">点击阶段查看</span></div>
              <div class="wr-funnel">
                <template v-for="(st, i) in report.funnel" :key="st.key">
                  <div class="stage clickable" :class="st.key" :title="'查看' + st" @click="drillFunnel(st.key)">
                    <div class="n">{{ st.num }}</div><div class="l">{{ ['好奇心总量', '待探索', '探索中', '已转为任务'][i] }}</div>
                  </div>
                  <div v-if="i < report.funnel.length - 1" class="funnel-arrow">
                    ↓ <template v-if="i === report.funnel.length - 2">转化率 {{ report.conversionRate }}%</template>
                  </div>
                </template>
              </div>
            </div>

            <!-- ⑤ 洞察 -->
            <div class="wr-sec">
              <div class="wr-sec-title">💡 洞察</div>
              <div v-for="(it, i) in report.insights" :key="i" class="wr-insight">{{ it.text }}</div>
            </div>
          </div>
          <div v-else class="wr-loading">{{ loading ? '统计中…' : '' }}</div>

          <div class="wr-foot">纯读取统计 · 数据不出本机（🤖 洞察需你手动触发才走你配置的网关）· Esc 关闭</div>
        </div>
      </div>
    </Transition>
    <!-- R139-#6：深度洞察评审抽屉（置于 Transition 外保单子节点约束；勾选采纳才落库） -->
    <AiDrawer v-if="aiJob" :job="aiJob" @close="aiJob = null" />
  </Teleport>
</template>

<style scoped>
.wr-overlay { position: fixed; inset: 0; z-index: 190; background: rgba(0,0,0,.72); display: flex; align-items: center; justify-content: center; padding: 28px; outline: none; } /* R139：190 让开抽屉层（201），深度洞察抽屉才浮在周报上 */
.wr-shell { width: min(880px, 94vw); max-height: 92vh; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); box-shadow: var(--shadow-lg); display: flex; flex-direction: column; overflow: hidden; }
.wr-head { display: flex; align-items: center; gap: 12px; padding: 12px 18px; border-bottom: 1px solid var(--border); }
.wr-title { font-size: 14px; font-weight: 700; color: var(--text); flex-shrink: 0; }
.wr-period { font-size: 11px; color: var(--text-3); flex: 1; }
.wr-switch { display: flex; border: 1px solid var(--border); border-radius: 8px; overflow: hidden; }
.wr-ai { padding: 4px 12px; font-size: 11.5px; border: 1px solid var(--border); border-radius: 8px; background: var(--surface-2); color: var(--text-2); cursor: pointer; font-family: inherit; flex-shrink: 0; transition: all var(--dur); }
.wr-ai:hover { border-color: var(--accent); color: var(--accent); background: var(--accent-light); }
.wr-sw { padding: 4px 14px; font-size: 11.5px; color: var(--text-2); cursor: pointer; background: var(--surface); border: none; font-family: inherit; }
.wr-sw + .wr-sw { border-left: 1px solid var(--border); }
.wr-sw.on { background: var(--accent-light); color: var(--accent); font-weight: 600; }
.wr-close { width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; border-radius: 6px; cursor: pointer; color: var(--text-3); font-size: 17px; background: transparent; border: none; }
.wr-close:hover { background: var(--surface-3); color: var(--text); }
.wr-body { flex: 1; overflow-y: auto; padding: 14px 18px 18px; }
.wr-loading { padding: 60px; text-align: center; color: var(--text-3); }
.wr-foot { padding: 8px 18px; border-top: 1px solid var(--border); font-size: 10.5px; color: var(--text-4); }

.wr-sec { margin-bottom: 16px; }
.wr-sec-title { font-size: 11.5px; font-weight: 700; color: var(--text-2); margin-bottom: 8px; letter-spacing: .4px; }
.wr-hint { font-weight: 400; color: var(--text-4); margin-left: 6px; }
.wr-empty { font-size: 11.5px; color: var(--text-4); padding: 10px 4px; }

.wr-bignums { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
.wr-bn { background: var(--surface-2); border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 10px 12px; text-align: left; }
.wr-bn.clickable { cursor: pointer; transition: all var(--dur-fast); }
.wr-bn.clickable:hover { border-color: var(--accent); background: var(--accent-light); }
.wr-bn .num { font-size: 22px; font-weight: 700; color: var(--text); font-variant-numeric: tabular-nums; line-height: 1.2; }
.wr-bn .num.warn { color: var(--tag-warn-text); }
.wr-bn .lbl { font-size: 10.5px; color: var(--text-3); margin-top: 1px; }
.wr-bn .trend { font-size: 10px; margin-top: 3px; }
.wr-bn .trend.up { color: var(--success); }
.wr-bn .trend.down { color: var(--tag-warn-text); }

.wr-bars { display: flex; flex-direction: column; gap: 6px; }
.wr-bar-row { display: flex; align-items: center; gap: 10px; }
.wr-bar-row.clickable { cursor: pointer; border-radius: 6px; padding: 2px 6px; transition: background var(--dur-fast); }
.wr-bar-row.clickable:hover { background: var(--surface-2); }
.wr-bar-row .name { width: 180px; font-size: 11.5px; color: var(--text-2); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; flex-shrink: 0; text-align: right; }
.bar-wrap { flex: 1; height: 14px; background: var(--surface-2); border-radius: 4px; overflow: hidden; }
.bar { height: 100%; background: var(--accent); border-radius: 4px; color: #fff; font-size: 10px; display: flex; align-items: center; justify-content: flex-end; padding-right: 5px; min-width: 14px; }

.wr-top5 { display: flex; flex-direction: column; gap: 4px; }
.wr-top-item { display: flex; align-items: center; gap: 8px; padding: 5px 8px; border-radius: 6px; }
.wr-top-item.clickable { cursor: pointer; transition: background var(--dur-fast); }
.wr-top-item.clickable:hover { background: var(--surface-2); }
.wr-top-item .rank { font-size: 11px; font-weight: 700; color: var(--text-3); width: 14px; text-align: center; flex-shrink: 0; }
.wr-top-item .title { font-size: 12px; color: var(--text-2); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 40%; }
.mini-bar { flex: 1; height: 6px; background: var(--surface-2); border-radius: 3px; overflow: hidden; }
.mini-bar i { display: block; height: 100%; background: var(--accent); opacity: .7; border-radius: 3px; }
.wr-top-item .fire { font-size: 11px; color: var(--tag-warn-text); flex-shrink: 0; font-variant-numeric: tabular-nums; }

.wr-funnel { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.stage { border-radius: var(--radius-sm); padding: 10px 14px; text-align: center; background: var(--surface-2); border: 1px solid var(--border); min-width: 110px; }
.stage .n { font-size: 18px; font-weight: 700; color: var(--text); }
.stage .l { font-size: 10px; color: var(--text-3); margin-top: 1px; }
.stage.clickable { cursor: pointer; transition: all var(--dur-fast); }
.stage.clickable:hover { border-color: var(--accent); }
.funnel-arrow { font-size: 11px; color: var(--text-4); }

.wr-insight { font-size: 12px; color: var(--text-2); background: var(--surface-2); border-left: 3px solid var(--accent); border-radius: 0 var(--radius-xs) var(--radius-xs) 0; padding: 8px 12px; margin-bottom: 6px; line-height: 1.6; }

.wr-fade-enter-active, .wr-fade-leave-active { transition: opacity .18s; }
.wr-fade-enter-from, .wr-fade-leave-to { opacity: 0; }

@media (max-width: 900px) {
  .wr-bignums { grid-template-columns: repeat(2, 1fr); }
  .wr-bar-row .name { width: 110px; }
}
</style>
