<script setup lang="ts">
/**
 * R2-③（V3.7.0 架构简化轮·资源卡管理补位）：资源卡池面板
 * —— 资源台退役后，池卡的唯一管理面（R179 交付说明遗留：池语义落地后管理入口待补位）。
 * 最小可用骨架：搜索 + 池卡网格（标题/标签/链资产标记）+ 单击开编辑抽屉（App 级 ResourceDetailDrawer
 * 经 zy-open-drawer 总线）+ 软删。控制行组件化 / 三视图渲染器 / 批量打标签 = R2 第二批（DeckTabs 收编）。
 * 数据口径：workspaceId='zy-curation'（隐藏池 id，R179 定案）且未软删。
 */
import { computed, ref } from 'vue'
import { useAppStore } from '../../stores/app'
import { emitOpenDrawer } from '@/shared/utils/bus'
import { showToast } from '@/shared/components/toast'
import NewBadge from '@/shared/components/NewBadge.vue'

const store = useAppStore()

const query = ref('')
const poolCards = computed(() => {
  const q = query.value.trim().toLowerCase()
  return (store.data?.resources || [])
    .filter(r => !r.deletedAt && r.workspaceId === 'zy-curation')
    .filter(r => !q || r.title.toLowerCase().includes(q) || (r.tags || []).some(t => t.toLowerCase().includes(q)))
    .sort((a, b) => (Number(b.pinned) - Number(a.pinned)) || (b.updatedAt || 0) - (a.updatedAt || 0))
})
const poolTotal = computed(() => (store.data?.resources || []).filter(r => !r.deletedAt && r.workspaceId === 'zy-curation').length)

function openCard(r: { id: string }) {
  emitOpenDrawer({ kind: 'res', id: r.id })
}
function removeCard(r: { id: string; title: string }) {
  const live = (store.data?.resources || []).find(x => x.id === r.id)
  if (!live) return
  live.deletedAt = Date.now()
  store.persist()
  showToast(`已删除「${live.title.slice(0, 20)}」`, { label: '撤销', cb: () => {
    const cur = (store.data?.resources || []).find(x => x.id === r.id)
    if (cur && cur.deletedAt) { cur.deletedAt = undefined; store.persist() }
  } })
}
</script>

<template>
  <div class="pcp">
    <div class="pcp-toolbar">
      <div class="pcp-search"><span>🔍</span><input v-model="query" placeholder="快速过滤标题 / 标签..."></div>
      <span class="pcp-count"><b>{{ poolCards.length }}</b> / 全部 {{ poolTotal }} 张</span>
      <!-- R2 第二批：批量管理 / 新建单卡 / 本地导入 / 待打标筛选（DeckTabs 控制行组件化时收编） -->
    </div>

    <div v-if="!poolCards.length" class="pcp-empty">
      <template v-if="query">没有匹配「{{ query }}」的资源卡——试试清空过滤</template>
      <template v-else>资源卡池还空着——用 <b>Ctrl+Shift+J</b> 从任意网页采集第一张卡</template>
    </div>

    <div v-else class="pcp-grid">
      <div v-for="r in poolCards" :key="r.id" class="pcp-card" :title="r.title + ' · 单击打开详情'"
        @click="openCard(r)">
        <div class="pcp-top">
          <div class="pcp-title">
            <NewBadge :at="r.createdAt" />
            <span v-if="r.pinned" class="pcp-pin" title="已置顶">📌</span>{{ r.title }}
          </div>
          <button class="pcp-del" title="删除（进回收站，可撤销）" @click.stop="removeCard(r)">🗑</button>
        </div>
        <div class="pcp-foot">
          <span v-if="r.link" class="pcp-mark" title="已挂链接">🔗</span>
          <span v-if="r.assets?.length" class="pcp-mark" title="有附件">📎</span>
          <span v-for="t in (r.tags || []).slice(0, 3)" :key="t" class="pcp-tag">{{ t }}</span>
          <span class="pcp-date">{{ new Date(r.updatedAt || r.createdAt || Date.now()).toLocaleDateString('zh-CN') }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* R2-③：池卡网格——与 DeckTabs 卡片语言同款（surface + hairline + hover 抬升） */
.pcp { min-height: 120px; }
.pcp-toolbar { display: flex; align-items: center; gap: 10px; margin-bottom: 14px; }
.pcp-search { display: flex; align-items: center; gap: 6px; padding: 5px 11px; border: 1px solid var(--border); border-radius: var(--radius-sm); background: var(--surface-2); }
.pcp-search:focus-within { border-color: var(--accent); }
.pcp-search input { border: none; outline: none; font-size: var(--fs-sub); width: 200px; background: transparent; color: var(--text); font-family: inherit; }
.pcp-count { margin-left: auto; font-size: var(--fs-sub); color: var(--text-3); font-variant-numeric: tabular-nums; }
.pcp-count b { color: var(--text-2); }
.pcp-empty { padding: 26px; text-align: center; font-size: var(--fs-sub); color: var(--text-3); }
.pcp-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 12px; }
.pcp-card { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-md); padding: 12px 14px; min-height: 94px; display: flex; flex-direction: column; justify-content: space-between; gap: 8px; cursor: pointer; transition: all var(--dur) ease; }
.pcp-card:hover { border-color: var(--border-strong); transform: translateY(-1px); box-shadow: var(--shadow-sm); }
.pcp-top { display: flex; align-items: flex-start; gap: 6px; }
.pcp-title { flex: 1; min-width: 0; font-size: var(--fs-body); font-weight: 600; line-height: 1.4; color: var(--text); display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; word-break: break-word; }
.pcp-pin { flex-shrink: 0; font-size: var(--fs-tiny); }
.pcp-del { border: none; background: transparent; color: var(--text-3); cursor: pointer; font-size: var(--fs-caption); border-radius: 5px; padding: 2px 5px; flex-shrink: 0; opacity: 0; transition: opacity var(--dur-fast); font-family: inherit; }
.pcp-card:hover .pcp-del { opacity: 1; }
.pcp-del:hover { color: var(--danger); background: var(--danger-bg-soft); }
.pcp-foot { display: flex; align-items: center; gap: 5px; font-size: var(--fs-tiny); color: var(--text-3); flex-wrap: wrap; }
.pcp-mark { flex-shrink: 0; }
.pcp-tag { padding: 0 6px; border-radius: 99px; background: var(--surface-3); color: var(--text-2); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 110px; }
.pcp-date { margin-left: auto; font-variant-numeric: tabular-nums; flex-shrink: 0; }
</style>
