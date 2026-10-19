<!--
  V3.8.42 · P0-3 第二批 · 「使用手册」子域（自 GlobalSettings.vue 原样搬出）

  为什么它排在本批第一个：它是剩余 16 个子域里耦合最低的一个 ——
  `openManualTab` 是唯一外部依赖，且**只被这一处调用**（逐条 grep 过：宿主里 `gs-manual-open`
  与 `gs-empty*` 的模板引用也都只在本子域内），因此它可以整个随迁而宿主不留任何代理。
  ★这一批同时搬 changelog 与 about，但它们各自要把定义留在宿主或上提，见各自文件头说明。

  ★样式为何能整段搬走：`.gs-empty*` 四条与 `.gs-manual-open` 两条经 grep 确认**仅本子域使用**，
  而 `<style scoped>` 生成的属性选择器本就限定在本组件内 ⇒ 搬走不改变任何像素。
  唯一要小心的是 `--gs-*` 之类 CSS 变量与自定义元素标签，这两条本子域都没用到。

  ★判据为什么零改动：`helpers.cjs` 的设置页聚合读取层（`read('/newtab/views/GlobalSettings.vue')`
  会把本目录按文件名排序拼在宿主之后）已经就位，214 处读设置页正文的判据因此读到的总长度不变。
-->
<template>
  <div class="gs-panel">
    <div class="gs-page-header">
      <div class="gs-page-title"><Icon name="book" :size="13"/> 产品使用手册</div>
      <div class="gs-page-desc">速览 / 基础 / 方法 / 理念 / 附录 —— 五篇一次读完</div>
    </div>
    <div class="gs-card">
      <div class="gs-card-body gs-empty">
        <!-- ★V3.8.25（B1-a）：原来外层 div 写死 font-size:34px、内层 Icon 用 width/height 定尺寸，
             外层 font-size 对它无效，所以图标比旁边的正文还小。改成直接给 :size="34"，外层只留排版。 -->
        <div class="gs-empty-ico"><Icon name="book" :size="34"/></div>
        <div class="gs-empty-title">使用手册已升级为独立阅读页</div>
        <div class="gs-empty-desc">五篇结构：速览一页上手 › 基础篇 › 方法篇（认知增强方法论）› 理念篇（知源哲学与理论根基）› 附录（快捷键全表与数据安全）。点击下方按钮在新标签页打开，支持左侧目录锚点定位。</div>
        <button class="gs-manual-open" @click="openManualTab"><Icon name="book" :size="13"/> 打开使用手册（新标签页）</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router'
import Icon from '@/shared/components/Icon.vue'

/**
 * ★`openManualTab` 随迁而非 props 传入：它只被本子域调用（宿主已无其他引用），
 * 留在宿主反而要为一个纯展示页在宿主留一个只为传参而存在的函数。
 * 逻辑逐字照抄，含 chrome.tabs 与 router 两条回落分支（顺序未改）。
 */
const router = useRouter()
function openManualTab() {
  if (typeof chrome !== 'undefined' && chrome.runtime?.getURL) {
    chrome.tabs.create({ url: chrome.runtime.getURL('src/newtab/index.html') + '#/manual' })
  } else {
    router.push('/manual')
  }
}
</script>

<style src="./base.css"></style>

<style scoped>
/* ★以下三条逐字照抄宿主（唯一样式差异是 `.gs-manual-open:hover` 在宿主里被拆到
   `.gs-letter-actions` 之后，属排版位置而非内容 —— 合并到此处后规则顺序不变，仍是最后一条）。
   第一版曾按印象写成「outline + inline-flex」形态，实测与真样式完全不同
   （真值是 accent 实心按钮、无 inline-flex、无 gap）⇒ 记录在此：搬样式只能照抄，不能凭印象重写。 */
.gs-empty { display: flex; flex-direction: column; align-items: center; gap: 14px; padding: 40px 20px; text-align: center; }
.gs-empty-ico { line-height: 1; }
.gs-empty-title { font-size: var(--fs-title); font-weight: 600; color: var(--text); }
.gs-empty-desc { font-size: var(--fs-sub); color: var(--text-3); line-height: 1.8; max-width: 420px; }
.gs-manual-open { padding: 10px 22px; border-radius: var(--radius-sm); border: 1px solid var(--accent); background: var(--accent); color: #fff; font-size: var(--fs-body); font-weight: 600; cursor: pointer; font-family: inherit; transition: all var(--dur); }
.gs-manual-open:hover { background: var(--accent-hover); }
</style>