<script setup lang="ts">
/**
 * R144 · G3′：金字塔节点菜单里的「🔍 找佐证」项。
 * 菜单宿主 Workspace 压在 1500 行验收线上——入口、评审抽屉、AI 懒栈与样式全收进本组件
 * （workspace.css 是 scoped，fragment 根不继承父 scope，故自带一份菜单项样式）。
 */
import { defineAsyncComponent, shallowRef } from 'vue'
import type { Category } from '@/shared/models'
import { useAppStore } from '@/newtab/stores/app'
import { wsDisplayNameOf } from '@/shared/utils/wsName'
import { showToast } from '@/shared/components/toast'

const props = defineProps<{ wsId: string; catId: string }>()
const emit = defineEmits<{ (e: 'close'): void }>()
const store = useAppStore()
const AiDrawer = defineAsyncComponent(() => import('@/newtab/components/AiSuggestionDrawer.vue'))
const job = shallowRef<import('@/shared/ai/job').AiJob | null>(null)

/** 分支路径：台名 / 父分类 / 本分类（≤4 级，带 visited 防环） */
function branchPath(d: NonNullable<ReturnType<typeof useAppStore>['data']>, cat: Category): string {
  const parts = [cat.name]
  const seen = new Set<string>([cat.id])
  let p = cat.parentId ? d.categories.find(x => x.id === cat.parentId) : undefined
  let guard = 0
  while (p && !seen.has(p.id) && guard++ < 4) { parts.unshift(p.name); seen.add(p.id); p = p.parentId ? d.categories.find(x => x.id === p!.parentId) : undefined }
  const ws = d.workspaces.find(w => w.id === cat.workspaceId)
  return (ws ? wsDisplayNameOf(ws) + ' / ' : '') + parts.join(' / ')
}

async function run() {
  emit('close')
  const d = store.data
  if (!d) return
  const cat = d.categories.find(c => c.id === props.catId && !c.deletedAt)
  if (!cat) { showToast('⚠ 该节点已不存在'); return }
  const [{ loadAiConfig, aiReady, aiConfig }, { buildEvidenceJob }] = await Promise.all([import('@/shared/ai/config'), import('@/shared/ai/batchG')])
  await loadAiConfig()
  if (!aiReady.value) { showToast('请先在 设置 → AI 助手 完成接入（地址/Key/模型）'); return }
  job.value = buildEvidenceJob({
    d, depth: aiConfig.value.depth, persist: () => store.persist(),
    wsId: props.wsId, catId: props.catId, branchName: cat.name, branchPath: branchPath(d, cat),
    onApplied: n => showToast(`✓ ${n} 张佐证卡已挂上「${cat.name}」`),
  })
  if (!job.value) showToast('⚠ 资源台里没有可推荐的卡（或都已挂在本分支）')
}
</script>

<template>
  <div class="ev-item" @click.stop="run">🔍 找佐证（全库推荐）</div>
  <AiDrawer v-if="job" :job="job" @close="job = null" />
</template>

<style scoped>
.ev-item { padding: 8px 11px; border-radius: 7px; font-size: 12px; color: var(--text-2); cursor: pointer; transition: all .1s; }
.ev-item:hover { background: var(--surface-3); color: var(--text); }
</style>
