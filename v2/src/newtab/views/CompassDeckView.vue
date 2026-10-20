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
const kicker = computed(() => kind.value === 'task' ? 'TASK CARDS' : kind.value === 'curiosity' ? 'CURIOSITY CARDS' : 'RESOURCE CARDS')
const description = computed(() => kind.value === 'task'
  ? '先看今天真正要推进的任务，再按项目与状态收窄。打开任意一行，右侧会展开完整任务详情，不需要离开当前列表。'
  : kind.value === 'curiosity'
    ? '好奇心不是待办。这里按求证阶段浏览问题，并看清每个问题已经积累了多少材料。'
    : '资源卡按最近调用与所属主题浏览。打开一行进入阅读与关联，不在这里重复采集入口。')

function goBack(): void {
  // 独立二级路由保留浏览器返回；没有历史时明确回首页，不制造空白页。
  if (window.history.length > 1) router.back()
  else void router.push('/')
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
    <!-- ★W17-C04（2026-10-20 用户拍板）：返回按钮独立成首行、左对齐；
         标题块另起一块，左缘与下方筛选栏 / 列表严格一致（原先三列 flex 把标题整体右推约 130px）。 -->
    <header class="deck-head">
      <div class="deck-head-top">
        <button class="deck-back" type="button" @click="goBack"><Icon name="arrowleft" :size="14"/> 返回调度台</button>
        <span class="deck-hint"><Icon name="bulb" :size="13"/> 新建统一走扩展快捷键</span>
      </div>
      <div class="deck-head-copy">
        <div class="deck-kicker">{{ kicker }}</div>
        <h1>{{ title }}</h1>
        <p>{{ description }}</p>
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
/* ★W17-C04：页头改单列为两行——首行返回 + 右侧提示，第二行标题块（左缘与列表对齐） */
.deck-head { display: flex; flex-direction: column; gap: 12px; padding: 4px 0 18px; }
.deck-head-top { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
.deck-back {
  flex-shrink: 0; display: inline-flex; align-items: center; gap: 6px; min-height: 30px;
  padding: 5px 11px; border: 1px solid var(--border); border-radius: var(--radius-sm);
  background: var(--surface); color: var(--text-2); font-size: var(--fs-sub); font-family: inherit; cursor: pointer;
}
.deck-back:hover { border-color: var(--border-strong); color: var(--text); }
.deck-head-copy { min-width: 0; }
.deck-kicker { font-size: var(--fs-micro); color: var(--text-3); letter-spacing: 1.4px; text-transform: uppercase; margin-bottom: 4px; }
.deck-head h1 { font-size: var(--fs-display); line-height: 1.2; letter-spacing: -.02em; color: var(--text); }
.deck-head p {
  max-width: 760px; margin: 6px 0 0; font-size: var(--fs-sub); line-height: 1.7; color: var(--text-3);
  /* 三页标题区高度固定：描述固定单行，超出省略（原为两行自由折行，切页内容起始位置会跳） */
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-height: calc(var(--fs-sub) * 1.7);
}
.deck-hint { display: inline-flex; align-items: center; gap: 6px; min-height: 28px; padding: 4px 10px; border: 1px dashed var(--border-strong); border-radius: var(--radius-sm); font-size: var(--fs-caption); color: var(--text-3); }
.deck-body { min-height: 320px; }
.deck-body :deep(.module-card) { background: transparent; border: none; box-shadow: none; }
.deck-body :deep(.module-title) { display: none; }
.deck-body :deep(.module-body) { padding: 0; }
@media (max-width: 760px) {
  .deck-page { padding: 14px 16px 48px; }
  .deck-head { flex-wrap: wrap; }
}
</style>
