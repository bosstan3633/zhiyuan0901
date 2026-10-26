<!--
  V3.8.42 · P0-3 第二批 · 「产品更新日志」子域（自 GlobalSettings.vue 原样搬出）

  ★为什么 `runtimeVersion` 与 `orderedChangelog` 走 props 而不随迁：
  两者都定义在宿主，且 `runtimeVersion` 被 changelog / about / extension **三个子域共用**
  （逐条 grep 过），`orderedChangelog` 又依赖它。
  按纪律「只有当单个子域能独立讲清、且有独立改动理由时才拆」——把它抽成一个共享模块是对的，
  但那是**另一个决定**，不该藏在一次搬移里（会让评审者看不出这是共享符号而非本子域私有）。
  ⇒ 本批保持定义留宿主、props 传入；「是否上提为 settings/shared.ts」留作独立一笔。
-->
<template>
  <div class="gs-panel">
    <div class="gs-page-header">
      <div class="gs-page-title"><Icon name="clock" :size="13"/> 产品更新日志</div>
      <div class="gs-page-desc">每个版本的发版时间与功能要点——看看这个产品是怎么一步步长成今天这样的</div>
    </div>
    <div class="gs-card">
      <div class="gs-card-body">
        <div class="gs-cl-shell">
          <nav class="gs-cl-dir" aria-label="更新日志版本目录">
            <div class="gs-cl-dir-h">
              <b>版本目录</b>
              <span>{{ orderedChangelog.length }} 个版本</span>
            </div>
            <div class="gs-cl-dir-list">
              <button v-for="e in orderedChangelog" :key="'nav-' + e.version" type="button"
                class="gs-cl-dir-item" :class="{ current: e.version === runtimeVersion, active: activeVersion === e.version }"
                :aria-current="activeVersion === e.version ? 'true' : undefined"
                @click="jumpTo(e.version)">
                <span class="gs-cl-dir-dot" aria-hidden="true"></span>
                <span class="gs-cl-dir-text"><b>V{{ e.version }}</b><small>{{ e.date }}</small></span>
                <span v-if="e.version === runtimeVersion" class="gs-cl-dir-now">当前</span>
              </button>
            </div>
          </nav>
          <div ref="contentRef" class="gs-cl-list" @scroll="onScroll">
          <!-- S5：当前版本置顶（CHANGELOG 本身倒序，「最新」自然在首；此处的置顶是对
               「数据顺序与展示顺序是两件事」的显式声明——将来若有人把数组改成正序，
               置顶不靠运气。徽章仍由 runtimeVersion 对照，不用数组下标。 -->
          <article v-for="e in orderedChangelog" :id="anchorOf(e.version)" :key="e.version" class="gs-cl-item"
            :class="{ current: e.version === runtimeVersion, active: activeVersion === e.version }"
            :data-version="e.version">
            <header class="gs-cl-entry-head">
              <div class="gs-cl-meta">
                <span class="gs-cl-ver">V{{ e.version }}</span>
                <span class="gs-cl-date">{{ e.date }}</span>
                <span v-if="e.version === runtimeVersion" class="gs-cl-now">当前版本</span>
              </div>
              <div class="gs-cl-title">{{ e.title }}</div>
            </header>
            <!-- V3.9.14：版本内分组回到单列并两端对齐。
                 上版双列在短文本下反而把右侧掏空；单列铺满正文列，长段落用两端对齐
                 维持稳定阅读边界，不再留下整列空白。 -->
            <div class="gs-cl-entry-body">
              <template v-if="kindGroupsOf(e)">
                <div v-for="g in kindGroupsOf(e)" :key="g.kind" class="gs-cl-group">
                  <div class="gs-cl-group-h"><span class="gs-cl-group-k">{{ g.label }}</span><span class="gs-cl-group-n">{{ g.items.length }}</span></div>
                  <ul class="gs-cl-points"><li v-for="(p, i) in g.items" :key="i"><RichText :text="p" /></li></ul>
                </div>
              </template>
              <ul v-else class="gs-cl-points gs-cl-points-flat"><li v-for="(p, i) in e.points" :key="i"><RichText :text="p" /></li></ul>
            </div>
          </article>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { kindGroupsOf } from '../../changelog-data'
import Icon from '@/shared/components/Icon.vue'
import RichText from '../../components/RichText.vue'

/** 宿主传入：当前运行版本号（三子域共用，故留在宿主） */
const props = defineProps<{ runtimeVersion: string; orderedChangelog: typeof import('../../changelog-data').CHANGELOG }>()
const contentRef = ref<HTMLElement | null>(null)
const activeVersion = ref(props.runtimeVersion)
let scrollRaf = 0
let jumpLock = 0
let jumpTimer: ReturnType<typeof setTimeout> | undefined
let pendingJumpVersion = ''
let pendingJumpTop = 0
let jumpSettled = false

const anchorOf = (version: string): string => `cl-v-${version.replace(/\./g, '-')}`
function isPendingJumpAligned(): boolean {
  const root = contentRef.value
  if (!root || !pendingJumpVersion) return false
  return Math.abs(root.scrollTop - pendingJumpTop) <= 3
}
/**
 * V3.9.21：平滑滚动可能超过 900ms（184 个版本时尤其明显）。
 * 锁过期后最后一个中间帧会把高亮改回旧版本，而目标已对齐、后续没有滚动事件纠正。
 * 用 scrollend 作为主信号，再加一个超时兜底；两者都只释放一次。
 */
function settleJump(): void {
  if (jumpTimer !== undefined) {
    clearTimeout(jumpTimer)
    jumpTimer = undefined
  }
  contentRef.value?.removeEventListener('scrollend', settleJump)
  jumpLock = 0
  jumpSettled = true
  /* ★V3.9.21：scrollend 后先等一帧再按位置同步。Chrome 在平滑滚动结束时
     会再落一个 scroll 事件；若这里立刻 sync，下一帧仍可能把 active 改回
     动画起点。锁定释放与位置同步分两帧，才是“落定后”的真实顺序。
     目标仍对齐时保留点击版本：短条目的下一版本可能已经进入探针线，
     单纯按位置同步会把用户刚点的版本抢走。 */
  requestAnimationFrame(() => {
    if (pendingJumpVersion && isPendingJumpAligned()) {
      activeVersion.value = pendingJumpVersion
      return
    }
    pendingJumpVersion = ''
    syncActiveFromScroll()
  })
}
function jumpTo(version: string): void {
  const root = contentRef.value
  const target = root?.querySelector<HTMLElement>(`[data-version="${version}"]`)
  if (!root || !target) return
  if (jumpTimer !== undefined) {
    clearTimeout(jumpTimer)
    jumpTimer = undefined
  }
  root.removeEventListener('scrollend', settleJump)
  activeVersion.value = version
  pendingJumpVersion = version
  pendingJumpTop = Math.max(0, target.offsetTop - 12)
  jumpSettled = false
  // Smooth scrolling emits many intermediate positions. Keep the clicked
  // version selected until the target settles instead of letting the
  // previous article reclaim the highlight mid-flight.
  jumpLock = Date.now() + 900
  // `.gs-cl-list` is the scroll container and `position: relative`; article offsetTop
  // is already relative to it. Subtracting root.offsetTop double-counts the offset.
  root.scrollTo({ top: pendingJumpTop, behavior: 'smooth' })
  root.addEventListener('scrollend', settleJump, { once: true })
  jumpTimer = setTimeout(settleJump, 1800)
}
function syncActiveFromScroll(): void {
  const root = contentRef.value
  if (!root) return
  if (Date.now() < jumpLock) return
  if (pendingJumpVersion && jumpSettled) {
    if (isPendingJumpAligned()) {
      activeVersion.value = pendingJumpVersion
      return
    }
    pendingJumpVersion = ''
  }
  // The oldest entry is often shorter than the viewport. At the physical
  // bottom there may be no article crossing the probe line, so treat the
  // bottom position as an explicit selection of the last entry.
  const atBottom = root.scrollTop + root.clientHeight >= root.scrollHeight - 2
  if (atBottom) {
    const last = root.querySelector<HTMLElement>('.gs-cl-item:last-child')
    if (last?.dataset.version) {
      activeVersion.value = last.dataset.version
      return
    }
  }
  const rows = [...root.querySelectorAll<HTMLElement>('.gs-cl-item')]
  if (!rows.length) return
  const line = root.getBoundingClientRect().top + Math.min(160, root.clientHeight * 0.28)
  let hit = rows[0]
  for (const row of rows) {
    if (row.getBoundingClientRect().top <= line) hit = row
    else break
  }
  activeVersion.value = hit.dataset.version || activeVersion.value
}
function onScroll(): void {
  cancelAnimationFrame(scrollRaf)
  scrollRaf = requestAnimationFrame(() => {
    // Ignore animation frames caused by the programmatic jump, but never
    // extend the lock from scroll itself: a fast user scroll during the
    // smooth animation would otherwise suppress highlight updates forever.
    if (Date.now() < jumpLock) return
    if (pendingJumpVersion && !jumpSettled) return
    syncActiveFromScroll()
  })
}
watch(() => props.runtimeVersion, v => { activeVersion.value = v })
// One source of truth: the scroll position. An observer can keep the previous
// tall article "visible" while the clicked target is aligned at the top, which
// overwrites the user's selection with a different version.
onMounted(() => { void nextTick(syncActiveFromScroll) })
onUnmounted(() => {
  cancelAnimationFrame(scrollRaf)
  if (jumpTimer !== undefined) {
    clearTimeout(jumpTimer)
    jumpTimer = undefined
  }
  contentRef.value?.removeEventListener('scrollend', settleJump)
  pendingJumpVersion = ''
})
</script>

<style src="./base.css"></style>

<style scoped>
/* ★本段 33 行**逐字程序化搬移**自宿主（自「产品更新日志」段首行注释起，至 `.gs-cl-group-n` 止），
   一行未改、一条注释未丢。为什么要程序化而不是手抄：这段里夹着 5 段 S5 设计理由注释
   （等宽版本号 / 日期对比度 / 68ch 行宽 / RichText 加粗 / 段头弱而不隐），
   手抄必漏注释，而**注释就是后续轮的判据锚点** ⇒ 搬移一律用脚本切原文，禁止重打。
   `.gs-cl-*` 全族经 grep 确认只被本子域使用，随迁不影响其他子域。 */
/* 产品更新日志（W5 / V3.8.5 · V3.8.38 S5 结构化 · V3.9.11 目录化）
   左侧是版本线与可点击目录，右侧是内容区；左侧随内容高亮，右侧独立滚动，长历史不把页面拉成一条线。 */
.gs-cl-shell { display: grid; grid-template-columns: 190px minmax(0, 1fr); gap: 32px; align-items: start; }
.gs-cl-dir { position: sticky; top: 12px; max-height: min(72vh, 720px); display: flex; flex-direction: column; min-height: 0; }
.gs-cl-dir-h { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; padding: 4px 10px 9px; border-bottom: 1px solid var(--border); }
.gs-cl-dir-h b { color: var(--text); font-size: var(--fs-caption); letter-spacing: var(--tracking-sm); }
.gs-cl-dir-h span { color: var(--text-3); font-size: var(--fs-micro); white-space: nowrap; }
.gs-cl-dir-list { min-height: 0; overflow: auto; padding: 7px 0 2px; border-left: 2px solid var(--border); }
.gs-cl-dir-item { position: relative; width: 100%; min-height: 44px; display: flex; align-items: center; gap: 8px; margin: 0; padding: 5px 8px 5px 12px; border: 0; background: transparent; color: var(--text-3); text-align: left; font: inherit; cursor: pointer; scroll-margin-block: 8px; }
.gs-cl-dir-item:hover { background: var(--surface-2); color: var(--text-2); }
.gs-cl-dir-item:focus-visible { outline: 2px solid var(--accent); outline-offset: -2px; }
.gs-cl-dir-item.active { scroll-margin-block: 8px; }
.gs-cl-dir-dot { position: absolute; left: -6px; width: 10px; height: 10px; border-radius: 50%; background: var(--surface-3); border: 2px solid var(--border-strong); }
.gs-cl-dir-item.current .gs-cl-dir-dot { background: var(--accent); border-color: var(--accent); }
.gs-cl-dir-item.active { background: var(--accent-light); color: var(--accent-ink); }
.gs-cl-dir-item.active .gs-cl-dir-dot { box-shadow: 0 0 0 3px var(--accent-glow); }
.gs-cl-dir-text { min-width: 0; display: flex; flex-direction: column; gap: 1px; }
.gs-cl-dir-text b { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: var(--fs-caption); color: var(--text-2); }
.gs-cl-dir-text small { font-size: var(--fs-micro); color: var(--text-3); }
.gs-cl-dir-item.active .gs-cl-dir-text b { color: var(--accent-ink); }
.gs-cl-dir-now { margin-left: auto; flex: none; padding: 1px 5px; border-radius: 99px; background: var(--surface); color: var(--accent-ink); font-size: var(--fs-micro); }
.gs-cl-list { position: relative; min-width: 0; max-height: min(72vh, 720px); overflow: auto; scroll-behavior: smooth; padding: 2px 10px 8px 18px; scrollbar-gutter: stable; }
.gs-cl-item { border-left: 2px solid var(--border); padding: 0 0 24px 18px; position: relative; scroll-margin-top: 16px; }
.gs-cl-item:last-child { border-left-color: transparent; padding-bottom: 6px; }
.gs-cl-item::before { content: ''; position: absolute; left: -7px; top: 4px; width: 12px; height: 12px; border-radius: 50%; background: var(--surface-3); border: 2px solid var(--border-strong); }
.gs-cl-item.current { border-left-color: var(--accent); }
.gs-cl-item.current::before { background: var(--accent); border-color: var(--accent); }
.gs-cl-entry-head { min-width: 0; margin-bottom: 10px; }
.gs-cl-meta { display: flex; align-items: center; gap: 8px; margin-bottom: 4px; }
/* S5：版本号走等宽字体。版本号是一串要被逐位比对的字符（3.8.37 / 3.8.4 谁新谁旧），
   等宽下 8 与 3 的宽度一致、竖排时小数点自然对齐；比例字体下这些数字宽窄不一，
   扫一列版本号时找不到对齐线。 */
.gs-cl-ver { font-weight: 700; font-size: var(--fs-sub); color: var(--text); font-variant-numeric: tabular-nums; font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
/* S5：日期升到 --text-3。此前用 --text-4，在浅色主题下约 2:1（真机近乎隐形）——
   日期是"这个版本什么时候发的"这一层事实，不该弱到读不出来。降噪只动字号与间距，不动对比度。 */
.gs-cl-date { font-size: var(--fs-caption); color: var(--text-3); }
.gs-cl-now { font-size: var(--fs-micro); background: var(--accent-light); color: var(--accent-ink); border-radius: 99px; padding: 1px 8px; font-weight: 600; }
.gs-cl-title { max-width: none; font-size: var(--fs-body); font-weight: 600; color: var(--text); }
.gs-cl-entry-body { display: flex; flex-direction: column; gap: 12px; align-items: stretch; width: 100%; }
/* V3.9.14：版本正文跟内容列同宽，靠两端对齐与 1.72 行高维持阅读节奏。
   左轨继续通到卡片右缘——轨是时间轴的脊，不该被行宽截断。 */
.gs-cl-points { min-width: 0; max-width: none; margin: 0; padding-left: 17px; font-size: var(--fs-sub); color: var(--text-2); line-height: 1.72; text-align: justify; }
.gs-cl-points-flat { max-width: none; }
.gs-cl-points li { margin-bottom: 6px; }
.gs-cl-points li:last-child { margin-bottom: 0; }
/* S5：要点里的 `**加粗**` 由 RichText 渲染成真加粗（此前星号原样显示给用户） */
.gs-cl-points b { color: var(--text); font-weight: 600; }
/* S5：变更分组（新增 / 修复 / 优化）。段头弱而不隐——它是扫读时的路标，
   用 caption 字号 + --text-2，不靠加粗抢眼（内容本身才是主角）。 */
.gs-cl-group { min-width: 0; width: 100%; margin: 0; }
.gs-cl-group-h { display: flex; align-items: center; gap: 6px; margin-bottom: 4px; }
.gs-cl-group-k { font-size: var(--fs-caption); font-weight: 600; color: var(--text-2); letter-spacing: var(--tracking-sm); }
.gs-cl-group-n { font-size: var(--fs-micro); color: var(--text-3); background: var(--surface-3); border-radius: 99px; padding: 0 6px; line-height: var(--lh-micro); }
@media (max-width: 720px) {
  .gs-cl-shell { grid-template-columns: 1fr; gap: 12px; }
  .gs-cl-dir { position: static; max-height: none; }
  .gs-cl-dir-list { max-height: 190px; }
  .gs-cl-list { max-height: none; overflow: visible; padding-left: 14px; }
}
</style>
