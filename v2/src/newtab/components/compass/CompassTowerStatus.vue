<script setup lang="ts">
/**
 * N2 · V3.8.18 舱头「状态读数组」——从 CompassTower 拆出的挂件：进度环 + 完成数 + 诊断标签组。
 *
 * 为什么整块外移（W11-12）：方向台每个组件钉死 400 行，超了=它承担了两件事，该拆不放宽上限。
 * 舱头本来就挤（序号/名称/面包屑 + 环 + 完成数 + 五个动作钮 + 折叠 + 菜单），
 * 再塞进标签组、过期态与两态入口必然越线——于是**只读的这一侧**（环 / 完成数 / 诊断存根）
 * 整块搬走，塔只留**会写数据的**动作区（拖拽 / 指标 / 置顶 / 菜单 / 折叠）。
 *
 * 诊断两态：
 *  - 没报告 → 一枚虚线「🧠 AI 诊断」（点它=跑；手动触发红线，从不自动跑、不预生成）
 *  - 有报告 → 标签组（最多 3 枚 + 折叠 +N）+ 一枚「📄 诊断报告」（点它=开中央弹窗）
 * 过期（数据已变更）只降亮标签，**不撤标签**——撤了反而看不出"这个项目曾经有过结论"。
 */
import Icon from '@/shared/components/Icon.vue'
import './hotzone.css'
import { computed } from 'vue'
import type { ProjectMeta } from '../../views/compassMeta'
import type { ProjectDiagnosis } from '@/shared/ai/projectDiagnose'

const props = defineProps<{
  projId: string
  /** 舱色：六档派生之一 */
  hue: string
  meta: ProjectMeta
  diag?: ProjectDiagnosis | null
  /** 报告指纹与当前数据重算的指纹不一致 */
  stale?: boolean
}>()

const emit = defineEmits<{
  (e: 'diagRun', projId: string): void
  (e: 'diagReport', projId: string): void
}>()

const ringR = 18
const ringC = 2 * Math.PI * ringR

const tags = computed(() => (props.diag?.tags || []).slice(0, 3))
const extra = computed(() => Math.max(0, (props.diag?.tags.length || 0) - 3))
/** 标签 title 回指维度（这条结论是谁判出来的），过期时补一句"可能过期" */
const tagTitle = (t: { tag: string; dim: string }) =>
  `${t.tag} · ${t.dim}${props.stale ? '（数据已变更，结论可能过期）' : ''}`
</script>

<template>
  <div class="tw-status" @click.stop>
    <div class="tw-ring" :title="`项目级完成度 ${meta.pct}%（跨全部指标聚合）`">
      <svg viewBox="0 0 42 42" width="42" height="42" aria-hidden="true">
        <circle cx="21" cy="21" :r="ringR" fill="none" stroke="var(--surface-3)" stroke-width="3" />
        <circle
          cx="21" cy="21" :r="ringR" fill="none"
          :stroke="hue" stroke-width="3" stroke-linecap="round"
          :stroke-dasharray="ringC" :stroke-dashoffset="ringC * (1 - meta.pct / 100)"
        />
      </svg>
      <span class="tw-ring-v">{{ meta.pct }}%</span>
    </div>
    <div class="tw-num">
      <b>{{ meta.done }} / {{ meta.total }}</b>
      任务完成
    </div>
    <!-- ★N2 · 诊断标签组（原型 P3 第 ① 节）：报告在就挂标签，不在就挂一枚跑诊断的入口 -->
    <div class="tw-diag" :class="{ stale }">
      <template v-if="diag">
        <span
          v-for="t in tags"
          :key="t.tag"
          class="dt"
          :class="t.level"
          :title="tagTitle(t)"
        >{{ t.tag }}</span>
        <span v-if="extra > 0" class="dt more" :title="`另有 ${extra} 条诊断标签`">+{{ extra }}</span>
        <button class="dt view" title="查看完整诊断报告" @click="emit('diagReport', projId)"><Icon name="filetext" :size="13"/> 诊断报告</button>
      </template>
      <button v-else class="dt run" title="AI 诊断：五维度规则结论 + AI 建议动作" @click="emit('diagRun', projId)"><Icon name="brain" :size="13"/> AI 诊断</button>
    </div>
  </div>
</template>

<style scoped>
.tw-status { display: flex; align-items: center; gap: 14px; flex: none; }
/* 原型 .ring 42px + 环上数字；24px 时光环细到看不出进度 */
.tw-ring { position: relative; width: 42px; height: 42px; flex: none; }
.tw-ring svg { transform: rotate(-90deg); }
.tw-ring-v {
  position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
  font-size: var(--fs-micro); font-weight: 700; color: var(--text-2);
}
/* 原型 .tw-num 是两行块：完成数一行（--fs-sub）、"任务完成"一行（--fs-micro）。
   之前挤成一行 "0 / 5 任务完成"，与舱头 15px 标题同排就糊了。 */
.tw-num { font-size: var(--fs-micro); color: var(--text-3); line-height: 1.5; white-space: nowrap; }
.tw-num b { display: block; font-size: var(--fs-sub); color: var(--text-2); font-variant-numeric: tabular-nums; }

/* 诊断标签组：过期只降亮（opacity）不撤标签 */
.tw-diag { display: flex; align-items: center; gap: 5px; flex: none; max-width: 340px; flex-wrap: wrap; }
.tw-diag.stale .dt:not(.view):not(.run) { opacity: .5; }
.dt {
  font-size: var(--fs-micro); font-weight: 600; line-height: 1.4;
  padding: 2px 7px; border-radius: 99px; white-space: nowrap;
  background: var(--surface-3); color: var(--text-2); border: 1px solid var(--border);
}
.dt.ok { background: var(--success-bg-soft); color: var(--success); border-color: rgba(52, 211, 153, .26); }
.dt.warn { background: var(--warning-bg-soft); color: var(--warning); border-color: rgba(251, 191, 36, .3); }
.dt.bad { background: var(--danger-bg-soft); color: var(--danger); border-color: rgba(248, 113, 113, .3); }
.dt.more { color: var(--text-3); font-weight: 700; }
.dt.view, .dt.run { cursor: pointer; font-weight: 600; font-family: inherit; }
.dt.view { background: var(--accent-light); color: var(--accent-ink); border-color: rgba(139, 92, 246, .3); }
.dt.view:hover { border-color: var(--accent); }
.dt.run { background: transparent; border-style: dashed; color: var(--text-3); }
.dt.run:hover { color: var(--accent-ink); border-color: var(--accent); }
</style>
