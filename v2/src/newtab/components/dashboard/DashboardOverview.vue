<script setup lang="ts">
/**
 * R172-T5（04-66 §四 / §5.2 / 04-67 F1~F6）：概览带 —— 存量快照 + 人话总结 + 参照系行 + 分数口径表。
 *
 * 三层可读性（04-66 §4.2）是本组件的存在理由：
 *   L1 主数字用人话量（有效动作件数），加权分降为副行  → 用户能想象"412 件事"，想象不了"3064 分"
 *   L2 档位语义名（静默/轻触/…）而非 L1~L5 裸代号
 *   L3 每个数字配参照系（等长窗口环比 + P 分位 + 年度排名）
 *
 * ★ 时间绑定（Q11 拍板）：`selDay` 非空时，5 张 chip 显示「截至那天的库容」+ 当日增减，
 *   流量（那天做了什么）与存量（库变成什么样）形成因果链。库容一律走 `zy_daily_stats` 前缀和
 *   （`stockBoundTo`），**不重扫全库**（04-67 §8.3 性能红线）。
 */
import './dashboard.css'
import { computed, ref } from 'vue'
import {
  W_ROWS, deltaOf, levelName, aggregateRange,
  type DailyStats
} from '@/shared/utils/dailyStats'
import { yearAgg, todayKey, pct, stockBoundTo } from '@/shared/utils/reviewReport'

const props = defineProps<{
  stats: DailyStats
  year: number
  /** 选中日（null = 未绑定，显示"截至今天"） */
  selDay: string | null
  /** 链接卡真实在库数（无事件源，按真实库传；见 dailyStats 文件头边界） */
  liveLink: number
  errorCount: number
}>()
const emit = defineEmits<{
  (e: 'clear-day'): void
  (e: 'open-cards', kind: 'all' | 'resource' | 'task' | 'curiosity' | 'link'): void
  (e: 'open-dyn', type: 'today-add' | 'week-add' | 'cum-del'): void
  (e: 'export-error'): void
}>()

const calibOn = ref(false)
/** 说明浮层悬停才显（R173-5）；`.dz-sec` 为圆角裁切默认 `overflow:hidden` —— 不临时放开会把浮层裁掉半截 */
const tipOn = ref(false)

/* ---------- 窗口工具（本地，避免为一个 addDays 让引擎多导一个内部函数） ---------- */
const pad2 = (n: number): string => String(n).padStart(2, '0')
function addDays(s: string, n: number): string {
  const d = new Date(s.replace(/-/g, '/'))
  d.setDate(d.getDate() + n)
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

const agg = computed(() => yearAgg(props.stats, props.year))
const boundDay = computed(() => props.selDay || agg.value.last)
const stock = computed(() => stockBoundTo(props.stats, props.selDay, props.liveLink))
const dayDelta = computed(() => (props.selDay ? deltaOf(props.stats, props.selDay) : null))

/** 5 张存量 chip（F1）；`dv` 为绑定态当日增减（未绑定时 null ⇒ 显示 —） */
const chips = computed(() => {
  const st = stock.value
  const d = dayDelta.value
  return [
    { k: '总卡片', v: st.total, dv: null as number | null, kind: 'all' as const },
    { k: '📇 资源卡', v: st.res, dv: d ? d.res : null, kind: 'resource' as const },
    { k: '✅ 任务卡', v: st.task, dv: d ? d.task : null, kind: 'task' as const },
    { k: '💡 好奇心卡', v: st.curio, dv: d ? d.curio : null, kind: 'curiosity' as const },
    { k: '🔗 链接卡', v: st.link, dv: null as number | null, kind: 'link' as const }
  ]
})

/** 人话总结（F3）——把孤立数字变成"读得懂"的一句；无数据时返回 null（模板走空态） */
const say = computed(() => {
  const a = agg.value
  if (!a.act || !a.peak) return null
  const mmdd = a.peak[0].slice(5).split('-')
  return {
    act: a.act, days: a.days, rate: Math.round((a.act / Math.max(1, a.days)) * 100),
    peakLabel: `${Number(mmdd[0])} 月 ${Number(mmdd[1])} 日`,
    peakLv: levelName(a.peak[1]), peakW: a.peak[1],
    perActive: Math.round(a.acts / Math.max(1, a.act)),
    steady: a.act / Math.max(1, a.days) >= 0.6
  }
})

/** 参照系行（F4）：环比一律**等长窗口**（近 N 天 vs 前 N 天），杜绝"部分月 vs 整月"假下跌 */
const meta = computed(() => {
  const a = agg.value
  const ref = props.year === Number(todayKey().slice(0, 4)) ? todayKey() : `${props.year}-12-31`
  const w30 = aggregateRange(props.stats, addDays(ref, -29), ref)
  const w30p = aggregateRange(props.stats, addDays(ref, -59), addDays(ref, -30))
  const w7 = aggregateRange(props.stats, addDays(ref, -6), ref)
  const w7p = aggregateRange(props.stats, addDays(ref, -13), addDays(ref, -7))
  const delTotal = Object.entries(props.stats.days)
    .filter(([k]) => k.startsWith(`${props.year}-`))
    .reduce((s, [, r]) => s + r.x.del, 0)
  return {
    acts: a.acts, W: Math.round(a.W),
    p30: pct(w30.W, w30p.W), p7: pct(w7.W, w7p.W),
    peakPill: a.peak && a.peak[1] >= a.p90 ? '90+' : a.peak && a.peak[1] >= a.p75 ? '75+' : '50',
    delTotal
  }
})

const fmtPct = (p: number | null): string => (p === null ? '—' : `${p >= 0 ? '+' : ''}${p}%`)
</script>

<template>
  <!-- R174-4：dz-sec-ov = 压缩版式（单行矮 chip + 紧行），热力图升首屏焦点（04-69 拍板 A） -->
  <section class="dz-sec dz-sec-ov" :class="{ 'dz-tip-open': tipOn }">
    <div class="dz-sec-h">
      <span class="dz-n">1</span><span class="dz-t">概览带</span><span class="dz-en">OVERVIEW</span>
      <span class="dz-sp"></span>
      <span class="dz-badge">截至 {{ boundDay }}{{ selDay ? '（所选日）' : '（今天）' }}</span>
      <button v-if="selDay" class="dz-btn sm ghost" title="解除绑定，回到「截至今天」" @click="emit('clear-day')">✕ 解除绑定</button>
      <button class="dz-btn sm ghost" @click="calibOn = !calibOn">⚖ 分数口径</button>
    </div>

    <div class="dz-sec-b">
      <div class="dz-ov">
        <div class="dz-ov-stock">
          <button v-for="c in chips" :key="c.k" class="dz-chip" :class="{ bind: !!selDay }"
            :title="`点击查看${c.k}明细`" @click="emit('open-cards', c.kind)">
            <span class="k">{{ c.k }}</span><b class="v">{{ c.v.toLocaleString() }}</b><span class="dl">
              <template v-if="c.dv === null">—</template>
              <template v-else-if="c.dv === 0">±0</template>
              <template v-else-if="c.dv > 0"><span class="up">+{{ c.dv }}</span></template>
              <template v-else><span class="dn">{{ c.dv }}</span></template>
            </span>
          </button>
        </div>

        <div class="dz-ov-meta">
          <span class="pill" title="口径：采集 + 调出 + 状态变更 + 推进的条数">有效动作 <b>{{ meta.acts.toLocaleString() }}</b> 件</span>
          <span class="pill" title="加权分是内部量，换算表见「⚖ 分数口径」">加权 <b>{{ meta.W }}</b> 分</span>
          <span class="pill" title="等长窗口：近 30 天 vs 前 30 天">近 30 天 vs 前 30 天 <span :class="(meta.p30 ?? 0) >= 0 ? 'up' : 'dn'">{{ fmtPct(meta.p30) }}</span></span>
          <span class="pill" title="等长窗口：近 7 天 vs 前 7 天">近 7 天 vs 前 7 天 <span :class="(meta.p7 ?? 0) >= 0 ? 'up' : 'dn'">{{ fmtPct(meta.p7) }}</span></span>
          <span class="pill">峰值日处于今年 <b>P{{ meta.peakPill }}</b></span>
          <button class="pill" title="查看今年移出明细" @click="emit('open-dyn', 'cum-del')">今年移出 <b>{{ meta.delTotal }}</b> 张</button>
          <span class="dz-ov-info" tabindex="0" title="悬停看本期说明"
            @mouseenter="tipOn = true" @mouseleave="tipOn = false"
            @focusin="tipOn = true" @focusout="tipOn = false">ⓘ 说明
            <span class="dz-ov-tip">
              <span class="dz-ov-say">
                <template v-if="say">
                  今年你在 <b>{{ say.act }} / {{ say.days }}</b> 天有动作（<b>{{ say.rate }}%</b>）。
                  最猛的一天是 <b>{{ say.peakLabel }}</b> —— 那天 <span class="hl">{{ say.peakLv }}</span>，
                  加权 {{ say.peakW }} 分。平均每个活跃日 ≈ <b>{{ say.perActive }} 次有效动作</b>，
                  {{ say.steady ? '节奏稳定。' : '存在明显断档。' }}
                  <template v-if="selDay"><br><b>已绑定到 {{ selDay }}</b>：上方存量卡显示的是「截至那天」的库容，不再只是"此刻"。</template>
                </template>
                <template v-else>本年还没有可统计的动作 —— 去采集第一张卡，热力图就会亮起来。</template>
              </span>
            </span>
          </span>
          <span class="dz-sp"></span>
          <!-- 0 就不出现：常驻的「运行错误 0」会被读成"这里有报错"（R173-1 真机反馈） -->
          <button v-if="errorCount > 0" class="pill dz-ov-err" title="导出运行错误堆栈（含 TDZ 类崩溃），供定位根因" @click="emit('export-error')">⚠ 运行错误 {{ errorCount }}</button>
        </div>
      </div>

      <div class="dz-calib" :class="{ on: calibOn }">
        <div class="ch">⚖ 加权分换算表 —— 让你能核对，而不是只能相信。分值可在「AI 助手」里调整，上线后按真实库校准。</div>
        <div class="cb">
          <div v-for="row in W_ROWS" :key="row[0]" class="r"><span>{{ row[0] }}</span><span class="w">{{ row[1].toFixed(1) }}</span></div>
        </div>
        <div class="cf">防刷分：同一张卡当天第 2 次起调出按 0.5 计；采集后 24h 内即删除，该笔采集分 ×0.3。<br>
          强度指数 = min(100, round(加权分 ÷ 55 × 100))，55 为满勤基线。档位为<b>固定阈值</b>，跨年可比。</div>
      </div>
    </div>
  </section>
</template>
