<script setup lang="ts">
/**
 * V3.9.7 标签分布解释抽屉：定义、当前分布、行动建议与 AI 治理入口。
 * 只负责呈现与统计，打开 AI 任务仍由宿主决定，避免把 AI 工厂拉进本组件。
 */
import { computed } from 'vue'
import Drawer from '@/shared/components/Drawer.vue'
import AiEntryButton from '@/shared/components/AiEntryButton.vue'
import type { ResourceCard, TaskCard } from '@/shared/models'

const props = defineProps<{
  open: boolean
  entropy: number
  resources: ResourceCard[]
  tasks: TaskCard[]
}>()
const emit = defineEmits<{ close: []; optimize: [] }>()

const stats = computed(() => {
  const counts = new Map<string, number>()
  let taggedCards = 0
  const holders = [...props.resources, ...props.tasks]
  for (const card of holders) {
    const tags = [...new Set((card.tags || []).map(t => t.trim()).filter(Boolean))]
    if (tags.length) taggedCards++
    for (const tag of tags) counts.set(tag, (counts.get(tag) || 0) + 1)
  }
  const rows = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
  return {
    holders: holders.length,
    taggedCards,
    untaggedCards: holders.length - taggedCards,
    tagCount: rows.length,
    rows: rows.slice(0, 6),
    concentration: rows.length ? Math.round((rows.slice(0, 3).reduce((sum, [, n]) => sum + n, 0) /
      Math.max(1, rows.reduce((sum, [, n]) => sum + n, 0))) * 100) : 0,
  }
})

const meaning = computed(() => {
  const s = stats.value
  const spread = props.entropy >= 4 ? '铺得较散，同类信息可能分散在多个叫法里'
    : props.entropy >= 2.5 ? '分布适中，主标签可辨认，但仍有一些长尾'
      : '分布集中，主标签清晰'
  return `当前知识熵 ${props.entropy.toFixed(1)} bit，${spread}。前 3 个标签覆盖 ${s.concentration}% 的标签引用；${s.untaggedCards} / ${s.holders} 张资源或任务尚未打标签。`
})

const actions = computed(() => {
  const s = stats.value
  const out = [
    s.untaggedCards > 0
      ? `先给 ${s.untaggedCards} 张未打标签的卡补上主标签，让它们能被检索与关联。`
      : '当前资源与任务都已至少有一个标签，可继续清理同义叫法。',
  ]
  if (props.entropy >= 4) out.push('检查「前 3 标签」之外的长尾：同一主题若出现近义写法，合并为一个规范标签。')
  else out.push('保留现有主标签，后续只在确有新主题时增加一级标签，避免为了分类而分类。')
  if (s.tagCount > 20) out.push(`当前使用 ${s.tagCount} 个不同标签；建议优先维护高使用量标签，低频标签定期合并或收进标签树。`)
  else out.push('标签总量目前可控，优先把高频标签写进标签树并补一句收卡定义。')
  return out
})
</script>

<template>
  <Drawer :open="open" title="标签分布 · 知识熵" icon="tag" width="520px" @close="emit('close')">
    <div class="tag-insight pi-tag-insight">
      <section class="hero">
        <span class="k">当前指标</span>
        <strong>{{ entropy.toFixed(1) }} <small>bit</small></strong>
        <p>{{ meaning }}</p>
      </section>
      <section>
        <h3>这个指标怎么看</h3>
        <p>知识熵衡量标签在卡片上的分散程度：越集中，主题越清楚；越分散，越可能用了多个叫法描述同一主题。它是观察入口，不是质量评分。</p>
      </section>
      <section>
        <h3>当前分布</h3>
        <div class="counter">
          <span><b>{{ stats.taggedCards }}</b> 已打标</span>
          <span><b>{{ stats.untaggedCards }}</b> 未打标</span>
          <span><b>{{ stats.tagCount }}</b> 个标签</span>
        </div>
        <div v-if="stats.rows.length" class="ranks">
          <div v-for="([name, count], i) in stats.rows" :key="name" class="rank">
            <span class="no">{{ i + 1 }}</span>
            <span class="name">#{{ name }}</span>
            <span class="count">{{ count }} 张</span>
          </div>
        </div>
        <p v-else class="empty">还没有带标签的卡片。采集资源或新建任务后，这里会按使用量列出标签。</p>
      </section>
      <section>
        <h3>下一步建议</h3>
        <ol class="actions">
          <li v-for="(a, i) in actions" :key="i">{{ a }}</li>
        </ol>
      </section>
      <section class="ai">
        <div>
          <h3>交给 AI 助手处理</h3>
          <p>让 AI 基于全库卡面与标签树给出同义合并、裸标签归位建议；每条建议勾选后才会写库。</p>
        </div>
        <button class="ai-btn" @click="emit('optimize')">
          <AiEntryButton variant="inline" label="生成标签治理建议" />
        </button>
      </section>
    </div>
  </Drawer>
</template>

<style scoped>
.tag-insight { display: flex; flex-direction: column; gap: 18px; }
.tag-insight section { min-width: 0; }
.tag-insight h3 { margin: 0 0 7px; font-size: var(--fs-sub); font-weight: 700; color: var(--text); }
.tag-insight p { margin: 0; font-size: var(--fs-caption); line-height: 1.75; color: var(--text-3); }
.hero { padding: 14px 15px; border: 1px solid var(--border); border-left: 3px solid var(--accent); border-radius: var(--radius-md); background: var(--surface-2); }
.hero .k { display: block; margin-bottom: 3px; font-size: var(--fs-micro); color: var(--text-4); letter-spacing: .06em; }
.hero strong { display: block; margin-bottom: 5px; font-size: var(--fs-title); line-height: 1.2; color: var(--text); font-variant-numeric: tabular-nums; }
.hero strong small { font-size: var(--fs-caption); font-weight: 500; color: var(--text-3); }
.counter { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 7px; margin-bottom: 10px; }
.counter span { padding: 7px 9px; border: 1px solid var(--border); border-radius: var(--radius-sm); background: var(--surface); font-size: var(--fs-micro); color: var(--text-3); }
.counter b { display: block; margin-bottom: 1px; font-size: var(--fs-sub); color: var(--text); font-variant-numeric: tabular-nums; }
.ranks { display: flex; flex-direction: column; border-top: 1px solid var(--border); }
.rank { display: grid; grid-template-columns: 22px minmax(0, 1fr) auto; align-items: center; gap: 7px; min-height: 34px; border-bottom: 1px solid var(--border); }
.rank .no { color: var(--text-4); font-size: var(--fs-micro); font-variant-numeric: tabular-nums; }
.rank .name { overflow: hidden; color: var(--text-2); font-size: var(--fs-caption); text-overflow: ellipsis; white-space: nowrap; }
.rank .count { color: var(--text-3); font-size: var(--fs-micro); font-variant-numeric: tabular-nums; }
.empty { padding: 12px; border: 1px dashed var(--border); border-radius: var(--radius-sm); text-align: center; }
.actions { margin: 0; padding-left: 20px; color: var(--text-2); font-size: var(--fs-caption); line-height: 1.8; }
.actions li + li { margin-top: 5px; }
.ai { display: flex; align-items: center; gap: 14px; padding: 13px 14px; border: 1px solid color-mix(in srgb, var(--accent) 30%, var(--border)); border-radius: var(--radius-md); background: var(--accent-light); }
.ai > div { flex: 1; min-width: 0; }
.ai h3 { color: var(--accent-ink); }
.ai p { color: var(--text-2); }
.ai-btn { flex: none; min-height: 32px; padding: 5px 10px; border: 1px solid var(--accent); border-radius: var(--radius-sm); background: var(--surface); color: var(--accent-ink); font-family: inherit; font-size: var(--fs-caption); font-weight: 700; cursor: pointer; }
.ai-btn:hover { background: var(--surface-2); }
@media (max-width: 560px) { .ai { align-items: flex-start; flex-direction: column; } }
</style>
