<script setup lang="ts">
/**
 * R147-e：论点骨架的结构化**只读**预览。
 * 真源仍是卡片描述里那段 THESIS_MARK / THESIS_PARTS_MARK 前缀文本（字面量见 shared/models/aiMarks）——不改数据格式、不新增模型；
 * 本组件只负责"读得下去"，并与本台一级分类做只读对照（✓ 已建架 / ○ 未建架）。
 * 两套结构（论点骨架 ↔ 金字塔 L2）的桥先只做看不做写：落架仍走评审抽屉的显式次通道。
 * 解析不出论点行就整块不渲染，原文照旧在描述里可见——绝不编一个看起来像结论的东西。
 */
import { computed } from 'vue'
import { useAppStore } from '@/newtab/stores/app'
import AiEntryButton from '@/shared/components/AiEntryButton.vue'
import { THESIS_MARK, THESIS_WHY_MARK } from '@/shared/models/aiMarks'

const props = defineProps<{ text?: string; wsId?: string }>()
const store = useAppStore()

interface ThesisPartView { name: string; definition: string; cards: number; shelved: boolean }

const parsed = computed<{ thesis: string; why: string; parts: ThesisPartView[] } | null>(() => {
  const t = props.text || ''
  const i = t.indexOf(THESIS_MARK)
  if (i < 0) return null
  const block = t.slice(i)
  const lines = block.split('\n')
  const thesis = lines[0].slice(THESIS_MARK.length).trim()
  if (!thesis) return null
  const why = (lines.find(l => l.startsWith(THESIS_WHY_MARK)) || '').slice(THESIS_WHY_MARK.length).trim()
  const catNames = new Set(
    (store.data?.categories || []).filter(c => !c.deletedAt && !c.parentId && (!props.wsId || c.workspaceId === props.wsId)).map(c => c.name)
  )
  const parts: ThesisPartView[] = []
  for (const ln of lines.slice(1)) {
    const m = ln.match(/^\s*\d+\.\s*(.+)$/)
    if (!m) continue
    let body = m[1].trim()
    let cards = 0
    const cm = body.match(/（佐证 (\d+) 张）\s*$/)
    if (cm) { cards = Number(cm[1]); body = body.slice(0, cm.index!).trim() }
    const [name, definition = ''] = body.split('——').map(x => x.trim())
    if (name) parts.push({ name, definition, cards, shelved: catNames.has(name) })
  }
  return { thesis, why, parts }
})
</script>

<template>
  <div v-if="parsed" class="tb">
    <div class="tb-head"><AiEntryButton variant="inline" label="中心论点" /><span class="tb-note">AI 提炼 · 只读预览，正文仍是卡片描述</span></div>
    <div class="tb-thesis">{{ parsed.thesis }}</div>
    <div v-if="parsed.why" class="tb-why">依据：{{ parsed.why }}</div>
    <ol v-if="parsed.parts.length" class="tb-parts">
      <li v-for="p in parsed.parts" :key="p.name">
        <b>{{ p.name }}</b><span v-if="p.definition" class="tb-def">—— {{ p.definition }}</span>
        <span class="tb-tag" :class="{ dim: !p.cards }">{{ p.cards ? '佐证 ' + p.cards + ' 张' : '没点到卡' }}</span>
        <span class="tb-tag" :class="{ dim: !p.shelved }" :title="p.shelved ? '本台已有同名一级分类' : '本台还没建这个分支分类——要落架用提炼抽屉底部「分论点建成分类并归架」'">{{ p.shelved ? '已建架' : '○ 未建架' }}</span>
      </li>
    </ol>
    <div v-else class="tb-none">还没有分论点骨架——只有论点一句话，可在策展台头重新提炼。</div>
  </div>
</template>

<style scoped>
.tb { border: 1px dashed color-mix(in srgb, var(--accent) 45%, transparent); background: var(--accent-light); border-radius: var(--radius-sm); padding: 10px 12px; display: flex; flex-direction: column; gap: 6px; }
.tb-head { display: flex; align-items: center; gap: 6px; font-size: var(--fs-sub); font-weight: 700; color: var(--accent); }
.tb-note { font-weight: 400; font-size: var(--fs-caption); color: var(--text-4); }
.tb-thesis { font-size: var(--fs-body); line-height: 1.6; color: var(--text); font-weight: 600; }
.tb-why { font-size: var(--fs-sub); line-height: 1.6; color: var(--text-3); }
.tb-parts { margin: 2px 0 0; padding-left: 20px; display: flex; flex-direction: column; gap: 4px; font-size: var(--fs-sub); line-height: 1.6; color: var(--text-2) }
.tb-def { color: var(--text-3); margin-left: 4px }
.tb-tag { margin-left: 6px; font-size: var(--fs-caption); color: var(--accent); }
.tb-tag.dim { color: var(--text-4); }
.tb-none { font-size: var(--fs-sub); color: var(--text-4); }
</style>
