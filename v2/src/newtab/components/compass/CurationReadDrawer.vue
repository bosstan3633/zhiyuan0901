<script setup lang="ts">
/**
 * V3.9.32（批 A）：策展模式 · 只读详情抽屉（单一抽屉六形态 + 散叶）。
 * 只读红线：全文件零 persist / 零编辑控件——任何修改都通过「去方向台编辑」导流回工作面。
 */
import { computed } from 'vue'
import Icon from '@/shared/components/Icon.vue'
import Drawer from '@/shared/components/Drawer.vue'
import type { CurationSel, CurationTree } from '@/shared/utils/compassCurationModel'

const props = defineProps<{ open: boolean; sel: CurationSel | null; tree: CurationTree }>()
const emit = defineEmits<{ (e: 'close'): void; (e: 'edit'): void }>()

const row = (k: string, v: string) => ({ k, v })
const stLabel: Record<string, string> = { done: '已完成', doing: '进行中', todo: '待开始', stale: '待开始（停滞 14 天+）' }
const priLabel: Record<string, string> = { high: '高', medium: '中', low: '低' }
const httpLink = (s: string): string => (/^https?:\/\//.test(s) ? s : '')

const kindLabel = computed(() => {
  const k = props.sel?.kind
  return k === 'vision' ? '根 · 愿景' : k === 'mission' ? '干 · 使命' : k === 'goal' ? '主枝 · 战略目标'
    : k === 'project' ? '分枝 · 项目' : k === 'metric' ? '花果 · 成功指标' : k === 'task' ? '叶 · 任务'
    : k === 'orphans' ? '散叶 · 未归档任务' : '详情'
})
const title = computed(() => {
  const s = props.sel
  if (!s) return '—'
  if (s.kind === 'goal') return s.goal.dir.name || '未命名战略目标'
  if (s.kind === 'project') return s.node.project.name || '未命名项目'
  if (s.kind === 'metric') return s.node.metric.title || '未命名指标'
  if (s.kind === 'task') return s.node.task.title || '未命名任务'
  if (s.kind === 'orphans') return `${s ? props.tree.orphans.length : 0} 件待归位`
  return s.kind === 'vision' ? '这棵树为什么长 · 愿景' : '这棵树为什么长 · 使命'
})
const rows = computed<{ k: string; v: string }[]>(() => {
  const s = props.sel
  if (!s) return []
  if (s.kind === 'vision') return [row('根 · 愿景', props.tree.vision || '尚未填写'), row('树语', '根深埋土里，决定整棵树往哪儿长')]
  if (s.kind === 'mission') return [row('干 · 使命', props.tree.mission || '尚未填写'), row('树语', '使命是向上生长的主轴')]
  if (s.kind === 'goal') {
    const tn = s.goal.projects.reduce((acc, P) => acc + P.totalCount, 0)
    return [
      row('层级', '第 3 层（愿景与使命之下的大枝）'),
      row('项目', `${s.goal.projects.length} 个分枝`),
      row('任务', `${tn} 件`),
      row('树语', '已归档目标 = 越冬枝（休眠色，不断不删）'),
    ]
  }
  if (s.kind === 'project') {
    const P = s.node
    return [
      row('进度', `${P.doneCount}/${P.totalCount} 任务 · ${P.progress}%`),
      row('身份', P.project.isFocused ? '主攻 · 向阳枝' : '普通枝'),
      row('状态', P.stalled ? '⚠ 停滞 14 天+（季节，不是审判）' : '推进中'),
      row('指标', `${P.metrics.length} 条（花果位）`),
      row('树语', '满枝硕果后木质化转稳定'),
    ]
  }
  if (s.kind === 'metric') {
    const M = s.node
    return [
      row('进度', `${M.doneCount}/${M.totalCount} · ${M.progress}%`),
      row('目标', (M.metric.target || '').trim() || '—'),
      row('验收', (M.metric.acceptance || '').trim() || '—'),
      row('树语', M.totalCount ? (M.progress >= 100 ? '硕果成熟 · 可摘入策展' : '开花中 · 花径随进度变大') : '空枝花苞（⚠ 缺任务）'),
    ]
  }
  if (s.kind === 'task') {
    const T = s.node
    return [
      row('状态', stLabel[T.status] || T.status),
      row('优先级', T.task.priority ? (priLabel[T.task.priority] || T.task.priority) + '优' : '—'),
      row('入树于', T.task.createdAt ? new Date(T.task.createdAt).toLocaleDateString() : '—'),
      row('完成于', T.task.completedAt ? new Date(T.task.completedAt).toLocaleDateString() : '—'),
      row('链接', (T.task.link || '').trim() || '未填写'),
      row('树语', T.status === 'done' ? '翠叶' : T.status === 'doing' ? '嫩叶 · 微光呼吸' : T.status === 'stale' ? '黄叶 · 停滞转黄' : '芽 · 带壳待放'),
    ]
  }
  return [
    row('清单', props.tree.orphans.map(T => T.task.title || '未命名任务').join(' · ') || '—'),
    row('树语', '散叶挂在根部——挂上指标即上枝'),
  ]
})
const linkHref = computed(() => {
  const s = props.sel
  if (!s || s.kind !== 'task') return ''
  return httpLink((s.node.task.link || '').trim())
})
const linkText = computed(() => {
  const s = props.sel
  return s && s.kind === 'task' ? (s.node.task.link || '').trim() : ''
})
</script>

<template>
  <Drawer :open="open && !!sel" :title="title" width="420px" @close="emit('close')">
    <template #title-extra>
      <span class="crd-kind">{{ kindLabel }}</span>
    </template>
    <div class="crd-body">
      <div v-for="(r, i) in rows" :key="i" class="crd-row">
        <span class="k">{{ r.k }}</span>
        <span class="v">{{ r.v }}</span>
      </div>
      <div v-if="linkHref" class="crd-row">
        <span class="k">打开</span>
        <span class="v"><a :href="linkHref" target="_blank" rel="noopener noreferrer">{{ linkText || linkHref }}</a></span>
      </div>
    </div>
    <template #footer>
      <button class="crd-edit" type="button" @click="emit('edit')">
        <Icon name="compass" :size="13"/> 去方向台编辑 ›
      </button>
    </template>
  </Drawer>
</template>

<style scoped>
.crd-kind { display: inline-flex; align-items: center; gap: 6px; font-size: 11px; font-weight: 700; color: var(--accent-ink); background: var(--accent-light); border-radius: 999px; padding: 1px 10px; }
.crd-body { padding: 12px 18px; }
.crd-row { display: flex; gap: 8px; font-size: var(--fs-body); padding: 6px 0; border-bottom: 1px solid var(--border); }
.crd-row:last-child { border-bottom: 0; }
.crd-row .k { color: var(--text-3); flex: none; width: 64px; }
.crd-row .v { color: var(--text); overflow-wrap: anywhere; white-space: pre-wrap; }
.crd-row .v a { color: var(--accent-ink); text-decoration: underline; text-underline-offset: 2px; overflow-wrap: anywhere; }
.crd-edit { width: 100%; display: inline-flex; align-items: center; justify-content: center; gap: 6px; border-radius: var(--radius-sm); padding: 8px 0; font-size: var(--fs-body); font-weight: 700; cursor: pointer; border: 1px solid var(--accent); background: var(--accent); color: #fff; font-family: inherit; }
.crd-edit:hover { filter: brightness(1.08); }
</style>
