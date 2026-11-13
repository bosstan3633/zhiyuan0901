<script setup lang="ts">
import AiEntryButton from '@/shared/components/AiEntryButton.vue'
import Icon from '@/shared/components/Icon.vue'
import type { ConciseInsight } from '@/shared/utils/reviewReport'
import type { PeriodAiState } from '@/newtab/composables/usePeriodAiReview'
import type { PeriodReviewTarget } from '@/shared/utils/periodReview'
import { formatPeriodReviewTarget } from '@/shared/utils/periodReview'

const props = defineProps<{
  ai: PeriodAiState
  fallback: ConciseInsight
}>()

const emit = defineEmits<{
  (e: 'regenerate'): void
  (e: 'navigate', target: PeriodReviewTarget): void
  (e: 'configure'): void
}>()

const LABEL: Record<PeriodAiState['range'], string> = {
  today: '今天',
  week: '本周',
  month: '本月',
  year: '本年',
}

function generatedText(ts: number): string {
  if (!ts) return ''
  const d = new Date(ts)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getMonth() + 1}/${d.getDate()} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}
</script>

<template>
  <section class="pi-ai-review" :class="{ 'has-result': !!props.ai.result, 'is-loading': props.ai.loading }">
    <header class="pi-ai-head">
      <div class="pi-ai-title">
        <span class="pi-ai-mark"><AiEntryButton variant="icon" /></span>
        <div>
          <b>AI 周期复盘</b>
          <small>{{ LABEL[props.ai.range] }} · 结合账号战报与方向树</small>
        </div>
      </div>
      <div class="pi-ai-tools">
        <span v-if="props.ai.loading" class="pi-ai-status">正在分析…</span>
        <span v-else-if="props.ai.stale" class="pi-ai-status stale">数据已变化</span>
        <span v-else-if="props.ai.result?.cached" class="pi-ai-status cached">已缓存 · {{ generatedText(props.ai.cachedAt) }}</span>
        <button class="pi-ai-refresh" type="button" :disabled="props.ai.loading" @click="emit('regenerate')">
          <Icon name="refresh" :size="12" /> {{ props.ai.result ? '重新分析' : '开始分析' }}
        </button>
      </div>
    </header>

    <div v-if="props.ai.loading && !props.ai.result" class="pi-ai-loading">
      <span class="pi-ai-loader" />
      <span>正在读取{{ LABEL[props.ai.range] }}战报、方向树和卡片状态…</span>
    </div>

    <div v-else-if="props.ai.result" class="pi-ai-body">
      <p class="pi-ai-headline">{{ props.ai.result.headline }}</p>
      <div class="pi-ai-insights">
        <article v-for="(insight, index) in props.ai.result.insights" :key="index" class="pi-ai-insight">
          <span class="pi-ai-index">{{ String(index + 1).padStart(2, '0') }}</span>
          <div>
            <b>{{ insight.title }}</b>
            <p>{{ insight.detail }}</p>
            <div v-if="insight.evidence.length" class="pi-ai-evidence">
              <span v-for="(evidence, i) in insight.evidence" :key="i">{{ evidence }}</span>
            </div>
          </div>
        </article>
      </div>
      <div class="pi-ai-actions">
        <button v-for="(action, index) in props.ai.result.actions" :key="index" type="button" class="pi-ai-action"
          :title="action.reason" @click="emit('navigate', action.target)">
          <span>{{ action.title }}</span>
          <small>{{ formatPeriodReviewTarget(action.target) }} ›</small>
        </button>
      </div>
      <footer class="pi-ai-foot">
        <span>依据：账号级战报 · 方向树 · 策展状态</span>
        <span v-if="props.ai.result.dataGaps.length">材料缺口：{{ props.ai.result.dataGaps.join('；') }}</span>
      </footer>
    </div>

    <div v-else class="pi-ai-fallback">
      <div class="one-insight" :class="props.fallback.warn ? 'warn' : 'info'">
        <span class="oi-ic"><Icon :name="props.fallback.warn ? 'warn' : 'bulb'" :size="15" /></span>
        <span class="oi-text" v-html="props.fallback.html"></span>
        <span class="pi-ai-fallback-tag">本地事实基线</span>
      </div>
      <div class="pi-ai-fallback-note">
        <span v-if="props.ai.unconfigured">AI 尚未配置；当前仅显示本地事实，不会生成虚构结论。</span>
        <span v-else-if="props.ai.error">AI 暂不可用：{{ props.ai.error }}</span>
        <span v-else>点击「开始分析」生成洞察与下一步建议。</span>
        <button v-if="props.ai.unconfigured" type="button" @click="emit('configure')">去配置 AI</button>
      </div>
    </div>
  </section>
</template>

<style scoped>
.pi-ai-review {
  margin: 0 0 14px;
  border: 1px solid color-mix(in srgb, var(--accent) 20%, var(--border));
  border-radius: 12px;
  background:
    radial-gradient(circle at 96% 0%, color-mix(in srgb, var(--accent-light) 72%, transparent), transparent 38%),
    linear-gradient(135deg, var(--surface), color-mix(in srgb, var(--surface-2) 40%, var(--surface)));
  overflow: hidden;
}
.pi-ai-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 11px 13px;
  border-bottom: 1px solid color-mix(in srgb, var(--border) 72%, transparent);
}
.pi-ai-title, .pi-ai-tools, .pi-ai-refresh, .pi-ai-status {
  display: inline-flex;
  align-items: center;
}
.pi-ai-title { gap: 8px; min-width: 0; }
.pi-ai-title > div { display: flex; flex-direction: column; min-width: 0; gap: 2px; }
.pi-ai-title b { color: var(--text); font-size: var(--fs-sub); }
.pi-ai-title small { color: var(--text-3); font-size: var(--fs-micro); }
.pi-ai-mark {
  width: 28px; height: 28px; flex: none; display: grid; place-items: center;
  border-radius: 9px; color: var(--accent-ink); background: var(--accent-light);
}
.pi-ai-tools { gap: 8px; flex: none; }
.pi-ai-status {
  padding: 3px 7px; border-radius: 999px; color: var(--accent-ink);
  background: var(--accent-light); font-size: var(--fs-micro); white-space: nowrap;
}
.pi-ai-status.stale { color: var(--warning); background: var(--warning-bg-soft); }
.pi-ai-status.cached { color: var(--text-3); background: var(--surface-2); }
.pi-ai-refresh {
  gap: 4px; min-height: 26px; padding: 3px 8px; border: 1px solid var(--border);
  border-radius: 7px; background: var(--surface); color: var(--text-2);
  font: inherit; font-size: var(--fs-micro); cursor: pointer;
}
.pi-ai-refresh:hover { border-color: var(--accent); color: var(--accent-ink); }
.pi-ai-refresh:disabled { opacity: var(--opacity-disabled); cursor: not-allowed; }
.pi-ai-body { padding: 13px; }
.pi-ai-headline { margin: 0 0 12px; color: var(--text); font-size: var(--fs-body); line-height: 1.6; font-weight: 650; }
.pi-ai-insights { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
.pi-ai-insight {
  display: grid; grid-template-columns: 25px minmax(0, 1fr); gap: 8px;
  padding: 9px 10px; border: 1px solid var(--border); border-radius: 9px;
  background: color-mix(in srgb, var(--surface) 88%, transparent);
}
.pi-ai-index { color: var(--accent-ink); font-size: var(--fs-micro); font-variant-numeric: tabular-nums; }
.pi-ai-insight b { display: block; margin-bottom: 3px; color: var(--text); font-size: var(--fs-caption); }
.pi-ai-insight p { margin: 0; color: var(--text-2); font-size: var(--fs-caption); line-height: 1.55; }
.pi-ai-evidence { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 6px; }
.pi-ai-evidence span {
  padding: 1px 5px; border-radius: 4px; background: var(--surface-2);
  color: var(--text-3); font-size: var(--fs-micro);
}
.pi-ai-actions { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 11px; }
.pi-ai-action {
  display: inline-flex; align-items: baseline; gap: 7px; min-height: 30px;
  padding: 5px 9px; border: 1px solid color-mix(in srgb, var(--accent) 35%, var(--border));
  border-radius: 7px; background: var(--accent-light); color: var(--accent-ink);
  font: inherit; font-size: var(--fs-caption); cursor: pointer; text-align: left;
}
.pi-ai-action:hover { border-color: var(--accent); background: color-mix(in srgb, var(--accent-light) 75%, var(--surface)); }
.pi-ai-action small { color: var(--text-3); font-size: var(--fs-micro); }
.pi-ai-foot {
  display: flex; justify-content: space-between; gap: 10px; flex-wrap: wrap;
  margin-top: 9px; color: var(--text-3); font-size: var(--fs-micro);
}
.pi-ai-loading, .pi-ai-fallback { padding: 13px; }
.pi-ai-loading { display: flex; align-items: center; gap: 9px; color: var(--text-3); font-size: var(--fs-caption); }
.pi-ai-loader {
  width: 13px; height: 13px; flex: none; border: 2px solid var(--border);
  border-top-color: var(--accent); border-radius: 50%; animation: pi-ai-spin .8s linear infinite;
}
@keyframes pi-ai-spin { to { transform: rotate(360deg); } }
.pi-ai-fallback .one-insight { margin: 0; }
.pi-ai-fallback-tag {
  flex: none; padding: 2px 6px; border-radius: 999px; background: var(--surface-2);
  color: var(--text-3); font-size: var(--fs-micro);
}
.pi-ai-fallback-note {
  display: flex; align-items: center; justify-content: space-between; gap: 10px;
  flex-wrap: wrap; margin-top: 7px; color: var(--text-3); font-size: var(--fs-micro);
}
.pi-ai-fallback-note button {
  padding: 2px 7px; border: 1px solid var(--border); border-radius: 5px;
  background: var(--surface); color: var(--accent-ink); font: inherit; cursor: pointer;
}
@media (max-width: 760px) {
  .pi-ai-head { align-items: flex-start; flex-direction: column; }
  .pi-ai-tools { width: 100%; justify-content: space-between; }
  .pi-ai-insights { grid-template-columns: 1fr; }
}
</style>
