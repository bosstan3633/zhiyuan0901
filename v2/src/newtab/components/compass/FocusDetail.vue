<script setup lang="ts">
/**
 * ★W12-D（V3.8.16）FocusDetail —— 「当前选中事件的全貌」常驻模块。
 * ★V3.8.18（N1）**版式重排**：从七层纵向堆叠（限高 620px，实测撑到 900px+）改为
 *   「三栏横排 + 下方固定高度子任务区」。
 *
 * 为什么重排：原布局把七件事一件接一件竖着码在 620px 里，于是真正的内容
 * （下方项目舱、任务行）被挤出首屏，而首屏里堆着的是七段导航与说明性文字。
 * 用户拍板：「2 属于哪 / 5 走过什么 / 6 下一步」横排一行，
 * 子任务区**高度锁死 = 恰好 4 条**，更多则在容器内上下滚动 —— 整条横条不再被子任务数量撑高。
 *
 * 为什么砍掉 ① 是什么：标题与描述已经完整写在上面那张三件事卡上（标题不截断），
 * 在这里再抄一遍是同一句话出现两次 —— 两份会各自漂移，且用户分不清哪份才是准的。
 * ④ 凭什么（支撑材料）与 ⑦ 动作（编辑）一并移进双击打开的 TaskDetailDrawer：
 * 它们是"动手时要看的东西"，不是"选中时就要读的东西"。
 *
 * 纯只读：不改任何数据。写操作一律走上抛的 `edit` 交宿主处理（与 Pi* 组件零 store 的纪律一致）。
 */
import { computed } from 'vue'
import type { AppData, TaskCard, ResourceCard, SupportLink } from '@/shared/models'
import type { CardEvent } from '@/shared/utils/eventLog'
import { EVENT_ACT_LABEL } from '@/shared/utils/eventLog'

const props = defineProps<{
  /** 当前选中的任务（null = 未选中 / 选中的是空槽） */
  task: TaskCard | null
  /** 空槽引导态用：这一格是不是被选中了的空槽（true 时显示「这个位置还空着」） */
  emptySlot: boolean
  /** ★V3.8.18（N1）：这一格**不是**任务时也要说清它是什么
   *   （源卡已删 / 装的是资源卡 / 是一句自由文本 / 什么都没装）。 */
  slotKind: 'none' | 'stale' | 'nonTask' | 'text'
  /** 非任务槽的快照文本（用于自由文本槽与源卡已删时的回显） */
  slotText?: string
  data: AppData
  events: CardEvent[]
}>()

const emit = defineEmits<{ (e: 'edit', task: TaskCard): void; (e: 'locate', resourceId: string): void }>()

// ---------- ② 属于哪：项目 → 指标 → 战略目标 → 使命 → 愿景 ----------
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
const subtasks = computed(() => props.task?.subtasks || [])
const subDone = computed(() => subtasks.value.filter(s => s.done).length)
const subTotal = computed(() => subtasks.value.length)
/** ★N1：固定高度的"可展示条数"只写在注释与常量一处 —— 样式里的 140px 必须与它一致，
 *  4 行 × 35px。改条数时两处一起改，否则会出现"说是 4 条、实际露 3 条半"。 */
const SUB_VISIBLE_ROWS = 4
const PRI_LABEL: Record<string, string> = { high: '高', medium: '中', low: '低' }
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

// ---------- ④ 支撑记录（不再独占一层，双击进抽屉后本组件只保留"有没有"这一个事实） ----------
const supports = computed<{ rec: SupportLink; res: ResourceCard | undefined }[]>(() => {
  const t = props.task
  if (!t) return []
  return (props.data.supportLinks || [])
    .filter(l => l.taskId === t.id)
    .map(l => ({ rec: l, res: props.data.resources.find(r => r.id === l.resourceId) }))
})

// ---------- ⑤ 走过什么 ----------
/** ★N1：横栏一行放不下 8 条，取最近 3 条 —— 一栏的高度由"下一步"那栏定，
 *  流水超过 3 条就该去抽屉里看全，横着铺 8 条只会把这一栏撑成一条灰带。 */
const flow = computed(() => {
  const t = props.task
  if (!t) return []
  return props.events.filter(e => e.cardId === t.id).slice(0, 3)
})
const flowTotal = computed(() => {
  const t = props.task
  if (!t) return 0
  return props.events.filter(e => e.cardId === t.id).length
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

  if (out.length === 0) out.push({ text: '该有的都有：挂了归属、定了截止、拆了子任务 —— 可以直接做。', tone: 'info' })
  return out.slice(0, 3)
})

function fmtTs(ts: number): string {
  const d = new Date(ts)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}
</script>

<template>
  <div class="fd-body">
    <!-- 空槽 / 非任务槽引导态：按用户拍板，选到空槽时**不静默回落到另一条任务」，
         ★N1 顺带修一个 V3.8.17 的缺陷：装资源卡/自由文本的槽位曾被一并显示成「这个位置还空着」，
         它明明不空。sourceType 决定这里说哪句话，而不是"有没有 task 对象"。 -->
    <div v-if="!task && emptySlot" class="fd-empty">
      <span class="fd-empty-ico">＋</span>
      <b class="fd-empty-t">这个位置还空着</b>
      <span class="fd-empty-s">点上方那一格的「＋ 从任务库选取」把它填上</span>
    </div>

    <div v-else-if="!task && slotKind === 'stale'" class="fd-empty">
      <span class="fd-empty-ico">⚠</span>
      <b class="fd-empty-t">源任务已失效</b>
      <span class="fd-empty-s">点上方那一格「重新选取」换一件</span>
    </div>

    <div v-else-if="!task && slotKind === 'nonTask'" class="fd-empty">
      <span class="fd-empty-ico">📦</span>
      <b class="fd-empty-t">这一格装的是卡片，不是任务</b>
      <span class="fd-empty-s">{{ slotText || '全貌只对任务展开 —— 双击卡片可看它自己的详情' }}</span>
    </div>

    <div v-else-if="!task && slotKind === 'text'" class="fd-empty">
      <span class="fd-empty-ico">✎</span>
      <b class="fd-empty-t">这一格是你自己写的一句话</b>
      <span class="fd-empty-s">{{ slotText || '自由文本不参与六层链 —— 要跟踪的话换成一条任务' }}</span>
    </div>

    <div v-else-if="!task" class="fd-empty">
      <span class="fd-empty-ico">☰</span>
      <b class="fd-empty-t">点上面任意一件，看它的全貌</b>
      <span class="fd-empty-s">单击选中 · 双击右侧滑出任务详情</span>
    </div>

    <template v-else>
      <!-- ★N1 三栏横排：② 属于哪 ｜ ⑤ 走过什么 ｜ ⑥ 下一步
           比例 1 : 1 : 1.6 —— 「下一步」是唯一要给结论的栏，给它最大宽度；
           另外两栏是事实性读数，窄栏 + 单行截断即可，不必跟它抢横向空间。 -->
      <div class="fd-cols">
        <section class="fd-col">
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

        <section class="fd-col">
          <div class="fd-sec-h"><span class="n">5</span><span class="t">走过什么</span>
            <span class="m">最近 {{ flow.length }}/{{ flowTotal }} 条</span></div>
          <ul v-if="flow.length" class="fd-flow">
            <li v-for="e in flow" :key="e.id">
              <span class="fd-flow-t">{{ fmtTs(e.ts) }}</span>
              <span class="fd-flow-a">{{ EVENT_ACT_LABEL[e.action] || e.action }}</span>
            </li>
          </ul>
          <p v-else class="fd-note">还没有相关记录 —— 做过一次就会出现在这里</p>
          <p v-if="flow.length && flowTotal > flow.length" class="fd-note">更早的 {{ flowTotal - flow.length }} 条在详情抽屉里</p>
        </section>

        <section class="fd-col fd-col-adv">
          <div class="fd-sec-h"><span class="n">6</span><span class="t">下一步</span><span class="m">本地判断 · 不调 AI</span></div>
          <ul class="fd-adv">
            <li v-for="(a, i) in advice" :key="i" :class="a.tone">{{ a.text }}</li>
          </ul>
        </section>
      </div>

      <!-- ★N1 子任务区：高度锁死 = 恰好 {{ SUB_VISIBLE_ROWS }} 条，超出在容器内上下滚动。
           为什么锁死：这一段是整条横条里唯一"数量不可控"的内容（子任务想写几条写几条），
           不锁死的话，某个任务挂 30 条子任务就会把下面三个卡位整块顶出屏。
           锁死后横条总高恒定，上面三栏与这一区的关系在任何任务下都一样。 -->
      <section class="fd-subs-sec">
        <div class="fd-sec-h">
          <span class="n">3</span><span class="t">要做什么</span>
          <span class="m">子任务 {{ subDone }}/{{ subTotal }} · 固定展示 {{ SUB_VISIBLE_ROWS }} 条，超出滚动</span>
        </div>
        <div class="fd-subs" :class="{ empty: !subTotal }">
          <template v-if="subTotal">
            <div v-for="st in subtasks" :key="st.id" class="fd-sub" :class="{ done: st.done }">
              <span class="fd-sub-box">{{ st.done ? '✓' : '' }}</span>
              <span class="fd-sub-t">{{ st.title }}</span>
              <!-- ★Subtask 模型里没有 priority 字段（只有父任务有）——
                   不在这里凭空造一个"看起来该有"的优先级标，宁可少一列也不显示不存在的数据。 -->
              <span class="fd-sub-meta">{{ st.done ? '已完成' : '待办' }}</span>
            </div>
          </template>
          <p v-else class="fd-note">没有子任务 —— 这一格下面会显示你要做的分步</p>
        </div>
      </section>

      <!-- 属性带：压在子任务区标题行右侧，不再单独占一行 -->
      <div class="fd-attrs">
        <span class="fd-attr">状态 <b>{{ STATUS_LABEL[task.status] }}</b></span>
        <span class="fd-attr">优先级 <b>{{ PRI_LABEL[task.priority] }}</b></span>
        <span class="fd-attr">成熟度 <b>{{ maturity }}</b></span>
        <span v-if="task.dueDate" class="fd-attr">截止 <b>{{ task.dueDate }}</b></span>
        <span v-if="task.estimatedMinutes" class="fd-attr">预估 <b>{{ task.estimatedMinutes }} 分钟</b></span>
        <span v-if="supports.length" class="fd-attr">支撑材料 <b>{{ supports.length }}</b></span>
        <span v-if="(task.tags || []).length" class="fd-attr">标签 <b>{{ (task.tags || []).join(' · ') }}</b></span>
      </div>
    </template>
  </div>
</template>

<style scoped>
.fd-body {
  /* ★N1 不再用 max-height + 整块内滚动：七层纵向堆叠已改为三栏横排，
     整块高度由「三栏 + 固定 4 条子任务区」自然决定，不设上限。
     旧的 max-height:620px 会把最后一栏（下一步）截掉一半 —— 那正是"选中项的关键结论看不见"。 */
  display: flex; flex-direction: column; gap: 12px; padding: 4px 2px 4px 0;
}
.fd-empty {
  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px;
  min-height: 160px; color: var(--text-3); text-align: center;
}
.fd-empty-ico {
  width: 40px; height: 40px; border-radius: 12px; display: grid; place-items: center;
  background: var(--surface-2); color: var(--text-4); font-size: 18px;
}
.fd-empty-t { font-size: var(--fs-body); color: var(--text-2); font-weight: 700; }
.fd-empty-s { font-size: var(--fs-caption); color: var(--text-4); max-width: 60ch; line-height: 1.7; }

/* ── 三栏横排 ── */
.fd-cols {
  display: grid;
  /* ★N1 比例 1 : 1 : 1.6 —— 「下一步」是唯一给结论的栏，给它最大宽度；
     「属于哪」与「走过什么」是事实性读数，单行截断即可，不必抢横向空间。 */
  grid-template-columns: 1fr 1fr 1.6fr;
  gap: 0;
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  background: var(--surface);
  overflow: hidden;
}
.fd-col {
  display: flex; flex-direction: column; gap: 7px;
  padding: 11px 14px;
  border-right: 1px solid var(--border);
  min-width: 0;
}
.fd-col:last-child { border-right: 0; }
.fd-col-adv { background: color-mix(in srgb, var(--accent) 4%, transparent); }

.fd-sec-h { display: flex; align-items: center; gap: 8px; }
.fd-sec-h .n {
  width: 17px; height: 17px; border-radius: 6px; background: var(--accent-light);
  color: var(--accent-ink); font-size: var(--fs-micro); font-weight: 700;
  display: grid; place-items: center; flex: none;
}
.fd-sec-h .t { font-size: var(--fs-caption); font-weight: 700; color: var(--text-2); }
.fd-sec-h .m { font-size: var(--fs-micro); color: var(--text-4); margin-left: auto; text-align: right; }

.fd-note { font-size: var(--fs-micro); color: var(--text-4); line-height: 1.6; }

.fd-chain { display: flex; align-items: baseline; gap: 9px; font-size: var(--fs-micro); min-width: 0; }
.fd-lv { flex: none; width: 54px; color: var(--text-4); }
.fd-cv { color: var(--text-2); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

.fd-flow { list-style: none; display: flex; flex-direction: column; gap: 3px; }
.fd-flow li { display: flex; gap: 10px; font-size: var(--fs-micro); color: var(--text-3); min-width: 0; }
.fd-flow-t { color: var(--text-4); flex: none; font-variant-numeric: tabular-nums; }
.fd-flow-a { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

.fd-adv { list-style: none; display: flex; flex-direction: column; gap: 5px; }
.fd-adv li {
  font-size: var(--fs-micro); line-height: 1.7; color: var(--text-2);
  padding: 5px 9px; border-radius: var(--radius-md); background: var(--surface-2);
  border-left: 2px solid var(--border-strong);
}
.fd-adv li.warn { border-left-color: var(--warning); color: var(--text); }

/* ── ③ 子任务区：固定高度 = SUB_VISIBLE_ROWS(4) × 35px = 140px，超出容器内滚动 ── */
.fd-subs-sec { display: flex; flex-direction: column; gap: 7px; }
.fd-subs {
  /* ★改条数时这里的 140px 必须同步改 SUB_VISIBLE_ROWS —— 两处是同一个数，
     写成两处是为了让 CSS 保持纯数值（不夹带 var 表达式），
     代价是必须手动同步，已在脚本侧常量处标注。 */
  height: 140px; overflow-y: auto; overscroll-behavior: contain;
  border: 1px solid var(--border); border-radius: var(--radius-md);
  background: var(--surface-2); padding: 0 10px;
  scrollbar-width: thin; scrollbar-color: var(--surface-3) transparent;
}
.fd-subs.empty { display: grid; place-items: center; }
.fd-subs::-webkit-scrollbar { width: 7px; }
.fd-subs::-webkit-scrollbar-track { background: transparent; }
.fd-subs::-webkit-scrollbar-thumb {
  background: var(--surface-3); border-radius: 9px;
  border: 2px solid transparent; background-clip: padding-box;
}
.fd-subs::-webkit-scrollbar-thumb:hover { background: var(--border-strong); background-clip: padding-box; }
.fd-sub {
  display: flex; align-items: center; gap: 9px;
  height: 35px; font-size: var(--fs-micro); color: var(--text-2);
  border-top: 1px dashed var(--border);
}
.fd-sub:first-child { border-top: 0; }
.fd-sub-box {
  width: 14px; height: 14px; border-radius: 4px; border: 1.4px solid var(--border-strong);
  flex: none; font-size: 9px; display: grid; place-items: center; color: var(--success);
}
.fd-sub.done { color: var(--text-4); }
.fd-sub.done .fd-sub-t { text-decoration: line-through; }
.fd-sub-t { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.fd-sub-meta { margin-left: auto; flex: none; color: var(--text-4); font-size: var(--fs-micro); }

.fd-attrs { display: flex; flex-wrap: wrap; gap: 6px; }
.fd-attr {
  font-size: var(--fs-micro); color: var(--text-3); background: var(--surface-2);
  border-radius: 999px; padding: 3px 9px;
}
.fd-attr b { color: var(--text); font-weight: 700; }
</style>