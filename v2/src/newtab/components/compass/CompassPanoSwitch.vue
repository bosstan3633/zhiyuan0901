<script setup lang="ts">
/**
 * 项目全景的紧凑切换器（V3.9.12）。
 *
 * 保留原有“全量项目可达、点任一项目切换主体”的能力；把过去一排常驻项目卡
 * 收成一个“当前位置 + 下拉清单”，让项目摘要和泳道重新成为首屏主角。
 */
import Icon from '@/shared/components/Icon.vue'
import { ref } from 'vue'
import type { Direction, Project } from '@/shared/models'
import type { ProjectMeta } from '../../views/compassMeta'

defineProps<{
  rows: { proj: Project; pm: ProjectMeta; dir: Direction; hue: string }[]
  activeId: string
}>()

const emit = defineEmits<{
  (e: 'pick', projId: string): void
  (e: 'back'): void
}>()

const open = ref(false)
const root = ref<HTMLElement | null>(null)

/** 只在焦点真正离开切换器时收起；点选清单项时 relatedTarget 仍在根节点内。 */
function onFocusout(e: FocusEvent) {
  const next = e.relatedTarget as Node | null
  if (!next || !root.value?.contains(next)) open.value = false
}
</script>

<template>
  <section v-if="rows.length" ref="root" class="pano-switch" aria-label="选择要横向展开的项目" @focusout="onFocusout">
    <button
      class="ps-current"
      :aria-expanded="open"
      aria-haspopup="listbox"
      :aria-label="`切换项目，当前 ${rows.find(r => r.proj.id === activeId)?.proj.name || rows[0].proj.name}`"
      @click="open = !open"
    >
      <Icon name="arrowupdown" :size="13"/>
      <span>切换项目</span>
      <span class="ps-caret" aria-hidden="true">{{ open ? '▴' : '▾' }}</span>
    </button>
    <button class="ps-back" title="回到项目塔，看所有项目的对比" @click="emit('back')">
      项目塔
    </button>
    <div v-if="open" class="ps-menu" role="listbox" aria-label="项目列表">
      <button
        v-for="r in rows" :key="r.proj.id"
        class="ps-opt" :class="{ on: r.proj.id === activeId }"
        role="option" :aria-selected="r.proj.id === activeId"
        :style="{ '--pc': r.hue }"
        @click="emit('pick', r.proj.id); open = false"
      >
        <span class="ps-opt-dot" aria-hidden="true"></span>
        <span class="ps-opt-main">
          <b>{{ r.proj.name }}</b>
          <small>{{ r.dir.name }} · {{ r.pm.metrics.length }} 指标 · {{ r.pm.total }} 任务</small>
        </span>
        <Icon v-if="r.proj.isFocused" name="main-focus" :size="13"/>
      </button>
    </div>
  </section>
  <section v-else class="pano-switch empty">
    <span class="ps-empty">还没有攻坚项目 —— 先在项目塔里添加一个</span>
  </section>
</template>

<style scoped>
/* V3.9.12：项目名由下方摘要唯一承担；这里只留一个“换主体”的小控件，避免同一标题出现两次。 */
.pano-switch {
  position: relative; display: inline-flex; align-items: center; gap: 4px;
  flex: none;
}
.pano-switch.empty { color: var(--text-3); font-size: var(--fs-micro); }
.ps-current {
  display: flex; align-items: center; gap: 5px;
  min-height: 28px; padding: 4px 8px;
  border: 1px solid var(--border); border-radius: var(--radius-sm);
  background: var(--surface); color: var(--text-2); font-family: inherit;
  font-size: var(--fs-micro); font-weight: 600; text-align: left;
  cursor: pointer; transition: background var(--dur), border-color var(--dur);
}
.ps-current:hover, .ps-current[aria-expanded="true"] {
  background: var(--accent-light); border-color: var(--accent); color: var(--accent-ink);
}
.ps-caret { flex: none; color: var(--text-3); font-size: var(--fs-caption); }
.ps-back {
  flex: none; min-height: 28px; padding: 4px 9px;
  border: 1px solid var(--border); border-radius: var(--radius-sm);
  background: var(--surface); color: var(--text-2); font-family: inherit;
  font-size: var(--fs-micro); font-weight: 600; cursor: pointer;
}
.ps-back:hover { color: var(--accent-ink); border-color: var(--accent); }
.ps-menu {
  position: absolute; right: 0; top: calc(100% + 5px); z-index: 30;
  width: min(420px, calc(100vw - 32px)); max-height: 320px; overflow-y: auto;
  padding: 5px; background: var(--surface); border: 1px solid var(--border-strong);
  border-radius: var(--radius-md); box-shadow: var(--shadow-lg);
}
.ps-opt {
  position: relative; display: flex; align-items: center; gap: 9px; width: 100%;
  padding: 8px 9px 8px 13px; border: 0; border-radius: var(--radius-sm);
  background: transparent; color: var(--text); font-family: inherit; text-align: left; cursor: pointer;
}
.ps-opt::before {
  content: ''; position: absolute; left: 3px; top: 8px; bottom: 8px;
  width: 3px; border-radius: 2px; background: var(--pc); opacity: .55;
}
.ps-opt:hover, .ps-opt.on { background: var(--surface-2); }
.ps-opt.on::before { opacity: 1; width: 4px; }
.ps-opt-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--pc); flex: none; }
.ps-opt-main { display: flex; flex-direction: column; min-width: 0; flex: 1; }
.ps-opt-main b { font-size: var(--fs-sub); font-weight: 700; }
.ps-opt-main small {
  margin-top: 2px; font-size: var(--fs-micro); color: var(--text-3);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.ps-empty { font-size: var(--fs-micro); color: var(--text-3); }

@media (max-width: 800px) {
  .ps-menu { right: 0; }
}
@media (max-width: 480px) {
  .pano-switch { gap: 2px; }
  .ps-current { padding-left: 7px; padding-right: 7px; }
}
</style>
