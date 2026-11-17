<script setup lang="ts">
/**
 * V3.9.32（批 A）：策展模式 · 树状布局。
 * V4.3.5：把纵向卡片链重构成 OPPO 风格的轻量层级树。
 *
 * 结构原则：
 * - 愿景 / 使命是树冠，战略目标是章节，项目是枝干，成功指标是节点，任务是叶片。
 * - 用柔和绿色层级线和低对比表面表达归属，不再依赖厚重边框和满屏色块。
 * - 保留只读边界：打开详情与折叠只 emit，不在本组件写库。
 */
import type { CurationGoalNode, CurationSel, CurationTree } from '@/shared/utils/compassCurationModel'

defineProps<{ tree: CurationTree; collapsed: Set<string> }>()

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
const stLabel: Record<string, string> = {
  done: '已完成',
  doing: '进行中',
  todo: '待开始',
  stale: '停滞 14 天+',
}
const priLabel: Record<string, string> = { high: '高', medium: '中', low: '低' }

function goalProgress(goal: CurationGoalNode): number {
  const total = goal.projects.reduce((sum, project) => sum + project.totalCount, 0)
  const done = goal.projects.reduce((sum, project) => sum + project.doneCount, 0)
  return total ? Math.round(done / total * 100) : 0
}
</script>

<template>
  <div class="ctl">
    <!-- 树冠：愿景 / 使命 -->
    <div class="cv-top">
      <div class="cv-card cv-hero cv-vision" role="button" tabindex="0"
        @click="emit('open', { kind: 'vision' })"
        @keydown.enter.prevent="emit('open', { kind: 'vision' })">
        <span class="cv-eyebrow"><i class="cv-eyebrow-dot"></i>愿景</span>
        <p class="cv-hero-t">{{ tree.vision || '尚未填写愿景' }}</p>
        <span class="cv-hero-hint">这棵树为什么长 <b>详情</b></span>
      </div>
      <div class="cv-card cv-hero cv-mission" role="button" tabindex="0"
        @click="emit('open', { kind: 'mission' })"
        @keydown.enter.prevent="emit('open', { kind: 'mission' })">
        <span class="cv-eyebrow"><i class="cv-eyebrow-dot"></i>使命</span>
        <p class="cv-hero-t">{{ tree.mission || '尚未填写使命' }}</p>
        <span class="cv-hero-hint">这棵树为什么长 <b>详情</b></span>
      </div>
    </div>
    <div class="cv-rootline" aria-hidden="true"><i></i></div>

    <div class="cv-overview">
      <span class="cv-overview-title">战略骨架</span>
      <span class="cv-overview-meta">{{ tree.goals.length }} 个战略目标 · {{ tree.orphans.length }} 件未归档</span>
    </div>

    <section v-for="(g, gi) in tree.goals" :key="g.dir.id" class="cv-goal">
      <div class="cv-card cv-goal-card" role="button" tabindex="0"
        @click="emit('open', { kind: 'goal', goal: g })"
        @keydown.enter.prevent="emit('open', { kind: 'goal', goal: g })">
        <span class="cv-index">{{ String(gi + 1).padStart(2, '0') }}</span>
        <div class="cv-goal-body">
          <span class="cv-eyebrow">战略目标</span>
          <b class="cv-t">{{ g.dir.name || '未命名战略目标' }}</b>
          <span class="cv-meta">
            {{ g.projects.length }} 个项目 · {{ g.projects.reduce((s, P) => s + P.totalCount, 0) }} 个任务
          </span>
        </div>
        <div class="cv-goal-progress">
          <b>{{ goalProgress(g) }}%</b>
          <span>完成</span>
        </div>
        <button class="cv-fold" type="button" :aria-expanded="!collapsed.has('g' + g.dir.id)"
          :title="collapsed.has('g' + g.dir.id) ? '展开本目标' : '折叠本目标'"
          @click.stop="emit('toggle', 'g' + g.dir.id)">
          {{ collapsed.has('g' + g.dir.id) ? '⌄' : '⌃' }}
        </button>
      </div>

      <div v-if="!collapsed.has('g' + g.dir.id)" class="cv-branch">
        <div class="cv-branch-line" aria-hidden="true"></div>
        <div v-if="g.projects.length" class="cv-projects">
          <div v-for="P in g.projects" :key="P.project.id" class="cv-project">
          <div class="cv-card cv-p-card" role="button" tabindex="0"
            @click="emit('open', { kind: 'project', node: P })"
            @keydown.enter.prevent="emit('open', { kind: 'project', node: P })">
            <div class="cv-p-head">
              <div class="cv-p-title">
                <span class="cv-node-mark">项目</span>
                <b class="cv-t">{{ P.project.name || '未命名项目' }}</b>
                <span v-if="P.project.isFocused" class="cv-badge">主攻</span>
              </div>
              <div class="cv-p-stats">
                <span>{{ P.doneCount }}/{{ P.totalCount }}</span>
                <b>{{ P.progress }}%</b>
              </div>
              <button class="cv-fold" type="button" :aria-expanded="!collapsed.has('p' + P.project.id)"
                :title="collapsed.has('p' + P.project.id) ? '展开本项目' : '折叠本项目'"
                @click.stop="emit('toggle', 'p' + P.project.id)">
                {{ collapsed.has('p' + P.project.id) ? '⌄' : '⌃' }}
              </button>
            </div>
            <div class="cv-p-meta">
              <span>{{ P.metrics.length }} 个成功指标</span>
              <span v-if="P.stalled" class="cv-warn">停滞 14 天+</span>
            </div>
            <div class="cv-track" aria-hidden="true">
              <span class="cv-fill" :style="{ width: P.progress + '%' }"></span>
            </div>
          </div>

          <div v-if="!collapsed.has('p' + P.project.id)" class="cv-metrics">
            <article v-for="M in P.metrics" :key="M.metric.id" class="cv-metric">
              <div class="cv-card cv-m-card" role="button" tabindex="0"
                @click="emit('open', { kind: 'metric', node: M })"
                @keydown.enter.prevent="emit('open', { kind: 'metric', node: M })">
                <div class="cv-m-head">
                  <div class="cv-m-title">
                    <span class="cv-node-mark cv-metric-mark">指标</span>
                    <b class="cv-t">{{ M.metric.title || '未命名指标' }}</b>
                  </div>
                  <div class="cv-m-stats">
                    <span>{{ M.doneCount }}/{{ M.totalCount }}</span>
                    <b>{{ M.progress }}%</b>
                  </div>
                  <button class="cv-fold" type="button" :aria-expanded="!collapsed.has('m' + M.metric.id)"
                    :title="collapsed.has('m' + M.metric.id) ? '展开本指标任务' : '折叠本指标任务'"
                    @click.stop="emit('toggle', 'm' + M.metric.id)">
                    {{ collapsed.has('m' + M.metric.id) ? '⌄' : '⌃' }}
                  </button>
                </div>
                <div class="cv-m-sub">
                  <span v-if="M.metric.target" class="cv-target" :title="M.metric.target">{{ M.metric.target }}</span>
                  <span v-if="!M.totalCount" class="cv-missing">还没有挂载任务</span>
                  <span v-else>任务进度</span>
                </div>
                <div class="cv-track cv-metric-track" aria-hidden="true">
                  <span class="cv-fill" :style="{ width: M.progress + '%' }"></span>
                </div>
              </div>

              <div v-if="!collapsed.has('m' + M.metric.id) && M.tasks.length" class="cv-task-list">
                <button v-for="T in M.tasks" :key="T.task.id" type="button"
                  class="cv-card cv-task-row" :class="'task-' + T.status"
                  @click="emit('open', { kind: 'task', node: T })">
                  <span class="cv-task-state">
                    <i class="cv-st" :class="stCls[T.status]" :title="stLabel[T.status]"></i>
                    {{ stLabel[T.status] }}
                  </span>
                  <span class="cv-task-title">{{ T.task.title || '未命名任务' }}</span>
                  <span class="cv-task-meta">
                    <span v-if="T.task.priority" class="cv-pri">{{ priLabel[T.task.priority] || '中' }}优</span>
                    <time v-if="T.task.completedAt && T.status === 'done'">{{ new Date(T.task.completedAt).toLocaleDateString() }}</time>
                  </span>
                </button>
              </div>
              <div v-if="!collapsed.has('m' + M.metric.id) && !M.tasks.length" class="cv-empty-inline">
                这个指标下还没有任务
              </div>
            </article>
          </div>
        </div>
        </div>
        <div v-if="!g.projects.length" class="cv-empty-panel">
          这个战略目标下还没有项目
        </div>
      </div>
    </section>

    <section v-if="tree.orphans.length" class="cv-card cv-orph">
      <div class="cv-orph-head" role="button" tabindex="0"
        @click="emit('open', { kind: 'orphans' })"
        @keydown.enter.prevent="emit('open', { kind: 'orphans' })">
        <div>
          <span class="cv-eyebrow">散叶</span>
          <b class="cv-t">未归档任务</b>
        </div>
        <span class="cv-meta">{{ tree.orphans.length }} 件 · 挂上指标即上枝</span>
        <span class="cv-orph-arrow">查看</span>
      </div>
      <div class="cv-orph-list">
        <button v-for="T in tree.orphans" :key="T.task.id" type="button"
          class="cv-card cv-task-row" :class="'task-' + T.status"
          @click="emit('open', { kind: 'task', node: T })">
          <span class="cv-task-state">
            <i class="cv-st" :class="stCls[T.status]" :title="stLabel[T.status]"></i>
            {{ stLabel[T.status] }}
          </span>
          <span class="cv-task-title">{{ T.task.title || '未命名任务' }}</span>
          <span v-if="T.status === 'stale'" class="cv-warn">{{ stLabel.stale }}</span>
        </button>
      </div>
    </section>
  </div>
</template>

<style scoped>
.ctl {
  --ctl-green: var(--success);
  --ctl-mint: color-mix(in srgb, var(--success) 72%, var(--info-blue));
  --ctl-green-soft: color-mix(in srgb, var(--success) 9%, var(--surface));
  --ctl-green-faint: color-mix(in srgb, var(--success) 5%, var(--surface-2));
  --ctl-rail: color-mix(in srgb, var(--success) 30%, var(--border));
  --ctl-card: color-mix(in srgb, var(--surface) 98%, var(--bg));
  --ctl-shadow: 0 16px 42px color-mix(in srgb, var(--success) 8%, transparent);
  position: relative;
  isolation: isolate;
  max-width: 1180px;
  margin: 0 auto;
  padding: 12px 0 60px;
}
.ctl::before {
  content: '';
  position: absolute;
  z-index: -1;
  inset: -28px 0 30%;
  pointer-events: none;
  background:
    radial-gradient(ellipse at 18% 0%, color-mix(in srgb, var(--success) 11%, transparent), transparent 56%),
    radial-gradient(ellipse at 92% 20%, color-mix(in srgb, var(--info-blue) 7%, transparent), transparent 54%);
}
.ctl::after {
  content: '';
  position: absolute;
  z-index: -1;
  inset: 18px 0 0;
  pointer-events: none;
  opacity: .24;
  background-image: radial-gradient(color-mix(in srgb, var(--success) 18%, var(--border)) .6px, transparent .6px);
  background-size: 22px 22px;
  mask-image: linear-gradient(to bottom, black, transparent 72%);
}
.cv-card {
  background:
    linear-gradient(145deg, color-mix(in srgb, var(--surface) 92%, var(--success) 8%), var(--ctl-card) 44%),
    var(--ctl-card);
  border: 1px solid var(--border);
  border-color: color-mix(in srgb, var(--success) 14%, var(--border));
  border-radius: 16px;
  cursor: pointer;
  transition: border-color var(--dur-fast), background var(--dur-fast), box-shadow var(--dur-fast), transform var(--dur-fast);
}
.cv-card:hover {
  border-color: color-mix(in srgb, var(--success) 42%, var(--border));
  background: var(--surface);
  box-shadow: var(--ctl-shadow);
  transform: translateY(-2px);
}
.cv-card:focus-visible {
  outline: 2px solid var(--success);
  outline-offset: 2px;
}
.cv-top {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}
.cv-hero {
  min-height: 126px;
  padding: 22px 24px 18px;
  display: flex;
  flex-direction: column;
  gap: 9px;
  border-radius: 22px;
  background:
    linear-gradient(135deg, color-mix(in srgb, var(--success) 13%, var(--surface)), var(--surface) 62%),
    var(--surface);
  box-shadow: 0 12px 30px color-mix(in srgb, var(--success) 7%, transparent);
}
.cv-vision {
  border-color: color-mix(in srgb, var(--success) 34%, var(--border));
}
.cv-mission {
  background:
    linear-gradient(135deg, color-mix(in srgb, var(--info-blue) 8%, var(--surface)), var(--surface) 60%),
    var(--surface);
}
.cv-eyebrow {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  width: fit-content;
  color: color-mix(in srgb, var(--success) 82%, var(--text));
  font-size: var(--fs-micro);
  font-weight: 700;
  letter-spacing: .16em;
}
.cv-eyebrow-dot {
  width: 6px;
  height: 6px;
  display: inline-block;
  border-radius: 50%;
  background: var(--ctl-green);
  box-shadow: 0 0 0 4px color-mix(in srgb, var(--success) 12%, transparent);
}
.cv-hero-t {
  margin: 0;
  color: var(--text);
  font-size: clamp(18px, 1.45vw, 22px);
  font-weight: 720;
  letter-spacing: -.02em;
  line-height: 1.35;
  overflow-wrap: anywhere;
}
.cv-hero-hint {
  margin-top: auto;
  color: var(--text-3);
  font-size: var(--fs-caption);
}
.cv-hero-hint b {
  color: var(--success);
  font-size: var(--fs-sub);
}
.cv-rootline {
  position: relative;
  width: 2px;
  height: 38px;
  margin: 0 auto;
  border-radius: var(--radius-full);
  background: linear-gradient(var(--ctl-mint), var(--ctl-rail));
}
.cv-rootline::after {
  content: '';
  position: absolute;
  left: -3px;
  top: 50%;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--ctl-mint);
  box-shadow: 0 0 0 5px color-mix(in srgb, var(--success) 12%, transparent);
}
.cv-overview {
  display: flex;
  align-items: baseline;
  gap: 10px;
  margin: 8px 4px 14px;
}
.cv-overview::after {
  content: '';
  flex: 1;
  height: 1px;
  background: linear-gradient(90deg, var(--ctl-rail), transparent);
}
.cv-overview-title {
  color: var(--text);
  font-size: var(--fs-sub);
  font-weight: 720;
  letter-spacing: .08em;
}
.cv-overview-meta {
  color: var(--text-3);
  font-size: var(--fs-caption);
}
.cv-goal {
  margin: 18px 0 26px;
}
.cv-goal-card {
  display: grid;
  grid-template-columns: 42px minmax(0, 1fr) auto 28px;
  align-items: center;
  gap: 12px;
  padding: 17px 17px 17px 19px;
  border-color: color-mix(in srgb, var(--success) 28%, var(--border));
  border-radius: 18px;
  background:
    linear-gradient(90deg, color-mix(in srgb, var(--success) 10%, var(--surface)), var(--ctl-card) 44%),
    var(--ctl-card);
  box-shadow: 0 10px 28px color-mix(in srgb, var(--success) 5%, transparent);
}
.cv-index {
  width: 38px;
  height: 38px;
  display: grid;
  place-items: center;
  border-radius: 13px;
  color: color-mix(in srgb, var(--success) 88%, var(--text));
  background:
    linear-gradient(145deg, color-mix(in srgb, var(--success) 22%, var(--surface)), color-mix(in srgb, var(--success) 8%, var(--surface)));
  font-size: var(--fs-body);
  font-weight: 760;
  font-variant-numeric: tabular-nums;
}
.cv-goal-body {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.cv-t {
  color: var(--text);
  font-size: var(--fs-title);
  font-weight: 680;
  line-height: 1.4;
  overflow-wrap: anywhere;
}
.cv-goal-body .cv-t {
  font-size: var(--fs-headline);
  letter-spacing: -.015em;
}
.cv-meta {
  color: var(--text-3);
  font-size: var(--fs-caption);
  line-height: 1.45;
}
.cv-goal-progress {
  min-width: 54px;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 1px;
}
.cv-goal-progress b {
  color: color-mix(in srgb, var(--success) 82%, var(--text));
  font-size: var(--fs-headline);
  font-variant-numeric: tabular-nums;
}
.cv-goal-progress span {
  color: var(--text-3);
  font-size: var(--fs-micro);
}
.cv-fold {
  width: 28px;
  height: 28px;
  display: grid;
  place-items: center;
  flex: none;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: color-mix(in srgb, var(--surface) 72%, transparent);
  color: var(--text-3);
  cursor: pointer;
  font: inherit;
  font-size: var(--fs-sub);
  line-height: 1;
}
.cv-fold:hover {
  border-color: color-mix(in srgb, var(--success) 42%, var(--border));
  color: var(--success);
  background: var(--ctl-green-soft);
}
.cv-branch {
  position: relative;
  margin: 11px 0 0 21px;
  padding: 8px 0 2px 25px;
}
.cv-branch-line {
  position: absolute;
  left: 0;
  top: 0;
  bottom: 20px;
  width: 2px;
  border-radius: var(--radius-full);
  background: linear-gradient(var(--ctl-rail), color-mix(in srgb, var(--success) 10%, transparent));
}
.cv-projects {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(330px, 1fr));
  align-items: start;
  gap: 12px;
}
.cv-project {
  position: relative;
  min-width: 0;
  margin: 0;
}
.cv-project::before {
  content: '';
  position: absolute;
  left: -25px;
  top: 26px;
  width: 17px;
  height: 2px;
  border-radius: var(--radius-full);
  background: var(--ctl-mint);
}
.cv-p-card {
  padding: 15px 15px 13px;
  border-radius: 16px;
  background:
    linear-gradient(150deg, color-mix(in srgb, var(--surface) 88%, var(--success) 12%), var(--surface));
}
.cv-p-head,
.cv-m-head {
  display: flex;
  align-items: center;
  gap: 9px;
}
.cv-p-title,
.cv-m-title {
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
}
.cv-p-title .cv-t {
  font-size: var(--fs-body);
}
.cv-node-mark {
  flex: none;
  padding: 2px 6px;
  border: 1px solid color-mix(in srgb, var(--success) 24%, var(--border));
  border-radius: 6px;
  color: color-mix(in srgb, var(--success) 80%, var(--text));
  background: var(--ctl-green-soft);
  font-size: var(--fs-micro);
  font-weight: 700;
  letter-spacing: .03em;
}
.cv-p-title .cv-t {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.cv-p-stats,
.cv-m-stats {
  flex: none;
  display: flex;
  align-items: baseline;
  gap: 7px;
  color: var(--text-3);
  font-size: var(--fs-caption);
  font-variant-numeric: tabular-nums;
}
.cv-p-stats b,
.cv-m-stats b {
  color: var(--success);
  font-size: var(--fs-body);
}
.cv-badge {
  flex: none;
  padding: 1px 7px;
  border: 1px solid color-mix(in srgb, var(--success) 34%, var(--border));
  border-radius: var(--radius-full);
  color: color-mix(in srgb, var(--success) 84%, var(--text));
  background: var(--ctl-green-soft);
  font-size: var(--fs-micro);
  font-weight: 700;
}
.cv-p-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 5px 0 10px 0;
  color: var(--text-3);
  font-size: var(--fs-caption);
}
.cv-track {
  height: 5px;
  overflow: hidden;
  border-radius: var(--radius-full);
  background: color-mix(in srgb, var(--success) 10%, var(--surface-3));
}
.cv-fill {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, var(--ctl-mint), var(--success));
  transition: width var(--dur-slow) var(--ease-out-soft);
}
.cv-metrics {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(255px, 1fr));
  align-items: start;
  gap: 9px;
  margin: 9px 0 0 10px;
  padding-left: 14px;
  border-left: 1px dashed color-mix(in srgb, var(--success) 24%, var(--border));
}
.cv-metric {
  position: relative;
  container-type: inline-size;
}
.cv-metric::before {
  content: '';
  position: absolute;
  left: -14px;
  top: 24px;
  width: 10px;
  height: 2px;
  border-radius: var(--radius-full);
  background: color-mix(in srgb, var(--success) 24%, var(--border));
}
.cv-m-card {
  padding: 13px 13px 11px;
  border-radius: 14px;
  background: color-mix(in srgb, var(--surface) 94%, var(--success) 6%);
}
.cv-m-title .cv-t {
  min-width: 0;
  font-size: var(--fs-body);
  font-weight: 670;
}
.cv-m-sub {
  display: flex;
  gap: 8px;
  align-items: center;
  min-height: 16px;
  margin-top: 5px;
  color: var(--text-3);
  font-size: var(--fs-caption);
}
.cv-target {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.cv-missing {
  color: var(--warning);
}
.cv-metric-track {
  margin-top: 7px;
}
.cv-task-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-top: 7px;
}
.cv-task-row {
  display: flex;
  align-items: flex-start;
  gap: 9px;
  width: 100%;
  min-width: 0;
  padding: 8px 9px;
  border-radius: 9px;
  border-color: transparent;
  background: var(--ctl-green-faint);
  color: var(--text-2);
  font: inherit;
  text-align: left;
}
.cv-task-row:hover {
  border-color: color-mix(in srgb, var(--success) 28%, var(--border));
  background: color-mix(in srgb, var(--success) 9%, var(--surface));
}
.cv-task-state {
  flex: none;
  min-width: 48px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding-top: 1px;
  color: var(--text-3);
  font-size: var(--fs-micro);
}
.cv-st {
  width: 7px;
  height: 7px;
  flex: none;
  border-radius: 50%;
}
.st-done {
  background: var(--success);
}
.st-doing {
  background: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-light);
}
.st-todo {
  background: var(--text-4);
}
.st-stale {
  background: var(--warning);
}
.cv-task-title {
  min-width: 0;
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  color: var(--text);
  font-size: var(--fs-sub);
  line-height: 1.35;
}
.cv-task-meta {
  flex: none;
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding-top: 1px;
  color: var(--text-3);
  font-size: var(--fs-caption);
  font-variant-numeric: tabular-nums;
}
.cv-pri {
  padding: 1px 5px;
  border-radius: var(--radius-xs);
  background: var(--surface-3);
  color: var(--text-3);
  font-size: var(--fs-micro);
}
.cv-task-row.task-done {
  background: color-mix(in srgb, var(--surface-3) 74%, var(--surface));
}
.cv-task-row.task-done .cv-task-title {
  color: var(--text-3);
}
.cv-task-row.task-doing {
  border-color: color-mix(in srgb, var(--accent) 18%, var(--border));
  background: color-mix(in srgb, var(--accent) 5%, var(--surface));
}
.cv-task-row.task-stale {
  border-color: color-mix(in srgb, var(--warning) 30%, var(--border));
  background: var(--warning-bg-soft);
}
.cv-warn {
  flex: none;
  color: color-mix(in srgb, var(--warning) 82%, var(--text));
  font-size: var(--fs-micro);
}
.cv-empty-inline,
.cv-empty-panel {
  color: var(--text-3);
  font-size: var(--fs-caption);
}
.cv-empty-inline {
  padding: 7px 10px 0;
}
.cv-empty-panel {
  padding: 18px;
  border: 1px dashed var(--border);
  border-radius: var(--radius-md);
  text-align: center;
}
.cv-orph {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: 26px;
  padding: 17px;
  border-style: dashed;
  border-color: color-mix(in srgb, var(--success) 30%, var(--border));
  background:
    linear-gradient(135deg, color-mix(in srgb, var(--success) 6%, var(--surface)), var(--surface));
}
.cv-orph-head {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}
.cv-orph-head > div {
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.cv-orph-head .cv-meta {
  margin-left: auto;
}
.cv-orph-arrow {
  flex: none;
  color: var(--success);
  font-size: var(--fs-title);
}
.cv-orph-list {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 6px;
}
.cv-orph-list .cv-task-row {
  min-width: 0;
}
@container (max-width: 320px) {
  .cv-task-meta {
    display: none;
  }
}
@media (max-width: 800px) {
  .ctl {
    padding-bottom: 36px;
  }
  .cv-top {
    grid-template-columns: 1fr;
  }
  .cv-hero {
    min-height: 102px;
  }
  .cv-goal-card {
    grid-template-columns: 34px minmax(0, 1fr) 26px;
  }
  .cv-index {
    width: 30px;
    height: 30px;
  }
  .cv-goal-progress {
    display: none;
  }
  .cv-branch {
    margin-left: 12px;
    padding-left: 16px;
  }
  .cv-projects,
  .cv-metrics {
    grid-template-columns: 1fr;
  }
  .cv-project::before {
    left: -16px;
    width: 8px;
  }
  .cv-metrics {
    margin-left: 8px;
    padding-left: 12px;
  }
  .cv-metric::before {
    left: -12px;
    width: 7px;
  }
  .cv-orph-list {
    grid-template-columns: 1fr;
  }
  .cv-p-meta {
    margin-left: 0;
  }
  .cv-task-meta {
    display: none;
  }
}
</style>
