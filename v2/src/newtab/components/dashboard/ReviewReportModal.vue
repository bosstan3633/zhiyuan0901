<script setup lang="ts">
/**
 * R172-T11（04-67 F27~F32）：AI 复盘的**文本报告**弹框 —— 承接原 `WeeklyReportOverlay` 的定位。
 *
 * 为什么是中央弹框而不是侧栏抽屉（Q9 决议）：报告要读的是"这一期整体怎么样"，
 * 侧栏抽屉的范式是"逐条判决要不要采纳"——把整篇报告塞进判决流里，用户会以为每条都要勾。
 *
 * 三条不可让的边界：
 *  ① **四段文本，无金字塔图形**（F28）：R2 曾把"金字塔原理"做成梯形图，理解错了；
 *     金字塔是**行文结构**（结论先行 → 以上统下 → 归类分组 → 逻辑递进），不是图。
 *  ② **本地骨架先出、AI 只续写**（F29/F30）：结论与论据由 `buildReviewReport` 算完即渲染，
 *     不等网络；AI 回来只替换「洞察 / 建议」两段，失败或未配置就留着本地版并标明。
 *  ③ **打开零写入**：`存为资源卡 / 生成任务` 必须用户显式点，写库动作在宿主。
 */
import Icon from '@/shared/components/Icon.vue'
import './dashboard.css'
import { computed, onUnmounted, ref, watch } from 'vue'
import Modal from '@/shared/components/Modal.vue'
import type { ReviewReport, ReviewSug } from '@/shared/ai/review'

/** 默认执笔 = 目标管理专家（复盘这件事的视角）；换人只改行文视角，不改数字与结论 */
const DEFAULT_PERSONA = 'goal-expert'

const props = defineProps<{ open: boolean; report: ReviewReport | null }>()
const emit = defineEmits<{
  close: []
  save: []
  task: [s: ReviewSug]
  goto: [s: ReviewSug]
  export: []
}>()

/** AI 执笔状态：idle（本地版）/ run（在飞）/ done（已续写）/ off（未配置，本地版即终稿） */
const narrate = ref<'idle' | 'run' | 'done' | 'off'>('idle')
const live = ref<{ insights: string[]; sugs: ReviewSug[] } | null>(null)
let aborted = false

/* ---------- R173-2：执笔角色 + 一次性提示词（沿用评审抽屉那套控件语义） ---------- */
const personas = ref<{ id: string; name: string }[]>([])
const personaId = ref(DEFAULT_PERSONA)
const dirText = ref('')
const personaName = computed(() => personas.value.find(p => p.id === personaId.value)?.name || '目标管理专家')

async function loadPersonas(): Promise<void> {
  if (personas.value.length) return
  const sc = await import('@/shared/ai/scenarios')
  personas.value = sc.allPersonas().map(p => ({ id: p.id, name: p.name }))
}

const insights = computed<string[]>(() => live.value?.insights || props.report?.insights || [])
const sugs = computed<ReviewSug[]>(() => live.value?.sugs || props.report?.sugs || [])
const isAi = computed(() => !!live.value)

async function runNarrate(): Promise<void> {
  const rep = props.report
  if (!rep) return
  aborted = false
  live.value = null
  narrate.value = 'run'
  try {
    await loadPersonas()
    const cfgMod = await import('@/shared/ai/config')
    await cfgMod.loadAiConfig()
    /** 就绪判据只认 `aiReady`（三字段齐才算已接入）——自己复制一遍口径必然与设置页漂移 */
    if (!cfgMod.aiReady.value) { narrate.value = 'off'; return }
    const { narrateReview } = await import('@/shared/ai/review')
    const out = await narrateReview(rep, cfgMod.aiConfig.value, { personaId: personaId.value, directive: dirText.value })
    if (aborted) return
    if (!out) { narrate.value = 'idle'; return }
    live.value = out
    narrate.value = 'done'
  } catch {
    /** 任一环节抛错（chunk 取不到 / 网络异常）都不能把用户留在转圈里：回落本地版并说明 */
    if (!aborted) narrate.value = 'idle'
  }
}

/**
 * `immediate: true` 是必须的：宿主用 `v-if` + `:open="true"` 一起挂载，
 * 没有它首帧之后 `open` 再也不变 ⇒ watch 永不触发，AI 执笔与 F27 运行态整条路径静默失效（活性探针 A8 抓到）。
 */
watch(() => props.open, (on) => { if (on) void runNarrate(); else { aborted = true; narrate.value = 'idle' } }, { immediate: true })
onUnmounted(() => { aborted = true })
</script>

<template>
  <Modal :open="open" title="AI 复盘 · 文本报告" width="min(760px, 94vw)" height="86vh" @close="emit('close')">
    <template #sub>
      <span v-if="report">{{ report.meta }} · 执笔：<b>{{ personaName }}</b></span>
    </template>

    <div v-if="report" class="dz-rpt" :data-narrate="narrate" data-testid="review-report">
      <div class="dz-rpt-ctl">
        <label class="who">执笔角色
          <select v-model="personaId" @change="runNarrate">
            <option v-for="p in personas" :key="p.id" :value="p.id">{{ p.name }}</option>
          </select>
        </label>
        <input v-model="dirText" class="dir" placeholder="本轮想让它怎么写？（一次性指令：可改语气与角度，不改数字与结论）" @keydown.enter.prevent="runNarrate" />
        <button class="dz-btn sm pri" :disabled="narrate === 'run'" title="按当前角色与提示词重新生成" @click="runNarrate"><Icon name="refresh" :size="13"/> 重新生成</button>
      </div>

      <div class="dz-rpt-method">
        方法：<b>金字塔原理</b> —— 结论先行 › 以上统下 › 归类分组（MECE）› 逻辑递进。
        <b>规则给事实，专家给判断</b>，不替你决策。
      </div>

      <h3>结论</h3>
      <p class="lead" v-html="report.lead" />

      <h3>支撑论据</h3>
      <div v-for="(x, i) in report.args" :key="i" class="arg">
        <span class="idx">{{ i + 1 }}</span>
        <div class="bd">
          <div class="ah">{{ x.title }}<span class="rel">—— {{ x.rel }}</span></div>
          <div class="ev" v-html="x.ev" />
        </div>
      </div>

      <h3>洞察</h3>
      <div v-if="narrate === 'run'" class="dz-rpt-run">
        <span class="spin" />目标管理专家正在按<b>金字塔原理</b>组织本期内容：先核对结论与论据，再续写洞察与建议…
      </div>
      <ul v-else class="ins">
        <li v-for="(x, i) in insights" :key="i" v-html="x" />
      </ul>
      <div v-if="narrate === 'off'" class="dz-rpt-note">未配置 AI（设置 › AI 能力），以上为<b>本地规则版</b>：数字与判断都由规则给出，可直接导出。</div>
      <div v-else-if="narrate === 'idle'" class="dz-rpt-note">AI 执笔未成功（网络或额度），以上为<b>本地规则版</b>。</div>

      <h3>建议（按优先级）</h3>
      <div v-for="(s, i) in sugs" :key="s.id" class="sug">
        <span class="sn">{{ i + 1 }}</span>
        <div class="sb">
          <div class="st">{{ s.title }}</div>
          <div class="sd">{{ s.detail }}</div>
        </div>
        <div class="sa">
          <button class="dz-btn sm" @click="emit('goto', s)">去处理 ›</button>
          <button class="dz-btn sm ghost" @click="emit('task', s)">生成任务</button>
        </div>
      </div>
      <div v-if="isAi" class="dz-rpt-tag">洞察与建议由「{{ personaName }}」执笔，结论与论据仍来自本地规则计算</div>
    </div>
    <div v-else class="dz-rpt-empty">本期还没有可复盘的数据。</div>

    <template #footer>
      <span class="dz-rpt-hint">采纳即写库 · 可 <kbd>Ctrl/Cmd+Z</kbd> 撤销</span>
      <span class="dz-sp" />
      <button class="dz-btn sm" @click="emit('export')"><Icon name="download" :size="13"/> 导出报告</button>
      <button class="dz-btn sm" @click="emit('save')">存为资源卡</button>
      <button class="dz-btn sm pri" @click="emit('task', { id: 'top', title: report?.sugs?.[0]?.title || '复盘跟进', detail: report?.sugs?.[0]?.detail || '' })">生成任务</button>
    </template>
  </Modal>
</template>
