<script setup lang="ts">
/**
 * R3-Cc2：三张卡（资源卡池 / 任务调度 / 好奇心培育）**控制行的唯一实现**。
 *
 * 渲染顺序固定，这就是"统一"的实际内容：
 *   搜索 → 筛选 → 视图 → 排序 → 排序方向 → 分组 → 面板自带控件（默认槽）→ 计数（#count 槽）→ 批量 → 新建
 * 值域（有哪些筛选项、哪几个视图、按什么排）由调用方以数组传入——**差异是数据，不是三份模板**。
 *
 * 两条纪律（都是这轮踩出来的）：
 *  1. 样式一律组件自带（`.dk-btn` 等），**不接受父面板传类名**：scoped 边界下父组件的
 *     `.mini-btn:disabled` 选不到子组件模板里的节点，传类名只会得到一排浏览器默认按钮。
 *  2. `panel` prop 落到 `data-panel`——三张卡同页挂载，共用组件后裸类名一次命中多枚
 *     （Playwright 严格模式直接抛），E2E 与排障都需要一个按卡型稳定的锚点。
 */
import Icon from '@/shared/components/Icon.vue'
import { computed } from 'vue'

export type DkOption = { id: string; label: string; title?: string; count?: number }

const props = withDefaults(defineProps<{
  panel: string
  search?: boolean
  searchPh?: string
  query?: string
  filters?: DkOption[]
  filterKind?: 'pills' | 'select'
  filterTitle?: string
  filter?: string
  views?: DkOption[]
  view?: string
  sorts?: DkOption[]
  sort?: string
  sortDir?: 'asc' | 'desc' | ''
  sortDirTitles?: [string, string]
  groups?: DkOption[]
  group?: string
  batchLabels?: [string, string]
  batchOn?: boolean
  newLabel?: string
  newTitle?: string
}>(), {
  search: false, searchPh: '快速过滤...', query: '', filters: () => [], filterKind: 'pills', filter: '',
  views: () => [], view: '', sorts: () => [], sort: '', sortDir: '', groups: () => [], group: '',
  batchLabels: () => ['批量管理', '完成'], batchOn: false
})

const emit = defineEmits<{
  (e: 'search', v: string): void
  (e: 'filter', v: string): void
  (e: 'view', v: string): void
  (e: 'sort', v: string): void
  (e: 'sort-dir'): void
  (e: 'group', v: string): void
  (e: 'batch'): void
  (e: 'create'): void
}>()

const sortDirLabel = computed(() => (props.sortDir === 'desc' ? '↓ 倒序' : '↑ 正序'))
const sortDirTitle = computed(() => {
  const t = props.sortDirTitles
  if (!t) return '切换排序方向'
  return props.sortDir === 'desc' ? t[0] : t[1]
})
</script>

<template>
  <div class="dk-row" :data-panel="panel">
    <div v-if="search" class="dk-search"><span><Icon name="search" :size="13"/></span><input :value="query" :placeholder="searchPh"
      @input="emit('search', ($event.target as HTMLInputElement).value)"></div>

    <div v-if="filters.length" class="dk-filters" :class="filterKind === 'pills' ? 'pills' : 'select'">
      <template v-if="filterKind === 'pills'">
        <button v-for="f in filters" :key="f.id" class="dk-btn dk-pill" :class="{ on: filter === f.id }"
          :title="f.title" @click="emit('filter', f.id)">{{ f.label }}<span v-if="f.count !== undefined" class="dk-pill-n">{{ f.count }}</span></button>
      </template>
      <select v-else class="dk-select" :value="filter" :title="filterTitle" @change="emit('filter', ($event.target as HTMLSelectElement).value)">
        <option v-for="f in filters" :key="f.id" :value="f.id">{{ f.label }}</option>
      </select>
    </div>

    <div v-if="views.length" class="dk-views">
      <button v-for="v in views" :key="v.id" class="dk-btn dk-view" :class="{ on: view === v.id }"
        :title="v.title || v.label" @click="emit('view', v.id)">{{ v.label }}</button>
    </div>

    <select v-if="sorts.length" class="dk-select dk-sort" :value="sort" title="排序方式"
      @change="emit('sort', ($event.target as HTMLSelectElement).value)">
      <option v-for="s in sorts" :key="s.id" :value="s.id">{{ s.label }}</option>
    </select>
    <button v-if="sortDir" class="dk-btn dk-sort-dir" :title="sortDirTitle" @click="emit('sort-dir')">{{ sortDirLabel }}</button>

    <select v-if="groups.length" class="dk-select dk-group" :value="group" title="分组方式"
      @change="emit('group', ($event.target as HTMLSelectElement).value)">
      <option v-for="g in groups" :key="g.id" :value="g.id">{{ g.label }}</option>
    </select>

    <!-- 面板自带控件：列数选择器、导入入口、转化读数等 -->
    <slot />

    <span v-if="$slots.count" class="dk-count"><slot name="count" /></span>

    <button v-if="batchLabels" class="dk-btn dk-batch" :class="{ on: batchOn }" @click="emit('batch')">{{ batchOn ? batchLabels[1] : batchLabels[0] }}</button>
    <button v-if="newLabel" class="dk-btn dk-new" :title="newTitle" @click="emit('create')">{{ newLabel }}</button>
  </div>
</template>

<style scoped>
/* 与三张卡既有的按钮语言一致（同一套令牌，不新造视觉） */
.dk-row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 12px; }
.dk-search { display: flex; align-items: center; gap: 6px; padding: 5px 11px; border: 1px solid var(--border); border-radius: var(--radius-sm); background: var(--surface-2); }
.dk-search:focus-within { border-color: var(--accent); }
.dk-search input { border: none; outline: none; font-size: var(--fs-sub); width: 190px; background: transparent; color: var(--text); font-family: inherit; }
.dk-views { display: inline-flex; align-items: center; gap: 2px; padding: 2px; border: 1px solid var(--border); border-radius: var(--radius-sm); background: var(--surface-2); }
.dk-filters { display: inline-flex; align-items: center; gap: 6px; }
.dk-filters.select { gap: 0; }
.dk-btn { border: 1px solid var(--border); background: var(--surface); color: var(--text-2); border-radius: var(--radius-sm); padding: 5px 11px; font-size: var(--fs-sub); font-weight: 600; font-family: inherit; cursor: pointer; user-select: none; transition: all var(--dur); white-space: nowrap; }
.dk-btn:hover:not(:disabled) { border-color: var(--border-strong); color: var(--text); }
.dk-btn:disabled { opacity: var(--opacity-disabled); cursor: not-allowed; }
.dk-btn.on { border-color: var(--accent); background: var(--accent-light); color: var(--accent-ink); }
.dk-views .dk-btn { border-color: transparent; background: transparent; padding: 4px 9px; font-size: var(--fs-caption); }
.dk-views .dk-btn.on { border-color: var(--border); background: var(--surface); color: var(--text); box-shadow: var(--shadow-sm); }
.dk-pill { padding: 4px 9px; font-weight: 500; font-size: var(--fs-caption); }
.dk-pill-n { margin-left: 5px; font-variant-numeric: tabular-nums; color: var(--text-3); }
.dk-pill.on .dk-pill-n { color: var(--accent-ink); }
.dk-select { border: 1px solid var(--border); background: var(--surface); color: var(--text-2); border-radius: var(--radius-sm); padding: 4px 8px; font-size: var(--fs-sub); font-family: inherit; outline: none; cursor: pointer; }
.dk-select:focus { border-color: var(--accent); }
.dk-count { margin-left: auto; font-size: var(--fs-sub); color: var(--text-3); font-variant-numeric: tabular-nums; display: inline-flex; align-items: center; gap: 4px; }
.dk-new { border-color: var(--accent); color: var(--accent); background: var(--accent-light); }
</style>
