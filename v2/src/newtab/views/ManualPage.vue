<script setup lang="ts">
/**
 * 使用手册独立页（/manual，第廿一轮 Bug4）
 * 左目录锚点定位 + 右内容；富文本样式为非 scoped，v-html 内容可完整生效。
 * 入口：设置 → 使用手册（新标签页打开）。
 */
import { ref, nextTick, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import Icon from '@/shared/components/Icon.vue'
import { MANUAL, buildManualStandaloneHtml } from '../manual-data'

const router = useRouter()
const activeSec = ref(MANUAL[0]?.sections[0]?.id || '')

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
onMounted(() => { document.title = '使用手册 · 知源调度台' })
</script>

<template>
  <div class="mn-page">
    <header class="mn-head">
      <button class="mn-back" @click="router.push('/settings')"><Icon name="arrowright" :size="13" style="transform: rotate(180deg)" />返回设置</button>
      <div class="mn-brand">📖 知源调度台 · 使用手册 <span class="mn-ver">V2.102.0</span></div>
      <div class="mn-spacer" />
      <button class="mn-dl" @click="downloadShare">⬇ 下载分享版</button>
    </header>
    <div class="mn-body">
      <aside class="mn-toc">
        <template v-for="part in MANUAL" :key="part.title">
          <div class="mn-part">{{ part.title }}</div>
          <div v-for="sec in part.sections" :key="sec.id" class="mn-item"
            :class="{ active: activeSec === sec.id }" @click="go(sec.id)">{{ sec.title }}</div>
        </template>
      </aside>
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
.mn-back { display: inline-flex; align-items: center; gap: 5px; padding: 5px 12px; border-radius: var(--radius-sm); border: 1px solid var(--border); background: var(--surface); color: var(--text-2); font-size: 12px; cursor: pointer; font-family: inherit; }
.mn-back:hover { border-color: var(--accent); color: var(--accent); }
.mn-brand { font-size: 14px; font-weight: 600; }
.mn-ver { font-size: 10.5px; color: var(--text-3); font-weight: 500; margin-left: 6px; }
.mn-spacer { flex: 1; }
.mn-dl { padding: 5px 12px; border-radius: var(--radius-sm); border: 1px solid var(--border); background: var(--surface); color: var(--text-2); font-size: 12px; cursor: pointer; font-family: inherit; }
.mn-dl:hover { border-color: var(--accent); color: var(--accent); }
.mn-body { display: flex; gap: 28px; max-width: 1120px; margin: 0 auto; padding: 36px 24px 80px; align-items: flex-start; }
.mn-toc { width: 224px; flex-shrink: 0; position: sticky; top: 76px; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); padding: 16px 10px; max-height: calc(100vh - 120px); overflow-y: auto; }
.mn-part { font-size: 10.5px; font-weight: 700; color: var(--text-3); letter-spacing: .08em; padding: 14px 10px 6px; }
.mn-item { padding: 7px 10px; border-radius: var(--radius-xs); font-size: 12.5px; color: var(--text-2); cursor: pointer; transition: all var(--dur-fast); border-left: 2px solid transparent; }
.mn-item:hover { background: var(--surface-3); color: var(--text); }
.mn-item.active { color: var(--accent); background: var(--accent-light); border-left-color: var(--accent); font-weight: 600; }
.mn-main { flex: 1; min-width: 0; max-width: 880px; }
.mn-section { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); padding: 36px 44px; margin-bottom: 24px; scroll-margin-top: 76px; }
.mn-sec-part { font-size: 10.5px; font-weight: 700; color: var(--accent); letter-spacing: .1em; text-transform: uppercase; margin-bottom: 8px; }
.mn-sec-title { font-size: 22px; font-weight: 600; letter-spacing: -0.02em; margin-bottom: 18px; }
.mn-foot { text-align: center; font-size: 11px; color: var(--text-4); padding: 20px 0 8px; }

/* —— 内容富文本（v-html）—— */
.mn-content { font-size: 14px; color: var(--text-2); line-height: 2.05; }
.mn-content p { margin: 8px 0; }
.mn-content h4 { font-size: 13.5px; font-weight: 700; color: var(--text); margin: 18px 0 8px; padding-left: 9px; border-left: 3px solid var(--accent); }
.mn-content ul { margin: 6px 0; padding-left: 20px; }
.mn-content li { margin: 5px 0; }
.mn-content li b, .mn-content p b { color: var(--text); }
.mn-content strong { color: var(--accent); font-weight: 700; }
.mn-content code { background: var(--surface-3); border-radius: 4px; padding: 1px 6px; font-size: 11.5px; color: var(--text-2); }
.mn-content kbd { background: var(--surface-3); border: 1px solid var(--border-strong); border-radius: 5px; padding: 1px 7px; font-family: inherit; font-size: 11px; color: var(--text); margin: 0 2px; box-shadow: 0 1px 0 var(--border-strong); white-space: nowrap; }
.mn-content .mc-flow { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 10px; background: var(--surface-2); border: 1px dashed var(--border-strong); border-radius: 10px; padding: 10px 14px; margin: 10px 0; font-size: 12.5px; color: var(--text); }
.mn-content .mc-steps { display: flex; flex-direction: column; gap: 8px; margin: 10px 0; }
.mn-content .mc-step { display: flex; gap: 10px; align-items: flex-start; background: var(--surface-2); border-radius: 10px; padding: 9px 12px; font-size: 12.5px; color: var(--text-2); line-height: 1.7; }
.mn-content .mc-step b:first-child { flex-shrink: 0; width: 22px; height: 22px; border-radius: 7px; background: var(--accent); color: #fff; font-size: 11px; display: flex; align-items: center; justify-content: center; font-weight: 700; margin-top: 1px; }
.mn-content .mc-tip { background: var(--accent-light); border-radius: 10px; padding: 10px 14px; margin: 12px 0; font-size: 12.5px; color: var(--text-2); line-height: 1.8; }
.mn-content .mc-warn { background: var(--tag-warn-bg); color: var(--tag-warn-text); border-radius: 10px; padding: 10px 14px; margin: 12px 0; font-size: 12.5px; line-height: 1.8; }
.mn-content .mc-quote { background: linear-gradient(135deg, var(--accent-light), color-mix(in srgb, var(--accent-light) 40%, var(--surface))); border-left: 3px solid var(--accent); border-radius: 0 12px 12px 0; padding: 14px 18px; margin: 12px 0; font-size: 13.5px; line-height: 2; color: var(--text); }
.mn-content .mc-table { width: 100%; border-collapse: collapse; margin: 10px 0; font-size: 12.5px; }
.mn-content .mc-table th { text-align: left; background: var(--surface-3); color: var(--text); font-weight: 600; padding: 7px 10px; border: 1px solid var(--border); }
.mn-content .mc-table td { padding: 7px 10px; border: 1px solid var(--border); color: var(--text-2); vertical-align: top; }
.mn-content .mc-table tr:hover td { background: var(--surface-2); }
</style>
