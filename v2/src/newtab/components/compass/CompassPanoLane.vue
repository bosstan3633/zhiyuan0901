<script setup lang="ts">
/**
 * W11 · 全景泳道（一根泳道 = 一条成功指标）。
 *
 * 为什么要独立成组件（不是"顺手拆一下"）：
 *  单文件超 400 行本身就是信号 —— 说明它承担了两件事。全景视图真有两块独立职责：
 *  ①「选谁」= 项目选择条 + 项目头 + 层级带（导航层）
 *  ②「看什么」= 一根根泳道（内容层）
 * 拆开后两块各自的判据能分别钉住：选择条钉"常驻可点、换主体不回首"，
 *  泳道钉"空位可见 / 收容道在最后 / 任务出口齐全"，不会因为改了导航样式就把内容判据一起拖红。
 *
 * 焦点纪律：★不得出现 font-size: var(--fs-display) / var(--fs-hero)（判据 W11-11 负锚）。
 * 层级：指标名 --fs-sub(12px)、任务 --fs-micro，与项目名 --fs-title(15px) 严格拉开。
 */
import type { TaskCard } from '@/shared/models'
import type { MetricMeta } from '../../views/compassMeta'
import { gradeColorVar } from '../../views/compassMeta'

const props = defineProps<{
  m: MetricMeta
  /** 泳道序号（从 1 起） */
  idx: number
  /** 当前项目 id（加任务要带出） */
  projId: string
}>()

const emit = defineEmits<{
  (e: 'toggleTask', taskId: string): void
  (e: 'taskGrade', taskId: string): void
  (e: 'addTask', metricId: string, projId: string): void
}>()

/** 状态点：○ 空 / ◐ 进行中 / ✓ 全完成（与 CompassLane 同口径） */
function dotOf(m: MetricMeta): { cls: string; g: string } {
  return m.dot === 'done' ? { cls: 'done', g: '✓' } : m.dot === 'doing' ? { cls: 'doing', g: '◐' } : { cls: '', g: '○' }
}

/** 任务是否带「支撑任务（线索未开）」软提示（不在 TaskCard 模型里，按可选扩展读） */
function hasClue(t: TaskCard): boolean {
  return !!(t as TaskCard & { w?: string }).w
}
function clueOf(t: TaskCard): string {
  return (t as TaskCard & { w?: string }).w || ''
}
function gradeOf(t: TaskCard): string {
  return (t as TaskCard & { grade?: string }).grade || 'C'
}
function statusOf(t: TaskCard): string {
  return t.status === 'done' ? 'done' : t.status === 'doing' ? 'doing' : ''
}
const PRI_LABEL: Record<string, string> = { high: '高', mid: '中', low: '低' }
function priOf(t: TaskCard): string {
  return PRI_LABEL[t.priority] || PRI_LABEL.mid
}
</script>

<template>
  <section class="lane" :data-metric="m.id">
    <header class="lane-h">
      <div class="lane-top">
        <span class="lane-i">{{ idx }}</span>
        <span class="lane-n">{{ m.title }}</span>
        <span class="lane-dot" :class="dotOf(m).cls" :title="`完成 ${m.done}/${m.total}`">{{ dotOf(m).g }}</span>
      </div>
      <div class="lane-acc">验收：<b>{{ m.acceptance || '未写验收标准' }}</b></div>
      <div class="lane-bar">
        <span class="track"><span class="fill" :style="{ width: m.pct + '%' }" /></span>
        <span class="v">{{ m.pct }}% · {{ m.done }}/{{ m.total }}</span>
      </div>
    </header>

    <div class="lane-b">
      <template v-if="m.tasks.length">
        <div v-for="t in m.tasks" :key="t.id" class="ltask" :class="statusOf(t)">
          <button
            class="ltask-box" :class="statusOf(t)"
            :aria-pressed="t.status === 'done'"
            :title="t.status === 'done' ? '点一下取消完成' : '点一下勾选完成'"
            @click="emit('toggleTask', t.id)"
          />
          <div class="ltask-t">{{ t.title }}</div>
          <div class="ltask-b">
            <span v-if="hasClue(t)" class="lb lb-clue" :title="clueOf(t)">⚠ {{ clueOf(t) }}</span>
            <span class="lb lb-pri">{{ priOf(t) }}</span>
            <button class="lb lb-g" :style="{ color: gradeColorVar(gradeOf(t)) }" :title="`成熟度等级 ${gradeOf(t)} · 点击看详情`" @click="emit('taskGrade', t.id)">{{ gradeOf(t) }}</button>
          </div>
        </div>
      </template>
      <!-- ★空泳道也占位：让"缺任务"在全景里同样可见（判据 W11-8 钉它不许消失） -->
      <div v-else class="lane-empty">
        <span class="le-i" aria-hidden="true">⚠</span>
        <span class="le-t">零任务</span>
        <span class="le-d">验收标准已定<br />动作还没落</span>
        <button class="le-add" @click="emit('addTask', m.id, projId)">＋ 建第一条任务</button>
      </div>
    </div>

    <footer class="lane-foot">
      <button class="lane-add" @click="emit('addTask', m.id, projId)">＋ 在「{{ m.title }}」下添加任务</button>
    </footer>
  </section>
</template>

<style scoped>
.lane {
  flex: 0 0 262px; display: flex; flex-direction: column;
  background: var(--surface); border-radius: var(--radius-lg);
  box-shadow: var(--shadow); overflow: hidden; max-height: 64vh;
}
.lane-h { padding: 13px 15px 12px; border-bottom: 1px solid var(--border); background: var(--surface-2); flex: none; }
.lane-top { display: flex; align-items: center; gap: 7px; margin-bottom: 7px; }
.lane-i {
  width: 17px; height: 17px; border-radius: 6px; display: grid; place-items: center;
  font-size: var(--fs-micro); font-weight: 700; flex: none;
  background: color-mix(in srgb, var(--hue) 24%, transparent); color: var(--text);
}
.lane-n { font-size: var(--fs-sub); font-weight: 700; line-height: 1.45; flex: 1; min-width: 0; color: var(--text); }
.lane-dot {
  width: 15px; height: 15px; border-radius: 999px; display: grid; place-items: center;
  font-size: 9px; flex: none; background: var(--surface-3); color: var(--text-4);
}
.lane-dot.doing { background: var(--warning-bg-soft); color: var(--warning); }
.lane-dot.done { background: var(--success-bg-soft); color: var(--success); }
.lane-acc { font-size: var(--fs-micro); color: var(--text-3); line-height: 1.65; margin-top: 5px; }
.lane-acc b { color: var(--text-2); font-weight: 600; }
.lane-bar { display: flex; align-items: center; gap: 7px; margin-top: 9px; }
.lane-bar .track { flex: 1; height: 4px; border-radius: 2px; background: var(--surface-3); overflow: hidden; }
.lane-bar .fill { display: block; height: 4px; border-radius: 2px; background: var(--hue); }
.lane-bar .v { font-size: var(--fs-micro); font-weight: 700; color: var(--text-2); flex: none; }

.lane-b { padding: 9px; display: flex; flex-direction: column; gap: 6px; overflow-y: auto; flex: 1; min-height: 74px; }
.ltask {
  position: relative; padding: 9px 10px 9px 11px; border-radius: var(--radius-sm);
  background: var(--surface-2); transition: all var(--dur); border-left: 2px solid var(--hue);
}
.ltask:hover { background: var(--surface-3); transform: translateX(2px); }
.ltask.done { border-left-color: var(--success); }
.ltask.doing { border-left-color: var(--warning); }
.ltask-t { font-size: var(--fs-micro); font-weight: 500; line-height: 1.6; padding-right: 18px; color: var(--text); }
.ltask.done .ltask-t { color: var(--text-3); text-decoration: line-through; text-decoration-color: var(--text-4); }
.ltask.doing .ltask-t { font-weight: 700; }
.ltask-box {
  position: absolute; right: 8px; top: 8px; width: 14px; height: 14px; border-radius: 4px;
  box-shadow: inset 0 0 0 1.5px var(--border-strong); cursor: pointer; transition: all var(--dur);
  background: transparent; padding: 0;
}
.ltask-box:hover { box-shadow: inset 0 0 0 2px var(--hue); }
.ltask-box.done { background: var(--success); box-shadow: none; }
.ltask-box.doing { box-shadow: inset 0 0 0 2px var(--warning); }
.ltask-b { display: flex; align-items: center; gap: 4px; margin-top: 6px; flex-wrap: wrap; }
.lb { font-size: var(--fs-micro); font-weight: 600; padding: 1px 6px; border-radius: 999px; white-space: nowrap; }
.lb-pri { color: var(--text-3); background: var(--surface-3); }
.lb-clue { color: var(--warning); background: var(--warning-bg-soft); }
.lb-g { background: var(--surface-3); letter-spacing: .04em; cursor: pointer; }

/* ★空泳道：缺任务也占位，"缺"必须在全景里同样可见 */
.lane-empty {
  flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px;
  padding: 20px 14px; border-radius: var(--radius-md);
  border: 1px dashed var(--warning-border); background: var(--warning-bg-soft);
  min-height: 96px; text-align: center;
}
.le-i {
  width: 24px; height: 24px; border-radius: 8px; background: var(--warning-bg-soft);
  color: var(--warning); display: grid; place-items: center; font-size: 12px;
}
.le-t { font-size: var(--fs-micro); font-weight: 700; color: var(--warning); }
.le-d { font-size: var(--fs-micro); color: var(--text-3); line-height: 1.6; }
.le-add {
  font-size: var(--fs-micro); font-weight: 600; color: var(--accent-ink);
  background: var(--accent-light); padding: 3px 10px; border-radius: 999px; cursor: pointer;
}
.le-add:hover { filter: brightness(1.08); }

.lane-foot { padding: 9px 11px; border-top: 1px solid var(--border); flex: none; background: var(--surface-2); }
.lane-add {
  display: flex; align-items: center; gap: 6px; width: 100%;
  font-size: var(--fs-micro); color: var(--text-4); cursor: pointer;
  padding: 5px 7px; border-radius: var(--radius-xs); transition: all var(--dur); text-align: left;
}
.lane-add:hover { background: var(--surface-3); color: var(--accent-ink); }
</style>