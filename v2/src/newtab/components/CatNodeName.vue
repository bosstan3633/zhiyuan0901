<script setup lang="ts">
/**
 * R141（反馈 #7）：分类树/金字塔共用的「双击就地改名」名称单元。
 * 双击 span → 行内 input（Enter/blur 提交、Esc 取消）；宿主菜单「重命名」经 editing prop 外部唤起。
 * 同名查重与落库由宿主 commit 回调负责（useCategoryCrud.commitCatRename）。
 */
import { nextTick, ref, watch } from 'vue'
const props = defineProps<{ name: string; editing?: boolean; icon?: string }>()
const emit = defineEmits<{ commit: [string]; done: [] }>()
const localEdit = ref(false)
const val = ref('')
const inpRef = ref<HTMLInputElement | null>(null)
function start() {
  val.value = props.name
  localEdit.value = true
  nextTick(() => { inpRef.value?.focus(); inpRef.value?.select() })
}
watch(() => props.editing, (v) => { if (v) start() })
function finish(commit: boolean) {
  if (!localEdit.value) return
  const v = val.value.trim()
  localEdit.value = false
  if (commit && v && v !== props.name) emit('commit', v)
  emit('done')
}
</script>

<template>
  <input v-if="localEdit" ref="inpRef" v-model="val" class="cn-input" :title="name"
    @click.stop @dblclick.stop @keydown.enter.prevent="finish(true)" @keydown.esc.prevent="finish(false)"
    @blur="finish(true)" />
  <span v-else class="cn-name"><template v-if="icon">{{ icon }}</template>{{ name }}</span>
</template>

<style scoped>
.cn-input { width: 100%; min-width: 40px; box-sizing: border-box; font: inherit; font-size: var(--fs-sub); padding: 1px 6px; border: 1px solid var(--accent); border-radius: var(--radius-xs); background: var(--surface); color: var(--text); outline: none; }
.cn-name { display: block; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
</style>
