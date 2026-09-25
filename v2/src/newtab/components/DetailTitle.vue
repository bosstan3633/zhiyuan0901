<script setup lang="ts">
/**
 * R167：详情抽屉主标题（kicker 一行小字 + 就地可编辑标题，单行自增高）。
 * 两宿主共用（App 级资源抽屉 / Workspace 内联抽屉）——标题若在两处各写一遍，
 * 就会出现"一处进头部、一处留正文，一份 17px、一份 12px"的分叉（本轮开工前正是这样）。
 * ★自增高不可省：不自增高的单行 textarea 遇到长标题会在框内竖滚，抽屉头高度随之抖。
 * ★回车即保存：标题只有单行语义，没有"换行"这个需求。
 */
import { nextTick, ref, watch } from 'vue'

const props = withDefaults(defineProps<{
  modelValue: string
  /** 头部小字：说清这张卡在哪、归哪类（主标题不再需要重复说"这是什么卡"以外的信息） */
  kicker?: string
  placeholder?: string
  /** 只读卡（镜像）：标题看得见、改不了——用 `readonly` 而非 `disabled`，后者会把它压成灰底 */
  readonly?: boolean
  /** 搜索/定位高亮（1.8s 后由宿主关掉）：标题是抽屉的第一视觉落点，闪它才找得到 */
  highlight?: boolean
}>(), { kicker: '', placeholder: '标题…', readonly: false, highlight: false })
const emit = defineEmits<{ 'update:modelValue': [string]; enter: [] }>()

const el = ref<HTMLTextAreaElement | null>(null)
function grow(): void {
  const t = el.value
  if (!t) return
  t.style.height = 'auto'
  t.style.height = t.scrollHeight + 'px'
}
/** 宿主以 `:model-value` + `@update` 单向传值，故外部改写（AI 采纳回写）也要重算高度 */
watch(() => props.modelValue, () => { void nextTick(grow) })
watch(el, (v) => { if (v) void nextTick(grow) })

function onEnter(e: KeyboardEvent): void {
  if (e.key !== 'Enter' || e.isComposing) return
  e.preventDefault()
  emit('enter')
}
</script>

<template>
  <div class="dt-root" :class="{ highlight }">
    <div v-if="kicker" class="ds-kicker">{{ kicker }}</div>
    <textarea ref="el" class="ds-h1" rows="1" :placeholder="placeholder" :value="modelValue" :readonly="readonly"
      @input="emit('update:modelValue', ($event.target as HTMLTextAreaElement).value); grow()"
      @keydown="onEnter"></textarea>
  </div>
</template>

<style scoped>
.dt-root { flex: 1; min-width: 0; }
.dt-root.highlight .ds-h1 { box-shadow: 0 0 0 2px var(--accent); }
</style>
