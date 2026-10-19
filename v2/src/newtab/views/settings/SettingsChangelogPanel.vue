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
        <div class="gs-cl-list">
          <!-- S5：当前版本置顶（CHANGELOG 本身倒序，「最新」自然在首；此处的置顶是对
               「数据顺序与展示顺序是两件事」的显式声明——将来若有人把数组改成正序，
               置顶不靠运气。徽章仍由 runtimeVersion 对照，不用数组下标。 -->
          <div v-for="e in orderedChangelog" :key="e.version" class="gs-cl-item" :class="{ current: e.version === runtimeVersion }">
            <div class="gs-cl-meta">
              <span class="gs-cl-ver">V{{ e.version }}</span>
              <span class="gs-cl-date">{{ e.date }}</span>
              <span v-if="e.version === runtimeVersion" class="gs-cl-now">当前版本</span>
            </div>
            <div class="gs-cl-title">{{ e.title }}</div>
            <!-- S5：三段式（新增 / 修复 / 优化）。kindGroupsOf 返回 null 的版本
                 （v2 时代单要点、标注缺失或脱节）走平铺列表，不硬造空段。 -->
            <template v-if="kindGroupsOf(e)">
              <div v-for="g in kindGroupsOf(e)" :key="g.kind" class="gs-cl-group">
                <div class="gs-cl-group-h"><span class="gs-cl-group-k">{{ g.label }}</span><span class="gs-cl-group-n">{{ g.items.length }}</span></div>
                <ul class="gs-cl-points"><li v-for="(p, i) in g.items" :key="i"><RichText :text="p" /></li></ul>
              </div>
            </template>
            <ul v-else class="gs-cl-points"><li v-for="(p, i) in e.points" :key="i"><RichText :text="p" /></li></ul>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { kindGroupsOf } from '../../changelog-data'
import Icon from '@/shared/components/Icon.vue'
import RichText from '../../components/RichText.vue'

/** 宿主传入：当前运行版本号（三子域共用，故留在宿主） */
defineProps<{ runtimeVersion: string; orderedChangelog: typeof import('../../changelog-data').CHANGELOG }>()
</script>

<style scoped>
/* ★本段 33 行**逐字程序化搬移**自宿主（自「产品更新日志」段首行注释起，至 `.gs-cl-group-n` 止），
   一行未改、一条注释未丢。为什么要程序化而不是手抄：这段里夹着 5 段 S5 设计理由注释
   （等宽版本号 / 日期对比度 / 68ch 行宽 / RichText 加粗 / 段头弱而不隐），
   手抄必漏注释，而**注释就是后续轮的判据锚点** ⇒ 搬移一律用脚本切原文，禁止重打。
   `.gs-cl-*` 全族经 grep 确认只被本子域使用，随迁不影响其他子域。 */
/* 产品更新日志（W5 / V3.8.5 · V3.8.38 S5 结构化）——时间线：左轨 + 圆点，当前版本整轨染 accent */
.gs-cl-list { position: relative; }
.gs-cl-item { border-left: 2px solid var(--border); padding: 0 0 22px 18px; position: relative; }
.gs-cl-item:last-child { border-left-color: transparent; padding-bottom: 0; }
.gs-cl-item::before { content: ''; position: absolute; left: -7px; top: 4px; width: 12px; height: 12px; border-radius: 50%; background: var(--surface-3); border: 2px solid var(--border-strong); }
.gs-cl-item.current { border-left-color: var(--accent); }
.gs-cl-item.current::before { background: var(--accent); border-color: var(--accent); }
.gs-cl-meta { display: flex; align-items: center; gap: 8px; margin-bottom: 4px; }
/* S5：版本号走等宽字体。版本号是一串要被逐位比对的字符（3.8.37 / 3.8.4 谁新谁旧），
   等宽下 8 与 3 的宽度一致、竖排时小数点自然对齐；比例字体下这些数字宽窄不一，
   扫一列版本号时找不到对齐线。 */
.gs-cl-ver { font-weight: 700; font-size: var(--fs-sub); color: var(--text); font-variant-numeric: tabular-nums; font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
/* S5：日期升到 --text-3。此前用 --text-4，在浅色主题下约 2:1（真机近乎隐形）——
   日期是"这个版本什么时候发的"这一层事实，不该弱到读不出来。降噪只动字号与间距，不动对比度。 */
.gs-cl-date { font-size: var(--fs-caption); color: var(--text-3); }
.gs-cl-now { font-size: var(--fs-micro); background: var(--accent-light); color: var(--accent-ink); border-radius: 99px; padding: 1px 8px; font-weight: 600; }
.gs-cl-title { font-size: var(--fs-body); font-weight: 600; color: var(--text); margin-bottom: 4px; }
/* S5：正文行宽 ≤68ch。设置页内容列宽 1100px，12px 正文铺满一行有近 90 个汉字，
   眼睛从行尾扫回行首会迷路；限宽后一行约 34 个汉字（中文按半角折算），落在可读区间。
   只限正文与标题，左轨继续通到卡片右缘——轨是时间轴的脊，不该被行宽截断。 */
.gs-cl-title, .gs-cl-points { max-width: 68ch; }
.gs-cl-points { margin: 0; padding-left: 18px; font-size: var(--fs-sub); color: var(--text-2); line-height: 1.75; }
.gs-cl-points li { margin-bottom: 6px; }
.gs-cl-points li:last-child { margin-bottom: 0; }
/* S5：要点里的 `**加粗**` 由 RichText 渲染成真加粗（此前星号原样显示给用户） */
.gs-cl-points b { color: var(--text); font-weight: 600; }
/* S5：变更分组（新增 / 修复 / 优化）。段头弱而不隐——它是扫读时的路标，
   用 caption 字号 + --text-2，不靠加粗抢眼（内容本身才是主角）。 */
.gs-cl-group { margin-top: 10px; }
.gs-cl-group:first-of-type { margin-top: 6px; }
.gs-cl-group-h { display: flex; align-items: center; gap: 6px; margin-bottom: 4px; }
.gs-cl-group-k { font-size: var(--fs-caption); font-weight: 600; color: var(--text-2); letter-spacing: var(--tracking-sm); }
.gs-cl-group-n { font-size: var(--fs-micro); color: var(--text-3); background: var(--surface-3); border-radius: 99px; padding: 0 6px; line-height: var(--lh-micro); }
</style>
