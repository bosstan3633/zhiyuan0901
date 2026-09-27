<script setup lang="ts">
/**
 * R166 定案 1/F2：任务卡内嵌子任务清单。
 *
 * 它是**本卡的内容**，不是独立任务卡——所以：
 *  · 删一行就是删掉，没有回收站、没有撤销（卡的回收站语义不适用于清单行）；
 *  · 勾选只改这一行的 done，**不联动**任务状态、不进成熟度/周报（定案 3）；
 *  · 排序就是数组顺序，不引入 sortOrder。
 * 改名用 `<input>` 而不是原型的 contenteditable：行为一致（就地改、失焦落库），
 * 但省掉 contenteditable 的粘贴富文本与光标陷阱。
 */
import { ref } from 'vue'
import type { Subtask } from '@/shared/models'
import { uid } from '@/shared/utils'

const props = defineProps<{
  subtasks: Subtask[]
  /** 该子任务已挂几条资源支持（无关联时不显角标） */
  supCount?: (subId: string) => number
}>()
const emit = defineEmits<{
  (e: 'update', v: Subtask[]): void
  (e: 'sup', s: Subtask): void
}>()

const draft = ref('')
const write = (fn: (list: Subtask[]) => Subtask[]) => emit('update', fn(props.subtasks || []))
// R172-T2：勾选同时落 `doneAt`（热力图/复盘「推进」维度按日归集的唯一依据）
function toggle(s: Subtask) { write(list => list.map(x => (x.id === s.id ? { ...x, done: !x.done, doneAt: !x.done ? Date.now() : undefined } : x))) }
function rename(s: Subtask, ev: Event) {
  const v = (ev.target as HTMLInputElement).value.trim()
  if (!v || v === s.title) return
  write(list => list.map(x => (x.id === s.id ? { ...x, title: v } : x)))
}
function remove(s: Subtask) { write(list => list.filter(x => x.id !== s.id)) }
function add() {
  const v = draft.value.trim()
  if (!v) return
  write(list => [...list, { id: uid('st'), title: v, done: false }])
  draft.value = ''
}
const done = () => (props.subtasks || []).filter(s => s.done).length
const total = () => (props.subtasks || []).length
</script>

<template>
  <div class="st">
    <div v-for="s in subtasks" :key="s.id" class="st-row">
      <span class="st-dot" :class="{ done: s.done }" :title="s.done ? '标记未完成' : '标记完成（不进成熟度与周报）'" @click="toggle(s)">{{ s.done ? '✓' : '' }}</span>
      <input class="st-t" :class="{ done: s.done }" :value="s.title" spellcheck="false" @change="rename(s, $event)" @keydown.enter.prevent="($event.target as HTMLInputElement).blur()">
      <span v-if="supCount && supCount(s.id)" class="st-sup" title="这条子任务已挂资源支持，点开看" @click="emit('sup', s)">🧭 {{ supCount(s.id) }}</span>
      <span class="st-x" title="删除这一行（清单行不是卡，无回收站）" @click="remove(s)">×</span>
    </div>
    <div class="st-add" @click="draft && ($event.target as HTMLElement).querySelector('input')?.focus()">
      <span class="st-plus">＋</span>
      <input v-model="draft" placeholder="加一条子任务，回车确认（也可让 AI 拆解批量写入）" @keydown.enter.prevent="add" @blur="add">
      <span v-if="total()" class="st-cnt">{{ done() }}/{{ total() }}</span>
    </div>
  </div>
</template>

<style scoped>
.st { border: 1px solid var(--border); border-radius: var(--radius-md); background: var(--surface-2); overflow: hidden; }
.st-row { display: flex; align-items: center; gap: 9px; padding: 7px 11px; border-bottom: 1px solid var(--border); font-size: var(--fs-sub); }
.st-row:last-of-type { border-bottom: 0; }
.st-dot { width: 16px; height: 16px; flex-shrink: 0; border-radius: 5px; border: 1.5px solid var(--border-strong); display: flex; align-items: center; justify-content: center; font-size: var(--fs-micro); color: #fff; cursor: pointer; }
.st-dot.done { background: var(--success); border-color: var(--success); }
.st-t { flex: 1; min-width: 0; border: none; outline: none; background: transparent; color: var(--text); font-size: var(--fs-sub); font-family: inherit; border-radius: 5px; padding: 1px 4px; }
.st-t:focus { background: var(--surface-3); }
.st-t.done { color: var(--text-4); text-decoration: line-through; }
.st-sup { font-size: var(--fs-tiny); color: var(--text-3); border: 1px solid var(--border); border-radius: 99px; padding: 0 7px; cursor: pointer; white-space: nowrap; }
.st-sup:hover { color: var(--accent); border-color: var(--accent); }
.st-x { color: var(--text-4); cursor: pointer; padding: 0 2px; font-size: var(--fs-body); }
.st-x:hover { color: var(--danger); }
.st-add { display: flex; align-items: center; gap: 9px; padding: 7px 11px; border-top: 1px dashed var(--border); color: var(--text-4); font-size: var(--fs-sub); }
.st-plus { width: 16px; text-align: center; flex-shrink: 0; }
.st-add input { flex: 1; min-width: 0; background: transparent; border: 0; outline: none; color: var(--text); font-size: var(--fs-sub); font-family: inherit; }
.st-cnt { font-size: var(--fs-tiny); color: var(--text-3); white-space: nowrap; }
</style>
