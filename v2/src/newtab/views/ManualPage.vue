<script setup lang="ts">
/**
 * 使用手册独立页（/manual，第廿一轮 Bug4）
 * 左目录锚点定位 + 右内容；富文本样式为非 scoped，v-html 内容可完整生效。
 * 入口：设置 → 使用手册（新标签页打开）。
 *
 * B7-e（H1 排版基线 / H2 目录锚点）：
 *   H1 —— 正文行宽 ≤68ch、标题走字阶令牌、代码与快捷键等宽；详见下方样式块内逐条备案。
 *   H2 —— 规范原文写「长文页**右缘** sticky 目录（或顶部折叠章目）」。本页目录本来就在**左缘**
 *        且已是 sticky + smooth ⇒ 方案已落地一半；真正缺的是另两件：
 *        ① **滚动联动**：原来只在「点目录」时点亮，鼠标滚轮翻页时目录不跟——长文里"定位靠滚动"
 *           正是被这一点打破的（规范现状栏的原话）。现用 IntersectionObserver 双向联动。
 *        ② **键盘可达**：目录项原来是 `<div @click>`，Tab 走不到、Enter 也按不动。
 *           改成真 `<button>`（原生可聚焦），顺带消掉一处 a11y-tab-audit 候选。
 */
import { ref, nextTick, onMounted, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import Icon from '@/shared/components/Icon.vue'
import { MANUAL, buildManualStandaloneHtml } from '../manual-data'

const router = useRouter()
const activeSec = ref(MANUAL[0]?.sections[0]?.id || '')
/** 当前视口内与目录项对应的 section id 集合（H2 滚动联动的判据） */
const visibleSecs = new Set<string>()
let io: IntersectionObserver | null = null

function go(id: string) {
  activeSec.value = id
  nextTick(() => document.getElementById('mn-' + id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
}
function back() {
  router.push('/settings?page=manual')
}
function downloadShare() {
  const blob = new Blob([buildManualStandaloneHtml()], { type: 'text/html;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = '知源调度台使用手册.html'
  a.click()
  URL.revokeObjectURL(url)
}

/**
 * H2：滚动时把目录高亮跟到当前章节。
 *
 * ★为什么用「可见集合 + 取最靠上那个」而不是 IntersectionObserver 回调里直接写 activeSec：
 *   回调触发顺序不等于阅读顺序，且一屏内常有 2~3 个 section 同时"露出边角"，谁最后回调谁赢——
 *   表现为快速滚动时目录高亮乱跳。改为：回调只**记集合**，高亮由 rAF 节流后从集合里挑 top 最小者，
 *   即"当前视口里最靠上的那一节"，与人的阅读直觉一致。
 */
function syncActiveFromScroll() {
  if (!visibleSecs.size) return
  let best = ''
  let bestTop = Infinity
  for (const id of visibleSecs) {
    const el = document.getElementById('mn-' + id)
    if (!el) continue
    const top = el.getBoundingClientRect().top
    if (top < bestTop) { bestTop = top; best = id }
  }
  if (best) activeSec.value = best
}

onMounted(() => {
  document.title = '使用手册 · 知源调度台'
  // 顶栏 52px + 章节 scroll-margin-top 76px：上边缘留 76px，正文不会被吸顶条盖住
  io = new IntersectionObserver(
    entries => {
      for (const e of entries) {
        const id = e.target.id.replace(/^mn-/, '')
        if (e.isIntersecting) visibleSecs.add(id)
        else visibleSecs.delete(id)
      }
      syncActiveFromScroll()
    },
    { rootMargin: '-76px 0px -55% 0px', threshold: 0 }
  )
  document.querySelectorAll('.mn-section').forEach(el => io!.observe(el))
})
onBeforeUnmount(() => { io?.disconnect(); io = null; visibleSecs.clear() })
</script>

<template>
  <div class="mn-page">
    <header class="mn-head">
      <button class="mn-back" @click="router.push('/settings')"><Icon name="arrowright" :size="13" class="mn-back-ico" />返回设置</button>
      <div class="mn-brand"><Icon name="book" :size="13"/> 知源调度台 · 使用手册 <span class="mn-ver">V3.8.42</span></div>
      <div class="mn-spacer" />
      <button class="mn-dl" @click="downloadShare"><Icon name="download" :size="13"/> 下载分享版</button>
    </header>
    <div class="mn-body">
      <nav class="mn-toc" aria-label="手册目录">
        <template v-for="part in MANUAL" :key="part.title">
          <div class="mn-part">{{ part.title }}</div>
          <button v-for="sec in part.sections" :key="sec.id" type="button" class="mn-item"
            :class="{ active: activeSec === sec.id }"
            :aria-current="activeSec === sec.id ? 'true' : undefined"
            @click="go(sec.id)">{{ sec.title }}</button>
        </template>
      </nav>
      <main class="mn-main">
        <template v-for="part in MANUAL" :key="part.title">
          <section v-for="sec in part.sections" :key="sec.id" :id="'mn-' + sec.id" class="mn-section">
            <div class="mn-sec-part">{{ part.title }}</div>
            <h2 class="mn-sec-title">{{ sec.title }}</h2>
            <div class="mn-content" v-html="sec.html"></div>
          </section>
        </template>
        <div class="mn-foot">知源调度台 · 从好奇出发，向源头求证</div>
      </main>
    </div>
  </div>
</template>

<style>
/* 手册页整体（含 v-html 内容样式）——本页样式不使用 scoped，保证 v-html 生效 */
.mn-page { min-height: 100vh; background: var(--bg); color: var(--text); }
.mn-head { position: sticky; top: 0; z-index: 10; height: 52px; display: flex; align-items: center; gap: 16px; padding: 0 24px; background: color-mix(in srgb, var(--surface) 88%, transparent); backdrop-filter: blur(12px); border-bottom: 1px solid var(--border); }
.mn-back { display: inline-flex; align-items: center; gap: 5px; padding: 5px 12px; border-radius: var(--radius-sm); border: 1px solid var(--border); background: var(--surface); color: var(--text-2); font-size: var(--fs-sub); cursor: pointer; font-family: inherit; }
.mn-back:hover { border-color: var(--accent); color: var(--accent); }
/* B1-c：返回箭头朝左（原内联 transform），抽类后不再写内联样式 */
.mn-back-ico { transform: rotate(180deg); }
.mn-brand { font-size: 14px; font-weight: 600; }
.mn-ver { font-size: var(--fs-caption); color: var(--text-3); font-weight: 500; margin-left: 6px; }
.mn-spacer { flex: 1; }
.mn-dl { padding: 5px 12px; border-radius: var(--radius-sm); border: 1px solid var(--border); background: var(--surface); color: var(--text-2); font-size: var(--fs-sub); cursor: pointer; font-family: inherit; }
.mn-dl:hover { border-color: var(--accent); color: var(--accent); }
.mn-body { display: flex; gap: 28px; max-width: 1440px; margin: 0 auto; padding: 36px 36px 80px; align-items: flex-start; }
.mn-toc { width: 224px; flex-shrink: 0; position: sticky; top: 76px; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); padding: 16px 10px; max-height: calc(100vh - 120px); overflow-y: auto; }
.mn-part { font-size: var(--fs-caption); font-weight: 700; color: var(--text-3); letter-spacing: .08em; padding: 14px 10px 6px; }
/* H2：目录项由 <div @click> 改真 <button>——原生可聚焦（Tab 可达、Enter/Space 可触发），
   因此要显式清掉浏览器默认的按钮外观与字体继承，否则会带进 UA 样式。
   命中项同时补 :focus-visible 环：键盘用户必须看得见自己在第几条上。 */
.mn-item { display: block; width: 100%; text-align: left; font-family: inherit; background: none; border: 0; padding: 7px 10px; border-radius: var(--radius-xs); font-size: var(--fs-body); color: var(--text-2); cursor: pointer; transition: all var(--dur-fast); border-left: 2px solid transparent; }
.mn-item:hover { background: var(--surface-3); color: var(--text); }
.mn-item:focus-visible { outline: 2px solid var(--accent); outline-offset: 1px; }
.mn-item.active { color: var(--accent-ink); background: var(--accent-light); border-left-color: var(--accent); font-weight: 600; }
.mn-main { flex: 1; min-width: 0; max-width: 880px; }
/* H1：发丝线分隔章节。原先各节是彼此独立的卡片盒（各自 border + 圆角 + 24px 间距），
   五篇读下来每节都"另起一个容器"，长文的连贯感被切碎。改为通栏发丝线 + 纯留白分隔：
   一条 1px 的线已经把层级说清楚了，盒子的重量是多余的。 */
.mn-section { border-top: 1px solid var(--border); padding: 32px 0 36px; scroll-margin-top: 76px; }
.mn-section:first-of-type { border-top: 0; padding-top: 0; }
.mn-sec-part { font-size: var(--fs-caption); font-weight: 700; color: var(--accent); letter-spacing: .1em; text-transform: uppercase; margin-bottom: 8px; }
/* H1：标题阶用 --fs-headline(17) 而非 --fs-display(22)。手册正文容器 880px 通栏，
   22px 标题在通栏里显得比正文重太多；而 22px 在本站是 --fs-display 的档位（首屏大数 / 品牌位），
   手册一屏有十几个 22px，等于把品牌位做成了正文标题。 */
.mn-sec-title { font-size: var(--fs-headline); font-weight: 600; letter-spacing: -0.01em; margin-bottom: 18px; }
.mn-foot { text-align: center; font-size: var(--fs-caption); color: var(--text-3); padding: 28px 0 8px; border-top: 1px solid var(--border); }

/* —— 内容富文本（v-html）—— */
/* H1：正文行宽 ≤68ch（与设置页更新日志 S5 同一口径）。880px 通栏下 14px 正文一行约 60 个汉字，
   眼睛从行尾扫回行首会迷路；限宽后落在每行约 34 字的舒适区。
   只限正文块，标题与分隔线继续通栏——它们是路标，不该被正文行宽截断。 */
.mn-content { font-size: var(--fs-body); color: var(--text-2); line-height: 1.8; max-width: 68ch; }
.mn-content p { margin: 8px 0; }
/* H1：段内小标题由 --fs-body(13) 提到 --fs-title(15)。原值与正文同号，只靠左边框区分——
   扫读时分不清"这是一段的标题"还是"这是一段的正文"。 */
.mn-content h4 { font-size: var(--fs-title); font-weight: 700; color: var(--text); line-height: var(--lh-title); margin: 20px 0 8px; padding-left: 9px; border-left: 3px solid var(--accent); }
.mn-content ul { margin: 6px 0; padding-left: 20px; }
.mn-content li { margin: 5px 0; }
.mn-content li b, .mn-content p b { color: var(--text); }
.mn-content strong { color: var(--accent); font-weight: 700; }
/* H1：代码与快捷键走等宽 + 同一字号档。原先 code 12px / kbd 11px 两档，
   而它们在同一段文字里并排出现（"在 <code>chrome://…</code> 按 <kbd>Ctrl+K</kbd>"）——
   字号不同会让并排的两个键看起来像不同层级。统一到 --fs-caption（kbd 原本的档）。 */
.mn-content code { font-family: var(--font-mono); background: var(--surface-3); border-radius: 4px; padding: 1px 6px; font-size: var(--fs-caption); color: var(--text-2); }
.mn-content kbd { font-family: var(--font-mono); background: var(--surface-3); border: 1px solid var(--border-strong); border-radius: 5px; padding: 1px 7px; font-size: var(--fs-caption); color: var(--text); margin: 0 2px; box-shadow: 0 1px 0 var(--border-strong); white-space: nowrap; }
/* 表格：窄窗下允许横向滚动而不是撑破版心（验收要求之一） */
.mn-content .mc-table { display: block; overflow-x: auto; max-width: 100%; width: 100%; border-collapse: collapse; margin: 10px 0; font-size: var(--fs-body); }
.mn-content .mc-table th { text-align: left; background: var(--surface-3); color: var(--text); font-weight: 600; padding: 7px 10px; border: 1px solid var(--border); }
.mn-content .mc-table td { padding: 7px 10px; border: 1px solid var(--border); color: var(--text-2); vertical-align: top; }
.mn-content .mc-table tr:hover td { background: var(--surface-2); }
.mn-content .mc-flow { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 10px; background: var(--surface-2); border: 1px dashed var(--border-strong); border-radius: 10px; padding: 10px 14px; margin: 10px 0; font-size: var(--fs-body); color: var(--text); }
.mn-content .mc-steps { display: flex; flex-direction: column; gap: 8px; margin: 10px 0; }
.mn-content .mc-step { display: flex; gap: 10px; align-items: flex-start; background: var(--surface-2); border-radius: 10px; padding: 9px 12px; font-size: var(--fs-body); color: var(--text-2); line-height: 1.7; }
/* ★序号圆牌改由独立类 .mc-n 承载，**不再用 b:first-child**。
   原选择器的匹配面比看上去宽得多：段内正文里任何**首个子元素**的 <b> 都会被命中
   （如 `<span>保存后<b>自动跑一次 AI 补全评审</b>…`），于是那一段被塞进 22px 见方的紫色圆牌里——
   实拍表现为「自动跑」三个字竖着断行、后面跟一个空牌。给序号一个自己的类，命中面才收得回来。 */
.mn-content .mc-n { flex-shrink: 0; width: 22px; height: 22px; border-radius: 7px; background: var(--accent); color: #fff; font-size: var(--fs-caption); display: flex; align-items: center; justify-content: center; font-weight: 700; margin-top: 1px; }
.mn-content .mc-tip { background: var(--accent-light); border-radius: 10px; padding: 10px 14px; margin: 12px 0; font-size: var(--fs-body); color: var(--text-2); line-height: 1.8; }
.mn-content .mc-warn { background: var(--tag-warn-bg); color: var(--tag-warn-text); border-radius: 10px; padding: 10px 14px; margin: 12px 0; font-size: var(--fs-body); line-height: 1.8; }
.mn-content .mc-quote { background: linear-gradient(135deg, var(--accent-light), color-mix(in srgb, var(--accent-light) 40%, var(--surface))); border-left: 3px solid var(--accent); border-radius: 0 12px 12px 0; padding: 14px 18px; margin: 12px 0; font-size: var(--fs-body); line-height: 2; color: var(--text); }
/* H3：本页自撰的一句"同源说明"（快捷键表由真源派生）。用 caption 档 + --text-3，
   它是注解不是正文，不该与手册内容抢层级。 */
.mn-content .mn-src { font-size: var(--fs-caption); color: var(--text-3); line-height: 1.7; margin: 8px 0 14px; }
.mn-content .mn-src b { color: var(--text-2); }

/* H2 / M6：窄窗回落。目录从"常驻左轨"改为顶部可折叠章目（规范允许的另一种方案），
   正文取消左右留白、章节发丝线继续通栏。 */
@media (max-width: 1024px) {
  .mn-head { padding: 0 16px; gap: 10px; }
  .mn-brand { font-size: var(--fs-body); }
  .mn-body { flex-direction: column; gap: 16px; padding: 16px 20px 60px; }
  .mn-main { max-width: 100%; }
  .mn-toc { width: 100%; position: static; max-height: none; padding: 12px 10px; }
  .mn-content { max-width: 100%; }
}
@media (max-width: 800px) {
  .mn-head { height: auto; flex-wrap: wrap; padding: 8px 12px; }
  .mn-back, .mn-dl { padding: 5px 9px; }
  .mn-body { padding: 12px 14px 48px; }
  .mn-content { font-size: var(--fs-sub); }
}
</style>
