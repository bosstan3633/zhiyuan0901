<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(defineProps<{
  count: number
  cached?: boolean
}>(), {
  cached: false,
})

const label = computed(() => props.count > 99 ? '99+' : String(props.count))
</script>

<template>
  <span v-if="count > 0" class="inbox-count-badge" :class="{ cached }" :aria-label="`${count} 条未转化采集`">
    {{ label }}
  </span>
</template>

<style scoped>
.inbox-count-badge {
  min-width: 18px;
  height: 18px;
  display: inline-grid;
  place-items: center;
  box-sizing: border-box;
  padding: 0 5px;
  border: 1px solid color-mix(in srgb, var(--accent) 20%, transparent);
  border-radius: 999px;
  background: var(--accent-light);
  color: var(--accent-ink);
  font-size: var(--fs-micro);
  font-variant-numeric: tabular-nums;
  font-weight: 700;
  line-height: 18px;
  letter-spacing: .01em;
}
.inbox-count-badge.cached {
  border-color: var(--border);
  background: color-mix(in srgb, var(--surface-2) 84%, var(--accent-light));
  color: var(--text-2);
}
</style>
