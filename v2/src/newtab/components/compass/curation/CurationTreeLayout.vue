<script setup lang="ts">
/**
 * V3.9.32（批 A）：策展模式 · 树状布局（默认）。
 * 自上而下六层纵向卡片链：愿景/使命 → 战略目标 → 项目 → 指标 → 任务；页面上下滑动通览。
 * 只读镜像：本组件零写库——所有交互只是 emit（open 开只读抽屉 / toggle 折叠）。
 * 折叠态由宿主（CompassCurationPage）的 collapsedIds 单一真源驱动。
 */
import type { CurationSel, CurationTree } from '@/shared/utils/compassCurationModel'

defineProps<{ tree: CurationTree; collapsed: Set<string> }>()

const emit = defineEmits<{
  (e: 'open', sel: CurationSel): void
  (e: 'toggle', id: string): void
}>()

const stCls: Record<string, string> = { done: 'st-done', doing: 'st-doing', todo: 'st-todo', stale: 'st-stale' }
const stLabel: Record<string, string> = { done: '已完成', doing: '进行中', todo: '待开始', stale: '停滞 14 天+' }
const priLabel: Record<string, string> = { high: '高', medium: '中', low: '低' }
</script>

<template>
  <div class="ctl">
    <!-- 愿景 / 使命（塔顶双卡） -->
    <div class="cv-top">
      <div class="cv-card cv-hero" role="button" tabindex="0" @click="emit('open', { kind: 'vision' })" @keydown.enter="emit('open', { kind: 'vision' })">
        <span class="cv-k">愿景</span>
        <p class="cv-hero-t">{{ tree.vision || '尚未填写愿景' }}</p>
      </div>
      <div class="cv-card cv-hero" role="button" tabindex="0" @click="emit('open', { kind: 'mission' })" @keydown.enter="emit('open', { kind: 'mission' })">
        <span class="cv-k">使命</span>
        <p class="cv-hero-t">{{ tree.mission || '尚未填写使命' }}</p>
      </div>
    </div>
    <div class="cv-rootline" aria-hidden="true"></div>

    <!-- 战略目标 -->
    <section v-for="(g, gi) in tree.goals" :key="g.dir.id" class="cv-goal">
      <div class="cv-card cv-goal-card" role="button" tabindex="0" @click="emit('open', { kind: 'goal', goal: g })" @keydown.enter="emit('open', { kind: 'goal', goal: g })">
        <span class="cv-idx">{{ gi + 1 }}</span>
        <b class="cv-t">{{ g.dir.name || '未命名战略目标' }}</b>
        <span class="cv-meta">{{ g.projects.length }} 项目 · {{ g.projects.reduce((s, P) => s + P.totalCount, 0) }} 任务</span>
        <button class="cv-fold" type="button" :aria-expanded="!collapsed.has('g' + g.dir.id)"
          :title="collapsed.has('g' + g.dir.id) ? '展开本目标' : '折叠本目标'"
          @click.stop="emit('toggle', 'g' + g.dir.id)">{{ collapsed.has('g' + g.dir.id) ? '▸' : '▾' }}</button>
      </div>
      <div v-if="!collapsed.has('g' + g.dir.id)" class="cv-indent">
        <div v-for="P in g.projects" :key="P.project.id" class="cv-proj">
          <div class="cv-card cv-p-card" role="button" tabindex="0" @click="emit('open', { kind: 'project', node: P })" @keydown.enter="emit('open', { kind: 'project', node: P })">
            <div class="cv-p-head">
              <b class="cv-t">{{ P.project.name || '未命名项目' }}</b>
              <span v-if="P.project.isFocused" class="cv-badge">主攻</span>
              <span class="cv-meta">{{ P.doneCount }}/{{ P.totalCount }} · {{ P.progress }}%</span>
              <span v-if="P.stalled" class="cv-warn">停滞 14 天+</span>
              <button class="cv-fold" type="button" :aria-expanded="!collapsed.has('p' + P.project.id)"
                @click.stop="emit('toggle', 'p' + P.project.id)">{{ collapsed.has('p' + P.project.id) ? '▸' : '▾' }}</button>
            </div>
            <div class="cv-track"><span class="cv-fill" :style="{ width: P.progress + '%' }"></span></div>
          </div>
          <div v-if="!collapsed.has('p' + P.project.id)" class="cv-indent">
            <div v-for="M in P.metrics" :key="M.metric.id" class="cv-metric">
              <div class="cv-card cv-m-card" role="button" tabindex="0" @click="emit('open', { kind: 'metric', node: M })" @keydown.enter="emit('open', { kind: 'metric', node: M })">
                <div class="cv-p-head">
                  <b class="cv-t">{{ M.metric.title || '未命名指标' }}</b>
                  <span class="cv-meta">{{ M.doneCount }}/{{ M.totalCount }} · {{ M.progress }}%</span>
                  <span v-if="M.metric.target" class="cv-target">{{ M.metric.target }}</span>
                  <button class="cv-fold" type="button" :aria-expanded="!collapsed.has('m' + M.metric.id)"
                    @click.stop="emit('toggle', 'm' + M.metric.id)">{{ collapsed.has('m' + M.metric.id) ? '▸' : '▾' }}</button>
                </div>
                <div v-if="M.totalCount" class="cv-track cv-metric-track" aria-hidden="true"><span class="cv-fill" :style="{ width: M.progress + '%' }"></span></div>
                <p v-if="M.metric.acceptance" class="cv-acc">验收：{{ M.metric.acceptance }}</p>
                <p v-if="!M.totalCount" class="cv-missing">⚠ 缺任务：验收已定，动作未落</p>
              </div>
              <ul v-if="!collapsed.has('m' + M.metric.id) && M.tasks.length" class="cv-tasks cv-indent">
                <li v-for="T in M.tasks" :key="T.task.id" class="cv-card cv-t-row" :class="'task-' + T.status" role="button" tabindex="0"
                  @click="emit('open', { kind: 'task', node: T })" @keydown.enter="emit('open', { kind: 'task', node: T })">
                  <span class="cv-st" :class="stCls[T.status]" :title="stLabel[T.status]"></span>
                  <span class="cv-tt">{{ T.task.title || '未命名任务' }}</span>
                  <span v-if="T.status === 'stale'" class="cv-warn">{{ stLabel.stale }}</span>
                  <span v-if="T.task.priority" class="cv-pri">{{ priLabel[T.task.priority] || '中' }}优</span>
                  <span v-if="T.status === 'done' && T.task.completedAt" class="cv-meta">{{ new Date(T.task.completedAt).toLocaleDateString() }}</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- 散叶 · 未归档任务 -->
    <section v-if="tree.orphans.length" class="cv-card cv-orph">
      <div class="cv-orph-head" role="button" tabindex="0"
        @click="emit('open', { kind: 'orphans' })" @keydown.enter="emit('open', { kind: 'orphans' })">
        <b class="cv-t">散叶 · 未归档任务</b>
        <span class="cv-meta">{{ tree.orphans.length }} 件 · 挂上指标即上枝</span>
      </div>
      <ul class="cv-tasks">
        <li v-for="T in tree.orphans" :key="T.task.id" class="cv-card cv-t-row" :class="'task-' + T.status" role="button" tabindex="0"
          @click.stop="emit('open', { kind: 'task', node: T })" @keydown.enter.stop="emit('open', { kind: 'task', node: T })">
          <span class="cv-st" :class="stCls[T.status]" :title="stLabel[T.status]"></span>
          <span class="cv-tt">{{ T.task.title || '未命名任务' }}</span>
          <span v-if="T.status === 'stale'" class="cv-warn">{{ stLabel.stale }}</span>
        </li>
      </ul>
    </section>
  </div>
</template>

<style scoped>
.ctl { max-width: 880px; margin: 0 auto; padding: 4px 0 40px; }
.cv-card { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-md, 10px); padding: 10px 14px; cursor: pointer; transition: border-color var(--dur-fast, 120ms), background var(--dur-fast, 120ms); }
.cv-card:hover { border-color: var(--accent); background: var(--surface-2); }
.cv-card:focus-visible { outline: 2px solid var(--accent); outline-offset: 1px; }
.cv-top { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.cv-hero { border-color: var(--border-strong); }
.cv-k { display: inline-block; font-size: var(--fs-caption); font-weight: 700; color: var(--accent-ink); letter-spacing: .1em; margin-bottom: 4px; }
.cv-hero-t { margin: 0; font-size: var(--fs-title); font-weight: 700; color: var(--text); line-height: 1.5; overflow-wrap: anywhere; }
.cv-rootline { width: 1px; height: 26px; margin: 0 auto; background: var(--border-strong); }
.cv-goal { margin: 18px 0; }
.cv-goal-card { display: flex; align-items: center; gap: 10px; border-left: 3px solid var(--accent); }
.cv-idx { flex: none; width: 22px; height: 22px; border-radius: 7px; background: var(--accent); color: #fff; display: grid; place-items: center; font-size: var(--fs-caption); font-weight: 700; }
.cv-t { color: var(--text); font-size: var(--fs-title); overflow-wrap: anywhere; }
.cv-meta { color: var(--text-3); font-size: var(--fs-caption); flex: none; }
.cv-badge { flex: none; font-size: 10px; font-weight: 700; color: var(--accent-ink); border: 1px solid var(--accent); border-radius: 999px; padding: 0 7px; }
.cv-warn { flex: none; font-size: 10px; color: var(--warning); border: 1px solid var(--warning); border-radius: 999px; padding: 0 7px; }
.cv-target { flex: none; font-size: var(--fs-caption); color: var(--text-3); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 220px; }
.cv-fold { flex: none; margin-left: auto; width: 22px; height: 22px; border-radius: 6px; border: 1px solid var(--border); background: transparent; color: var(--text-3); cursor: pointer; font-family: inherit; font-size: 11px; line-height: 1; }
.cv-fold:hover { color: var(--accent-ink); border-color: var(--accent); }
.cv-indent { margin-left: 15px; padding-left: 14px; border-left: 1px solid var(--border); margin-top: 8px; display: flex; flex-direction: column; gap: 8px; }
.cv-p-card { border-left: 3px solid var(--border-strong); }
.cv-p-head { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.cv-track { height: 4px; border-radius: 999px; background: var(--surface-3); margin-top: 8px; overflow: hidden; }
.cv-fill { display: block; height: 100%; border-radius: 999px; background: var(--accent); }
.cv-m-card { border-left: 3px solid var(--border); }
.cv-metric-track { margin-top: 7px; }
.cv-acc { margin: 6px 0 0; font-size: var(--fs-caption); color: var(--text-3); overflow-wrap: anywhere; }
.cv-missing { margin: 6px 0 0; font-size: var(--fs-caption); color: var(--warning); }
.cv-tasks { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 5px; }
.cv-t-row { display: flex; align-items: center; gap: 8px; padding: 6px 10px; }
.cv-t-row.task-done { background: var(--surface-3); color: var(--text-3); }
.cv-t-row.task-done .cv-tt { color: var(--text-3); }
.cv-t-row.task-todo { background: var(--tag-info-bg); }
.cv-t-row.task-doing { border-left: 2px solid var(--accent); background: var(--tag-info-bg); }
.cv-t-row.task-stale { border-color: color-mix(in srgb, var(--warning) 35%, var(--border)); background: var(--warning-bg-soft); }
.cv-st { flex: none; width: 8px; height: 8px; border-radius: 50%; }
.st-done { background: var(--success); }
.st-doing { background: var(--accent); box-shadow: 0 0 0 3px var(--accent-light); }
.st-todo { background: var(--text-4); }
.st-stale { background: var(--warning); }
.cv-tt { color: var(--text-2); font-size: var(--fs-body); flex: 1; min-width: 0; overflow-wrap: anywhere; }
.cv-pri { flex: none; font-size: var(--fs-caption); color: var(--text-3); }
.cv-orph { display: flex; align-items: stretch; flex-direction: column; gap: 10px; margin-top: 18px; border-style: dashed; cursor: default; }
.cv-orph-head { display: flex; align-items: center; gap: 10px; cursor: pointer; }
.cv-orph-head .cv-meta { margin-left: auto; }
@media (max-width: 800px) {
  .cv-top { grid-template-columns: 1fr; }
  .cv-target { display: none; }
}
</style>
