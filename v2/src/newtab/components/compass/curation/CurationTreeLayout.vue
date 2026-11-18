<script setup lang="ts">
/**
 * V3.9.32（批 A）：策展模式 · 树状布局。
 * V4.3.5：把纵向卡片链重构成 OPPO 风格的轻量层级树。
 * V4.3.6：按原型 V0.3 一比一还原——根脉带（愿景/使命 56px 横带）+ 主干线 +
 *         战略目标双列瀑布大卡（序号方块 + 进度环 + 折叠徽记）+ 项目层级线 +
 *         指标自适应网格 + 任务叶片状态点；项目筛选聚焦态背景弱化。
 *
 * 结构原则：
 * - 愿景 / 使命是根脉，战略目标是章节，项目是枝干，成功指标是节点，任务是叶片。
 * - 只读边界：打开详情与折叠只 emit，不在本组件写库。
 */
import type { CurationGoalNode, CurationSel, CurationTree } from '@/shared/utils/compassCurationModel'

defineProps<{ tree: CurationTree; collapsed: Set<string>; focused?: boolean }>()

const emit = defineEmits<{
  (e: 'open', sel: CurationSel): void
  (e: 'toggle', id: string): void
}>()

const stCls: Record<string, string> = {
  done: 'st-done',
  doing: 'st-doing',
  todo: 'st-todo',
  stale: 'st-stale',
}
const priLabel: Record<string, string> = { high: '高', medium: '中', low: '低' }

function goalProgress(goal: CurationGoalNode): number {
  const total = goal.projects.reduce((sum, project) => sum + project.totalCount, 0)
  const done = goal.projects.reduce((sum, project) => sum + project.doneCount, 0)
  return total ? Math.round(done / total * 100) : 0
}
function ringDash(pct: number): string {
  const c = 113.1
  return `${(pct / 100 * c).toFixed(1)} ${c}`
}
</script>

<template>
  <div class="ctl" :class="{ focused }">
    <!-- 根脉带：愿景 / 使命（压缩为一条横带，仍是可点节点） -->
    <div class="ctl-rootband">
      <div class="ctl-rootcell" role="button" tabindex="0"
        @click="emit('open', { kind: 'vision' })"
        @keydown.enter.prevent="emit('open', { kind: 'vision' })">
        <span class="ctl-eyebrow"><i></i>愿景</span>
        <span class="ctl-root-text">{{ tree.vision || '尚未填写愿景' }}</span>
        <span class="ctl-root-link">详情 ›</span>
      </div>
      <div class="ctl-rootcell" role="button" tabindex="0"
        @click="emit('open', { kind: 'mission' })"
        @keydown.enter.prevent="emit('open', { kind: 'mission' })">
        <span class="ctl-eyebrow blue"><i></i>使命</span>
        <span class="ctl-root-text">{{ tree.mission || '尚未填写使命' }}</span>
        <span class="ctl-root-link">详情 ›</span>
      </div>
    </div>
    <div class="ctl-trunk" aria-hidden="true"></div>

    <div class="ctl-spine-head">
      <b>战略骨架</b>
      <span>{{ tree.goals.length }} 个战略目标 · {{ tree.goals.reduce((s, g) => s + g.projects.length, 0) }} 个项目{{ focused ? ' · 聚焦中' : '' }}</span>
    </div>

    <!-- 战略目标双列瀑布 -->
    <div class="ctl-goals">
      <section v-for="(g, gi) in tree.goals" :key="g.dir.id" class="ctl-goal" :class="{ collapsed: collapsed.has('g' + g.dir.id) }">
        <div class="ctl-goal-card" role="button" tabindex="0"
          @click="emit('open', { kind: 'goal', goal: g })"
          @keydown.enter.prevent="emit('open', { kind: 'goal', goal: g })">
          <span class="ctl-goal-index">{{ String(gi + 1).padStart(2, '0') }}</span>
          <div class="ctl-goal-body">
            <span class="ctl-eyebrow">战略目标</span>
            <div class="ctl-goal-name">{{ g.dir.name || '未命名战略目标' }}</div>
            <div class="ctl-goal-meta">
              {{ g.projects.length }} 个项目 · {{ g.projects.reduce((s, P) => s + P.totalCount, 0) }} 个任务
            </div>
          </div>
          <div class="ctl-goal-right">
            <span v-if="collapsed.has('g' + g.dir.id)" class="ctl-fold-chip">已折叠 {{ g.projects.length }} 项目</span>
            <div class="ctl-ring" :title="`完成 ${goalProgress(g)}%`">
              <svg width="44" height="44" viewBox="0 0 44 44" aria-hidden="true">
                <circle cx="22" cy="22" r="18" fill="none" class="ctl-ring-bg" stroke-width="4.5"/>
                <circle cx="22" cy="22" r="18" fill="none" class="ctl-ring-fg" stroke-width="4.5"
                  stroke-linecap="round" :stroke-dasharray="ringDash(goalProgress(g))"/>
              </svg>
              <b>{{ goalProgress(g) }}%</b>
            </div>
            <button class="ctl-fold" type="button" :aria-expanded="!collapsed.has('g' + g.dir.id)"
              :title="collapsed.has('g' + g.dir.id) ? '展开本目标' : '折叠本目标'"
              @click.stop="emit('toggle', 'g' + g.dir.id)">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" aria-hidden="true"><path d="M6 15l6-6 6 6"/></svg>
            </button>
          </div>
        </div>

        <div v-if="!collapsed.has('g' + g.dir.id)" class="ctl-branch">
          <article v-for="P in g.projects" :key="P.project.id" class="ctl-proj" :class="{ collapsed: collapsed.has('p' + P.project.id) }">
            <div class="ctl-proj-head" role="button" tabindex="0"
              @click="emit('open', { kind: 'project', node: P })"
              @keydown.enter.prevent="emit('open', { kind: 'project', node: P })">
              <span class="ctl-badge">项目</span>
              <span class="ctl-proj-title">{{ P.project.name || '未命名项目' }}</span>
              <span v-if="P.project.isFocused" class="ctl-focus-badge">主攻</span>
              <span v-if="P.stalled" class="ctl-stale">停滞 14 天+</span>
              <span class="ctl-pmeta">{{ P.doneCount }}/{{ P.totalCount }}</span>
              <span class="ctl-pbar" aria-hidden="true"><i :style="{ width: P.progress + '%' }"></i></span>
              <span class="ctl-pct">{{ P.progress }}%</span>
              <button class="ctl-fold" type="button" :aria-expanded="!collapsed.has('p' + P.project.id)"
                :title="collapsed.has('p' + P.project.id) ? '展开本项目' : '折叠本项目'"
                @click.stop="emit('toggle', 'p' + P.project.id)">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" aria-hidden="true"><path d="M6 15l6-6 6 6"/></svg>
              </button>
            </div>

            <div v-if="!collapsed.has('p' + P.project.id)" class="ctl-metrics">
              <div v-for="M in P.metrics" :key="M.metric.id" class="ctl-metric" role="button" tabindex="0"
                @click="emit('open', { kind: 'metric', node: M })"
                @keydown.enter.prevent="emit('open', { kind: 'metric', node: M })">
                <div class="ctl-metric-head">
                  <span class="ctl-metric-badge">指标</span>
                  <span class="ctl-metric-name">{{ M.metric.title || '未命名指标' }}</span>
                  <span class="ctl-metric-pct">{{ M.doneCount }}/{{ M.totalCount }} · {{ M.progress }}%</span>
                </div>
                <div class="ctl-mbar" aria-hidden="true"><i :style="{ width: M.progress + '%' }"></i></div>
                <div v-if="M.tasks.length" class="ctl-tasks">
                  <button v-for="T in M.tasks" :key="T.task.id" type="button"
                    class="ctl-task" :class="'task-' + T.status"
                    @click.stop="emit('open', { kind: 'task', node: T })">
                    <i class="ctl-dot" :class="stCls[T.status]"></i>
                    <span class="ctl-task-t">{{ T.task.title || '未命名任务' }}</span>
                    <span v-if="T.task.priority" class="ctl-task-pri">{{ priLabel[T.task.priority] || '中' }}优</span>
                  </button>
                </div>
                <div v-else class="ctl-empty-inline">这个指标下还没有任务</div>
              </div>
            </div>
          </article>
          <div v-if="!g.projects.length" class="ctl-empty-panel">这个战略目标下还没有项目</div>
        </div>
      </section>
    </div>

    <!-- 散叶 · 未归档任务 -->
    <section v-if="tree.orphans.length" class="ctl-orphan">
      <div class="ctl-orphan-head" role="button" tabindex="0"
        @click="emit('open', { kind: 'orphans' })"
        @keydown.enter.prevent="emit('open', { kind: 'orphans' })">
        <b>散叶 · 未归档任务</b>
        <span>{{ tree.orphans.length }} 件 · 挂上指标即上枝</span>
      </div>
      <div class="ctl-orphan-list">
        <button v-for="T in tree.orphans" :key="T.task.id" type="button"
          class="ctl-orphan-task" :class="'task-' + T.status"
          @click="emit('open', { kind: 'task', node: T })">
          <i class="ctl-dot" :class="stCls[T.status]"></i>
          <span class="ctl-task-t">{{ T.task.title || '未命名任务' }}</span>
          <span v-if="T.status === 'stale'" class="ctl-stale">停滞 14 天+</span>
        </button>
      </div>
    </section>
  </div>
</template>

<style scoped>
.ctl { position: relative; max-width: 1560px; margin: 0 auto; padding: 4px 0 40px; }

/* ===== 根脉带 ===== */
.ctl-rootband { position: relative; display: flex; max-width: 1180px; margin: 0 auto;
  background: var(--surface); border: 1px solid var(--border); border-radius: 16px;
  box-shadow: var(--lv-card-shadow); overflow: hidden; transition: opacity var(--dur-fast), box-shadow var(--dur-fast); }
.ctl-rootcell { position: relative; flex: 1; display: flex; align-items: center; gap: 10px; padding: 12px 20px; min-width: 0; cursor: pointer; transition: background var(--dur-fast); }
.ctl-rootcell:hover { background: var(--lv-green-faint); }
.ctl-rootcell + .ctl-rootcell::before { content: ''; position: absolute; left: 0; top: 14px; bottom: 14px; width: 1px;
  background: linear-gradient(transparent, var(--border) 25%, var(--border) 75%, transparent); }
.ctl-eyebrow { flex: none; display: inline-flex; align-items: center; gap: 5px; font-size: var(--fs-caption); font-weight: 800; letter-spacing: .14em; color: var(--lv-green-deep); }
.ctl-eyebrow i { width: 5px; height: 5px; border-radius: 50%; background: var(--lv-green); box-shadow: 0 0 0 3px color-mix(in srgb, var(--lv-green) 12%, transparent); }
.ctl-eyebrow.blue { color: var(--info-blue, #3a6ea8); }
.ctl-eyebrow.blue i { background: var(--info-blue, #5b9bd9); box-shadow: 0 0 0 3px color-mix(in srgb, var(--info-blue, #5b9bd9) 14%, transparent); }
.ctl-root-text { font-size: var(--fs-title); font-weight: 650; letter-spacing: -.01em; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--text); }
.ctl-root-link { flex: none; margin-left: auto; font-size: var(--fs-caption); color: var(--text-3); opacity: 0; transition: var(--dur-fast); }
.ctl-rootcell:hover .ctl-root-link { opacity: 1; color: var(--lv-green); }
.ctl-trunk { width: 2px; height: 30px; margin: 0 auto; background: linear-gradient(var(--lv-mint), var(--lv-rail)); position: relative; }
.ctl-trunk::after { content: ''; position: absolute; left: 50%; bottom: -4px; transform: translateX(-50%);
  width: 8px; height: 8px; border-radius: 50%; background: var(--lv-green); box-shadow: 0 0 0 5px color-mix(in srgb, var(--lv-green) 12%, transparent); }

.ctl-spine-head { display: flex; align-items: center; gap: 12px; max-width: 1180px; margin: 20px auto 16px; }
.ctl-spine-head b { font-size: var(--fs-body); letter-spacing: .06em; }
.ctl-spine-head span { font-size: var(--fs-sub); color: var(--text-3); }
.ctl-spine-head::before { content: ''; width: 26px; height: 1px; background: var(--border); }
.ctl-spine-head::after { content: ''; flex: 1; height: 1px; background: linear-gradient(90deg, var(--border), transparent); }

/* ===== 战略目标双列瀑布 ===== */
.ctl-goals { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 22px; align-items: start; }
.ctl-goal { background: var(--surface); border: 1px solid var(--border); border-radius: 20px; box-shadow: var(--lv-card-shadow); overflow: hidden; transition: border-color var(--dur-fast), box-shadow var(--dur-fast); }
.ctl-goal:hover { border-color: var(--lv-mint); box-shadow: var(--lv-card-shadow-hover); }
.ctl-goal-card { display: flex; align-items: center; gap: 14px; padding: 16px 20px; cursor: pointer; }
.ctl-goal-index { flex: none; width: 42px; height: 42px; border-radius: 13px; display: grid; place-items: center; background: var(--lv-green-faint); color: var(--lv-green-deep); font-weight: 800; font-size: var(--fs-title); }
.ctl-goal-body { flex: 1; min-width: 0; }
.ctl-goal-body .ctl-eyebrow { margin-bottom: 2px; }
.ctl-goal-name { font-size: var(--fs-headline); font-weight: 750; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ctl-goal-meta { margin-top: 2px; font-size: var(--fs-sub); color: var(--text-3); }
.ctl-goal-right { display: flex; align-items: center; gap: 10px; flex: none; }
.ctl-fold-chip { flex: none; font-size: var(--fs-caption); color: var(--text-3); background: var(--surface-2); border: 1px solid var(--border); border-radius: var(--radius-full); padding: 4px 10px; }
.ctl-ring { position: relative; width: 44px; height: 44px; }
.ctl-ring svg { transform: rotate(-90deg); }
.ctl-ring-bg { stroke: var(--surface-3, #ecefe7); }
.ctl-ring-fg { stroke: var(--lv-green); }
.ctl-ring b { position: absolute; inset: 0; display: grid; place-items: center; font-size: var(--fs-sub); font-weight: 800; color: var(--lv-green-deep); }
.ctl-fold { flex: none; width: 28px; height: 28px; border-radius: 50%; border: 1px solid var(--border); background: var(--surface); display: grid; place-items: center; color: var(--text-3); cursor: pointer; transition: var(--dur-fast); }
.ctl-fold:hover { border-color: var(--lv-green); color: var(--lv-green-deep); background: var(--lv-green-faint); }
.ctl-fold svg { transition: transform var(--dur-slow); }
.ctl-goal.collapsed .ctl-fold svg { transform: rotate(180deg); }
.ctl-branch { border-top: 1px dashed var(--border); padding: 14px 16px 16px; display: flex; flex-direction: column; gap: 12px; }

/* ===== 项目卡 ===== */
.ctl-proj { position: relative; background: var(--surface-2); border: 1px solid var(--border); border-radius: 14px; transition: border-color var(--dur-fast), box-shadow var(--dur-fast); }
.ctl-proj:hover { border-color: var(--lv-mint); box-shadow: var(--lv-card-shadow); }
.ctl-proj::before { content: ''; position: absolute; left: 20px; top: 0; bottom: 0; width: 2px; background: linear-gradient(var(--lv-rail), color-mix(in srgb, var(--lv-green) 6%, transparent)); border-radius: 2px; }
.ctl-proj-head { display: flex; align-items: center; gap: 12px; padding: 13px 16px 13px 34px; cursor: pointer; }
.ctl-badge { flex: none; height: 21px; padding: 0 9px; border-radius: var(--radius-full); background: var(--lv-green-soft); color: var(--lv-green-deep); font-size: var(--fs-caption); font-weight: 800; display: inline-flex; align-items: center; }
.ctl-proj-title { flex: 1; min-width: 0; font-size: var(--fs-title); font-weight: 750; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ctl-focus-badge { flex: none; font-size: var(--fs-caption); font-weight: 800; color: var(--accent); background: var(--accent-light); padding: 3px 8px; border-radius: var(--radius-full); }
.ctl-stale { flex: none; font-size: var(--fs-caption); color: var(--warning); font-weight: 700; }
.ctl-pmeta { font-size: var(--fs-caption); color: var(--text-3); flex: none; }
.ctl-pbar { flex: none; width: 96px; height: 6px; border-radius: var(--radius-full); background: var(--surface-3, #edefe8); overflow: hidden; }
.ctl-pbar i { display: block; height: 100%; border-radius: var(--radius-full); background: linear-gradient(90deg, var(--lv-green), #58c98d); }
.ctl-pct { flex: none; width: 38px; text-align: right; font-size: var(--fs-caption); font-weight: 800; color: var(--lv-green-deep); }
.ctl-proj.collapsed .ctl-proj-head .ctl-fold svg { transform: rotate(180deg); }

/* ===== 指标网格 ===== */
.ctl-metrics { display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 10px; padding: 0 14px 14px 34px; }
.ctl-metric { background: var(--surface); border: 1px solid var(--border); border-radius: 11px; padding: 11px 13px; cursor: pointer; transition: var(--dur-fast); }
.ctl-metric:hover { background: var(--lv-green-faint); border-color: var(--lv-mint); }
.ctl-metric-head { display: flex; align-items: center; gap: 8px; }
.ctl-metric-badge { flex: none; height: 17px; padding: 0 7px; border-radius: var(--radius-full); background: color-mix(in srgb, var(--lv-green) 12%, transparent); color: var(--lv-green-deep); font-size: var(--fs-caption); font-weight: 800; display: inline-flex; align-items: center; }
.ctl-metric-name { flex: 1; min-width: 0; font-size: var(--fs-sub); font-weight: 700; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ctl-metric-pct { font-size: var(--fs-caption); font-weight: 800; color: var(--text-2); flex: none; }
.ctl-mbar { margin-top: 8px; height: 4px; border-radius: var(--radius-full); background: var(--surface-3, #edefe8); overflow: hidden; }
.ctl-mbar i { display: block; height: 100%; background: linear-gradient(90deg, var(--lv-green), #58c98d); }
.ctl-tasks { margin-top: 9px; display: flex; flex-direction: column; gap: 5px; }
.ctl-task { display: flex; align-items: center; gap: 8px; padding: 6px 9px; border-radius: 8px; background: var(--surface); border: 1px solid var(--border); font: inherit; font-size: var(--fs-sub); color: var(--text-2); cursor: pointer; transition: var(--dur-fast); text-align: left; }
.ctl-task:hover { border-color: var(--lv-mint); color: var(--text); }
.ctl-dot { flex: none; width: 6.5px; height: 6.5px; border-radius: 50%; }
.ctl-dot.st-todo { background: var(--text-4, #c8cec2); }
.ctl-dot.st-doing { background: var(--warning); }
.ctl-dot.st-done { background: var(--lv-green); }
.ctl-dot.st-stale { background: var(--warning); }
.ctl-task.task-done { color: var(--text-3); }
.ctl-task.task-done .ctl-task-t { text-decoration: line-through; text-decoration-color: color-mix(in srgb, var(--text) 22%, transparent); }
.ctl-task-t { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ctl-task-pri { margin-left: auto; flex: none; font-size: var(--fs-caption); color: var(--text-3); }
.ctl-empty-inline { margin-top: 9px; font-size: var(--fs-caption); color: var(--text-3); padding: 6px 2px; }
.ctl-empty-panel { font-size: var(--fs-sub); color: var(--text-3); padding: 14px 20px; }

/* ===== 散叶 ===== */
.ctl-orphan { margin-top: 26px; background: var(--surface); border: 1px dashed var(--lv-mint); border-radius: 20px; padding: 16px 20px 18px; }
.ctl-orphan-head { display: flex; align-items: center; gap: 10px; margin-bottom: 12px; cursor: pointer; }
.ctl-orphan-head b { font-size: var(--fs-body); }
.ctl-orphan-head span { font-size: var(--fs-sub); color: var(--text-3); }
.ctl-orphan-list { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 8px; }
.ctl-orphan-task { display: flex; align-items: center; gap: 9px; padding: 9px 12px; border-radius: 10px; background: var(--surface-2); border: 1px solid var(--border); font: inherit; font-size: var(--fs-sub); color: var(--text-2); cursor: pointer; transition: var(--dur-fast); text-align: left; }
.ctl-orphan-task:hover { border-color: var(--lv-mint); background: var(--lv-green-faint); }

/* ===== 聚焦态：根脉与目标降级，项目成主角 ===== */
.ctl.focused .ctl-rootband { opacity: .72; box-shadow: none; }
.ctl.focused .ctl-root-text { font-size: var(--fs-sub); color: var(--text-2); }
.ctl.focused .ctl-trunk { height: 18px; }
.ctl.focused .ctl-spine-head { margin: 12px auto 10px; }
.ctl.focused .ctl-goal-card { background: var(--surface-2); }
.ctl.focused .ctl-proj { box-shadow: var(--lv-card-shadow-hover); border-color: var(--lv-mint); background: var(--surface); }
.ctl.focused .ctl-proj-title { font-size: var(--fs-headline); color: var(--lv-green-deep); }

@media (max-width: 1200px) {
  .ctl-goals { grid-template-columns: 1fr; }
}
</style>
