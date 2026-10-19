/**
 * V3.8.42 · 一次性搬移脚本：把「重置与回滚」子域从宿主切到 settings/SettingsResetPanel.vue
 *
 * ★纪律：模板与样式一律**按行号从宿主切原文**，一个字符都不重打
 *   （上一轮连续两次凭印象写错 CSS，编译过、判据绿、只有像素知道）。
 *
 * 切的四段（宿主 GlobalSettings.vue 绝对行号）：
 *   模板  638-665   reset 面板
 *   模板  730-747   回滚确认弹窗（Teleport 到 body，与面板同子域，一起走）
 *   脚本  1519-1571 reset 逻辑（showResetModal / doReset / emptyRecycleBin / clearCache）
 *   样式  2494-2502 + 2526-2538  危险区 + 弹窗
 *
 * 用法：node scripts/archive/move-reset-subdomain.cjs [--dry]
 */
const fs = require('fs')
const path = require('path')

const VUE = path.resolve(__dirname, '../../src/newtab/views/GlobalSettings.vue')
const OUT = path.resolve(__dirname, '../../src/newtab/views/settings/SettingsResetPanel.vue')
const DRY = process.argv.includes('--dry')

/** [起, 止] 闭区间（绝对行号）→ 去宿主模板里的缩进后作为子组件正文 */
const TPL_PANEL = [638, 665]
const TPL_MODAL = [730, 747]
const CSS_DANGER = [2494, 2502]
const CSS_MODAL = [2526, 2538]

function main() {
  const raw = fs.readFileSync(VUE, 'utf8')
  const lines = raw.split('\n')

  const cut = (a, b) => lines.slice(a - 1, b).join('\n')
  /** 模板段统一左移 6 格（宿主在 <main> 内缩进 6 层，子组件根级应为 2） */
  const dedent = (s) => s.split('\n').map(l => l.startsWith('      ') ? l.slice(6) : l).join('\n')

  // 边界自检：段首必须是注释或元素/选择器，段尾必须闭合
  const guard = (name, a, b, expect) => {
    const head = lines[a - 1].trim()
    const tail = lines[b - 1].trim()
    if (!expect.some(e => head.startsWith(e))) throw new Error(`${name} 段首异常(${a})：${head.slice(0, 50)}`)
    if (!/(^|\s)\}\s*$|>\s*$|\/\s*$|\*\/\s*$/.test(tail)) throw new Error(`${name} 段尾未闭合(${b})：${tail.slice(0, 50)}`)
    console.log(`  ${name.padEnd(10)} ${a}-${b}  首「${head.slice(0, 26)}」尾「${tail.slice(-16)}」`)
  }
  console.log('边界核对：')
  guard('模板面板', ...TPL_PANEL, ['<!--', '<div'])
  guard('模板弹窗', ...TPL_MODAL, ['<!--', '<Teleport'])
  guard('样式危险区', ...CSS_DANGER, ['/*', '.gs-danger'])
  guard('样式弹窗', ...CSS_MODAL, ['/*', '.gs-'])

  /* ★面板段自带 `<div v-if="activePage === 'reset'" class="gs-panel">` 外层——
     这层壳正是拆分的接口（宿主用 v-if 控制挂载，子组件不该再判一次 activePage，
     否则同一条件写两处、且子组件会持有宿主的路由态）。这里**剥掉外壳**，只取内部，
     由脚本重新生成一个干净的 <div class="gs-panel"> 根。
     剥法：首行必须是那层壳、末行必须是它的闭合 `</div>`，否则说明切错了行 ⇒ 直接抛错。 */
  /* 段首可能是分隔注释（`<!-- ===== 重置与回滚 ===== -->`），跳过它再找外壳。 */
  const panelLines = lines.slice(TPL_PANEL[0] - 1, TPL_PANEL[1])
  const shellAt = panelLines.findIndex(l => /^\s*<div v-if="activePage === 'reset'" class="gs-panel">\s*$/.test(l))
  if (shellAt < 0) throw new Error(`面板段内找不到 v-if 外壳，首行：${panelLines[0].trim()}`)
  const body = panelLines.slice(shellAt + 1)
  const closeAt = body.map(l => l.trim()).lastIndexOf('</div>')
  if (closeAt < 0) throw new Error('面板段内找不到外壳闭合 </div>')
  /* 外壳闭合必须是本段最后一个非空行，否则说明段尾多切了别人的东西 */
  const after = body.slice(closeAt + 1).filter(l => l.trim() && !l.trim().startsWith('<!--'))
  if (after.length) throw new Error(`外壳闭合之后还有内容：${after[0].trim()}`)
  const tplPanel = dedent(body.slice(0, closeAt).join('\n'))
  const tplModal = dedent(cut(...TPL_MODAL))
  const css = cut(...CSS_DANGER) + '\n' + cut(...CSS_MODAL)
  const script = cut(1519, 1571)

  console.log(`\n模板面板 ${TPL_PANEL[1] - TPL_PANEL[0] + 1} 行 · 弹窗 ${TPL_MODAL[1] - TPL_MODAL[0] + 1} 行 · 脚本 53 行 · 样式 ${CSS_DANGER[1] - CSS_DANGER[0] + 1 + CSS_MODAL[1] - CSS_MODAL[0] + 2} 行`)
  if (DRY) {
    console.log('\n--dry 预览（模板面板前 6 行）--\n' + tplPanel.split('\n').slice(0, 6).join('\n'))
    console.log('\n--dry 预览（脚本首 6 行）--\n' + script.split('\n').slice(0, 6).join('\n'))
    return
  }

  const file = `<template>
  <div class="gs-panel">
${tplPanel.split('\n').join('\n  ')}
  </div>

${tplModal}
</template>

<script setup lang="ts">
/* V3.8.42 · P0-3 第三批：从 GlobalSettings.vue 原样搬出的「重置与回滚」子域。
   ★随迁的东西：回滚确认弹窗（Teleport 到 body）——它由本子域的状态驱动，
     留在宿主就得把 showResetModal 也留在宿主，两个文件互相拿对方的 ref，是拆分的失败形态。
   ★留在宿主的：store / router / useConfirm / clearHot / purge 等外部依赖一律**在本组件内直接引入**，
     因为它们都不是宿主私有状态（对比 about 子域：那批留宿主的是「订阅与生命周期」，性质不同）。
   ★样式两段一并搬进本组件的 scoped（危险区 9 行 + 弹窗 13 行），
     基类（.gs-card/.gs-btn/.gs-setting-row…）由共享的 settings/base.css 提供。
     ⚠ 不要再把基类抄一份进本组件——那份真源在 base.css，抄了就是两份都得改。 */
import Icon from '@/shared/components/Icon.vue'
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAppStore } from '../../stores/app'
import { createDefaultData } from '@/shared/storage/defaults'
import { clearHot } from '@/shared/storage/hotStats'
import { purgeCardsCompletely, recycledCardsOf } from '@/shared/storage/purge'
import { clearLinkCache } from '@/shared/ai/linkFetch'
import { reviseSnips } from '@/shared/ai/govern'
import { useConfirm } from '@/shared/components/confirm'
import { showToast } from '@/shared/components/toast'

const router = useRouter()
const store = useAppStore()

${script.split('\n').join('\n')}
</script>

<!-- 基类：.gs-card / .gs-btn / .gs-setting-row 等跨子域共享（V3.8.42 外提为全局表） -->
<style src="./base.css"></style>

<style scoped>
${css}
</style>
`
  fs.writeFileSync(OUT, file)
  console.log(`\n✔ 写入 ${path.relative(process.cwd(), OUT)}（${file.split('\n').length} 行）`)

  // 从宿主删掉这五段（从后往前，行号不漂），并在原位留下组件接线
  const drop = new Set([
    ...Array.from({ length: TPL_PANEL[1] - TPL_PANEL[0] + 1 }, (_, i) => TPL_PANEL[0] + i),
    ...Array.from({ length: TPL_MODAL[1] - TPL_MODAL[0] + 1 }, (_, i) => TPL_MODAL[0] + i),
    ...Array.from({ length: 1571 - 1519 + 1 }, (_, i) => 1519 + i),
    ...Array.from({ length: CSS_DANGER[1] - CSS_DANGER[0] + 1 }, (_, i) => CSS_DANGER[0] + i),
    ...Array.from({ length: CSS_MODAL[1] - CSS_MODAL[0] + 1 }, (_, i) => CSS_MODAL[0] + i),
  ])
  /* ★接线代码放回原位而不是追加到文件尾：位置本身有语义——
     reset 面板原本就排在 letter 与 extension 之间，追加到末尾会打乱设置页面板的视觉顺序，
     而这正是本项目纪律「在Order 里钉住序列」的同类要求。 */
  const WIRE = [
    '',
    '      <!-- V3.8.42 P0-3 第三批：「重置与回滚」子域（含回滚确认弹窗）已搬至 settings/SettingsResetPanel.vue -->',
    '      <SettingsResetPanel v-if="activePage === \'reset\'" />',
  ]
  const kept = []
  for (let i = 0; i < lines.length; i++) {
    if (drop.has(i + 1)) { if (i + 1 === TPL_PANEL[0]) kept.push(...WIRE); continue }
    kept.push(lines[i])
  }
  fs.writeFileSync(VUE, kept.join('\n'))
  console.log(`✔ 宿主删除 ${drop.size} 行并在原位接线：${lines.length} → ${kept.length}`)

  /* ★import 必须补，否则宿主编译期就找不到组件（而这类错误只在 build 暴露，不在回归链里）。 */
  /* ★自检必须查 **import 语句本身**，不能查组件名出现过没有——
     接线代码里刚写进模板的 `<SettingsResetPanel …>` 已经让 `includes('SettingsResetPanel')` 为真，
     于是 import 永远被跳过 ⇒ 模板引用了一个未定义的组件 ⇒ 页面整块不渲染（V3.8.42 实测踩到：
     实拍只报「标题空、panel=false」，看不出是缺 import）。 */
  const v2 = fs.readFileSync(VUE, 'utf8')
  const anchor = "import SettingsAboutPanel from './settings/SettingsAboutPanel.vue'"
  if (!v2.includes(anchor)) throw new Error('未找到 import 锚点')
  if (!v2.includes("import SettingsResetPanel from"))
    fs.writeFileSync(VUE, v2.replace(anchor, anchor + "\nimport SettingsResetPanel from './settings/SettingsResetPanel.vue'"))
  console.log('✔ 宿主补 import')
}

main()