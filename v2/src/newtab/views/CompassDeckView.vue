<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import Icon from '@/shared/components/Icon.vue'
import TaskManagerPanel from '../components/compass/TaskManagerPanel.vue'
import CuriosityPanel from '../components/compass/CuriosityPanel.vue'
import PoolCardsPanel from '../components/compass/PoolCardsPanel.vue'

defineOptions({ name: 'CompassDeckView' })

type DeckKind = 'task' | 'curiosity' | 'resource'

const route = useRoute()
const router = useRouter()
const taskPanel = ref<InstanceType<typeof TaskManagerPanel> | null>(null)
const curiosityPanel = ref<InstanceType<typeof CuriosityPanel> | null>(null)
const resourcePanel = ref<InstanceType<typeof PoolCardsPanel> | null>(null)

const kind = computed<DeckKind>(() => {
  const raw = String(route.params.kind || '')
  return raw === 'curiosity' || raw === 'resource' ? raw : 'task'
})
const title = computed(() => kind.value === 'task' ? '任务卡 · 全部' : kind.value === 'curiosity' ? '好奇心卡 · 全部' : '资源卡 · 全部')
/** V3.9.22：可见标题块退役；保留一份读屏标题，tab 成为页头唯一导航。 */
const DECK_TABS: { kind: DeckKind; label: string }[] = [
  { kind: 'task', label: '任务卡' },
  { kind: 'curiosity', label: '好奇心卡' },
  { kind: 'resource', label: '资源卡' },
]
/** ★V3.9.7：二级卡池允许在任务 / 好奇心 / 资源之间直接切换。
 *  仍以路由作为唯一状态源：切换 push 新 URL，浏览器返回键自然回到各自类型，
 *  不另造一份 activeKind ref 与 URL 竞争。 */
function switchKind(next: DeckKind): void {
  if (next === kind.value) return
  void router.push(`/deck/${next}`)
}

function goBack(): void {
  // V3.9.10：这里必须直接回调度台根路由。
  // 二级页的三类卡片共用 /deck 路由族，用户切到好奇心/资源后，router.back()
  // 只会回到"上一类卡片"，而不是离开二级页；表现为点「返回调度台」仍在卡池之间打转。
  void router.push('/')
}

/**
 * 首页预览卡与全局搜索共用同一深链：先进入本类二级列表，再展开右侧详情。
 * 不在首页复制一套好奇心详情，保证编辑、转化与附件能力只有一份。
 */
watch(
  () => [route.query.hl, route.query.open, kind.value] as const,
  async ([hl, open, k]) => {
    if (!hl) return
    await nextTick()
    setTimeout(() => {
      if (k === 'task') taskPanel.value?.openDetail(String(hl))
      else if (k === 'curiosity' && open === '1') curiosityPanel.value?.openDetail(String(hl))
      else if (k === 'resource') resourcePanel.value?.openDetail(String(hl))
    }, 80)
  },
  { immediate: true }
)
</script>

<template>
  <div class="deck-page">
    <!-- V3.9.22：二级页只留返回 + 卡片类型 tab；标题保留为不可见读屏语义。 -->
    <header class="deck-head">
      <h1 class="deck-sr-title">{{ title }}</h1>
      <button class="deck-back" type="button" @click="goBack"><Icon name="arrowleft" :size="14"/> 返回调度台</button>
      <div class="deck-kind-seg" role="tablist" aria-label="卡片类型">
        <button v-for="tab in DECK_TABS" :key="tab.kind" type="button" role="tab"
          :class="{ on: kind === tab.kind }" :aria-selected="kind === tab.kind"
          @click="switchKind(tab.kind)">{{ tab.label }}</button>
      </div>
    </header>

    <section class="deck-body">
      <TaskManagerPanel v-if="kind === 'task'" ref="taskPanel" secondary-mode />
      <CuriosityPanel v-else-if="kind === 'curiosity'" ref="curiosityPanel" secondary-mode />
      <PoolCardsPanel v-else ref="resourcePanel" secondary-mode />
    </section>
  </div>
</template>

<style scoped>
.deck-page { max-width: 1440px; margin: 0 auto; padding: 18px 36px 72px; }
/* V3.9.22：返回与 tab 同排，页头不再被重复标题块占高。 */
.deck-head { display: flex; align-items: center; gap: 14px; flex-wrap: wrap; padding: 4px 0 16px; }
.deck-sr-title {
  position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px;
  overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0;
}
.deck-back {
  flex-shrink: 0; display: inline-flex; align-items: center; gap: 6px; min-height: 30px;
  padding: 5px 11px; border: 1px solid var(--border); border-radius: var(--radius-sm);
  background: var(--surface); color: var(--text-2); font-size: var(--fs-sub); font-family: inherit; cursor: pointer;
}
.deck-back:hover { border-color: var(--border-strong); color: var(--text); }
.deck-kind-seg {
  display: inline-flex; align-items: center; gap: 2px;
  padding: 3px; border: 1px solid var(--border); border-radius: var(--radius-md);
  background: var(--surface-2);
}
.deck-kind-seg button {
  min-height: 30px; padding: 4px 13px; border: 0; border-radius: var(--radius-sm);
  background: transparent; color: var(--text-3); font-family: inherit; font-size: var(--fs-caption);
  font-weight: 600; cursor: pointer;
}
.deck-kind-seg button:hover { color: var(--text); background: var(--surface); }
.deck-kind-seg button.on { color: var(--accent-ink); background: var(--surface); box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--accent) 28%, var(--border)); }
.deck-body { min-height: 320px; }
.deck-body :deep(.module-card) { background: transparent; border: none; box-shadow: none; }
.deck-body :deep(.module-title) { display: none; }
.deck-body :deep(.module-body) { padding: 0; }
@media (max-width: 760px) {
  .deck-page { padding: 14px 16px 48px; }
  .deck-head { align-items: flex-start; gap: 10px; }
  .deck-kind-seg { max-width: 100%; overflow-x: auto; }
}
</style>
