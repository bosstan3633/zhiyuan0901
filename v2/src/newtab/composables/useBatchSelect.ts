import { computed, ref, type Ref } from 'vue'

/** 批量动作的公共形状：三类卡都有 id / tags / updatedAt，软删卡一律不参与批量写入 */
export type BatchTarget = { id: string; tags?: string[]; updatedAt?: number; deletedAt?: number }

/**
 * R3-Cb：三张卡（资源卡池 / 任务调度 / 好奇心培育）批量选择的**唯一**实现。
 *
 * 立这条不是为了少写几行，而是改前三份各写各的、其中两份是错的：
 *  - 任务与好奇的按钮文案写「全选/反选」，函数体只做满选↔清空，**反选从来没实现过**；
 *  - 好奇退出批量态不清空 selected，下一次进来上一轮的勾选还在，而两次之间可见集合可能已变
 *    ——那是"我以为没选"的误删配方（批量动作里就有删除）。
 * 语义：`visibleIds()` 给**当前过滤结果**，所有选择动作都只在这个集合里发生（全池/全量取反
 * 会把看不见的卡卷进批量删除）。Set 用就地增删，与各面板既有的 `.forEach/.size/.has/.clear` 调用点一致。
 */
export function useBatchSelect(visibleIds: () => string[]) {
  const selected: Ref<Set<string>> = ref(new Set())
  const size = computed(() => selected.value.size)
  const allSelected = computed(() => {
    const ids = visibleIds()
    return ids.length > 0 && ids.length === selected.value.size
  })
  const has = (id: string) => selected.value.has(id)
  function toggle(id: string) {
    if (selected.value.has(id)) selected.value.delete(id); else selected.value.add(id)
  }
  function selectAll() {
    if (allSelected.value) selected.value.clear()
    else visibleIds().forEach(id => selected.value.add(id))
  }
  function invert() {
    const keep = visibleIds().filter(id => !selected.value.has(id))
    selected.value.clear()
    keep.forEach(id => selected.value.add(id))
  }
  function clear() { selected.value.clear() }
  /** 退出批量态必须清空（三面板同一句，不再各写各的） */
  function setMode(on: boolean): boolean { if (!on) clear(); return on }
  return { selected, size, allSelected, has, toggle, selectAll, invert, clear, setMode }
}

/**
 * R3-Cb：批量打标签的唯一写入式——**只加不减**（去标签回卡详情，与拖拽打标同口径），
 * 软删卡跳过，命中数回给调用方去提示。
 */
export function addTagToCards<T extends BatchTarget>(items: T[], ids: Set<string>, tag: string): number {
  const t = tag.trim()
  if (!t) return 0
  let n = 0
  const now = Date.now()
  for (const it of items) {
    if (!ids.has(it.id) || it.deletedAt) continue
    it.tags = Array.from(new Set([...(it.tags || []), t]))
    it.updatedAt = now
    n++
  }
  return n
}
