<script setup lang="ts">
import Icon from '@/shared/components/Icon.vue'
import { useOverlayTarget } from '@/shared/utils/overlayHost'
// R113-N5：Teleport 目标动态化——金字塔真全屏期间浮层挂进全屏元素（否则不可见）
const overlayTarget = useOverlayTarget()
/**
 * R169-老账①：分类自绘选择器（点开才展开，替掉原生 <select> 的常驻 <option>）。
 * 背景（R168 交付说明 §七）：真库 88+ 个分类 ⇒ 原生 select 的 <option> 无法懒渲染，
 * 每次打开详情抽屉都是一整列 option 节点；自绘弹层把"选项列表"从 DOM 常驻变成点开才挂。
 * 惯例同 TagPicker（R113-N5）：Teleport + fixed mask + 计算坐标；判据单源：选项由宿主传入，
 * 本组件不感知分类数据结构。键盘契约：Esc 关（焦点在过滤框，无 R161 immediate 陷阱）、
 * Enter 选首条、↑/↓ 移动高亮。
 */
import { ref, computed, nextTick } from 'vue'

export interface CatOpt { id: string; label: string }
const props = defineProps<{
  /** 当前分类 id（'' = 待分类） */
  modelValue?: string
  options: CatOpt[]
}>()
const emit = defineEmits<{ 'update:modelValue': [string] }>()

const open = ref(false)
const q = ref('')
const popLeft = ref(0)
const popTop = ref(0)
const btnRef = ref<HTMLElement | null>(null)
const filterRef = ref<HTMLInputElement | null>(null)
/** 键盘高亮游标（-1 = 未落在具体项；Enter 时落到首条可见项） */
const activeIdx = ref(-1)

const labelOf = computed(() => {
  const hit = props.options.find(o => o.id === props.modelValue)
  return hit ? hit.label : '待分类'
})
const visible = computed(() => {
  const qq = q.value.trim().toLowerCase()
  return qq ? props.options.filter(o => o.label.toLowerCase().includes(qq)) : props.options
})

function openPop() {
  open.value = true
  q.value = ''
  activeIdx.value = -1
  // 与 TagPicker 同法：锚在触发钮附近（本组件触发钮宽度可能超过 240 → x 取按钮左缘）
  const r = btnRef.value?.getBoundingClientRect()
  popLeft.value = Math.max(8, Math.min(r ? r.left : 20, window.innerWidth - 320))
  popTop.value = Math.min(r ? r.bottom + 6 : 100, window.innerHeight - 360)
  nextTick(() => filterRef.value?.focus())
}
function pick(id: string) {
  emit('update:modelValue', id)
  open.value = false
}
function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape') { e.stopPropagation(); open.value = false; return }
  if (e.key === 'ArrowDown') { e.preventDefault(); activeIdx.value = Math.min(activeIdx.value + 1, visible.value.length - 1); return }
  if (e.key === 'ArrowUp') { e.preventDefault(); activeIdx.value = Math.max(activeIdx.value - 1, -1); return }
  if (e.key === 'Enter') {
    e.preventDefault()
    const hit = activeIdx.value >= 0 ? visible.value[activeIdx.value] : visible.value[0]
    if (hit) pick(hit.id)
  }
}
</script>

<template>
  <div class="cp" @click.stop>
    <button ref="btnRef" type="button" class="cp-btn" :title="'选择分类（点开才展开，不再常驻 option）'" @click="openPop">
      <span class="cp-cur" :class="{ unset: !modelValue }">{{ labelOf }}</span>
      <span class="cp-caret">▾</span>
    </button>
    <Teleport :to="overlayTarget">
      <div v-if="open" class="cp-mask" @click="open = false" />
      <div v-if="open" class="cp-pop" :style="{ left: popLeft + 'px', top: popTop + 'px' }" @click.stop>
        <div class="cp-head"><Icon name="folderopen" :size="13"/> 选择分类 <span class="cp-sub">共 {{ options.length }} 个候选</span></div>
        <input ref="filterRef" v-model="q" class="cp-search" placeholder="搜索分类…" @keydown="onKey">
        <div class="cp-list" @keydown="onKey">
          <div class="cp-item" :class="{ on: !modelValue, act: activeIdx === -1 && !q.trim() }" @click="pick('')"
            @mousemove="activeIdx = -1">待分类（不归入任何分类）</div>
          <div v-for="(o, i) in visible" :key="o.id" class="cp-item" :class="{ on: o.id === modelValue, act: i === activeIdx }"
            @click="pick(o.id)" @mousemove="activeIdx = i">{{ o.label }}</div>
          <div v-if="!visible.length" class="cp-empty">没有匹配「{{ q.trim() }}」的分类</div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.cp { display: inline-block; max-width: 240px; width: 100%; position: relative; }
.cp-btn { width: 100%; display: flex; align-items: center; justify-content: space-between; gap: 6px; padding: 7px 10px; border: 1px solid var(--border); border-radius: 8px; background: var(--surface); color: var(--text); font-size: var(--fs-sub); cursor: pointer; font-family: inherit; transition: border-color var(--dur); text-align: left; }
.cp-btn:hover { border-color: var(--accent); }
.cp-cur { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.cp-cur.unset { color: var(--text-3); }
.cp-caret { color: var(--text-3); font-size: var(--fs-tiny); flex-shrink: 0; }
.cp-mask { position: fixed; inset: 0; z-index: var(--z-picker); }
.cp-pop { position: fixed; z-index: calc(var(--z-picker) + 1); width: 300px; max-width: 92vw; background: var(--surface); border: 1px solid var(--border); border-radius: 12px; box-shadow: var(--shadow-lg); overflow: hidden; }
.cp-head { padding: 12px 14px 0; font-size: var(--fs-body); font-weight: 600; color: var(--text); }
.cp-head .cp-sub { display: block; font-size: var(--fs-tiny); color: var(--text-3); font-weight: 400; margin-top: 2px; }
.cp-search { width: calc(100% - 20px); margin: 10px 10px 6px; border: 1px solid var(--border); border-radius: 8px; padding: 8px 10px; font-size: var(--fs-sub); outline: none; font-family: inherit; background: var(--surface); color: var(--text); }
.cp-search:focus { border-color: var(--accent); }
.cp-list { max-height: 280px; overflow-y: auto; padding: 4px 6px 8px; }
.cp-item { padding: 7px 8px; border-radius: 6px; cursor: pointer; font-size: var(--fs-sub); color: var(--text); transition: background .1s; }
.cp-item:hover, .cp-item.act { background: var(--surface-2); }
.cp-item.on { color: var(--accent); font-weight: 600; }
.cp-empty { padding: 12px; text-align: center; font-size: var(--fs-sub); color: var(--text-3); }
</style>
