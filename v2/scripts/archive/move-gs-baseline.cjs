/**
 * V3.8.42 · 一次性搬移脚本：把设置页「跨子域共享基类」从宿主 scoped 抽出为 settings/base.css
 *
 * ★为什么必须脚本切、不能手抄：上一轮已连续两次凭印象写错 CSS（编译过、判据绿、只有像素知道）。
 *   本脚本按**绝对行号**逐行搬运，一个字符都不重打。
 *
 * 搬移范围（宿主 GlobalSettings.vue，1-based）：
 *   2424-2431  页头三件（.gs-page-header / -title / -desc）——含其上方的死 CSS 注释块留在宿主
 *   2433-2444  卡片段（.gs-card / -header / -title / -desc / -body）
 *   2446-2472  设置行段（.gs-setting-row* / .gs-sr-* / .gs-log-*）
 *   2474-2478  开关（.gs-toggle*）
 *   2480-2494  输入框/下拉/隐藏 file input
 *   2496-2503  按钮（.gs-btn*）
 *
 * 不搬：宿主布局骨架（.gs-page / .gs-nav* / .gs-content / .gs-back-btn）——它们只属于宿主，
 *      子组件用不到；留在 scoped 里反而是对的（不外泄）。
 *
 * 用法：node scripts/move-gs-baseline.cjs [--dry]
 */
const fs = require('fs')
const path = require('path')

const VUE = path.resolve(__dirname, '../src/newtab/views/GlobalSettings.vue')
const CSS = path.resolve(__dirname, '../src/newtab/views/settings/base.css')
const DRY = process.argv.includes('--dry')

/** [起, 止] 闭区间，均为宿主文件的绝对行号 */
const RANGES = [
  [2424, 2431],
  [2433, 2444],
  [2446, 2472],
  [2474, 2478],
  [2480, 2494],
  [2496, 2503],
]

const HEADER = `/*
 * V3.8.42 · 设置页「跨子域共享基类」—— 从 GlobalSettings.vue 的 <style scoped> 原样搬出
 *
 * ★★ 为什么必须是**非 scoped** 的独立文件（这是本文件存在的全部理由）：
 *   Vue 的 \`scoped\` 是按**组件实例**给元素打 data-v 标记的，父组件的样式**命中不了子组件内部元素**。
 *   子组件里的 \`.gs-card\` 只带自己的 \`data-v-xxxx\`，而宿主那条规则是 \`.gs-card[data-v-a193e574]\`
 *   ⇒ 不匹配 ⇒ 卡片外壳（背景/边框/圆角/阴影）在子组件里**整条失效**。
 *
 *   实测证据（scripts/probe-gs-baseline.cjs，computed style 直接读）：
 *     已拆子域 manual/about/letter：.gs-card border=0px radius=0 bg=transparent shadow=none；
 *                                 .gs-page-title fontSize=13px/400（应为 17px/700）
 *     未拆宿主 resource        ：.gs-card border=1px radius=14px bg=rgb(20,22,27) 有卡影
 *   ⇒ 这不是"某几条漏搬"，是**每拆一个子域就会重演一次**的系统性陷阱。
 *
 * ★ 为什么上轮像素 A/B 报「0 差」没抓到：那次 A/B 的新旧两张图是同一张（跳过 0 张），
 *   详见 docs/交付说明_V3.8.42_P0-3第二批_设置页三子域拆分.md 第四节「假信号套着假信号」。
 *   ⇒ 由 scripts/regression/33-gs-baseline.cjs 接管：判据直接查「子组件用的 class 在此表有定义」。
 *
 * ★ 纪律：搬样式一律脚本切原文（\`scripts/move-gs-baseline.cjs\`），人只核对边界，不重打内容。
 *   另：注释里禁止出现 \`/* … */\` 字面量（会提前闭合注释块，build 才拦得住）。
 */
`

function main() {
  const lines = fs.readFileSync(VUE, 'utf8').split('\n')
  const picked = []
  for (const [a, b] of RANGES) {
    if (b >= lines.length) throw new Error(`行号越界：${a}-${b}（文件共 ${lines.length} 行）`)
    for (let i = a; i <= b; i++) picked.push({ n: i, text: lines[i - 1] })
  }
  // 搬移前的守门：每段首行必须真的是注释或选择器，不能是注释块的中间（切错边界的典型症状）
  for (const [a] of RANGES) {
    const t = lines[a - 1].trim()
    if (!t.startsWith('/*') && !t.startsWith('.gs-') && !t.startsWith('}')) {
      throw new Error(`段首 ${a} 行不是注释或选择器：${t.slice(0, 60)}`)
    }
  }
  // 搬移后的守门：段尾必须闭合（大括号配平），否则说明切进了规则中间
  for (const [, b] of RANGES) {
    const t = lines[b - 1].trim()
    if (!t.endsWith('}') && !t.endsWith('*/') && !t.startsWith('/*') && !t.trim().startsWith('*')) {
      throw new Error(`段尾 ${b} 行未闭合：${t.slice(0, 60)}`)
    }
  }

  const body = picked.map(p => p.text).join('\n')
  const declCount = (body.match(/^\s*\.gs-[a-z0-9-]+/gim) || []).length
  console.log(`将搬 ${picked.length} 行 / ${RANGES.length} 段 · 其中选择器 ${declCount} 条`)
  console.log(`段范围：${RANGES.map(r => r.join('-')).join(', ')}`)
  if (DRY) { console.log('\n--dry：仅预览前 12 行 --\n' + body.split('\n').slice(0, 12).join('\n')); return }

  // 1) 写 base.css
  fs.writeFileSync(CSS, HEADER + body + '\n')
  console.log(`✔ 写入 ${path.relative(process.cwd(), CSS)}`)

  // 2) 从宿主删除这些行（从后往前删，避免行号漂移）
  const drop = new Set(picked.map(p => p.n))
  const kept = lines.filter((_, i) => !drop.has(i + 1))
  fs.writeFileSync(VUE, kept.join('\n'))
  console.log(`✔ 宿主删除 ${drop.size} 行：${lines.length} → ${kept.length}`)

  // 3) 宿主引入 base.css（放在 scoped 之前，作为独立非 scoped 块）
  const vue = fs.readFileSync(VUE, 'utf8')
  const anchor = '<style scoped>'
  if (!vue.includes(anchor)) throw new Error('未找到 <style scoped> 锚点')
  if (vue.includes("import './settings/base.css'")) { console.log('·宿主已引入，跳过'); return }
  const at = vue.lastIndexOf(anchor)
  fs.writeFileSync(VUE, vue.slice(0, at) + "<!-- V3.8.42：跨子域共享基类（.gs-card/.gs-btn/.gs-setting-row…）已外提为 settings/base.css。\n     必须非 scoped —— Vue 的 scoped 命中不了子组件内部元素，外提前四个已拆子域的卡片外壳全部失效。 -->\n<style src=\"./settings/base.css\"></style>\n\n" + vue.slice(at))
  console.log('✔ 宿主引入 base.css')
}

main()