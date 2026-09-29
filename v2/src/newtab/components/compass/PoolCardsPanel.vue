<script setup lang="ts">
/**
 * R2-③（V3.7.0 架构简化轮·资源卡管理补位）→ R2-④⑤ 收口：资源卡池面板
 * —— 资源台退役后，池卡的唯一管理面。
 * 已接：搜索 + 池卡网格 + 单击开编辑抽屉（App 级 ResourceDetailDrawer 经 zy-open-drawer 总线，
 * 打开即记一次「调出」，与内联抽屉宿主同口径）+ 软删带撤销 + `?hl=&hk=res` 定位高亮（⌘K / 网页浮层 / AI 面板直达）。
 * 仍欠（R2 第三批）：控制行组件化 / 三视图渲染器 / 批量打标签 / 新建单卡 / 本地文件导入入口。
 * 数据口径：workspaceId=CURATION_WS_ID（隐藏池 id，R179 定案）且未软删。
 */
import { computed, nextTick, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAppStore } from '../../stores/app'
import { CURATION_WS_ID } from '@/shared/models'
import { emitOpenDrawer } from '@/shared/utils/bus'
import { showToast } from '@/shared/components/toast'
import NewBadge from '@/shared/components/NewBadge.vue'

const store = useAppStore()
const route = useRoute()
const router = useRouter()

const query = ref('')
const poolCards = computed(() => {
  const q = query.value.trim().toLowerCase()
  return (store.data?.resources || [])
    .filter(r => !r.deletedAt && r.workspaceId === CURATION_WS_ID)
    .filter(r => !q || r.title.toLowerCase().includes(q) || (r.tags || []).some(t => t.toLowerCase().includes(q)))
    .sort((a, b) => (Number(b.pinned) - Number(a.pinned)) || (b.updatedAt || 0) - (a.updatedAt || 0))
})
const poolTotal = computed(() => (store.data?.resources || []).filter(r => !r.deletedAt && r.workspaceId === CURATION_WS_ID).length)

/**
 * R2-④：`?hl=&hk=res` 卡片定位消费者（⌘K 单击/Ctrl+Enter、网页浮层定位、AI 面板直达同一条链路）。
 * 纪律照 `useWsLocate.ts:61-68`：**hk 指明别的卡型就让路**——调度台同页挂着任务卡与好奇卡两个
 * hl 消费者，抢着处理会把别人的定位抹掉（R152 真机报过的那类 bug）。
 */
const highlightId = ref<string | null>(null)
watch(() => route.query.hl, (hl) => {
  if (!hl || typeof hl !== 'string') return
  const hk = typeof route.query.hk === 'string' ? route.query.hk : ''
  if (hk && hk !== 'res') return
  const hit = (store.data?.resources || []).find(r => r.id === hl && !r.deletedAt)
  if (!hit) return
  if (hit.workspaceId !== CURATION_WS_ID) { showToast('⚠ 这张卡不在资源卡池（在策展台内）'); return }
  query.value = '' // 过滤态下目标卡可能根本不在渲染列表里，定位先清过滤
  highlightId.value = hl
  nextTick(() => {
    setTimeout(() => {
      document.querySelector(`[data-rid="${hl}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      setTimeout(() => { highlightId.value = null }, 2000)
    }, 120)
  })
  router.replace({ path: route.path })
}, { immediate: true })

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
      <div v-for="r in poolCards" :key="r.id" class="pcp-card" :class="{ flash: highlightId === r.id }" :data-rid="r.id"
        :title="r.title + ' · 单击打开详情'" @click="openCard(r)">
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
/* R2-④：定位高亮——与 workspace.css 的 .res-card.flash 同一视觉语言（该表在调度台不加载，故本地定义） */
.pcp-card.flash { animation: pcp-flash 2s ease-out; }
@keyframes pcp-flash {
  0% { box-shadow: 0 0 0 3px var(--accent), 0 4px 20px color-mix(in srgb, var(--accent) 35%, transparent); background: var(--accent-light); }
  60% { box-shadow: 0 0 0 3px var(--accent); background: var(--accent-light); }
  100% { box-shadow: none; }
}
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
