/**
 * V3.8.42 · 一次性搬移脚本：把「扩展设置」子域从宿主切到 settings/SettingsExtensionPanel.vue
 *
 * ★与 reset 同批，同样按绝对行号切原文，不重打一个字符。
 *
 * 切的三段（宿主 GlobalSettings.vue 绝对行号）：
 *   模板  642-687   extension 面板（含首行分隔注释与 v-if 外壳，外壳剥掉由宿主接管）
 *   脚本  1478-1490 抓取偏好（capturePref / persistCapturePref / chrome.storage 读回）
 *
 * 留在宿主的两个符号（**必须走 props，不能各自复制一份**）：
 *   runtimeVersion  三子域共用（changelog / about 也在用）
 *   shortcutsUrl    shortcuts 子域也在用（模板里两处 chrome://extensions/shortcuts 链接）
 *   ★教训（reset 那次刚踩过 import 自检的坑）：本脚本的自检一律查 **import 语句本身**，
 *     不查组件名出现过没有——模板接线里已经含组件名，用名字判会永远为真而跳过补 import。
 *
 * 用法：node scripts/archive/move-extension-subdomain.cjs [--dry]
 */
const fs = require('fs')
const path = require('path')

const VUE = path.resolve(__dirname, '../../src/newtab/views/GlobalSettings.vue')
const OUT = path.resolve(__dirname, '../../src/newtab/views/settings/SettingsExtensionPanel.vue')
const DRY = process.argv.includes('--dry')

const TPL = [642, 687]
const SCRIPT = [1478, 1490]

function main() {
  const lines = fs.readFileSync(VUE, 'utf8').split('\n')

  const guard = (name, a, b, expect) => {
    const head = lines[a - 1].trim(), tail = lines[b - 1].trim()
    if (!expect.some(e => head.startsWith(e))) throw new Error(`${name} 段首异常(${a})：${head.slice(0, 50)}`)
    if (!/(^|\s)\}\s*$|>\s*$|\/\s*$/.test(tail)) throw new Error(`${name} 段尾未闭合(${b})：${tail.slice(0, 50)}`)
    console.log(`  ${name.padEnd(8)} ${a}-${b}  首「${head.slice(0, 24)}」尾「${tail.slice(-14)}」`)
  }
  console.log('边界核对：')
  guard('模板', ...TPL, ['<!--', '<div'])
  guard('脚本', ...SCRIPT, ['//', 'const', 'function', '}', 'if', ' '])

  /* 剥 v-if 外壳（同 reset） */
  const tplLines = lines.slice(TPL[0] - 1, TPL[1])
  const shellAt = tplLines.findIndex(l => /^\s*<div v-if="activePage === 'extension'" class="gs-panel">\s*$/.test(l))
  if (shellAt < 0) throw new Error(`模板段内找不到 v-if 外壳，首行：${tplLines[0].trim()}`)
  const body = tplLines.slice(shellAt + 1)
  const closeAt = body.map(l => l.trim()).lastIndexOf('</div>')
  if (closeAt < 0) throw new Error('模板段内找不到外壳闭合 </div>')
  const after = body.slice(closeAt + 1).filter(l => l.trim() && !l.trim().startsWith('<!--'))
  if (after.length) throw new Error(`外壳闭合之后还有内容：${after[0].trim()}`)
  const dedent = s => s.split('\n').map(l => l.startsWith('      ') ? l.slice(6) : l).join('\n')
  const tpl = dedent(body.slice(0, closeAt).join('\n'))

  const script = lines.slice(SCRIPT[0] - 1, SCRIPT[1]).join('\n')
  console.log(`\n模板 ${closeAt} 行 · 脚本 ${SCRIPT[1] - SCRIPT[0] + 1} 行`)
  if (DRY) {
    console.log('\n--dry 模板前 5 行--\n' + tpl.split('\n').slice(0, 5).join('\n'))
    console.log('\n--dry 脚本全部--\n' + script)
    return
  }

  const file = `<template>
  <div class="gs-panel">
${tpl.split('\n').join('\n  ')}
  </div>
</template>

<script setup lang="ts">
/* V3.8.42 · P0-3 第三批：从 GlobalSettings.vue 原样搬出的「扩展设置」子域。
   ★props 而非各自复制：runtimeVersion 三子域共用（changelog/about 也在用），
     shortcutsUrl 被 shortcuts 子域的两处链接共用——复制一份就是两处都得改的隐患。
   ★抓取偏好（capturePref）随迁：它只服务本子域的「自动取文件夹名」开关，
     留在宿主就得为一个开关专设一条 props 通道（关于 shared 也只有本组件写）。
   ★样式：本子域**没有私有样式**——状态徽章 / 按键帽 / 快捷键链接都与 Airtable、快捷键子域共用，
     已随第三批并入共享基类 settings/base.css（全局表）。 */
import Icon from '@/shared/components/Icon.vue'
import { reactive } from 'vue'
import { K } from '@/shared/storage/keys'
import { showToast } from '@/shared/components/toast'

defineProps<{
  runtimeVersion: string
  shortcutsUrl: string
}>()

${script}
</script>

<!-- 基类：.gs-card / .gs-setting-row / .gs-status-badge / .gs-keycap…（V3.8.42 外提为全局表） -->
<style src="./base.css"></style>
`
  fs.writeFileSync(OUT, file)
  console.log(`\n✔ 写入 ${path.relative(process.cwd(), OUT)}（${file.split('\n').length} 行）`)

  /* 宿主：删两段 + 原位接线 + 补 import */
  const drop = new Set()
  for (let i = TPL[0]; i <= TPL[1]; i++) drop.add(i)
  for (let i = SCRIPT[0]; i <= SCRIPT[1]; i++) drop.add(i)
  const WIRE = [
    '',
    '      <!-- V3.8.42 P0-3 第三批：「扩展设置」子域已搬至 settings/SettingsExtensionPanel.vue -->',
    '      <SettingsExtensionPanel v-if="activePage === \'extension\'"',
    '        :runtime-version="runtimeVersion" :shortcuts-url="shortcutsUrl" />',
  ]
  const kept = []
  for (let i = 0; i < lines.length; i++) {
    if (drop.has(i + 1)) { if (i + 1 === TPL[0]) kept.push(...WIRE); continue }
    kept.push(lines[i])
  }
  fs.writeFileSync(VUE, kept.join('\n'))
  console.log(`✔ 宿主删除 ${drop.size} 行并在原位接线：${lines.length} → ${kept.length}`)

  const v2 = fs.readFileSync(VUE, 'utf8')
  const anchor = "import SettingsResetPanel from './settings/SettingsResetPanel.vue'"
  if (!v2.includes(anchor)) throw new Error('未找到 import 锚点')
  if (!v2.includes("import SettingsExtensionPanel from"))
    fs.writeFileSync(VUE, v2.replace(anchor, anchor + "\nimport SettingsExtensionPanel from './settings/SettingsExtensionPanel.vue'"))
  console.log('✔ 宿主补 import')
}

main()