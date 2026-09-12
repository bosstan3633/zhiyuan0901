<template>
  <Transition name="fade">
    <div v-if="open" class="itm-overlay" @click.self="emit('close')"></div>
  </Transition>
  <Transition name="pop">
    <div v-if="open" class="itm-modal">
      <div class="itm-head">
        <span class="itm-title">📋 {{ mode === 'goal' ? '导入项目模板' : '导入金字塔模板' }}</span>
        <span class="itm-target">{{ mode === 'goal' ? '导入目标：战略目标「' + targetName + '」' : '导入目标：策展台「' + targetName + '」（金字塔视图）' }}</span>
        <span class="itm-close" @click="emit('close')">×</span>
      </div>
      <div class="itm-head-ops">
        <button class="itm-rule-btn" @click="ruleOpen = !ruleOpen">📖 AI 整理规则{{ ruleOpen ? ' ▴' : ' ▾' }}</button>
        <button class="itm-rule-btn" @click="copyRule">⧉ 复制规则给 AI</button>
      </div>
      <div v-if="ruleOpen" class="itm-rule-panel">{{ ruleText }}</div>
      <div class="itm-rule">
        <template v-if="mode === 'goal'">
          解析规则：<b># 一级标题 = 项目名称</b>（可多个）｜<b>## 二级标题 = 该项目的成功指标</b>｜<b>### 三级标题 = 该指标下的任务名称</b>｜<b>### 之下的正文 = 该任务的详情</b>（四级及以下标题并入任务详情）
        </template>
        <template v-else>
          解析规则：<b># 一级标题 = 中心论点</b>（仅一个，多余忽略）｜<b>## 二级标题 = 第二层节点</b>｜<b>### 三级标题 = 第三层节点</b>（隶属上一个二级）｜<b>#### 四级标题 = 第四层节点</b>｜<b>标题下的正文 = 该节点卡片的描述内容</b>
        </template>
      </div>
      <div v-if="mode === 'pyramid' && hasThesis" class="itm-notice">
        ⚠ 本台已设中心论点——Markdown 中的 H1 将被忽略，导入从二级层级挂入现有论点
      </div>
      <div v-if="warns.length" class="itm-notice">
        <div v-for="w in warns" :key="w">{{ w }}</div>
      </div>
      <div class="itm-cols">
        <div class="itm-pane">
          <div class="itm-pane-head">📋 粘贴标准化 Markdown（支持直接粘贴）</div>
          <textarea class="itm-md" v-model="src" spellcheck="false" placeholder="在此粘贴标准化 Markdown…"></textarea>
        </div>
        <div class="itm-pane">
          <div class="itm-pane-head">预览 · 将创建的结构</div>
          <div class="itm-preview">
            <!-- 场景A：结构树 -->
            <template v-if="mode === 'goal'">
              <div v-if="!goal.projects.length" class="itm-empty">未识别到项目（# 一级标题）——解析失败不写入任何数据</div>
              <div v-for="pr in goal.projects" :key="pr.name" class="g-proj">
                <div class="g-proj-h"><span class="g-tagp">项目</span><span>{{ pr.name }}</span><span class="g-cnt">{{ pr.metrics.length }} 指标 · {{ taskCountOf(pr) }} 任务</span></div>
                <div v-for="m in pr.metrics" :key="m.name" class="g-met">◎ {{ m.name }}<span v-if="m.auto" class="g-auto">（自动创建：H3 跳级容错）</span></div>
                <template v-for="m in pr.metrics">
                  <div v-for="t in m.tasks" :key="pr.name + m.name + t.name" class="g-task">
                    <span class="tn">{{ t.name }}</span>
                    <span class="td">{{ t.detail || '（无详情）' }}</span>
                  </div>
                </template>
              </div>
            </template>
            <!-- 场景B：金字塔 -->
            <template v-else>
              <div v-if="!pyr.thesis" class="itm-empty">未识别到中心论点（# 一级标题）——解析失败不写入任何数据</div>
              <div v-else class="p-pyr">
                <div class="p-l1">
                  <div class="lb">L1 · 中心论点<span v-if="pyr.thesis.virtual">（虚拟——实装时将提示）</span><span v-if="hasThesis">（本台已设——H1 忽略）</span></div>
                  <div class="t">{{ hasThesis ? '（本台已设的论点）' : pyr.thesis.name }}</div>
                  <div v-if="hasThesis===false && pyr.thesis.desc" class="d">{{ pyr.thesis.desc }}</div>
                </div>
                <div class="p-l2row">
                  <div v-for="n2 in pyr.thesis.children" :key="n2.name" class="p-col">
                    <div class="p-node"><div class="t"><span class="nm">{{ n2.name }}</span><span class="lb">L2</span></div>
                      <div v-if="n2.desc" class="d">{{ n2.desc }}</div>
                      <div class="ops"><span>🔗 关联资源卡</span><span>➕ 新建卡片</span></div>
                    </div>
                    <div class="p-sub" v-if="n2.children.length">
                      <div v-for="n3 in n2.children" :key="n3.name" class="p-node">
                        <div class="t"><span class="nm">{{ n3.name }}</span><span class="lb">L3</span></div>
                        <div v-if="n3.desc" class="d">{{ n3.desc }}</div>
                        <div class="ops"><span>🔗 关联资源卡</span><span>➕ 新建卡片</span></div>
                        <div class="p-sub" v-if="n3.children.length">
                          <div v-for="n4 in n3.children" :key="n4.name" class="p-node">
                            <div class="t"><span class="nm">{{ n4.name }}</span><span class="lb">L4</span></div>
                            <div v-if="n4.desc" class="d">{{ n4.desc }}</div>
                            <div class="ops"><span>🔗 关联资源卡</span><span>➕ 新建卡片</span></div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </template>
          </div>
          <div class="itm-stat">
            <template v-if="mode === 'goal'">
              <span class="chip">项目 <b>{{ goal.projects.length }}</b></span>
              <span class="chip">成功指标 <b>{{ goalMetricCount }}</b></span>
              <span class="chip">任务 <b>{{ goalTaskCount }}</b></span>
            </template>
            <template v-else>
              <span class="chip">L2 节点 <b>{{ pyrLevel(2) }}</b></span>
              <span class="chip">L3 节点 <b>{{ pyrLevel(3) }}</b></span>
              <span class="chip">L4 节点 <b>{{ pyrLevel(4) }}</b></span>
              <span class="chip">节点卡片 <b>{{ pyrCardCount }}</b></span>
            </template>
          </div>
        </div>
      </div>
      <div class="itm-foot">
        <span class="itm-note">同名跳过/复用在确认导入时执行并汇总提示（幂等，防重复导入）</span>
        <button class="btn" @click="emit('close')">取消</button>
        <button class="btn primary" :disabled="!canConfirm" @click="emitConfirm">✓ 确认导入</button>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
/**
 * R108（T2/T3）：Markdown 模板导入共享弹窗（方向树 goal 模式 / 策展台 pyramid 模式）。
 * - 左栏粘贴 Markdown，右栏实时解析预览（解析走 shared/utils/mdImport 纯函数）；
 * - 确认时 emit 解析结果，写入与同名跳过由宿主执行（需要宿主的既有数据上下文）；
 * - pyramid 模式：hasThesis=true 时 H1 被忽略（导入从二级挂入现有论点，安全默认）。
 */
import { ref, computed, watch } from 'vue'
import { parseGoalTemplate, parsePyramidTemplate, GOAL_RULE, PYRAMID_RULE, type GoalParseResult, type PyramidParseResult, type PyramidNode } from '@/shared/utils/mdImport'
import { showToast } from '@/shared/components/toast'

const props = defineProps<{
  open: boolean
  mode: 'goal' | 'pyramid'
  targetName: string
  /** pyramid 模式：本台是否已设中心论点 */
  hasThesis?: boolean
}>()
const emit = defineEmits<{
  (e: 'close'): void
  (e: 'confirm', payload: { goal?: GoalParseResult; pyramid?: PyramidParseResult }): void
}>()

const src = ref('')
const ruleOpen = ref(false)
const ruleText = computed(() => props.mode === 'goal' ? GOAL_RULE : PYRAMID_RULE)
async function copyRule() {
  try {
    await navigator.clipboard.writeText(ruleText.value + '\n\n现在请整理用户的以下文本：')
    showToast('✓ 规则已复制——粘贴给任意 AI，把 AI 输出粘回左侧即可')
  } catch { showToast('✗ 复制失败——请手动选择文本复制') }
}
const goal = computed<GoalParseResult>(() => props.mode === 'goal' ? parseGoalTemplate(src.value) : { projects: [], warns: [] })
const pyr = computed<PyramidParseResult>(() => props.mode === 'pyramid' ? parsePyramidTemplate(src.value) : { thesis: null, extraH1: [], warns: [] })
const warns = computed(() => props.mode === 'goal' ? goal.value.warns : pyr.value.warns)

const goalMetricCount = computed(() => goal.value.projects.reduce((s, p) => s + p.metrics.length, 0))
const goalTaskCount = computed(() => goal.value.projects.reduce((s, p) => s + p.metrics.reduce((s2, m) => s2 + m.tasks.length, 0), 0))
const taskCountOf = (pr: { metrics: { tasks: unknown[] }[] }) => pr.metrics.reduce((s, m) => s + m.tasks.length, 0)

const pyrLevel = (lv: number) => {
  let n = 0
  const walk = (node: PyramidNode) => { if (node.level === lv) n++; (node.children || []).forEach(walk) }
  if (pyr.value.thesis) walk(pyr.value.thesis)
  return n
}
const pyrCardCount = computed(() => {
  let n = 0
  const walk = (node: PyramidNode) => { n++; (node.children || []).forEach(walk) }
  if (pyr.value.thesis) walk(pyr.value.thesis)
  return n
})

const canConfirm = computed(() => {
  if (props.mode === 'goal') return goal.value.projects.length > 0
  return !!(pyr.value.thesis && (pyr.value.thesis.children || []).length)
})
function emitConfirm() {
  if (!canConfirm.value) return
  emit('confirm', props.mode === 'goal' ? { goal: goal.value } : { pyramid: pyr.value })
  src.value = ''
}
/** 打开时清空上次粘贴（预览即确认原则：每次导入都应看得见全部内容） */
watch(() => props.open, (v) => { if (v) src.value = '' })
</script>

<style scoped>
.itm-overlay { position: fixed; inset: 0; background: rgba(0,0,0,.4); z-index: 300; }
.itm-modal { position: fixed; top: 50%; left: 50%; transform: translate(-50%,-50%); width: 1080px; max-width: 96vw; max-height: 92vh; overflow: auto; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); box-shadow: var(--shadow-lg); z-index: 301; }
.itm-head { display: flex; align-items: center; gap: 10px; padding: 14px 18px; border-bottom: 1px solid var(--border); flex-wrap: wrap; }
.itm-title { font-size: 15px; font-weight: 700; }
.itm-target { font-size: 11.5px; color: var(--text3); }
.itm-close { margin-left: auto; width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; border-radius: 6px; cursor: pointer; color: var(--text3); font-size: 17px; }
.itm-close:hover { background: var(--surface-3); color: var(--text); }
.itm-head-ops { display: flex; gap: 8px; padding: 10px 18px 0; }
.itm-rule-btn { font-size: 11.5px; color: var(--accent); background: var(--accent-light); border: 1px solid color-mix(in srgb, var(--accent) 40%, transparent); border-radius: 99px; padding: 3px 12px; cursor: pointer; font-family: inherit; }
.itm-rule-btn:hover { background: color-mix(in srgb, var(--accent) 22%, transparent); }
.itm-rule-panel { margin: 10px 18px 0; padding: 12px 14px; border: 1px solid var(--border); border-radius: 8px; background: var(--surface-2); color: var(--text-2); font-size: 12px; line-height: 1.7; white-space: pre-wrap; max-height: 220px; overflow: auto; }
.itm-rule { margin: 10px 18px 0; padding: 8px 12px; border: 1px solid var(--border); border-radius: 8px; font-size: 11.5px; color: var(--text2); background: var(--surface-2); }
.itm-rule b { color: var(--accent); }
.itm-notice { margin: 10px 18px 0; padding: 8px 12px; border-radius: 8px; background: rgba(217,160,60,.1); border: 1px solid rgba(217,160,60,.4); color: var(--warn); font-size: 12px; }
.itm-cols { display: grid; grid-template-columns: 1fr 1.15fr; gap: 14px; padding: 14px 18px; align-items: stretch; }
.itm-pane { border: 1px solid var(--border); border-radius: var(--rads); overflow: hidden; background: var(--surface-2); display: flex; flex-direction: column; }
.itm-pane-head { padding: 9px 14px; font-size: 12px; font-weight: 600; color: var(--text2); border-bottom: 1px solid var(--border); }
.itm-md { flex: 1; min-height: 380px; background: transparent; border: none; outline: none; color: var(--text2); font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12.5px; line-height: 1.75; padding: 12px 14px; resize: vertical; }
.itm-preview { min-height: 380px; max-height: 460px; overflow: auto; padding: 12px 14px; }
.itm-empty { color: var(--text3); font-size: 12.5px; text-align: center; padding: 60px 0; }
.itm-stat { display: flex; gap: 10px; flex-wrap: wrap; padding: 10px 14px; border-top: 1px solid var(--border); }
.itm-stat .chip { font-size: 11px; color: var(--text2); background: var(--surface-3); border: 1px solid var(--border); border-radius: 99px; padding: 3px 12px; font-variant-numeric: tabular-nums; }
.itm-stat .chip b { color: var(--text); }
.itm-foot { display: flex; align-items: center; gap: 8px; justify-content: flex-end; padding: 12px 18px; border-top: 1px solid var(--border); }
.itm-note { margin-right: auto; font-size: 11px; color: var(--text3); }
.btn { padding: 7px 16px; border-radius: 8px; border: 1px solid var(--border); background: var(--surface-2); color: var(--text-2); font-size: 12.5px; cursor: pointer; font-family: inherit; }
.btn.primary { background: var(--accent); border-color: var(--accent); color: #fff; font-weight: 600; }
.btn.primary:hover { background: var(--accent-hover); }
.btn:disabled { opacity: .45; cursor: not-allowed; }
/* 场景A 结构树 */
.g-proj { border: 1px solid var(--border); border-radius: var(--rads); margin-bottom: 10px; background: var(--surface-2); }
.g-proj-h { padding: 8px 12px; display: flex; align-items: center; gap: 8px; font-weight: 600; font-size: 12.5px; border-bottom: 1px solid var(--border); flex-wrap: wrap; }
.g-tagp { font-size: 9.5px; color: var(--accent); background: var(--accent-light); padding: 1px 8px; border-radius: 99px; }
.g-cnt { margin-left: auto; font-size: 10.5px; color: var(--text3); font-variant-numeric: tabular-nums; }
.g-met { padding: 6px 12px 2px 26px; font-size: 12px; color: var(--text-2); font-weight: 600; }
.g-met::before { content: "◎ "; color: var(--accent); }
.g-auto { color: var(--warn); font-size: 10.5px; font-weight: 400; }
.g-task { margin: 2px 12px 6px 42px; padding: 5px 10px; background: var(--surface-3); border-radius: 6px; font-size: 11.5px; }
.g-task .tn { color: var(--text-2); font-weight: 500; }
.g-task .td { display: block; font-size: 10.5px; color: var(--text3); margin-top: 2px; white-space: pre-wrap; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
/* 场景B 金字塔 */
.p-pyr { display: flex; flex-direction: column; align-items: center; }
.p-l1 { background: linear-gradient(180deg, color-mix(in srgb, var(--accent) 26%, transparent), color-mix(in srgb, var(--accent) 8%, transparent)); border: 1px solid var(--accent); border-radius: 10px; padding: 10px 26px; text-align: center; min-width: 230px; max-width: 430px; }
.p-l1 .lb { font-size: 9.5px; color: var(--accent); letter-spacing: 1.5px; }
.p-l1 .t { font-weight: 700; font-size: 14px; }
.p-l1 .d { margin-top: 6px; border-top: 1px dashed color-mix(in srgb, var(--accent) 40%, transparent); padding-top: 6px; font-size: 11px; color: var(--text3); text-align: left; white-space: pre-wrap; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.p-l2row { display: flex; gap: 12px; flex-wrap: wrap; justify-content: center; margin-top: 14px; align-items: flex-start; }
.p-col { display: flex; flex-direction: column; align-items: center; }
.p-node { background: var(--surface-2); border: 1px solid var(--border); border-radius: var(--rads); padding: 9px 11px; width: 230px; font-size: 12px; display: flex; flex-direction: column; gap: 6px; }
.p-node .t { font-weight: 600; display: flex; gap: 6px; align-items: center; }
.p-node .nm { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.p-node .lb { font-size: 9px; color: var(--text3); letter-spacing: .8px; margin-left: auto; }
.p-node .d { font-size: 10.5px; color: var(--text3); white-space: pre-wrap; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; border-top: 1px dashed var(--border); padding-top: 5px; }
.p-node .ops { display: flex; gap: 6px; border-top: 1px solid var(--border); padding-top: 6px; }
.p-node .ops span { flex: 1; text-align: center; font-size: 10px; color: var(--text3); background: var(--surface-3); border: 1px solid var(--border); border-radius: 6px; padding: 2px 0; cursor: default; }
.p-sub { margin-top: 8px; border-left: 1px solid var(--border); padding-left: 10px; display: flex; flex-direction: column; gap: 8px; width: 100%; }
.fade-enter-active, .fade-leave-active { transition: opacity .2s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
.pop-enter-active, .pop-leave-active { transition: all .18s ease; }
.pop-enter-from, .pop-leave-to { opacity: 0; transform: translate(-50%,-50%) scale(.97); }
</style>
