<script setup lang="ts">
import Icon from '@/shared/components/Icon.vue'
/**
 * F7 · 层级专属列表视图（骨架条第 3/5/6 层，用户拍板 2026-10-16）。
 *
 * 存在的理由：点第 6 层的预期是"看到全部任务"，实际旧行为是滚动到第一条任务 + toast——
 * "定位到一条"和"看到全部"差一个数量级；3/5/6 的共同诉求是**按层审视**，
 * 专属列表把这一层从下挂结构（指标藏塔内、任务藏指标内）里抽出来平铺。
 * 第 4 层保留定位（项目舱本身已是独立全貌，一舱一项目，定位即所见）；
 * 第 1/2 层保留层面板（全文 + 推导链）。
 *
 * 互斥占位：本组件挂载时项目塔/项目全景都不渲染（宿主 v-if/v-else-if 链），
 * ✕ 返回或同层再点即收起，宿主 viewMode 原样保留 —— 关闭即回到打开列表前的视图。
 * 行内能力：第 3 层点行过滤（原目标横卡语义，横卡→列表行）；第 5/6 层行内「定位」回塔。
 *
 * 纪律：props-only 零 store、零再聚合（行数据由宿主算好传入，W11-5/W11-9 同源口径）。
 */
const props = defineProps<{
  /** 当前专属列表层 */
  layer: 3 | 5 | 6
  /** 返回按钮的目标视图名（宿主 viewMode 记忆：关闭即原样恢复） */
  backLabel: string
  /** 当前聚焦的战略目标 id（第 3 层行高亮用） */
  dirFilter: string
  /** 第 3 层行：战略目标（原目标横卡数据迁移） */
  rows3: { id: string; i: number; name: string; done: number; total: number; pct: number; stall: boolean; projs: { t: number; risk: boolean }[] }[]
  /** 第 5 层行：全部成功指标（与骨架条 counts.metrics 同口径遍历） */
  rows5: { id: string; title: string; dirName: string; projName: string; projId: string; total: number; done: number; pct: number; orphan: boolean }[]
  /** 第 6 层行：全部任务（与骨架条 counts.tasks 同口径：未删除即算，含无归属） */
  rows6: { id: string; title: string; status: string; metricTitle: string | null; projName: string | null; projId: string; dirName: string | null; orphan: boolean }[]
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'dir', id: string): void
  (e: 'locate', projId: string, label: string): void
}>()

const LAYER_META = {
  3: { n: 3, t: '战略目标', en: 'DIRECTION', ic: '', tip: '点任一行 → 过滤下方项目塔（再点取消）' },
  5: { n: 5, t: '成功指标', en: 'METRIC', ic: '◎', tip: '全部指标平铺 · 行内「定位」回项目塔' },
  6: { n: 6, t: '任务', en: 'TASK', ic: '', tip: '全部任务平铺（未删除即算，与骨架条同口径）· 行内「定位」回项目塔' }
} as const
const lm = LAYER_META[props.layer]

/** 行状态徽标：任务状态三态（与塔内同语义） */
function statusDot(s: string): string { return s === 'done' ? '' : s === 'doing' ? '◐' : '○' }
</script>

<template>
  <div class="lvlist" id="lvlist-anchor">
    <header class="lvl-h">
      <span class="lvl-badge"><i class="lvl-n">{{ lm.n }}</i>{{ lm.t }}<span class="lvl-en">{{ lm.en }}</span></span>
      <span class="lvl-count">
        {{ layer === 3 ? rows3.length + ' 个目标' : layer === 5 ? rows5.length + ' 条指标' : rows6.length + ' 条任务' }}
      </span>
      <span class="lvl-tip">{{ lm.tip }}</span>
      <span class="lvl-gap" />
      <button class="lvl-x" title="同层再点骨架条该层也可收起（双向可达）" @click="emit('close')"><Icon name="x" :size="13"/> 返回{{ backLabel }}</button>
    </header>

    <div class="lvl-rows">
      <!-- ★第 3 层：目标行（原层面板横卡迁移，能力一项不少：进度/停滞/下挂/点行过滤） -->
      <template v-if="layer === 3">
        <button
          v-for="r in rows3" :key="r.id" class="lvl-row r3"
          :class="{ on: dirFilter === r.id }"
          @click="emit('dir', r.id)"
        >
          <span class="lr-i">{{ r.i + 1 }}</span>
          <span class="lr-n">{{ r.name }}</span>
          <span v-if="r.stall" class="lr-w"><Icon name="warn" :size="13"/> 有停滞</span>
          <span class="lr-pct">
            <b>{{ r.pct }}%</b>
            <span class="lr-bar"><i :style="{ width: r.pct + '%' }" /></span>
            <em>{{ r.done }}/{{ r.total }} 任务</em>
          </span>
          <span class="lr-sub">
            <span v-for="(p, pi) in r.projs" :key="pi" class="lr-proj">{{ p.t }} 任务<Icon v-if="p.risk" name="warn" :size="12"/></span>
          </span>
          <span class="lr-go">{{ dirFilter === r.id ? '正在只看这个 · 再点取消' : '▸ 只看这个目标' }}</span>
        </button>
        <div v-if="!rows3.length" class="lvl-empty">还没有战略目标 · 点上方「＋ 战略目标」开始</div>
      </template>

      <!-- ★第 5 层：指标行 -->
      <template v-else-if="layer === 5">
        <button
          v-for="r in rows5" :key="r.id" class="lvl-row r5"
          :title="`${r.dirName} › ${r.projName}`"
          @click="emit('locate', r.projId, `指标 · ${r.title}`)"
        >
          <span class="lr-dot" :class="{ done: r.pct === 100 && r.total, doing: r.pct > 0 && r.pct < 100 }"><Icon v-if="r.total && r.pct === 100" name="check" :size="12"/><template v-else>{{ r.total ? '◐' : '○' }}</template></span>
          <span class="lr-n">{{ r.title }}</span>
          <span v-if="r.orphan" class="lr-w"><Icon name="warn" :size="13"/> 缺任务</span>
          <span class="lr-path">{{ r.dirName }} › {{ r.projName }}</span>
          <span class="lr-pct">
            <b>{{ r.pct }}%</b>
            <span class="lr-bar"><i :style="{ width: r.pct + '%' }" /></span>
            <em>{{ r.done }}/{{ r.total }}</em>
          </span>
          <span class="lr-go">▸ 定位</span>
        </button>
        <div v-if="!rows5.length" class="lvl-empty">还没有成功指标 · 进项目舱点「＋ 指标」开始</div>
      </template>

      <!-- ★第 6 层：任务行（含无归属孤儿任务——counts.tasks 口径未删除即算） -->
      <template v-else>
        <button
          v-for="r in rows6" :key="r.id" class="lvl-row r6"
          :title="r.metricTitle ? `${r.dirName} › ${r.projName} › ${r.metricTitle}` : '无归属任务'"
          @click="r.projId ? emit('locate', r.projId, `任务 · ${r.title}`) : undefined"
          :class="{ orphan: r.orphan }"
        >
          <span class="lr-dot" :class="{ done: r.status === 'done', doing: r.status === 'doing' }"><Icon v-if="r.status === 'done'" name="check" :size="11"/><template v-else>{{ statusDot(r.status) }}</template></span>
          <span class="lr-n" :class="{ done: r.status === 'done' }">{{ r.title }}</span>
          <span v-if="r.orphan" class="lr-w"><Icon name="warn" :size="13"/> 未归属</span>
          <span class="lr-path">{{ r.metricTitle ? `${r.projName} › ${r.metricTitle}` : (r.projName || '未挂项目') }}</span>
          <span class="lr-go" v-if="r.projId">▸ 定位</span>
          <span class="lr-go dim" v-else>不可定位</span>
        </button>
        <div v-if="!rows6.length" class="lvl-empty">还没有任务 · 进项目舱给指标加任务</div>
      </template>
    </div>
  </div>
</template>

<style scoped>
/* ── 层级专属列表（F7）：占住项目塔/全景的位置，与它们互斥 ── */
.lvlist {
  background: var(--surface); border: 1px solid var(--border);
  border-radius: var(--radius-lg); box-shadow: var(--shadow);
  margin-bottom: 22px; overflow: hidden;
}
.lvl-h {
  display: flex; align-items: center; gap: 10px; flex-wrap: wrap;
  padding: 11px 16px; border-bottom: 1px solid var(--border);
}
.lvl-badge {
  display: inline-flex; align-items: center; gap: 7px;
  font-size: var(--fs-sub); font-weight: 700; color: var(--text);
}
.lvl-n {
  width: 20px; height: 20px; border-radius: 6px; font-style: normal;
  display: inline-flex; align-items: center; justify-content: center;
  background: var(--accent-light); color: var(--accent-ink); font-size: var(--fs-micro); font-weight: 700;
}
.lvl-en { font-size: var(--fs-micro); font-weight: 700; letter-spacing: .13em; color: var(--text-4); }
.lvl-count { font-size: var(--fs-micro); font-weight: 700; color: var(--text-3); font-variant-numeric: tabular-nums; }
.lvl-tip { font-size: var(--fs-micro); color: var(--text-4); }
.lvl-gap { margin-left: auto; }
.lvl-x {
  font-size: var(--fs-micro); font-weight: 600; color: var(--text-3);
  background: var(--surface-2); border: 1px solid transparent;
  padding: 4px 10px; border-radius: 999px; cursor: pointer; transition: all var(--dur);
}
.lvl-x:hover { color: var(--text); background: var(--surface-3); }

.lvl-rows { display: flex; flex-direction: column; max-height: 62vh; overflow: auto; }
.lvl-row {
  display: flex; align-items: center; gap: 10px; flex-wrap: wrap;
  width: 100%; text-align: left; cursor: pointer;
  padding: 9px 16px; background: none; border: none;
  border-bottom: 1px solid var(--border); transition: background var(--dur);
  color: var(--text-2); font-size: var(--fs-caption);
}
.lvl-row:hover { background: var(--surface-2); }
.lvl-row.on { background: color-mix(in srgb, var(--accent) 9%, transparent); }
.lvl-row.orphan { background: color-mix(in srgb, var(--warning) 7%, transparent); }
.lr-i {
  width: 20px; height: 20px; border-radius: 6px; flex: none;
  display: inline-flex; align-items: center; justify-content: center;
  background: var(--surface-3); color: var(--text-4); font-size: var(--fs-micro); font-weight: 700;
}
.lr-dot { flex: none; font-size: var(--fs-caption); color: var(--text-4); }
.lr-dot.done { color: var(--success); }
.lr-dot.doing { color: var(--info-blue); }
.lr-n { font-weight: 600; color: var(--text); white-space: nowrap; max-width: 42%; overflow: hidden; text-overflow: ellipsis; }
.lr-n.done { color: var(--text-4); text-decoration: line-through; }
.lr-w {
  flex: none; font-size: var(--fs-micro); font-weight: 700; color: var(--warning);
  background: var(--warning-bg-soft); padding: 1px 7px; border-radius: 999px;
}
.lr-path { font-size: var(--fs-micro); color: var(--text-4); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 34%; }
.lr-pct { display: inline-flex; align-items: center; gap: 7px; margin-left: auto; flex: none; }
.lr-pct b { font-size: var(--fs-caption); font-weight: 700; color: var(--text); font-variant-numeric: tabular-nums; }
.lr-pct em { font-style: normal; font-size: var(--fs-micro); color: var(--text-4); font-variant-numeric: tabular-nums; }
.lr-bar { width: 74px; height: 5px; border-radius: 999px; background: var(--surface-3); overflow: hidden; }
.lr-bar i { display: block; height: 100%; background: var(--accent); border-radius: 999px; }
.lr-sub { display: inline-flex; gap: 6px; flex-wrap: wrap; }
.lr-proj { font-size: var(--fs-micro); color: var(--text-4); background: var(--surface-2); padding: 1px 7px; border-radius: 999px; }
.lr-go { flex: none; font-size: var(--fs-micro); font-weight: 600; color: var(--accent); white-space: nowrap; }
.lr-go.dim { color: var(--text-4); }
.lvl-empty { padding: 26px 16px; text-align: center; color: var(--text-4); font-size: var(--fs-caption); }
</style>
