<script setup lang="ts">
/**
 * ★W12-D（V3.8.16）FocusDetail —— 「当前选中事件的全貌」常驻模块。
 *
 * 为什么有它：用户 2026-10-13 拍板把调度台的年度热力图退役（画像洞察页已全量覆盖），
 * 那个槽位改成「今日三件事当前选中的那条到底怎么样」——三件事卡片只有 2 行截断的描述
 * + 一行标签，看不全这件事的全貌，而「看不全」正是"排三件事"时最难受的地方。
 *
 * 七层全貌（用户拍板"全部都要"，故一屏内分区呈现，限高 + 内滚动）：
 *   ① 是什么 —— 标题 + 描述全文（解除卡片上的 2 行截断）
 *   ② 属于哪 —— 归属链：项目 → 成功指标 → 战略目标 → 使命 → 愿景
 *   ③ 要做什么 —— 子任务清单（含完成态）+ 优先级 / 成熟度 / 截止 / 标签
 *   ④ 凭什么 —— 支持记录 SupportLink（任务 → 资源的关联记录）
 *   ⑤ 走过什么 —— 该任务相关的事件流水（只读，按时间倒序）
 *   ⑥ 下一步 —— **本地规则式**建议（用户拍板 B4-a：先不等 AI）
 *   ⑦ 动作 —— 编辑 / 打开详情进 TaskDetailDrawer
 *
 * 纯只读：不改任何数据。写操作一律走上抛的 `edit` 交宿主处理（与 Pi* 组件零 store 的纪律一致）。
 */
import { computed } from 'vue'
import type { AppData, TaskCard, ResourceCard, SupportLink, Subtask } from '@/shared/models'
import type { CardEvent } from '@/shared/utils/eventLog'
import { EVENT_ACT_LABEL } from '@/shared/utils/eventLog'

const props = defineProps<{
  /** 当前选中的任务（null = 未选中 / 选中的是空槽） */
  task: TaskCard | null
  /** 空槽引导态用：这一格是不是被选中了的空槽（true 时显示「这个位置还空着」） */
  emptySlot: boolean
  data: AppData
  events: CardEvent[]
}>()

const emit = defineEmits<{ (e: 'edit', task: TaskCard): void; (e: 'locate', resourceId: string): void }>()

// ---------- ② 归属链：项目 → 指标 → 战略目标 → 使命 → 愿景 ----------
const chain = computed(() => {
  const t = props.task
  if (!t) return null
  const c = props.data.compass
  let dir: { id: string; name: string } | null = null
  let proj: { id: string; name: string } | null = null
  let metric: { id: string; title: string } | null = null
  for (const d of c.directions) {
    for (const p of d.projects) {
      if (p.id === t.projectId) { proj = { id: p.id, name: p.name }; dir = { id: d.id, name: d.name } }
      for (const m of p.metrics) {
        if (m.id === t.metricId) metric = { id: m.id, title: m.title }
      }
    }
  }
  return {
    dir, proj, metric,
    mission: c.mission?.content || '',
    vision: c.vision?.content || ''
  }
})

// ---------- ③ 子任务 + 属性 ----------
const subDone = computed(() => (props.task?.subtasks || []).filter(s => s.done).length)
const subTotal = computed(() => (props.task?.subtasks || []).length)
const PRI_LABEL: Record<string, string> = { high: '高', medium: '中', low: '低' }
const PRI_ORDER: Record<string, number> = { high: 0, medium: 1, low: 2 }
const STATUS_LABEL: Record<string, string> = { todo: '待办', doing: '进行中', done: '已完成' }
/** 成熟度口径与方向台 `tk-pri` 同源：按优先级 + 是否逾期给一个可读判断，不引入第二套算法 */
const maturity = computed(() => {
  const t = props.task
  if (!t) return ''
  if (t.status === 'done') return '已完成'
  const days = daysLeft(t.dueDate)
  if (t.priority === 'high' && days !== null && days < 0) return `逾期 ${-days} 天`
  if (t.priority === 'high') return '高优先'
  if (days !== null && days <= 2) return `还剩 ${days} 天`
  return PRI_LABEL[t.priority] + '优先'
})
function daysLeft(due?: string): number | null {
  if (!due) return null
  const ms = new Date(due.replace(/-/g, '/')).getTime() - Date.now()
  if (Number.isNaN(ms)) return null
  return Math.round(ms / 86400000)
}

// ---------- ④ 支持记录 ----------
const supports = computed<{ rec: SupportLink; res: ResourceCard | undefined }[]>(() => {
  const t = props.task
  if (!t) return []
  return (props.data.supportLinks || [])
    .filter(l => l.taskId === t.id)
    .map(l => ({ rec: l, res: props.data.resources.find(r => r.id === l.resourceId) }))
})
/** 子任务未挂载到资源卡的也要捞出来（SupportLink.subId 维度） */
const orphanSupports = computed<SupportLink[]>(() => {
  const t = props.task
  if (!t) return []
  return (props.data.supportLinks || []).filter(l => l.taskId === t.id && !l.resourceId)
})

// ---------- ⑤ 该任务的事件流水 ----------
const flow = computed(() => {
  const t = props.task
  if (!t) return []
  return props.events.filter(e => e.cardId === t.id).slice(0, 8)
})

// ---------- ⑥ 下一步建议（本地规则式，用户拍板 B4-a）----------
/** 每条规则一个「因为…所以…」的直白结论，全部是纯函数、无副作用、不调 AI。
 *  刻意写得保守：只陈述库里已有事实能支撑的东西，不编造、不预测。 */
const advice = computed<{ text: string; tone: 'warn' | 'info' }[]>(() => {
  const t = props.task
  if (!t) return []
  const out: { text: string; tone: 'warn' | 'info' }[] = []
  const days = daysLeft(t.dueDate)

  // 归属缺失是最该先说的：任务没挂成功指标 ⇒ 复盘与加权分都算不到它
  if (!t.metricId) out.push({ text: '这条任务还没有挂到任何成功指标上 —— 不挂就没有加权分，复盘也看不见它。', tone: 'warn' })
  else if (!t.projectId) out.push({ text: '挂到了成功指标，但没挂攻坚项目 —— 六层链断在第 5 层。', tone: 'warn' })

  // 子任务：一步到位 vs 拆解
  if (subTotal.value === 0) out.push({ text: '一条子任务都没有 —— 如果它要分几步做，先拆出来，做完一件划一件更有手感。', tone: 'info' })
  else if (subDone.value === subTotal.value) out.push({ text: `子任务已全完成（${subTotal.value}/${subTotal.value}）—— 主体没勾的话勾掉它。`, tone: 'info' })
  else out.push({ text: `子任务完成 ${subDone.value}/${subTotal.value} —— 还剩 ${subTotal.value - subDone.value} 件。`, tone: 'info' })

  // 逾期
  if (days !== null && days < 0 && t.status !== 'done') {
    out.push({ text: `已经过了截止日 ${-days} 天。要么今天做掉，要么改个日期 —— 别让它一直挂着假装还在计划里。`, tone: 'warn' })
  } else if (days !== null && days <= 2 && t.status !== 'done') {
    out.push({ text: `离截止只剩 ${days} 天，今天不做就得挪期。`, tone: 'warn' })
  }

  // 久未推进
  const idle = Math.round((Date.now() - (t.updatedAt || t.createdAt)) / 86400000)
  if (t.status !== 'done' && idle >= 14) {
    out.push({ text: `已经 ${idle} 天没动过了 —— 要么今天推一把，要么诚实一点，把它归档。`, tone: 'warn' })
  }

  // 没被调用过：说明它多半只是"记下了"，还没真用上
  if (!t.callCount && t.status !== 'done') {
    out.push({ text: '这条任务一次都没被调出过 —— 记录本身不产生价值，用上才算。', tone: 'info' })
  }

  // 支撑材料
  if (supports.value.length === 0) {
    out.push({ text: '没有挂任何支撑材料 —— 动手前先挂一条资源（参考链接/素材），做的时候不用再回头找。', tone: 'info' })
  }

  if (out.length === 0) out.push({ text: '该有的都有：挂了归属、定了截止、拆了子任务、也挂了材料 —— 可以直接做。', tone: 'info' })
  return out.slice(0, 4)
})

function fmtTs(ts: number): string {
  const d = new Date(ts)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}
function fmtDay(iso?: string): string {
  if (!iso) return ''
  return iso
}
</script>

<template>
  <div class="fd-body">
    <!-- 空槽引导态：按用户拍板，选到空槽时**不静默回落到另一条任务** -->
    <div v-if="!task && emptySlot" class="fd-empty">
      <span class="fd-empty-ico">＋</span>
      <b class="fd-empty-t">这个位置还空着</b>
      <span class="fd-empty-s">点上方那一格的「＋ 从任务库选取」把它填上</span>
    </div>

    <div v-else-if="!task" class="fd-empty">
      <span class="fd-empty-ico">☰</span>
      <b class="fd-empty-t">点上面任意一件，看它的全貌</b>
      <span class="fd-empty-s">单击选中 · 双击跳到下方任务列表</span>
    </div>

    <template v-else>
      <!-- ① 是什么 -->
      <section class="fd-sec fd-what">
        <div class="fd-sec-h"><span class="n">1</span><span class="t">是什么</span></div>
        <h3 class="fd-title">{{ task.title }}</h3>
        <p v-if="task.description" class="fd-desc">{{ task.description }}</p>
        <p v-else class="fd-desc fd-desc-none">还没有写描述 —— 一句话说清「做完之后世界有什么不同」，以后回看才认得出这件事。</p>
      </section>

      <!-- ② 属于哪 -->
      <section class="fd-sec">
        <div class="fd-sec-h"><span class="n">2</span><span class="t">属于哪</span><span class="m">六层链</span></div>
        <div class="fd-chain">
          <span class="fd-lv">愿景</span><span class="fd-cv">{{ chain?.vision || '（未设定）' }}</span>
        </div>
        <div class="fd-chain">
          <span class="fd-lv">使命</span><span class="fd-cv">{{ chain?.mission || '（未设定）' }}</span>
        </div>
        <div class="fd-chain">
          <span class="fd-lv">战略目标</span><span class="fd-cv">{{ chain?.dir?.name || '⚠ 断链' }}</span>
        </div>
        <div class="fd-chain">
          <span class="fd-lv">攻坚项目</span><span class="fd-cv">{{ chain?.proj?.name || '⚠ 断链' }}</span>
        </div>
        <div class="fd-chain">
          <span class="fd-lv">成功指标</span><span class="fd-cv">{{ chain?.metric?.title || '⚠ 断链（没挂指标就等于没归属）' }}</span>
        </div>
      </section>

      <!-- ③ 要做什么 -->
      <section class="fd-sec">
        <div class="fd-sec-h"><span class="n">3</span><span class="t">要做什么</span>
          <span class="m">子任务 {{ subDone }}/{{ subTotal }}</span></div>
        <div class="fd-attrs">
          <span class="fd-attr">状态 <b>{{ STATUS_LABEL[task.status] }}</b></span>
          <span class="fd-attr">优先级 <b>{{ PRI_LABEL[task.priority] }}</b></span>
          <span class="fd-attr">成熟度 <b>{{ maturity }}</b></span>
          <span v-if="task.dueDate" class="fd-attr">截止 <b>{{ fmtDay(task.dueDate) }}</b></span>
          <span v-if="task.estimatedMinutes" class="fd-attr">预估 <b>{{ task.estimatedMinutes }} 分钟</b></span>
          <span v-if="(task.tags || []).length" class="fd-attr">标签 <b>{{ (task.tags || []).join(' · ') }}</b></span>
        </div>
        <ul v-if="subTotal" class="fd-subs">
          <li v-for="s in (task.subtasks || [])" :key="s.id" :class="{ done: s.done }">
            <span class="fd-sub-box">{{ s.done ? '✓' : '' }}</span>{{ s.title }}
          </li>
        </ul>
        <p v-else class="fd-note">没有子任务 —— 这一格下面会显示你要做的分步</p>
      </section>

      <!-- ④ 凭什么 -->
      <section class="fd-sec">
        <div class="fd-sec-h"><span class="n">4</span><span class="t">凭什么</span>
          <span class="m">支撑材料 {{ supports.length }}</span></div>
        <ul v-if="supports.length" class="fd-sup">
          <li v-for="s in supports" :key="s.rec.id">
            <button class="fd-sup-btn" @click="emit('locate', s.rec.resourceId)">{{ s.res?.title || '（资源已删除）' }}</button>
            <span v-if="s.rec.why" class="fd-sup-why">{{ s.rec.why }}</span>
            <span class="fd-sup-from">{{ s.rec.from === 'ai' ? 'AI 建议' : '手动挂载' }}</span>
          </li>
        </ul>
        <p v-else class="fd-note">没有挂支撑材料 —— 动手前先挂一条，做的时候不用回头找</p>
        <p v-if="orphanSupports.length" class="fd-note">另有 {{ orphanSupports.length }} 条指向子任务的支撑记录</p>
      </section>

      <!-- ⑤ 走过什么 -->
      <section class="fd-sec">
        <div class="fd-sec-h"><span class="n">5</span><span class="t">走过什么</span>
          <span class="m">最近 {{ flow.length }} 条</span></div>
        <ul v-if="flow.length" class="fd-flow">
          <li v-for="e in flow" :key="e.id">
            <span class="fd-flow-t">{{ fmtTs(e.ts) }}</span>
            <span class="fd-flow-a">{{ EVENT_ACT_LABEL[e.action] || e.action }}</span>
          </li>
        </ul>
        <p v-else class="fd-note">还没有相关记录 —— 做过一次就会出现在这里</p>
      </section>

      <!-- ⑥ 下一步 -->
      <section class="fd-sec">
        <div class="fd-sec-h"><span class="n">6</span><span class="t">下一步</span><span class="m">本地判断 · 不调 AI</span></div>
        <ul class="fd-adv">
          <li v-for="(a, i) in advice" :key="i" :class="a.tone">{{ a.text }}</li>
        </ul>
      </section>

      <!-- ⑦ 动作 -->
      <section class="fd-sec fd-acts">
        <div class="fd-sec-h"><span class="n">7</span><span class="t">动作</span></div>
        <button class="fd-act" @click="emit('edit', task)">✎ 编辑这条任务</button>
      </section>
    </template>
  </div>
</template>

<style scoped>
.fd-body {
  /* ★限高 + 内滚动（用户拍板 B「限高 + 内滚动」）：任务描述很长时不能把下方三张卡顶出屏 */
  max-height: 620px; overflow-y: auto; overscroll-behavior: contain;
  display: flex; flex-direction: column; gap: 18px; padding: 4px 2px 4px 0;
}
.fd-empty {
  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px;
  min-height: 220px; color: var(--text-3); text-align: center;
}
.fd-empty-ico {
  width: 40px; height: 40px; border-radius: 12px; display: grid; place-items: center;
  background: var(--surface-2); color: var(--text-4); font-size: 18px;
}
.fd-empty-t { font-size: var(--fs-body); color: var(--text-2); font-weight: 700; }
.fd-empty-s { font-size: var(--fs-caption); color: var(--text-4); }

.fd-sec { display: flex; flex-direction: column; gap: 9px; }
.fd-sec-h { display: flex; align-items: center; gap: 9px; }
.fd-sec-h .n {
  width: 18px; height: 18px; border-radius: 6px; background: var(--accent-light);
  color: var(--accent-ink); font-size: var(--fs-micro); font-weight: 700;
  display: grid; place-items: center; flex: none;
}
.fd-sec-h .t { font-size: var(--fs-caption); font-weight: 700; color: var(--text-2); }
.fd-sec-h .m { font-size: var(--fs-micro); color: var(--text-4); margin-left: auto; }

.fd-title { font-size: var(--fs-headline); font-weight: 700; color: var(--text); line-height: 1.4; }
.fd-desc { font-size: var(--fs-body); color: var(--text-2); line-height: 1.75; white-space: pre-wrap; }
.fd-desc-none { color: var(--text-4); }
.fd-note { font-size: var(--fs-caption); color: var(--text-4); line-height: 1.6; }

.fd-chain { display: flex; align-items: baseline; gap: 10px; font-size: var(--fs-caption); }
.fd-lv { flex: none; width: 62px; color: var(--text-4); }
.fd-cv { color: var(--text-2); }

.fd-attrs { display: flex; flex-wrap: wrap; gap: 7px; }
.fd-attr {
  font-size: var(--fs-micro); color: var(--text-3); background: var(--surface-2);
  border-radius: 999px; padding: 3px 10px;
}
.fd-attr b { color: var(--text); font-weight: 700; }

.fd-subs { list-style: none; display: flex; flex-direction: column; gap: 5px; }
.fd-subs li {
  display: flex; align-items: center; gap: 8px; font-size: var(--fs-caption);
  color: var(--text-2); padding: 5px 9px; background: var(--surface-2); border-radius: var(--radius-md);
}
.fd-subs li.done { color: var(--text-4); text-decoration: line-through; }
.fd-sub-box {
  width: 14px; height: 14px; border-radius: 4px; border: 1.4px solid var(--border-strong);
  flex: none; font-size: 9px; display: grid; place-items: center; color: var(--success);
}

.fd-sup { list-style: none; display: flex; flex-direction: column; gap: 5px; }
.fd-sup li { display: flex; align-items: center; gap: 8px; font-size: var(--fs-caption); }
.fd-sup-btn {
  background: none; border: 0; padding: 0; font-family: inherit; cursor: pointer;
  color: var(--accent-ink); font-size: var(--fs-caption); text-decoration: underline;
  text-underline-offset: 3px; max-width: 46%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.fd-sup-why { color: var(--text-4); font-size: var(--fs-micro); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.fd-sup-from { margin-left: auto; font-size: var(--fs-micro); color: var(--text-4); flex: none; }

.fd-flow { list-style: none; display: flex; flex-direction: column; gap: 4px; }
.fd-flow li { display: flex; gap: 12px; font-size: var(--fs-micro); color: var(--text-3); }
.fd-flow-t { color: var(--text-4); flex: none; font-variant-numeric: tabular-nums; }

.fd-adv { list-style: none; display: flex; flex-direction: column; gap: 6px; }
.fd-adv li {
  font-size: var(--fs-caption); line-height: 1.7; color: var(--text-2);
  padding: 8px 12px; border-radius: var(--radius-md); background: var(--surface-2);
  border-left: 2px solid var(--border-strong);
}
.fd-adv li.warn { border-left-color: var(--warning); color: var(--text); }

.fd-acts { }
.fd-act {
  align-self: flex-start; font-family: inherit; cursor: pointer;
  background: var(--surface-2); border: 1px solid var(--border); border-radius: var(--radius-md);
  padding: 7px 14px; font-size: var(--fs-caption); color: var(--text-2);
}
.fd-act:hover { border-color: var(--border-strong); color: var(--accent-ink); }
.fd-act:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
</style>