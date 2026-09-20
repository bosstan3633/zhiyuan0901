<script lang="ts">
/** 契约类型已迁至 shared/ai/job.ts（R135：供 .ts 侧共用）；本块 re-export 保兼容 */
export type { AiRow, AiJob } from '@/shared/ai/job'
</script>

<script setup lang="ts">
/**
 * R134-F1：AI 建议评审抽屉（所有场景共用的消费面）。
 * 性能与数据纪律：建议数据只活在本组件内存态（shallowRef），**不进 store、不落盘**——
 * 用户勾选采纳时由 job.apply 走既有 action + persist；中止/关抽屉即弃。
 * 渲染零原文 HTML 指令：模型回显一律纯文本插值，天然免疫提示词注入的 XSS 面。
 */
import { computed, onUnmounted, ref, shallowRef, watch } from 'vue'
import Drawer from '@/shared/components/Drawer.vue'
import { showToast } from '@/shared/components/toast'
import { chatStream, extractJson } from '@/shared/ai/llm'
import type { AiJob, AiRow } from '@/shared/ai/job'

const props = defineProps<{ job: AiJob | null }>()
const emit = defineEmits<{ close: [] }>()

type Phase = 'running' | 'done' | 'error' | 'idle'
const phase = ref<Phase>('idle')
const errMsg = ref('')
const streamText = ref('')
const rows = shallowRef<AiRow[]>([])
const picked = ref<Set<string>>(new Set())
const showRaw = ref(false)
let ctrl: AbortController | null = null
let jobSeq = 0

const open = computed(() => !!props.job)
const inputChars = ref(0)
const canApply = computed(() => (props.job?.adoptable ?? true) && picked.value.size > 0)

async function run(job: AiJob) {
  const seq = ++jobSeq
  phase.value = 'running'; errMsg.value = ''; streamText.value = ''; rows.value = []; picked.value = new Set(); showRaw.value = false
  ctrl?.abort()
  ctrl = new AbortController()
  const onDelta = (t: string) => { if (seq === jobSeq) streamText.value = t }
  try {
    let out: AiRow[]
    if (job.run) {
      out = await job.run({ signal: ctrl.signal, onDelta })
      inputChars.value = 0
    } else {
      const { messages, jsonMode } = await job.build()
      inputChars.value = messages.reduce((n, m) => n + m.content.length, 0)
      const text = await chatStream({ messages, jsonMode: job.rawText ? false : jsonMode !== false, signal: ctrl.signal, onDelta })
      if (!text.trim()) throw new Error('模型返回为空（可能超时或余额不足）')
      out = job.parse(job.rawText ? text : extractJson(text))
    }
    if (seq !== jobSeq) return
    rows.value = out
    picked.value = new Set(out.map(r => r.key))
    phase.value = 'done'
  } catch (e) {
    if (seq !== jobSeq) return
    const msg = (e as Error).message || String(e)
    if ((e as Error).name === 'AbortError') { emit('close'); return }
    errMsg.value = msg
    phase.value = 'error'
  }
}

watch(() => props.job, (j) => { if (j) run(j); }, { immediate: true })

function toggle(key: string) {
  const next = new Set(picked.value)
  if (next.has(key)) next.delete(key); else next.add(key)
  picked.value = next
}
function toggleAll() {
  picked.value = picked.value.size === rows.value.length ? new Set() : new Set(rows.value.map(r => r.key))
}
async function adopt() {
  const job = props.job
  if (!job) return
  const sel = rows.value.filter(r => picked.value.has(r.key))
  if (!sel.length) return
  try {
    const summary = await job.apply(sel)
    showToast(typeof summary === 'string' ? summary : '✓ 已采纳')
    emit('close')
  } catch (e) { showToast('⚠ 采纳失败：' + (e as Error).message) }
}
function stop() { ctrl?.abort(); ctrl = null }
function close() { ctrl?.abort(); emit('close') }
async function adoptSecondary() {
  const job = props.job
  if (!job?.secondary) return
  const sel = rows.value.filter(r => picked.value.has(r.key))
  if (!sel.length) return
  try {
    const summary = await job.secondary.apply(sel)
    showToast(typeof summary === 'string' ? summary : '✓ 已处理')
    emit('close')
  } catch (e) { showToast('⚠ 处理失败：' + (e as Error).message) }
}
onUnmounted(() => { jobSeq++; ctrl?.abort() })
</script>

<template>
  <Drawer :open="open" :title="'🤖 ' + (job?.title || 'AI 建议')" width="560px" @close="close">
    <div class="ai-body">
      <div v-if="job?.hint" class="ai-hint">{{ job.hint }}</div>

      <div v-if="phase === 'running'" class="ai-status">
        <div class="ai-run-row">
          <span class="ai-dot-pulse"></span> 专家思考/生成中…
          <button class="ai-btn sm" @click="stop">⏹ 中止</button>
        </div>
        <pre v-if="streamText" class="ai-stream">{{ streamText.slice(-600) }}</pre>
      </div>

      <div v-else-if="phase === 'error'" class="ai-status ai-err">
        ⚠ {{ errMsg }}
        <button class="ai-btn sm" @click="job && run(job)">↻ 重试</button>
      </div>

      <template v-else-if="phase === 'done'">
        <div v-if="!rows.length" class="ai-empty">模型没有给出可采纳的建议</div>
        <template v-else>
          <div class="ai-toolbar">
            <label class="ai-all"><input type="checkbox" :checked="picked.size === rows.length && rows.length > 0" @change="toggleAll" /> 全选</label>
            <select v-if="job?.persona" class="ai-persona" :value="job.persona.current"
              title="换一个专家视角重新生成" @change="job.persona!.onPick(($event.target as HTMLSelectElement).value)">
              <option v-for="o in job.persona.options" :key="o.id" :value="o.id">{{ o.label }}</option>
            </select>
            <span class="ai-count">已选 {{ picked.size }}/{{ rows.length }}</span>
            <span class="ai-usage">投料 {{ inputChars }} 字（~{{ Math.ceil(inputChars / 1.6) }} tok）· 产出 {{ streamText.length }} 字</span>
            <button class="ai-btn sm ghost" @click="showRaw = !showRaw">{{ showRaw ? '收起' : '原文' }}</button>
          </div>
          <pre v-if="showRaw" class="ai-stream">{{ streamText }}</pre>
          <div class="ai-rows">
            <label v-for="r in rows" :key="r.key" class="ai-row" :class="{ on: picked.has(r.key) }">
              <input type="checkbox" :checked="picked.has(r.key)" @change="toggle(r.key)" />
              <span class="ai-row-txt">
                <span class="ai-row-main">
                  <span v-if="r.badge" class="ai-badge" :class="'b-' + (r.badgeType || 'neutral')">{{ r.badge }}</span>
                  {{ r.main }}
                </span>
                <span v-if="r.sub" class="ai-row-sub">{{ r.sub }}</span>
              </span>
            </label>
          </div>
        </template>
      </template>
    </div>

    <template #footer>
      <button class="ai-btn" @click="close">关闭</button>
      <button v-if="job?.secondary && rows.length" class="ai-btn" :disabled="picked.size === 0"
        @click="adoptSecondary">{{ job.secondary.label }}（{{ picked.size }}）</button>
      <button v-if="job?.adoptable !== false && rows.length" class="ai-btn primary" :disabled="!canApply" @click="adopt">✓ 采纳勾选项（{{ picked.size }}）</button>
    </template>
  </Drawer>
</template>

<style scoped>
.ai-body { display: flex; flex-direction: column; gap: 10px; font-size: 12.5px; color: var(--text-2); }
.ai-hint { font-size: 11.5px; color: var(--text-3); line-height: 1.6; }
.ai-status { padding: 14px; border: 1px solid var(--border); border-radius: var(--radius-sm); background: var(--surface-2); line-height: 1.7; }
.ai-err { color: var(--danger); display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
.ai-run-row { display: flex; align-items: center; gap: 8px; }
.ai-dot-pulse { width: 8px; height: 8px; border-radius: 50%; background: var(--accent); animation: breathe 1.2s ease-in-out infinite; }
.ai-stream { margin-top: 8px; max-height: 180px; overflow: auto; padding: 8px 10px; background: var(--surface-3); border: 1px solid var(--border); border-radius: var(--radius-xs); font-size: 11px; line-height: 1.6; white-space: pre-wrap; word-break: break-all; color: var(--text-3); font-family: ui-monospace, Menlo, monospace; }
.ai-empty { padding: 24px; text-align: center; color: var(--text-3); }
.ai-toolbar { display: flex; align-items: center; gap: 10px; font-size: 11.5px; color: var(--text-3); }
.ai-all { display: flex; align-items: center; gap: 5px; cursor: pointer; }
.ai-persona { padding: 3px 6px; border: 1px solid var(--border); border-radius: var(--radius-xs); background: var(--surface-2); color: var(--text-2); font-size: 11px; cursor: pointer; font-family: inherit; max-width: 160px; }
.ai-usage { margin-left: auto; }
.ai-rows { display: flex; flex-direction: column; gap: 6px; }
.ai-row { display: flex; gap: 9px; padding: 9px 11px; border: 1px solid var(--border); border-radius: var(--radius-sm); background: var(--surface); cursor: pointer; transition: border-color var(--dur); }
.ai-row.on { border-color: var(--accent); background: var(--accent-light); }
.ai-row-txt { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
.ai-row-main { color: var(--text); font-weight: 500; line-height: 1.5; }
.ai-row-sub { color: var(--text-3); font-size: 11.5px; line-height: 1.6; white-space: pre-wrap; word-break: break-word; }
.ai-badge { display: inline-block; margin-right: 6px; padding: 1px 6px; border-radius: var(--radius-xs); font-size: 10.5px; font-weight: 600; vertical-align: 1px; }
.ai-badge.b-warn { background: var(--warning-bg-soft); color: var(--warning); }
.ai-badge.b-ok { background: var(--success-bg-soft); color: var(--success); }
.ai-badge.b-danger { background: var(--danger-bg-soft); color: var(--danger); }
.ai-badge.b-neutral { background: var(--tag-neutral-bg); color: var(--tag-neutral-text); }
.ai-btn { padding: 8px 14px; border: 1px solid var(--border); border-radius: var(--radius-sm); background: var(--surface-2); color: var(--text); font-size: 12.5px; cursor: pointer; font-family: inherit; transition: all var(--dur); }
.ai-btn:hover { border-color: var(--accent); color: var(--accent); }
.ai-btn.primary { background: var(--accent); border-color: var(--accent); color: #fff; }
.ai-btn.primary:hover { filter: brightness(1.08); color: #fff; }
.ai-btn.primary:disabled { opacity: var(--opacity-disabled); cursor: not-allowed; filter: none; }
.ai-btn.sm { padding: 3px 9px; font-size: 11px; }
.ai-btn.ghost { background: transparent; }
</style>
