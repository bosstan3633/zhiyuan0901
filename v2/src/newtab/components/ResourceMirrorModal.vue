<script setup lang="ts">
/**
 * ★W17-C06（2026-10-20 用户拍板）镜像到策展台：中央弹窗 + 多选复选框。
 *
 * 用户原话：「点击后应该弹出弹窗，选择镜像到哪个策展台。并且一张卡，可以镜像到多个策展台。」
 * 补充拍板：勾选=镜像过去，取消勾选=取消到该台的镜像；允许多选。
 *
 * 三个必须由本组件承担的判定（否则又回到"靠 toast 猜"）：
 *   ① 打开时按 curationProjections 回显勾选态；
 *   ② 勾选/取消只在弹窗内暂存，底部「保存」统一次提交（新增 → projectCardToBoardEx，
 *      取消 → removeProjection），幂等：来回勾选不产生重复记录；
 *   ③ 汇总按 created 判别只说真话：新增 N / 移出 M，无改动说「没有改动」。
 *
 * 池自身（CURATION_WS_ID）与归档台永不出现在候选（沿用既有过滤）。
 */
import { computed, ref, watch } from 'vue'
import Icon from '@/shared/components/Icon.vue'
import { showToast } from '@/shared/components/toast'
import { useAppStore } from '@/newtab/stores/app'
import { CURATION_WS_ID } from '@/shared/models'
import { projectCardToBoardEx, removeProjection } from '@/shared/storage/hub'

const props = defineProps<{
  open: boolean
  cardId: string | null
  cardTitle?: string
}>()
const emit = defineEmits<{ (e: 'close'): void; (e: 'saved'): void }>()

const store = useAppStore()

const boards = computed(() =>
  (store.data?.workspaces || []).filter(w => w.kind !== 'resource' && w.id !== CURATION_WS_ID && !w.archived)
)

/** 该卡在当前库里的投射：targetWsId → 投射 id */
const existing = computed(() => {
  const m = new Map<string, string>()
  if (!props.cardId) return m
  for (const p of store.data?.curationProjections || []) {
    if (p.kind === 'card' && p.cardId === props.cardId && p.targetWsId) m.set(p.targetWsId, p.id)  }
  return m
})

/** 暂存勾选（保存前不动库） */
const checked = ref<Set<string>>(new Set())

watch(() => [props.open, props.cardId], () => {
  if (!props.open) return
  checked.value = new Set(existing.value.keys())
}, { immediate: true })

function toggle(wsId: string) {
  const next = new Set(checked.value)
  if (next.has(wsId)) next.delete(wsId)
  else next.add(wsId)
  checked.value = next
}

const added = computed(() => [...checked.value].filter(id => !existing.value.has(id)).length)
const removed = computed(() => [...existing.value.keys()].filter(id => !checked.value.has(id)).length)
const changed = computed(() => added.value + removed.value > 0)

function save() {
  const d = store.data
  if (!d || !props.cardId) { emit('close'); return }
  let add = 0, del = 0
  for (const id of checked.value) {
    if (existing.value.has(id)) continue
    const r = projectCardToBoardEx(d, props.cardId, id)
    if (r.created) add++
  }
  for (const [wsId, projId] of existing.value) {
    if (checked.value.has(wsId)) continue
    if (removeProjection(d, projId)) del++
  }
  if (add || del) {
    store.persist()
    const parts: string[] = []
    if (add) parts.push(`已镜像 ${add} 个台`)
    if (del) parts.push(`移出 ${del} 个台`)
    showToast(parts.join(' · '))
    emit('saved')
  } else {
    showToast('没有改动')
  }
  emit('close')
}
</script>

<template>
  <Teleport to="body">
    <div v-if="props.open" class="mirror-mask" @click.self="emit('close')">
      <div class="mirror-modal" role="dialog" aria-modal="true" aria-label="镜像到策展台">
        <header class="mirror-h">
          <div>
            <b>镜像到策展台</b>
            <p v-if="props.cardTitle" class="mirror-sub" :title="props.cardTitle">{{ props.cardTitle }}</p>
          </div>
          <button class="mirror-x" title="关闭" @click="emit('close')">×</button>
        </header>

        <div v-if="boards.length" class="mirror-list">
          <label v-for="w in boards" :key="w.id" class="mirror-row">
            <input type="checkbox" :checked="checked.has(w.id)" @change="toggle(w.id)">
            <span class="mirror-name">{{ w.name }}</span>
            <span v-if="existing.has(w.id)" class="mirror-tag">已镜像</span>
          </label>
        </div>
        <div v-else class="mirror-empty">还没有可镜像的策展台。先在方向台建一个策展台，再回来镜像。</div>

        <footer class="mirror-f">
          <span class="mirror-hint">勾选 = 镜像过去 · 取消勾选 = 取消该台镜像{{ changed ? ` · 本次 +${added} / −${removed}` : '' }}</span>
          <button class="mirror-btn" @click="emit('close')">取消</button>
          <button class="mirror-btn primary" :disabled="!boards.length" @click="save"><Icon name="check" :size="13"/> 保存</button>
        </footer>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.mirror-mask { position: fixed; inset: 0; z-index: 70; background: rgba(0, 0, 0, .45); display: flex; align-items: center; justify-content: center; }
.mirror-modal { width: min(420px, 92vw); max-height: 80vh; display: flex; flex-direction: column; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-md); box-shadow: var(--shadow-lg); }
.mirror-h { display: flex; align-items: flex-start; gap: 10px; padding: 16px 18px 10px; border-bottom: 1px solid var(--border); }
.mirror-h b { font-size: var(--fs-body); color: var(--text); }
.mirror-sub { margin: 4px 0 0; font-size: var(--fs-caption); color: var(--text-4); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 320px; }
.mirror-x { margin-left: auto; border: 0; background: transparent; color: var(--text-3); font-size: var(--fs-body); cursor: pointer; }
.mirror-list { padding: 8px 10px; overflow-y: auto; display: flex; flex-direction: column; gap: 2px; }
.mirror-row { display: flex; align-items: center; gap: 9px; padding: 8px 10px; border-radius: var(--radius-sm); font-size: var(--fs-sub); color: var(--text); cursor: pointer; }
.mirror-row:hover { background: var(--surface-2); }
.mirror-name { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.mirror-tag { flex: none; font-size: var(--fs-micro); color: var(--accent-ink); background: var(--accent-light); padding: 1px 7px; border-radius: 999px; }
.mirror-empty { padding: 18px; font-size: var(--fs-caption); color: var(--text-4); line-height: 1.7; }
.mirror-f { display: flex; align-items: center; gap: 8px; padding: 10px 18px 14px; border-top: 1px solid var(--border); }
.mirror-hint { flex: 1; min-width: 0; font-size: var(--fs-micro); color: var(--text-4); }
.mirror-btn { border: 1px solid var(--border); background: var(--surface); color: var(--text-2); border-radius: var(--radius-sm); padding: 5px 12px; font-size: var(--fs-sub); font-weight: 600; font-family: inherit; cursor: pointer; }
.mirror-btn:hover:not(:disabled) { border-color: var(--border-strong); color: var(--text); }
.mirror-btn.primary { border-color: var(--accent); color: var(--accent-ink); background: var(--accent-light); }
.mirror-btn:disabled { opacity: var(--opacity-disabled); cursor: not-allowed; }
</style>
