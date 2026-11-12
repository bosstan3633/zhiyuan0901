<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import Icon from '@/shared/components/Icon.vue'
import { useFocusTrap } from '@/shared/utils/focusTrap'
import type { MergeChoices, MergeConflict, MergeSide } from '@/shared/cloud/threeWayMerge'
import { syncFieldLabel, syncTypeLabel } from '@/shared/cloud/syncDisplay'
import type { CloudDecisionInfo } from '../../composables/useCloudSync'
import type { CloudUploadDecision } from '@/shared/cloud/sync'

const props = defineProps<{
  open: boolean
  info: CloudDecisionInfo | null
}>()
const emit = defineEmits<{
  resolve: [choice: CloudUploadDecision]
}>()

const panel = ref<HTMLElement | null>(null)
const choices = ref<MergeChoices>({})
useFocusTrap(panel, () => props.open, { initial: 'first' })

const conflicts = computed(() => props.info?.conflicts || [])
const mergeMode = computed(() => props.info?.mode === 'merge' && conflicts.value.length > 0)
const allChosen = computed(() => conflicts.value.every(row => !!choices.value[row.id]))
const title = computed(() => mergeMode.value ? '选择冲突字段的保留版本' : '云端修订已变化')
const intro = computed(() => {
  if (mergeMode.value) {
    return '不同记录、不同字段会自动合并。下面只列出同一条记录、同一字段被两端改成了不同值的情况；逐项确认后才能写入云端。'
  }
  return '你选择了整端覆盖，但云端在检查后又出现了新修订。请明确继续用本机覆盖，或改为拉回云端。'
})

watch(
  () => [props.open, props.info] as const,
  () => {
    choices.value = {}
  },
  { immediate: true },
)

function formatValue(value: unknown, missing?: boolean): string {
  if (missing) return '已删除'
  if (value === undefined || value === null) return '无'
  if (typeof value === 'string') return value || '空'
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  try {
    const text = JSON.stringify(value, null, 2)
    return text.length > 360 ? `${text.slice(0, 360)}…` : text
  } catch {
    return String(value)
  }
}

function kindLabel(row: MergeConflict): string {
  if (row.kind === 'delete-modify') return '删除 / 修改冲突'
  if (row.kind === 'unknown') return '记录冲突'
  return '字段冲突'
}

function choose(row: MergeConflict, side: MergeSide): void {
  choices.value = { ...choices.value, [row.id]: side }
}

function chooseAll(side: MergeSide): void {
  choices.value = Object.fromEntries(conflicts.value.map(row => [row.id, side])) as MergeChoices
}

function resolve(choice: CloudUploadDecision): void {
  emit('resolve', choice)
}

function confirmMerge(): void {
  if (!allChosen.value) return
  resolve({ action: 'merge', choices: { ...choices.value } })
}

function onKeydown(event: KeyboardEvent): void {
  if (!props.open || event.key !== 'Escape') return
  event.preventDefault()
  event.stopPropagation()
  resolve({ action: 'cancel' })
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="cmc-mask"
      data-a11y-container
      @keydown="onKeydown"
      @click.self="resolve({ action: 'cancel' })"
    >
      <section
        ref="panel"
        class="cmc-panel"
        :class="{ merge: mergeMode }"
        tabindex="-1"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cmc-title"
        aria-describedby="cmc-intro"
      >
        <header class="cmc-head">
          <span class="cmc-mark"><Icon name="refresh" :size="17" /></span>
          <div>
            <h2 id="cmc-title">{{ title }}</h2>
            <p>本机基线修订 {{ info?.localRevision || 0 }} · 云端当前修订 {{ info?.remoteRevision || 0 }}</p>
          </div>
          <button class="cmc-x" type="button" aria-label="取消同步" @click="resolve({ action: 'cancel' })"><Icon name="x" :size="16" /></button>
        </header>

        <p id="cmc-intro" class="cmc-intro">{{ intro }}</p>

        <template v-if="mergeMode">
          <div class="cmc-tools">
            <span>{{ conflicts.length }} 个冲突 · 已选择 {{ Object.keys(choices).length }} 个</span>
            <button type="button" @click="chooseAll('local')">全部保留本机</button>
            <button type="button" @click="chooseAll('remote')">全部保留云端</button>
          </div>
          <div class="cmc-list">
            <article v-for="row in conflicts" :key="row.id" class="cmc-row">
              <div class="cmc-row-head">
                <span class="cmc-type">{{ syncTypeLabel(row.type) }}</span>
                <div>
                  <b>{{ row.title || row.recordId }}</b>
                  <small>{{ kindLabel(row) }} · {{ syncFieldLabel(row.field) }}</small>
                </div>
                <div class="cmc-seg" role="group" :aria-label="`${row.title} 冲突处理`">
                  <button type="button" :class="{ on: choices[row.id] === 'local' }" @click="choose(row, 'local')">保留本机</button>
                  <button type="button" :class="{ on: choices[row.id] === 'remote' }" @click="choose(row, 'remote')">保留云端</button>
                </div>
              </div>
              <div class="cmc-values">
                <div>
                  <span>共同基线</span>
                  <pre>{{ formatValue(row.baseValue, row.baseMissing) }}</pre>
                </div>
                <div class="local">
                  <span>本机版本</span>
                  <pre>{{ formatValue(row.localValue, row.localMissing) }}</pre>
                </div>
                <div class="remote">
                  <span>云端版本</span>
                  <pre>{{ formatValue(row.remoteValue, row.remoteMissing) }}</pre>
                </div>
              </div>
              <p v-if="!choices[row.id]" class="cmc-required">请选择这一项保留哪个版本</p>
            </article>
          </div>
        </template>

        <footer class="cmc-actions">
          <button class="cmc-cancel" type="button" @click="resolve({ action: 'cancel' })">取消同步</button>
          <template v-if="mergeMode">
            <button type="button" @click="resolve({ action: 'download' })">全部拉回云端</button>
            <button class="primary" type="button" :disabled="!allChosen" @click="confirmMerge">
              合并并同步
            </button>
          </template>
          <template v-else>
            <button type="button" @click="resolve({ action: 'download' })">改为拉回云端</button>
            <button class="primary" type="button" @click="resolve({ action: 'upload' })">继续用本机覆盖</button>
          </template>
        </footer>
      </section>
    </div>
  </Teleport>
</template>

<style scoped>
.cmc-mask {
  position: fixed;
  inset: 0;
  z-index: var(--z-confirm);
  display: grid;
  place-items: center;
  padding: 22px;
  background: rgb(0 0 0 / .46);
  backdrop-filter: blur(4px);
}
.cmc-panel {
  width: min(720px, calc(100vw - 28px));
  max-height: min(86vh, 880px);
  display: flex;
  flex-direction: column;
  gap: 13px;
  overflow: hidden;
  padding: 18px;
  border: 1px solid var(--border-strong);
  border-radius: 16px;
  background: var(--surface);
  box-shadow: var(--shadow-lg);
}
.cmc-panel.merge { width: min(920px, calc(100vw - 28px)); }
.cmc-head { display: flex; align-items: flex-start; gap: 10px; }
.cmc-mark {
  width: 36px;
  height: 36px;
  flex: none;
  display: grid;
  place-items: center;
  border-radius: 10px;
  background: var(--accent-light);
  color: var(--accent-ink);
}
.cmc-head > div { flex: 1; min-width: 0; }
.cmc-head h2 { margin: 0; color: var(--text); font-size: var(--fs-title); }
.cmc-head p { margin: 4px 0 0; color: var(--text-3); font-size: var(--fs-caption); }
.cmc-x {
  width: 30px;
  height: 30px;
  display: grid;
  place-items: center;
  padding: 0;
  border: 0;
  border-radius: 7px;
  background: transparent;
  color: var(--text-3);
  cursor: pointer;
}
.cmc-x:hover { background: var(--surface-2); color: var(--text); }
.cmc-intro {
  margin: 0;
  padding: 9px 11px;
  border-radius: 9px;
  background: var(--surface-2);
  color: var(--text-2);
  font-size: var(--fs-caption);
  line-height: 1.55;
}
.cmc-tools {
  display: flex;
  align-items: center;
  gap: 7px;
  color: var(--text-3);
  font-size: var(--fs-micro);
}
.cmc-tools span { margin-right: auto; }
.cmc-tools button {
  min-height: 27px;
  padding: 3px 8px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--surface);
  color: var(--text-2);
  font: inherit;
  cursor: pointer;
}
.cmc-list {
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 9px;
  overflow: auto;
  padding-right: 3px;
}
.cmc-row {
  padding: 10px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: color-mix(in srgb, var(--surface-2) 44%, var(--surface));
}
.cmc-row-head { display: flex; align-items: center; gap: 9px; }
.cmc-type {
  flex: none;
  padding: 3px 7px;
  border-radius: 999px;
  background: var(--surface);
  color: var(--text-3);
  font-size: var(--fs-micro);
}
.cmc-row-head > div:nth-child(2) { min-width: 0; flex: 1; }
.cmc-row-head b { display: block; overflow: hidden; color: var(--text); font-size: var(--fs-sub); text-overflow: ellipsis; white-space: nowrap; }
.cmc-row-head small { display: block; margin-top: 2px; color: var(--text-3); font-size: var(--fs-micro); }
.cmc-seg { display: inline-flex; flex: none; padding: 2px; border-radius: 7px; background: var(--surface-3); }
.cmc-seg button {
  min-height: 26px;
  padding: 3px 8px;
  border: 0;
  border-radius: 5px;
  background: transparent;
  color: var(--text-3);
  font: inherit;
  font-size: var(--fs-micro);
  cursor: pointer;
}
.cmc-seg button.on { background: var(--surface); color: var(--accent-ink); box-shadow: var(--shadow-sm); font-weight: 700; }
.cmc-values { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 6px; margin-top: 8px; }
.cmc-values > div { min-width: 0; padding: 7px 8px; border-radius: 7px; background: var(--surface); }
.cmc-values .local { box-shadow: inset 2px 0 0 var(--accent); }
.cmc-values .remote { box-shadow: inset 2px 0 0 var(--success); }
.cmc-values span { color: var(--text-3); font-size: var(--fs-micro); }
.cmc-values pre {
  max-height: 86px;
  margin: 4px 0 0;
  overflow: auto;
  color: var(--text-2);
  font-family: var(--font-mono);
  font-size: 10px;
  line-height: 1.45;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
.cmc-required { margin: 7px 0 0; color: var(--warning); font-size: var(--fs-micro); }
.cmc-actions { display: flex; justify-content: flex-end; gap: 8px; }
.cmc-actions button {
  min-height: 32px;
  padding: 5px 11px;
  border: 1px solid var(--border);
  border-radius: 7px;
  background: var(--surface);
  color: var(--text-2);
  font: inherit;
  font-size: var(--fs-caption);
  cursor: pointer;
}
.cmc-actions button.primary { border-color: var(--accent); background: var(--accent); color: #fff; font-weight: 700; }
.cmc-actions button.primary:hover { background: var(--accent-hover); }
.cmc-actions button:disabled { opacity: var(--opacity-disabled); cursor: not-allowed; }
.cmc-actions .cmc-cancel { margin-right: auto; }
@media (max-width: 720px) {
  .cmc-mask { padding: 10px; }
  .cmc-panel, .cmc-panel.merge { width: calc(100vw - 20px); max-height: 92vh; padding: 14px; }
  .cmc-row-head { flex-wrap: wrap; }
  .cmc-seg { width: 100%; }
  .cmc-seg button { flex: 1; }
  .cmc-values { grid-template-columns: 1fr; }
  .cmc-actions { flex-wrap: wrap; }
  .cmc-actions .cmc-cancel { width: 100%; margin-right: 0; }
}
</style>
