<template>
  <div class="gs-panel">
    <div class="gs-page-header">
      <div class="gs-page-title"><Icon name="mail" :size="13"/> 写给用户的一封信</div>
      <div class="gs-page-desc">donge 哥 · 致每一位知源调度台的同行者</div>
    </div>
    <div class="gs-card">
      <div class="gs-card-body gs-letter" v-html="LETTER_HTML"></div>
    </div>
    <div class="gs-letter-actions">
      <button class="gs-manual-open" @click="downloadLetter"><Icon name="download" :size="13"/> 下载这封信（分享 HTML）</button>
    </div>
  </div>
</template>

<script setup lang="ts">
/* V3.8.42 · P0-3 第一批：从 GlobalSettings.vue 搬出的「写给用户的一封信」子域。
   选它做第一批的理由：全页 18 个子域里耦合最轻的一个——数据侧本来就在外部（letter-data.ts），
   逻辑侧只有一个 8 行的下载函数，不碰 store / AI / 导入导出任何状态。
   ★随迁的样式：`.gs-letter*` 三条本批一并搬进本组件的 scoped 样式，宿主不残留
   （★纪律：样式跟着宿主走，否则拆完之后样式留在 438 行的宿主样式段里，欠账原地不动）。 */
import Icon from '@/shared/components/Icon.vue'
import { LETTER_HTML, buildLetterStandaloneHtml } from '../../letter-data'

function downloadLetter() {
  const blob = new Blob([buildLetterStandaloneHtml()], { type: 'text/html;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = '写给用户的一封信.html'
  a.click()
  URL.revokeObjectURL(url)
}
</script>

<style src="./base.css"></style>

<style scoped>
/* 信纸排版（第廿九轮：明显留白——行距 2.75 / 段距 32px / 640px 窄栏 / 落款前 72px，给读者呼吸感） */
.gs-letter { max-width: 640px; margin: 0 auto; padding: 80px 64px !important; background: var(--surface); font-family: "Songti SC", "Noto Serif SC", "SimSun", Georgia, serif; }
.gs-letter .lp-saluta { font-size: var(--fs-title); margin-bottom: 44px; color: var(--text); }
.gs-letter .lp-body p { font-size: var(--fs-body); line-height: 3.1; margin: 0 0 40px; text-align: justify; color: var(--text-2); }
.gs-letter .lp-body b { color: var(--text); }
.gs-letter .lp-sign { margin-top: 84px; text-align: right; font-size: var(--fs-body); line-height: 2.2; color: var(--text-3); }
.gs-letter .lp-sign b { font-size: 14px; color: var(--text); }
.gs-letter .lp-date { font-size: var(--fs-caption); color: var(--text-4); margin-top: 10px; letter-spacing: .05em; }
/* 第卅轮：模块化分节——lp-h 节头（粗体转折句独立成节） lp-turn 节内停顿（短句）/ lp-creed 信念行；R49 加大留白 */
.gs-letter .lp-body p.lp-h { margin: 68px 0 40px; font-size: var(--fs-title); color: var(--text); }
.gs-letter .lp-body p.lp-turn { margin: 24px 0 40px; color: var(--text); }
.gs-letter .lp-body p.lp-creed { margin: 56px 0 0; letter-spacing: .08em; color: var(--text); font-weight: 600; }
.gs-letter-actions { text-align: center; margin-top: 14px; }
.gs-manual-open:hover { background: var(--accent-hover); }
</style>
