<template>
  <!-- B3：快捷键速查面板（? 呼出）
       ★V3.9.6：从 `GlobalPopups.vue`（2,142 行）拆出的第一块 —— 按「弹窗家族」切，
         一轮一块不打包。清单真源仍是 `shared/utils/shortcuts.ts`（与设置页、手册同源），
         这里只做**派生**：把 {MOD} 占位按当前修饰键换成真实键位。 -->
  <div class="gp-overlay" :class="{open: active}" @click.self="$emit('close')">
    <div class="gp-panel gp-panel-shortcuts">
      <div class="gp-cap-head">
        <div class="gp-cap-icon res"><Icon name="settings" :size="18" /></div>
        <div class="gp-cap-titles">
          <div class="gp-cap-title">快捷键速查</div>
          <div class="gp-cap-sub">键盘优先 · 按 Esc 关闭</div>
        </div>
        <button class="gp-cap-close" @click="$emit('close')">×</button>
      </div>
      <div class="gp-sc-body">
        <div v-for="grp in groups" :key="grp.title" class="gp-sc-group">
          <div class="gp-sc-title">{{ grp.title }}</div>
          <div v-for="it in grp.items" :key="it.keys" class="gp-sc-row">
            <span class="gp-sc-keys"><kbd v-for="k in it.keys.split('+')" :key="k">{{ k }}</kbd></span>
            <span class="gp-sc-desc">{{ it.desc }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import Icon from '@/shared/components/Icon.vue'
// B7-e H3：清单真源在 shared/utils/shortcuts.ts（与设置页、手册共用一份）。
import { SHORTCUT_GROUPS, resolveKeys } from '@/shared/utils/shortcuts'

/** 宿主（GlobalPopups）当前的弹窗态 —— 决定浮层是否展开 */
defineProps<{ active: boolean }>()
defineEmits<{ (e: 'close'): void }>()

/**
 * V3.9.1：应用内切台固定 Alt，速查面板不再跟随旧偏好字段。
 * ★派生逻辑随组件一起搬走（原先在宿主的 script 里）：换 {MOD} 占位 → 真实键位。
 */
const SC_MOD = computed(() => 'alt')
const groups = computed(() =>
  SHORTCUT_GROUPS.map(g => ({
    title: g.title,
    items: g.items.map(it => ({ keys: resolveKeys(it.keys, SC_MOD.value), desc: it.action })),
  }))
)
</script>

<style scoped>
/* ★样式随组件一起搬走：类名一字未改 ⇒ 判据与实拍截图里的选择器不用重指。
   （宿主 `.gp-overlay` / `.gp-panel` / `.gp-cap-*` 是**通用**弹窗外壳，仍留在宿主；
     本组件只带走 `.gp-panel-shortcuts` 与 `.gp-sc-*` 这两族本面板专属的。） */
.gp-panel-shortcuts { width: 560px; }
.gp-sc-body { padding: 14px 24px 20px; max-height: 60vh; overflow-y: auto; }
.gp-sc-group { margin-bottom: 16px; }
.gp-sc-group:last-child { margin-bottom: 0; }
.gp-sc-title { font-size: var(--fs-caption); font-weight: 700; color: var(--text-3); letter-spacing: .08em; text-transform: uppercase; margin-bottom: 6px; }
.gp-sc-row { display: flex; align-items: center; gap: 12px; padding: 5px 0; font-size: var(--fs-body); color: var(--text-2); }
.gp-sc-keys { min-width: 150px; display: flex; gap: 4px; flex-shrink: 0; }
.gp-sc-keys kbd { background: var(--surface-3); border: 1px solid var(--border); border-radius: 5px; padding: 1px 7px; font-size: var(--fs-caption); color: var(--text); font-family: inherit; box-shadow: 0 1px 0 var(--border); }
</style>
