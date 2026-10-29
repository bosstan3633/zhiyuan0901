<script setup lang="ts">
import Icon from '@/shared/components/Icon.vue'

withDefaults(defineProps<{
  level: 3 | 4 | 5
  kind: 'direction' | 'project' | 'metric'
  icon: string
  label: string
}>(), {
  level: 3,
  kind: 'direction',
  icon: 'compass',
  label: '',
})
</script>

<template>
  <span class="level-tag" :class="kind" aria-hidden="true">
    <span class="lt-n">{{ level }}</span>
    <Icon :name="icon" :size="11" />
    <span>{{ label }}</span>
  </span>
</template>

<style scoped>
.level-tag {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  flex: none;
  min-height: 22px;
  padding: 1px 8px 1px 3px;
  border: 1px solid var(--border);
  border-radius: var(--radius-full);
  color: var(--text-3);
  background: var(--surface-2);
  font-size: var(--fs-micro);
  font-weight: 700;
  line-height: 1;
  letter-spacing: .04em;
  white-space: nowrap;
  user-select: none;
}

.lt-n {
  display: inline-grid;
  place-items: center;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: var(--surface-3);
  color: var(--text-3);
  font-size: 9px;
  font-variant-numeric: tabular-nums;
}

.level-tag.direction {
  border-color: color-mix(in srgb, var(--accent) 34%, var(--border));
  background: var(--accent-light);
  color: var(--accent-ink);
}

.level-tag.direction .lt-n {
  background: var(--accent);
  color: #fff;
}

.level-tag.project {
  border-color: color-mix(in srgb, var(--accent) 18%, var(--border));
  background: color-mix(in srgb, var(--surface-2) 72%, var(--accent-light));
  color: var(--text-2);
}

.level-tag.metric {
  min-height: 20px;
  padding-right: 7px;
  border-color: transparent;
  background: transparent;
  color: var(--text-3);
  font-weight: 600;
}

.level-tag.metric .lt-n {
  width: 14px;
  height: 14px;
  background: transparent;
  box-shadow: inset 0 0 0 1px var(--border);
}
</style>
