<script setup lang="ts">
/**
 * W11 · 项目全景（横向泳道视图，原型 .pano）—— **导航层**。
 *
 * 为什么要有第二个视图（项目塔解决不了什么）：
 *  项目塔是**纵向**的 —— 舱 → 指标 → 任务自上而下，适合回答"我在哪个位置"；
 *  但第三个高频问题是"**这一个项目的完整链路长什么样**"，纵向要滚动七八屏，
 *  且指标之间的并列关系在纵向里读不出来。横向泳道：选一个项目 → 一根泳道 = 一条成功指标，
 *  泳道内竖排该指标的任务，顶部一条三段层级带把「第 4 层 › 第 5 层 › 第 6 层」的从属印在结构上。
 *
 * 形态决策（D3 已拍板）：做成**方向台内的第二视图**（viewMode: 'tower' | 'pano'），
 * 不新建路由、不新建页面文件 —— 它是同一份 compassMeta 的另一种投影，不是另一个实体世界。
 *
 * ★组件边界：本组件只管「选谁 / 主体是谁」（选择条 + 项目头 + 层级带 + 收容道），
 * 一根根泳道交给 CompassPanoLane。两块各自独立可判 —— 改导航样式不会把内容判据一起拖红。
 *
 * 焦点纪律：★不得出现 font-size: var(--fs-display) / var(--fs-hero)（判据 W11-11 负锚）。
 * 项目名 --fs-title(15px)，主角感由横向铺开与留白承担。
 */
import { computed } from 'vue'
import type { Direction, Project } from '@/shared/models'
import type { CompassMeta, ProjectMeta } from '../../views/compassMeta'
import CompassPanoLane from './CompassPanoLane.vue'

const props = defineProps<{
  meta: CompassMeta
  /** 当前全景聚焦的项目 id（双向：点选择条换主体 / 判据 W11-8） */
  activeId: string
}>()

const emit = defineEmits<{
  (e: 'pick', projId: string): void
  (e: 'toggleTask', taskId: string): void
  (e: 'taskGrade', taskId: string): void
  (e: 'addTask', metricId: string, projId: string): void
  (e: 'addMetric', projId: string): void
  (e: 'aiMetric', projId: string): void
  (e: 'bindOrphan', taskId: string, projId: string): void
  (e: 'gotoDetail', projId: string): void
  (e: 'toTower', projId: string): void
}>()

/** 选择条上的项目序列（扁平成一条，前端不再嵌套遍历） */
interface PickRow { proj: Project; pm: ProjectMeta; dir: Direction; hue: string; i: number }
const pickRows = computed<PickRow[]>(() => {
  const HUES = [88, 70, 52, 38, 26, 16]
  const out: PickRow[] = []
  for (const g of props.meta.dirs) {
    for (const pm of g.projects) {
      /* ProjectMeta 只存 id，回原树取实体（取数口径唯一仍在 compassMeta，这里只补类型信息） */
      const proj = g.dir.projects.find(dir => dir.id === pm.id)
      if (!proj) continue
      const k = out.length
      out.push({
        proj, pm, dir: g.dir,
        hue: `color-mix(in srgb, var(--accent) ${HUES[k % HUES.length]}%, var(--surface))`,
        i: g.projects.indexOf(pm)
      })
    }
  }
  return out
})

/** 当前聚焦项目（activeId 失效时兜底到第一个，避免空白屏） */
const current = computed<PickRow | null>(() => {
  const hit = pickRows.value.find(r => r.proj.id === props.activeId)
  return hit || pickRows.value[0] || null
})

/** 三段层级带的数字（全部吃集中取数，不现算 —— 判据 W11-5） */
const bandStats = computed(() => {
  const pm = current.value?.pm
  if (!pm) return null
  const withTasks = pm.metrics.filter(m => m.total > 0).length
  const zero = pm.metrics.filter(m => m.orphanMetric).length
  const allTasks = pm.metrics.reduce((s, m) => s + m.total, 0)
  const doneTasks = pm.metrics.reduce((s, m) => s + m.done, 0)
  return { metrics: pm.metrics.length, withTasks, zero, allTasks, doneTasks, pending: allTasks - doneTasks }
})

const ringR = 21
const ringC = 2 * Math.PI * ringR
</script>

<template>
  <div class="pano" :style="{ '--hue': current?.hue || 'var(--accent)' }">
    <!-- ① 项目选择条：全景的入口。★双向可达 —— 点条上任一项目即换主体，不设"必须先选"的门槛 -->
    <section class="pano-pick" aria-label="选择要横向展开的项目">
      <div class="pp-t">选择项目 · 横向看全它的一条链</div>
      <div class="pp-row">
        <button
          v-for="r in pickRows" :key="r.proj.id"
          class="pp" :class="{ on: current?.proj.id === r.proj.id }"
          :style="{ '--pc': r.hue }"
          :title="`${r.dir.name} › ${r.proj.name} · ${r.pm.metrics.length} 指标 · ${r.pm.total} 任务`"
          @click="emit('pick', r.proj.id)"
        >
          <span class="pp-n">{{ r.i + 1 }} {{ r.proj.name }}</span>
          <span class="pp-m">
            {{ r.pm.metrics.length }} 指标 · {{ r.pm.total }} 任务<template v-if="r.proj.isFocused"> · 🚀</template>
          </span>
        </button>
        <div v-if="!pickRows.length" class="pp-empty">还没有攻坚项目 —— 先在项目塔里添加一个</div>
      </div>
    </section>

    <template v-if="current">
      <!-- ② 项目头：名 + 徽标 + 归属路径 + 完成度 + 四个动作 -->
      <section class="pano-h">
        <span class="ph-i" aria-hidden="true">{{ current.i + 1 }}</span>
        <div class="ph-b">
          <h3 class="ph-n">
            {{ current.proj.name }}
            <span v-if="current.proj.isFocused" class="ph-badge focus" title="主攻项目">🚀 主攻</span>
            <span v-if="current.proj.pinned" class="ph-badge" title="已置顶">📌 置顶</span>
            <span v-if="current.pm.stall" class="ph-badge stall" title="近 14 天无推进/完成活动">⚠ 停滞 14 天+</span>
          </h3>
          <!-- ★归属路径：全景里最容易丢的就是"这个项目的指标从哪来"，所以路径常驻不折叠 -->
          <nav class="ph-c">
            <span>{{ current.dir.name }}</span><span class="ph-sep">›</span>
            <b>第 4 层 · 攻坚项目</b><span class="ph-sep">›</span>
            <span>{{ bandStats?.metrics }} 条成功指标 · {{ bandStats?.allTasks }} 条任务</span>
            <button class="ph-link" title="回到项目塔里看它与其它项目的对比" @click="emit('toTower', current.proj.id)">⇅ 回项目塔</button>
          </nav>
        </div>
        <div class="ph-r">
          <div class="ph-prog" :title="`项目级完成度 ${current.pm.pct}%（跨全部指标聚合）`">
            <div class="ph-ring">
              <svg viewBox="0 0 48 48" width="42" height="42" aria-hidden="true">
                <circle cx="24" cy="24" :r="ringR" fill="none" stroke="var(--surface-3)" stroke-width="3.5" />
                <circle
                  cx="24" cy="24" :r="ringR" fill="none"
                  stroke="var(--hue)" stroke-width="3.5" stroke-linecap="round"
                  :stroke-dasharray="ringC" :stroke-dashoffset="ringC * (1 - current.pm.pct / 100)"
                />
              </svg>
              <span class="ph-ring-v">{{ current.pm.pct }}%</span>
            </div>
            <div class="ph-num">
              <b>{{ current.pm.done }} / {{ current.pm.total }}</b> 任务完成
              <span>{{ bandStats?.metrics }} 条指标 · {{ current.pm.risk ? `${current.pm.risk} 处断链` : '链路完整' }}</span>
            </div>
          </div>
          <div class="ph-acts">
            <button v-if="current.pm.risk > 0" class="ph-act risk" :title="`${current.pm.risk} 处断链：缺任务指标 + 无归属任务`">⚠ 断链 {{ current.pm.risk }}</button>
            <button class="ph-act" title="在本项目下新建成功指标" @click="emit('addMetric', current.proj.id)">＋ 指标</button>
            <button class="ph-act ai" title="✦ AI 依使命与本项目建议成功指标（查重后采纳才创建）" @click="emit('aiMetric', current.proj.id)">✦ AI 建议指标</button>
            <button class="ph-act" title="打开项目详情页" @click="emit('gotoDetail', current.proj.id)">📄 详情</button>
          </div>
        </div>
      </section>

      <!-- ③ 层级带：把「从属关系」直接印在结构上，不靠脑补 -->
      <section v-if="bandStats" class="band" aria-label="三层从属">
        <div class="bd">
          <div class="bd-l"><i>第 4 层</i>PROJECT</div>
          <div class="bd-n">{{ current.proj.name }}</div>
          <div class="bd-m">1 个攻坚项目 · 本次全景的主体</div>
        </div>
        <div class="bd">
          <div class="bd-l"><i>第 5 层</i>METRIC</div>
          <div class="bd-n">{{ bandStats.metrics }} 条成功指标</div>
          <div class="bd-m">{{ bandStats.withTasks }} 条有任务 · {{ bandStats.zero }} 条零任务</div>
        </div>
        <div class="bd">
          <div class="bd-l"><i>第 6 层</i>TASK</div>
          <div class="bd-n">{{ bandStats.allTasks }} 条任务</div>
          <div class="bd-m">{{ bandStats.doneTasks }} 已完成 · {{ bandStats.pending }} 待推进<template v-if="current.pm.orphanTasks.length"> · {{ current.pm.orphanTasks.length }} 条无归属</template></div>
        </div>
      </section>

      <!-- ④ 横向泳道区：一根泳道 = 一条成功指标（组件化，见 CompassPanoLane） -->
      <div class="lanes">
        <CompassPanoLane
          v-for="(m, mi) in current.pm.metrics"
          :key="m.id"
          :m="m"
          :idx="mi + 1"
          :proj-id="current.proj.id"
          @toggle-task="emit('toggleTask', $event)"
          @task-grade="emit('taskGrade', $event)"
          @add-task="(mid, pid) => emit('addTask', mid, pid)"
        />

        <!-- ★无归属收容泳道：在项目内但没挂任何成功指标的任务（判据 W11-8 钉它在泳道区最右侧） -->
        <section v-if="current.pm.orphanTasks.length" class="lane orph" aria-label="无归属任务收容">
          <header class="lane-h">
            <div class="lane-top">
              <span class="lane-i">!</span>
              <span class="lane-n">无归属任务</span>
            </div>
            <div class="lane-acc">在项目内，但<b class="bad">没挂任何成功指标</b></div>
          </header>
          <div class="lane-b">
            <div v-for="t in current.pm.orphanTasks" :key="t.id" class="ltask orph">
              <div class="ltask-t">{{ t.title }}</div>
              <div class="ltask-b">
                <span class="lb lb-clue">⚠ 缺指标归属</span>
                <button class="lb lb-bind" @click="emit('bindOrphan', t.id, current.proj.id)">＋ 挂指标</button>
              </div>
            </div>
          </div>
        </section>
      </div>
    </template>
  </div>
</template>

<style scoped>
/* ── 项目选择条 ── */
.pano-pick {
  background: var(--surface); border-radius: var(--radius-lg);
  box-shadow: var(--shadow); padding: 12px 16px; margin-bottom: 16px;
}
.pp-t { font-size: var(--fs-micro); font-weight: 700; letter-spacing: .11em; color: var(--text-4); margin-bottom: 9px; }
.pp-row { display: flex; gap: 7px; overflow-x: auto; padding-bottom: 3px; }
.pp-empty { font-size: var(--fs-micro); color: var(--text-4); padding: 8px 2px; }
.pp {
  position: relative; flex: 0 0 auto; padding: 8px 13px 8px 14px;
  border-radius: var(--radius-md); background: var(--surface-2);
  cursor: pointer; transition: all var(--dur); min-width: 132px; text-align: left;
}
.pp::before { content: ''; position: absolute; left: 0; top: 6px; bottom: 6px; width: 3px; border-radius: 2px; background: var(--pc); }
.pp:hover { transform: translateY(-1px); box-shadow: var(--shadow-sm); }
.pp.on { background: color-mix(in srgb, var(--pc) 18%, var(--surface-2)); box-shadow: inset 0 0 0 1.5px var(--pc); }
.pp-n {
  display: block; font-size: var(--fs-sub); font-weight: 700; line-height: 1.4;
  white-space: nowrap; max-width: 190px; overflow: hidden; text-overflow: ellipsis; color: var(--text);
}
.pp-m { display: block; font-size: var(--fs-micro); color: var(--text-4); margin-top: 3px; font-weight: 600; }

/* ── 项目头 ── */
.pano-h {
  display: flex; align-items: center; gap: 16px; padding: 16px 20px;
  border-radius: var(--radius-lg); background: var(--surface); box-shadow: var(--shadow);
  margin-bottom: 16px; flex-wrap: wrap;
}
.ph-i {
  width: 42px; height: 42px; border-radius: 13px; display: grid; place-items: center;
  font-size: var(--fs-title); font-weight: 700; flex: none;
  background: color-mix(in srgb, var(--hue) 20%, transparent); color: var(--text);
}
.ph-b { flex: 1; min-width: 240px; }
/* ★项目名 --fs-title(15px)：与指标 --fs-sub(12px) 拉开一档，不抢焦点（愿景才是 display） */
.ph-n { margin: 0; font-size: var(--fs-title); font-weight: 700; letter-spacing: -.015em; display: flex; align-items: baseline; gap: 9px; flex-wrap: wrap; color: var(--text); }
.ph-badge { font-size: var(--fs-micro); color: var(--text-3); background: var(--surface-2); padding: 1px 7px; border-radius: 999px; white-space: nowrap; }
.ph-badge.focus { color: var(--accent-ink); background: var(--accent-light); font-weight: 600; }
.ph-badge.stall { color: var(--warning); background: var(--warning-bg-soft); }
.ph-c { font-size: var(--fs-micro); color: var(--text-4); margin-top: 5px; display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.ph-c b { color: var(--text-2); }
.ph-sep { opacity: .6; }
.ph-link { font-size: var(--fs-micro); color: var(--accent-ink); cursor: pointer; font-weight: 600; }
.ph-link:hover { text-decoration: underline; }

.ph-r { display: flex; align-items: center; gap: 20px; flex: none; }
.ph-prog { display: flex; align-items: center; gap: 9px; }
.ph-ring { position: relative; width: 42px; height: 42px; flex: none; }
.ph-ring-v {
  position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
  font-size: var(--fs-micro); font-weight: 700; color: var(--text-2);
}
.ph-num { font-size: var(--fs-micro); color: var(--text-3); line-height: 1.55; }
.ph-num b { color: var(--text-2); font-variant-numeric: tabular-nums; display: block; }
.ph-num span { display: block; }
.ph-acts { display: flex; gap: 6px; }
.ph-act {
  font-size: var(--fs-micro); font-weight: 600; color: var(--text-2);
  background: var(--surface-2); border: 1px solid var(--border);
  padding: 4px 10px; border-radius: 999px; cursor: pointer; transition: all var(--dur); white-space: nowrap;
}
.ph-act:hover { color: var(--accent-ink); border-color: var(--accent-light); background: var(--accent-light); }
.ph-act.risk { color: var(--danger); background: var(--danger-bg-soft); border-color: var(--danger-border); }
.ph-act.ai { color: var(--accent-ink); background: var(--accent-light); border-color: transparent; }

/* ── 层级带 ── */
.band {
  display: flex; align-items: stretch; border-radius: var(--radius-md);
  overflow: hidden; margin-bottom: 16px; box-shadow: var(--shadow-sm);
  border: 1px solid var(--border);
}
/* ★三段宽度递增（1.25 / 2 / 2.6）—— 视觉上就是"越往下越细"，从属直接印在结构上 */
.bd { display: flex; flex-direction: column; gap: 3px; padding: 11px 16px; position: relative; }
.bd:nth-child(1) { flex: 1.25; background: linear-gradient(90deg, color-mix(in srgb, var(--hue) 22%, transparent), color-mix(in srgb, var(--hue) 12%, transparent)); }
.bd:nth-child(2) { flex: 2; background: linear-gradient(90deg, color-mix(in srgb, var(--hue) 14%, transparent), color-mix(in srgb, var(--hue) 9%, transparent)); }
.bd:nth-child(3) { flex: 2.6; background: color-mix(in srgb, var(--hue) 9%, transparent); }
/* ★段间箭头：无内容伪元素，用 clip-path 画折角。别删——删了三段就变成三块并列色块，从属感全失 */
.bd::after {
  content: ''; position: absolute; right: -7px; top: 0; bottom: 0; width: 14px;
  background: inherit; clip-path: polygon(0 0, 100% 50%, 0 100%); z-index: 1;
}
.bd:last-child::after { display: none; }
.bd-l { font-size: var(--fs-micro); font-weight: 700; letter-spacing: .09em; color: var(--text-2); display: flex; align-items: center; gap: 6px; z-index: 2; }
.bd-l i { font-style: normal; opacity: .7; font-weight: 700; }
.bd-n { font-size: var(--fs-sub); font-weight: 700; line-height: 1.4; z-index: 2; color: var(--text); }
.bd-m { font-size: var(--fs-micro); color: var(--text-3); z-index: 2; }

/* ── 泳道区（横向容器；泳道本体在 CompassPanoLane）── */
.lanes { display: flex; gap: 12px; overflow-x: auto; padding: 2px 2px 16px; align-items: flex-start; }

/* ── 收容泳道（留在本组件：它不属于任何指标，是项目级的第三态）── */
.lane {
  flex: 0 0 262px; display: flex; flex-direction: column;
  background: var(--surface); border-radius: var(--radius-lg);
  box-shadow: var(--shadow); overflow: hidden; max-height: 64vh;
}
.lane.orph { border: 1px dashed var(--danger-border); background: var(--danger-bg-soft); }
.lane-h { padding: 13px 15px 12px; border-bottom: 1px solid var(--border); background: var(--surface-2); flex: none; }
.lane.orph .lane-h { background: transparent; border-bottom-color: var(--danger-border); }
.lane-top { display: flex; align-items: center; gap: 7px; margin-bottom: 7px; }
.lane-i {
  width: 17px; height: 17px; border-radius: 6px; display: grid; place-items: center;
  font-size: var(--fs-micro); font-weight: 700; flex: none;
  background: var(--danger-bg-soft); color: var(--danger);
}
.lane-n { font-size: var(--fs-sub); font-weight: 700; line-height: 1.45; flex: 1; min-width: 0; color: var(--text); }
.lane-acc { font-size: var(--fs-micro); color: var(--text-3); line-height: 1.65; margin-top: 5px; }
.lane-acc b { color: var(--text-2); font-weight: 600; }
.lane-acc .bad { color: var(--danger); }
.lane-b { padding: 9px; display: flex; flex-direction: column; gap: 6px; overflow-y: auto; flex: 1; min-height: 74px; }
.ltask {
  position: relative; padding: 9px 10px 9px 11px; border-radius: var(--radius-sm);
  background: var(--surface-2); transition: all var(--dur); border-left: 2px solid var(--danger);
}
.ltask-t { font-size: var(--fs-micro); font-weight: 500; line-height: 1.6; color: var(--text); }
.ltask-b { display: flex; align-items: center; gap: 4px; margin-top: 6px; flex-wrap: wrap; }
.lb { font-size: var(--fs-micro); font-weight: 600; padding: 1px 6px; border-radius: 999px; white-space: nowrap; }
.lb-clue { color: var(--warning); background: var(--warning-bg-soft); }
.lb-bind { color: var(--accent-ink); background: var(--accent-light); cursor: pointer; }
</style>