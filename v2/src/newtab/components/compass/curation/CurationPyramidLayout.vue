<script setup lang="ts">
/**
 * V3.9.32（批 A）：策展模式 · 金字塔布局（总览态）。
 * 愿景居顶、使命次之，战略目标→项目→指标→任务 逐层展开的塔形总览；
 * 与树状布局消费同一棵 CurationTree（同源），点击节点同样开只读抽屉。
 * 折叠在树状布局中生效；本布局恒为全展开总览（页脚有说明）。
 */
import { computed } from 'vue'
import type { CurationSel, CurationTree } from '@/shared/utils/compassCurationModel'

const props = defineProps<{ tree: CurationTree }>()
const emit = defineEmits<{ (e: 'open', sel: CurationSel): void }>()

const allProjects = computed(() => props.tree.goals.flatMap(g => g.projects.map(P => ({ ...P, goal: g.dir.name }))))
const allMetrics = computed(() => allProjects.value.flatMap(P => P.metrics.map(M => ({ ...M, proj: P.project.name }))))
const allTasks = computed(() => allMetrics.value.flatMap(M => M.tasks.map(T => ({ ...T, metric: M.metric.title }))))
const stCls: Record<string, string> = { done: 'st-done', doing: 'st-doing', todo: 'st-todo', stale: 'st-stale' }
</script>

<template>
  <div class="cpl">
    <div class="tier t1">
      <div class="cv-card hero" role="button" tabindex="0" @click="emit('open', { kind: 'vision' })" @keydown.enter="emit('open', { kind: 'vision' })">
        <span class="k">愿景</span><p>{{ tree.vision || '尚未填写愿景' }}</p>
      </div>
    </div>
    <div class="tier t2">
      <div class="cv-card hero" role="button" tabindex="0" @click="emit('open', { kind: 'mission' })" @keydown.enter="emit('open', { kind: 'mission' })">
        <span class="k">使命</span><p>{{ tree.mission || '尚未填写使命' }}</p>
      </div>
    </div>
    <div class="tier-label">战略目标 ×{{ tree.goals.length }}</div>
    <div class="tier t3">
      <div v-for="(g, gi) in tree.goals" :key="g.dir.id" class="cv-card chip goal" role="button" tabindex="0"
        @click="emit('open', { kind: 'goal', goal: g })" @keydown.enter="emit('open', { kind: 'goal', goal: g })">
        <b>{{ gi + 1 }}. {{ g.dir.name || '未命名战略目标' }}</b>
        <small>{{ g.projects.length }} 项目</small>
      </div>
    </div>
    <div class="tier-label">项目 ×{{ allProjects.length }}</div>
    <div class="tier t4">
      <div v-for="P in allProjects" :key="P.project.id" class="cv-card chip proj" role="button" tabindex="0"
        @click="emit('open', { kind: 'project', node: P })" @keydown.enter="emit('open', { kind: 'project', node: P })">
        <b>{{ P.project.name || '未命名项目' }}</b>
        <small>{{ P.doneCount }}/{{ P.totalCount }} · {{ P.progress }}% <template v-if="P.project.isFocused">· 主攻</template><template v-if="P.stalled"> · ⚠停滞</template></small>
        <span class="bar"><span :style="{ width: P.progress + '%' }"></span></span>
      </div>
    </div>
    <div class="tier-label">成功指标 ×{{ allMetrics.length }}</div>
    <div class="tier t5">
      <div v-for="M in allMetrics" :key="M.metric.id" class="cv-card chip met" role="button" tabindex="0"
        @click="emit('open', { kind: 'metric', node: M })" @keydown.enter="emit('open', { kind: 'metric', node: M })">
        <b>{{ M.metric.title || '未命名指标' }}</b>
        <small>{{ M.totalCount ? M.doneCount + '/' + M.totalCount + ' · ' + M.progress + '%' : '⚠ 缺任务' }}</small>
      </div>
    </div>
    <div class="tier-label">任务 ×{{ allTasks.length }} <span class="hint">（含未归档 {{ tree.orphans.length }} 件）</span></div>
    <div class="tier t6">
      <div v-for="T in allTasks" :key="'tk' + T.task.id" class="cv-card chip tk" role="button" tabindex="0"
        @click="emit('open', { kind: 'task', node: T })" @keydown.enter="emit('open', { kind: 'task', node: T })">
        <span class="st" :class="stCls[T.status]"></span><span class="tt">{{ T.task.title || '未命名任务' }}</span>
      </div>
      <div v-for="(T, i) in tree.orphans" :key="'or' + i" class="cv-card chip tk orph" role="button" tabindex="0"
        @click="emit('open', { kind: 'orphans' })" @keydown.enter="emit('open', { kind: 'orphans' })">
        <span class="st st-orph"></span><span class="tt">{{ T.task.title || '未命名任务' }}</span>
      </div>
    </div>
    <p class="cap">金字塔为总览态（恒全展开）；逐层折叠与滑动通览请切「树状」布局。</p>
  </div>
</template>

<style scoped>
.cpl { max-width: 1080px; margin: 0 auto; padding: 4px 0 40px; }
.tier { display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; margin: 0 0 6px; }
.tier-label { text-align: center; font-size: var(--fs-caption); font-weight: 700; color: var(--text-3); letter-spacing: .12em; margin: 14px 0 8px; }
.tier-label .hint { font-weight: 500; letter-spacing: 0; }
.cv-card { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-md, 10px); padding: 8px 12px; cursor: pointer; transition: border-color var(--dur-fast, 120ms), background var(--dur-fast, 120ms); }
.cv-card:hover { border-color: var(--accent); background: var(--surface-2); }
.cv-card:focus-visible { outline: 2px solid var(--accent); outline-offset: 1px; }
.hero { max-width: 460px; width: 100%; text-align: center; border-color: var(--border-strong); }
.hero .k { display: inline-block; font-size: var(--fs-caption); font-weight: 700; color: var(--accent-ink); letter-spacing: .1em; margin-bottom: 3px; }
.hero p { margin: 0; font-size: var(--fs-title); font-weight: 700; color: var(--text); overflow-wrap: anywhere; }
.chip { display: flex; flex-direction: column; gap: 2px; min-width: 180px; max-width: 300px; }
.chip b { color: var(--text); font-size: var(--fs-body); overflow-wrap: anywhere; }
.chip small { color: var(--text-3); font-size: var(--fs-caption); }
.chip.goal { border-left: 3px solid var(--accent); }
.chip.met { min-width: 200px; }
.chip.tk { flex-direction: row; align-items: center; gap: 7px; min-width: 0; max-width: 340px; padding: 5px 10px; }
.chip.tk .tt { color: var(--text-2); font-size: var(--fs-caption); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.chip.tk.orph { border-style: dashed; }
.st { flex: none; width: 7px; height: 7px; border-radius: 50%; }
.st-done { background: var(--success); }
.st-doing { background: var(--accent); box-shadow: 0 0 0 3px var(--accent-light); }
.st-todo { background: var(--text-4); }
.st-stale { background: var(--warning); }
.st-orph { background: transparent; border: 1px dashed var(--text-4); }
.bar { display: block; height: 3px; border-radius: 999px; background: var(--surface-3); overflow: hidden; }
.bar span { display: block; height: 100%; background: var(--accent); }
.cap { text-align: center; color: var(--text-4); font-size: var(--fs-caption); margin: 22px 0 0; }
</style>
