<script setup lang="ts">
/**
 * R165-A（方案 A 标准）：删除二次确认钮——详情抽屉页脚统一实现（四宿主：RDD / Workspace 内联 / 任务抽屉 / 好奇详情）。
 * 单击扣扳机（红底「确认删除？（进回收站）」），3 秒内再点才真删；超时自动回落。软删语义由宿主 handler 保证。
 */
import { ref, onUnmounted } from 'vue'

const props = withDefaults(defineProps<{ label?: string; busy?: boolean }>(), { label: '🗑 删除', busy: false })
const emit = defineEmits<{ confirm: [] }>()

const armed = ref(false)
let t: ReturnType<typeof setTimeout> | null = null
function click() {
  if (!armed.value) {
    armed.value = true
    t = setTimeout(() => { armed.value = false }, 3000)
    return
  }
  if (t) { clearTimeout(t); t = null }
  armed.value = false
  if (!props.busy) emit('confirm')
}
onUnmounted(() => { if (t) clearTimeout(t) })
</script>

<template>
  <button class="arm-del" :class="{ armed }" :disabled="busy" @click.stop="click">
    {{ armed ? '确认删除？（进回收站）' : label }}
  </button>
</template>

<style scoped>
.arm-del {
  padding: 9px 14px; border-radius: 9px; border: 1px solid var(--border); background: transparent;
  color: var(--text-3); cursor: pointer; font-size: var(--fs-sub); font-family: inherit;
  transition: all var(--dur); white-space: nowrap; flex-shrink: 0;
}
.arm-del:hover { color: var(--danger); border-color: var(--danger); }
.arm-del.armed { color: #fff; background: var(--danger); border-color: var(--danger); }
.arm-del:disabled { opacity: var(--opacity-disabled); cursor: not-allowed; }
</style>
