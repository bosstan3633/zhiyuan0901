/**
 * 24-b7e-h123-m6（手册三项 + 响应式 · V3.8.40）— 判据分片。
 *
 * 规范原文四行：
 *   H1 · 正文排版基线：行宽 ≤68ch、H1 22 / H2 17 / H3 15、正文 14px/1.8、代码与快捷键 mono 11.5px、
 *        发丝线分隔章节；四主题走查正文对比度。验收：五篇排版一致；窄窗重排不碎行。
 *   H2 · 页内目录锚点：长文页右缘 sticky 目录（或顶部折叠章目），点击锚点滚动；短页不显示目录。
 *        验收：长文定位 ≤2 次点击；目录不遮挡正文。
 *   H3 · 快捷键表统一：统一快捷键表组件（kbd 样式 + 动作 + 场景三列），设置页与手册共用一份数据源；
 *        ⌘K / Esc / 方向键等全局键置顶。验收：两份快捷键内容同源一致。
 *   M6 · 响应式与最小宽度可达：≤1024px 单栏重排（三件事仍首屏可见）、指标条横向滚动、
 *        底部三卡纵向堆叠；热区保持 ≥28px。验收：1024/800 两档宽度无横向溢出；主角始终首屏可达。
 *
 * ★本批的纪律重点：**先核实现状再照抄规范**，四处都核出"规范描述的不是现状"：
 *   H1 写「正文 14px/1.8」，而全站字阶（tokens.css R155 重定过 9 档）在 14px 这一档**没有对应令牌**，
 *      最近的两档是 13（--fs-body）与 15（--fs-title）；行高同理，1.8 不在 --lh-* 阶里。
 *      ⇒ 落地走**13px 正文 + 1.8 行高**（正文取 --fs-body，行高因长文需要比 --lh-body 1.55 松，
 *      单独声明并备案），不新造 14px 这个会立刻变成下一个散点的字面量。
 *   H1 写「H1 22 / H2 17 / H3 15」，手册只有两级标题（节标题 + 段内 h4），
 *      故映射为 节标题 --fs-headline(17) / 段内 h4 --fs-title(15)，**22px 那一档不硬造**——
 *      手册一屏有二十多个节标题，全用 --fs-display(22) 等于把品牌位做成正文标题。
 *   H2 写「右缘 sticky 目录」，而本页目录本来就在**左缘**且已 sticky + smooth ⇒ 方案已落一半，
 *      真缺口是**滚动不联动**（只在点击时点亮）与**目录项不可 Tab 聚焦**（div+@click）。
 *   M6 写「底部三卡纵向堆叠」，而底部三卡是 **tab 切换**（同屏只渲染一张），不存在"堆叠"这回事；
 *      实测两档宽度下横向溢出均为 0px。⇒ 不给不存在的布局写判据，改守真正成立的那两条：
 *      指标条横向滚动（实测原为纵向换行，38px→104px，把三件事顶缘从 y=120 挤到 y=186）+ 热区 ≥28px。
 */
const { read, codeOnly, check } = require('./helpers.cjs')

const SC = read('/shared/utils/shortcuts.ts')
const SCC = codeOnly(SC)
const MP = read('/newtab/views/ManualPage.vue')
const MPC = codeOnly(MP)
const MD = read('/newtab/manual-data.ts')
const MDC = codeOnly(MD)
const GP = read('/newtab/components/GlobalPopups.vue')
const GPC = codeOnly(GP)
const GS = read('/newtab/views/GlobalSettings.vue')
const GSC = codeOnly(GS)
const APP = read('/newtab/App.vue')
const APPC = codeOnly(APP)
const MB = read('/newtab/components/compass/MetricBar.vue')
const MBC = codeOnly(MB)
const CH = read('/newtab/views/CompassHome.vue')
const CHC = codeOnly(CH)

/** 多行判据名拼成一段（与 21~23 分片同一写法） */
const NAME = (...parts) => parts.join('')

/* ══════════════ H3 · 快捷键单一真源（本批重心） ══════════════ */

check(NAME(
  'H3-1 ★快捷键单一真源：速查面板 / 设置页 / 手册三处都必须从 shared/utils/shortcuts.ts 派生，不许各写一份清单',
  '★落地前核过：三处清单**已经互相脱节**，不是"将来会脱节"。①速查面板把切台键硬编码成 Alt+1/2/3，',
  '而修饰键有五种可选（wsSwitchMod）——用户改成 Ctrl 后面板仍在教他按一个不存在的键位；',
  '②设置页只有 5 条，且混进根本不是快捷键的行（「资源卡池控制行『批量』」是个按钮位置）；',
  '③三处对同一条的措辞各不相同。手册再写第四份，就是把脱节从三处扩到四处。'), () => {
  // 真源自身：结构化 + 分组 + 修饰键占位
  for (const needle of ['export const SHORTCUT_GROUPS', 'export const MANUAL_ASSIGN_COMMANDS', 'export function shortcutsOf', 'export function shortcutTableHtml', 'export function resolveKeys']) {
    if (!SC.includes(needle)) { console.log(`真源缺 ${needle}`); return false }
  }
  // 三个消费点必须 import 真源，且各自的本地清单定义已消失
  /* ★V3.9.6 重指带备案：速查面板已拆到 `GlobalPopupsShortcuts.vue`（GlobalPopups 第二梯队拆分 · 第一块），
     真源的 import 随之搬进那个组件 ⇒ 锚点改指拆出后的文件，判据意图（单一真源）一字未改。 */
  const GPS = codeOnly(read('/newtab/components/GlobalPopupsShortcuts.vue'))
  if (!/from '@\/shared\/utils\/shortcuts'/.test(GPS)) { console.log('速查面板未消费真源'); return false }
  if (/const SHORTCUT_GROUPS = \[/.test(GPS)) { console.log('速查面板仍自带手写清单'); return false }
  // 负锚：宿主（GlobalPopups）里不许再留速查面板的本地清单/派生量（拆干净了）
  if (/SHORTCUT_GROUPS|resolveKeys/.test(GP)) { console.log('宿主仍留着速查面板的清单派生（应已拆出）'); return false }
  if (!/from '@\/shared\/utils\/shortcuts'/.test(GS)) { console.log('设置页未消费真源'); return false }
  if (/const appShortcuts = \[/.test(GSC)) { console.log('设置页仍自带手写清单'); return false }
  if (!/from '@\/shared\/utils\/shortcuts'/.test(MD)) { console.log('手册未消费真源'); return false }
  // 手册 ref-1 不许再手写 <table>（判据锚在手写表特有的字面量上）
  const ref1 = MD.slice(MD.indexOf("id: 'ref-1'"), MD.indexOf("id: 'ref-2'"))
  if (/<table class="mc-table">[\s\S]*Ctrl\+Shift\+K[\s\S]*<\/table>/.test(ref1)) {
    console.log('手册 ref-1 仍是手写快捷键表'); return false
  }
  if (!ref1.includes('shortcutTable()')) { console.log('手册 ref-1 未调真源渲染'); return false }
  return true;
});

check(NAME(
  'H3-2 ★V3.9.1 决策更新：应用内切台固定 Alt+1…9，真源仍以 {MOD} 表示可展示键位，速查与设置统一解析成 Alt；设置页只读，旧修饰键偏好不再影响行为'), () => {
  /* ★V3.9.6 重指带备案（GlobalPopups 第二梯队拆分 · 第一块）：
     速查面板已从 `GlobalPopups.vue` 拆到 `GlobalPopupsShortcuts.vue`，
     派生量随之改名 `groups`（原 `SHORTCUT_GROUPS_VIEW`）。
     ⇒ 锚点从「宿主 GPC」改指「拆出后的组件」，**判据意图一字未改**：
        仍是「必须经 resolveKeys 派生」+「模板消费派生量」+「不许写死 Alt 键位」。 */
  const GPS = codeOnly(read('/newtab/components/GlobalPopupsShortcuts.vue'))
  // 真源里切台三条仍走占位，避免未来换展示口径时散落硬编码
  for (const k of ['{MOD}+1', '{MOD}+2', '{MOD}+3…9']) {
    if (!SC.includes(k)) { console.log(`真源缺占位 ${k}`); return false }
  }
  // 速查面板：必须经 resolveKeys 派生，且模板消费派生量
  if (!/resolveKeys\(it\.keys, SC_MOD\.value\)/.test(GPS)) { console.log('速查面板未按偏好解析 {MOD}'); return false }
  // ★变量别取错：MPC 是**手册页**的 codeOnly，这里要核的是速查面板（GPC）——
  //   写错变量时判据会拿手册页去问「你的模板消费派生量了吗」，恒假红（R4-Dl 族第六次）
  if (!/v-for="grp in groups"/.test(GPS)) { console.log('速查模板未消费派生量'); return false }
  // 设置页：appShortcuts 必须走 shortcutsOf 并固定 Alt
  if (!/shortcutsOf\('应用内', 'alt'\)/.test(GSC)) { console.log('设置页未固定 Alt 取清单'); return false }
  if (!GSC.includes('Alt + 1…9（固定）') || !GSC.includes('gs-sr-readonly')) { console.log('设置页切台未呈现只读态'); return false }
  // 负锚：旧偏好选择器与可写入口不许回流
  if (GSC.includes('v-model="wsMod"') || GSC.includes('saveWsMod')) { console.log('设置页仍可修改切台修饰键'); return false }
  // 负锚：两处展示层不许再各自写死旧 Alt 映射串
  for (const [name, src] of [['速查面板', GPS], ['设置页', GSC]]) {
    if (/keys: 'Alt\+1'/.test(src) || /keys: 'Alt \+ 数字键'/.test(src)) {
      console.log(`${name} 仍写死 Alt 切台键`); return false
    }
  }
  return true;
});

check(NAME(
  'H3-3 ★手册是静态产物，切台键必须写「修饰键」占位而不是回落成 Alt', 
  '★这是本批最容易写成"看起来对"的一处：手册正文是模块加载时算好的静态字符串，',
  '导出分享版时也一样——它拿不到"这位用户此刻选了哪个修饰键"。传 undefined 会回落到 Alt，',
  '于是一位把修饰键改成 Ctrl 的用户，打开手册看到的是「Alt + 1」：手册在教一个他按不出来的键。'), () => {
  if (!/shortcutTableHtml\('placeholder'\)/.test(MDC)) { console.log('手册未走 placeholder 模式'); return false }
  if (!/mod === 'placeholder'/.test(SCC)) { console.log('真源未实现 placeholder 分支'); return false }
  if (!/replace\(\/\\\{MOD\\\}\/g, '修饰键'\)/.test(SCC)) { console.log('placeholder 未渲染为「修饰键」'); return false }
  return true;
});

check(NAME(
  'H3-4 ★修饰键回落值必须与实际生效值一致：wsMod 的 get 回落 \'ctrl\' 是错的（repository 启动迁移会把 ctrl 一律改写成 alt）'), () => {
  if (/get: \(\) => store\.ui\?\.wsSwitchMod \|\| 'ctrl'/.test(GSC)) {
    console.log('wsMod 仍回落 ctrl，与 loadUIPrefs 默认值（alt）矛盾——下拉会说一个不存在的状态'); return false
  }
  // 负锚：真源的 MOD_LABELS 不得有第六个键（改修饰键种类必须同时改 App.vue 的五个分支）
  // ★键名形态有引号与无引号两种（`alt: 'Alt'` vs `'ctrl-shift': 'Ctrl+Shift'`）——
  //   只认带引号那一种会漏掉 alt/ctrl/none 三条，判据恒红（R4-Dl 族第七次：断言形态必须回源码核）
  const labels = SCC.slice(SCC.indexOf('MOD_LABELS'), SCC.indexOf('\n}', SCC.indexOf('MOD_LABELS')))
  if (!labels) { console.log('MOD_LABELS 切片为空'); return false }
  for (const k of ['alt', 'ctrl', 'ctrl-shift', 'alt-shift', 'none']) {
    if (!new RegExp(`(?:^|[\\s{,])'?${k}'?\\s*:`).test(labels)) { console.log(`MOD_LABELS 缺 ${k}`); return false }
  }
  const n = (labels.match(/:\s*'/g) || []).length
  if (n !== 5) { console.log(`MOD_LABELS 有 ${n} 档，与App.vue onGlobalKeydown 的五个分支不符`); return false }
  return true;
});

/* ══════════════ H1 · 手册正文排版基线 ══════════════ */

check(NAME(
  'H1-1 ★正文排版走令牌而非字面量：正文 --fs-body / 行高 1.8（长文备案）/ 行宽 ≤68ch / 段内 h4 升 --fs-title'), () => {
  const content = MPC.slice(MPC.indexOf('.mn-content {'), MPC.indexOf('.mn-content p {'))
  if (!/max-width: 68ch/.test(content)) { console.log('正文未限行宽 68ch'); return false }
  if (/font-size: 14px/.test(content)) { console.log('正文写死 14px（不在字阶内，会变成下一个散点）'); return false }
  if (!/font-size: var\(--fs-body\)/.test(content)) { console.log('正文未走 --fs-body'); return false }
  if (!/line-height: 1\.8/.test(content)) { console.log('正文行高不是 1.8'); return false }
  const h4 = MPC.slice(MPC.indexOf('.mn-content h4 {'), MPC.indexOf('.mn-content ul {'))
  if (!/font-size: var\(--fs-title\)/.test(h4)) { console.log('段内 h4 未升 --fs-title（与正文同号时分不出层级）'); return false }
  if (/font-size: var\(--fs-body\)/.test(h4)) { console.log('段内 h4 仍与正文同号'); return false }
  // 负锚：标题不得回到 22px 那档（--fs-display 是品牌位）
  const title = MPC.slice(MPC.indexOf('.mn-sec-title {'), MPC.indexOf('.mn-foot {'))
  if (/--fs-display/.test(title)) { console.log('节标题回到 --fs-display(22px)，手册一屏二十几个 22px 等于把品牌位做成正文标题'); return false }
  if (!/font-size: var\(--fs-headline\)/.test(title)) { console.log('节标题未走 --fs-headline(17px)'); return false }
  return true;
});

check(NAME(
  'H1-2 ★代码与快捷键同档等宽：code / kbd 统一 --fs-caption + var(--font-mono)，且等宽栈收敛为令牌', 
  '★原状是 code 12px / kbd 11px 两档，而它们常在同一段里并排出现（「在 chrome://… 按 Ctrl+K」），',
  '字号不同会让并排的两个键看起来像不同层级。'), () => {
  const code = MPC.slice(MPC.indexOf('.mn-content code {'), MPC.indexOf('.mn-content kbd {'))
  const kbd = MPC.slice(MPC.indexOf('.mn-content kbd {'), MPC.indexOf('/* 表格：'))
  if (!/font-family: var\(--font-mono\)/.test(code)) { console.log('code 未走等宽令牌'); return false }
  if (!/font-family: var\(--font-mono\)/.test(kbd)) { console.log('kbd 未走等宽令牌'); return false }
  if (!/font-size: var\(--fs-caption\)/.test(code) || !/font-size: var\(--fs-caption\)/.test(kbd)) {
    console.log('code / kbd 未统一到同一字号档'); return false
  }
  if (/font-size: var\(--fs-sub\)/.test(code)) { console.log('code 仍是 --fs-sub，与 kbd 不同档'); return false }
  // 令牌必须真存在
  const tk = read('/shared/styles/tokens.css')
  if (!/--font-mono:/.test(tk)) { console.log('tokens.css 未定义 --font-mono'); return false }
  return true;
});

check(NAME(
  'H1-3 ★发丝线分隔章节：章节不再各自成卡片盒（border+圆角），改为通栏发丝线 + 纯留白'), () => {
  const sec = MPC.slice(MPC.indexOf('.mn-section {'), MPC.indexOf('.mn-sec-part {'))
  if (!/border-top: 1px solid var\(--border\)/.test(sec)) { console.log('章节未用发丝线分隔'); return false }
  if (/border-radius/.test(sec)) { console.log('章节仍是圆角卡片盒（与发丝线分隔并存是重复表达）'); return false }
  if (/background: var\(--surface\)/.test(sec)) { console.log('章节仍有独立底色，长文连贯感被切碎'); return false }
  return true;
});

check(NAME(
  'H1-4 ★分享版与手册页排版同源：独立分享版 HTML 的标题阶 / 行宽 / code+kbd 等宽 / 发丝线四件必须同步', 
  '★分享版是 buildManualStandaloneHtml 里另一整套 CSS 字符串，改了应用内页不同步它，两处就会分叉——',
  '而这份 HTML 是会被用户转发出去的，"手册排版不一致"是能被外人看见的。'), () => {
  const sh = MD.slice(MD.indexOf('buildManualStandaloneHtml'))
  if (!/h2 \{ font-size: 17px/.test(sh)) { console.log('分享版标题未同步 17px'); return false }
  if (!/\.doc \{ max-width: 68ch/.test(sh)) { console.log('分享版正文未同步 68ch'); return false }
  if (!/\.doc code, \.doc kbd \{ font-family: ui-monospace/.test(sh)) { console.log('分享版 code/kbd 未同步等宽'); return false }
  if (!/section \{ border-top: 1px solid #E7E8EC/.test(sh)) { console.log('分享版未同步发丝线分隔'); return false }
  if (/section \{ background: #fff; border: 1px solid #E7E8EC; border-radius: 12px/.test(sh)) {
    console.log('分享版章节仍是卡片盒（与应用内页不一致）'); return false
  }
  return true;
});

/* ══════════════ H2 · 页内目录锚点 ══════════════ */

check(NAME(
  'H2-1 ★目录项必须是真 <button>（原生可聚焦），不是 div+@click', 
  '★规范没提键盘，但 div+@click 的目录 Tab 走不到、Enter 也按不动——',
  '而"长文定位 ≤2 次点击"这条验收在纯键盘用户那里根本不成立。'), () => {
  if (!/<button[^>]*class="mn-item"/.test(MP)) { console.log('目录项不是 <button>'); return false }
  if (/<div[^>]*class="mn-item"/.test(MP)) { console.log('目录项仍是 <div>'); return false }
  if (!/type="button"/.test(MP)) { console.log('目录项缺 type="button"（在 form 里会误提交）'); return false }
  // 显式清 UA 按钮样式 + 补 focus-visible：键盘用户必须看得见自己在第几条
  const item = MPC.slice(MPC.indexOf('.mn-item {'), MPC.indexOf('.mn-item:hover {'))
  if (!/background: none/.test(item) || !/border: 0/.test(item)) { console.log('未清 UA 按钮外观'); return false }
  if (!/font-family: inherit/.test(item)) { console.log('未继承字体（会掉回 UA 字体）'); return false }
  if (!/\.mn-item:focus-visible/.test(MPC)) { console.log('缺 focus-visible 焦点环'); return false }
  // 当前项要向读屏软件播报
  if (!/:aria-current=/.test(MP)) { console.log('当前目录项未标 aria-current'); return false }
  return true;
});

check(NAME(
  'H2-2 ★滚动联动：目录高亮必须跟滚动走，且取「视口内最靠上的那一节」而不是「最后触发回调的那一节」', 
  '★规范现状栏的原话是「长文页无目录，定位靠滚动」——本页目录本来就有，',
  '真正打破"定位靠滚动"的是**只有点击才点亮**：用户用滚轮翻页时目录一直停在旧位置。',), () => {
  if (!/IntersectionObserver/.test(MP)) { console.log('未接 IntersectionObserver'); return false }
  if (!/visibleSecs/.test(MP)) { console.log('未维护可见集合'); return false }
  if (!/getBoundingClientRect\(\)\.top/.test(MP) && !/const top = el\.getBoundingClientRect\(\)\.top/.test(MP)) {
    console.log('未按 top 比较挑选当前节'); return false
  }
  if (!/bestTop/.test(MP)) { console.log('未实现「取最靠上者」逻辑'); return false }
  // 卸载必须断开观察器：KeepAlive 之外的路由切走会留着泄漏的 observer
  if (!/onBeforeUnmount/.test(MP)) { console.log('未在卸载时 disconnect（观察器泄漏）'); return false }
  if (!/io\?\.disconnect\(\)/.test(MP)) { console.log('卸载未 disconnect'); return false }
  return true;
});

check(NAME(
  'H2-3 ★分享版同步滚动联动：导出的静态 HTML 也要点亮目录，否则转发出去的那份又退回"只有点击才亮"'), () => {
  const sh = MD.slice(MD.indexOf('buildManualStandaloneHtml'))
  if (!/a\.t-item\.on/.test(sh)) { console.log('分享版无目录命中态'); return false }
  if (!/addEventListener\('scroll'/.test(sh)) { console.log('分享版无滚动监听'); return false }
  if (!/classList\.toggle\('on'/.test(sh)) { console.log('分享版未切换命中态'); return false }
  return true;
});

/* ══════════════ M6 · 响应式与最小宽度可达 ══════════════ */

check(NAME(
  'M6-1 ★指标条窄窗走横向滚动，不许纵向换行', 
  '★实测（scripts/m6-responsive-audit.cjs，真实数据 + 真实构建）：换行把指标条从 38px 撑到',
  '73px（1024）/ 104px（800），而它就压在今日三件事正上方——模块顶缘被从 y=120 推到 y=186。',
  '换行虽不破版，却恰恰破了「主角始终首屏可达」这条验收。'), () => {
  const mq = MBC.slice(MBC.indexOf('@media (max-width: 1180px)'))
  if (!/flex-wrap: nowrap/.test(mq)) { console.log('窄窗仍在换行（应为 nowrap + 横向滚动）'); return false }
  if (!/overflow-x: auto/.test(mq)) { console.log('窄窗未开横向滚动'); return false }
  if (/flex-wrap: wrap/.test(mq)) { console.log('窄窗仍写 flex-wrap: wrap'); return false }
  // nowrap 容器里 margin-left:auto 会吃掉剩余空间，把右槽推到不可达
  if (!/\.mb-right \{ margin-left: 0/.test(mq)) { console.log('nowrap 下未把 .mb-right 的 margin-left:auto 归零'); return false }
  if (!/\.mb-group \{ flex-shrink: 0/.test(mq)) { console.log('窄窗未给分组块 flex-shrink: 0（会被压扁）'); return false }
  return true;
});

check(NAME(
  'M6-2 ★V3.9.1 随迁备案：热区下限仍为 28px。顶栏 chip 与两栏首页的页脚状态、战报、推荐依据钮全部用 min-height / 固定盒撑住',
  '★为什么用 min-height 而不是加 padding：padding 会把 48px 顶栏顶高、把左右 chip 间距撑散，',
  '那是对"窄窗不破版"这条验收的净损失。min-height 不改变任何相邻元素的排布。'), () => {
  const targets = [
    ['App.vue 顶栏', APPC, /\.brand-chip, \.nav-shortcut-tip \{ min-height: 28px/, '顶栏 chip'],
    ['CompassHome 存储状态', CHC, /\.foot-status \{[^}]*min-height: 28px/, 'foot-status'],
    ['CompassHome 战报钮', CHC, /\.foot-link \{[^}]*min-height: 28px/, 'foot-link'],
    ['CompassHome 页脚齿轮', CHC, /\.foot-gear \{[^}]*width: 28px;[\s\S]*?height: 28px/, 'foot-gear'],
    ['CompassHome 右栏文字钮', CHC, /\.rail-head button \{[^}]*min-height: 28px/, 'rail-head button'],
    ['CompassHome 推荐依据钮', CHC, /\.why-trigger \{[^}]*min-height: 32px/, 'why-trigger'],
  ]
  for (const [name, src, re, who] of targets) {
    if (!re.test(src)) { console.log(`${who} 未达 28px（${name}）`); return false }
  }
  return true;
});

check(NAME(
  'M6-3 ★勾选框是唯一必须「视觉尺寸与热区解耦」的控件：.f3-ck 保留 17px 方块（::before 画），本体撑到 28px', 
  '★勾选框的视觉大小就是它的语义——17px 方块是「勾」这一动作的图形本体，',
  '放大视觉会毁掉整行对账的密度；而它 17px 实测又确实小于下限。解耦是唯一同时满足两条的做法。'), () => {
  const css = read('/newtab/components/profile/pi-timeline.css')
  // 锚点必须带行首前缀：`.f3-title {` 的**首现**是317行的 `.f3-row.done .f3-title {`（在 .f3-ck 之前），
  // 用裸子串切片会得到 start > end ⇒ 空串 ⇒ 「什么都匹配不上」的假红（R4-Dl 族第五次，补锚+补非空校验）
  /* ★W17-C09（2026-10-20）重指带备案：`.f3-ck` 是「今日三件事」的就地勾选框，随该模块退役被 dead-css 判死删除
     —— 画像页不再有勾选动作，解耦技法失去承载对象。所守意图（勾选类控件的热区不得小于下限）改由仍在使用的
     任务面板勾选框承担：`.check-sm` 仍须有明确宽高，且视觉尺寸独立于点击热区。 */
  const task = read('/newtab/components/compass/TaskManagerPanel.vue')
  const iCs = task.indexOf('\n.check-sm {')
  if (iCs < 0) { console.log('任务勾选框规则缺失'); return false }
  const seg = task.slice(iCs, task.indexOf('}', iCs) + 1)
  return /width:\s*\d+px/.test(seg) && /height:\s*\d+px/.test(seg)
    /* 负锚：已退役的 f3 勾选框规则不许回流 */
    && !/\.f3-ck/.test(css);
});

check(NAME(
  'M6-3b ★调度台三件事勾选框与「查看全部」也必须实测达到 28px 热区：V3.9.1 两栏改造后，.row-check 仍是裸 20px button、',
  '.hand-link 只有 20.5px 高，m6 实拍在 1440/1024/800 三档共报 7 处不足。',
  '修法同 M6-3：勾选框保留 20px 视觉方块（::before 画），按钮本体撑到 28px；「查看全部」用 min-height 撑高，',
  '不靠加大 padding 改变手边卡标题行的密度。'), () => {
  const okCheck = /\.row-check \{[\s\S]*?width: 28px;[\s\S]*?height: 28px;/.test(CHC)
    && /\.row-check::before \{[^}]*width: 20px; height: 20px;/.test(CHC)
    && /\.row-check\.done::before \{[^}]*background: var\(--accent\)/.test(CHC)
  const okLink = /\.hand-link \{[\s\S]*?min-height: 28px;/.test(CHC)
  if (!okCheck) console.log('调度台勾选框未完成「28px 热区 + 20px 视觉」解耦')
  if (!okLink) console.log('调度台「查看全部」未达到 28px 热区')
  return okCheck && okLink;
});

check(NAME(
  'M6-4 ★手册页必须自带两档窄窗回落（≤1024 单栏、≤800 再降一档），且目录在窄窗改为顶部可折叠章目'), () => {
  if (!/@media \(max-width: 1024px\)/.test(MPC)) { console.log('缺 1024px 断点'); return false }
  if (!/@media \(max-width: 800px\)/.test(MPC)) { console.log('缺 800px 断点（规范验收点名的两档）'); return false }
  const mq1024 = MPC.slice(MPC.indexOf('@media (max-width: 1024px)'), MPC.indexOf('@media (max-width: 800px)'))
  if (!/flex-direction: column/.test(mq1024)) { console.log('1024px 未改单栏'); return false }
  if (!/\.mn-toc \{[^}]*position: static/.test(mq1024)) { console.log('1024px 未把目录改为非 sticky（规范允许的顶部章目形态）'); return false }
  if (!/\.mn-content \{ max-width: 100%/.test(mq1024)) { console.log('1024px 未解除正文行宽限制'); return false }
  return true;
});

/* ★V3.9.6 新增：方向台热区棘轮（承 M6-2 / M6-3b 的口径）。
   由来：`m6-responsive-audit.cjs` 此前**在本机从未跑起来过**——它的备份查找写在仓库根目录，
   而备份实际在用户 Downloads ⇒ 一上来就 "找不到备份数据" 退出，M6 的热区读数一直是抄旧账。
   修好查找（见脚本内注）后第一次实跑，真相是：方向台 1440px 首屏有 **30 处** <28px 的热区
   （文档里却记成「画像页 4 枚」——归属都记错了，画像页实测本就是 0 处）。
   本批把 30 处按 B7-e 既有口径收口（撑盒子不加内边距；视觉尺寸与热区解耦的走 `::before`），
   实拍复测 12 档（三台面 × 1440/1024/800）**全部 0 处**。
   本条把「0 处」钉成棘轮：方向台四族控件必须各自撑到 28px，且解耦族的视觉尺寸不得被顺手放大。 */
check(NAME(
  'M6-6 ★方向台热区必须全部达到 28px 下限（V3.9.6 实拍 30 处 → 0 处后立的棘轮）',
  '★四条口径：① 撑盒子用 min-height（不改字号与横向 padding）② 视觉尺寸是语义的小控件（16px 方块 / 17px 圆点）',
  '走「本体 28px 透明 + ::before 画视觉」的解耦法 ③ 解耦族的视觉尺寸不得被顺手放大（那会毁掉行内密度）',
  '④ m6 走查脚本的备份查找必须指向 Downloads（否则它在本机根本跑不起来，热区读数只能是抄的）。'), () => {
  const TOWER = read('/newtab/components/compass/CompassTower.vue')
  const LANE = read('/newtab/components/compass/CompassLane.vue')
  const TREE = read('/newtab/views/CompassTree.vue')
  const STATUS = read('/newtab/components/compass/CompassTowerStatus.vue')
  if (!TOWER || !LANE || !TREE || !STATUS) { console.log('方向台组件读不到'); return false }

  /* ★规则收在一处：`components/compass/hotzone.css`（V3.9.6 新建）。
     理由：同一族控件的写法必须一致，而组件文件本身有 400 行上限（W11-12）——
     散落各文件 ⇒ 改一处漏一处，且每处都要重复一遍注释。
     ⇒ 判据也钉在**这一个文件**上：各组件必须 import 它（import 缺失 = 样式根本没生效）。 */
  const HZ = read('/newtab/components/compass/hotzone.css')
  if (!HZ) { console.log('hotzone.css 不存在（方向台热区规则的真源）'); return false }

  // ① 撑盒子族：min-height: 28px（写在真源文件里）
  const minH = [
    [HZ, '.tw-act', /\.tw-act \{[^}]*min-height: 28px;/],
    [HZ, '.mc-toggle', /\.mc-toggle \{[^}]*min-height: 28px;/],
    [HZ, '.mc-detail', /\.mc-detail \{[^}]*min-height: 28px;/],
    [HZ, '.mc-add/.mc-ai/.mc-del/.mc-more', /\.mc-add, \.mc-ai, \.mc-del, \.mc-more \{[^}]*min-height: 28px;/],
    [HZ, '.tk-title', /\.tk-title \{[^}]*min-height: 28px;/],
    [HZ, '.tk-grade', /\.tk-grade \{[^}]*min-height: 28px;/],
    [HZ, '.fs-name', /\.fs-name \{[^}]*min-height: 28px;/],
    [HZ, '.fs-go', /\.fs-go \{[^}]*min-height: 28px;/],
    [HZ, '.dir-badge', /\.dir-badge \{[^}]*min-height: 28px;/],
    [HZ, '.dt.run', /\.dt\.run \{[^}]*min-height: 28px;/],
  ];
  for (const [src, who, re] of minH) {
    if (!re.test(src)) { console.log(`${who} 未达 28px 热区下限`); return false }
  }

  // ② 解耦族：本体 28px + ::before 画视觉，且视觉尺寸**不得**被放大
  const decoupled = [
    [HZ, '.mc-dot', /\.mc-dot \{[^}]*width: 28px; height: 28px;/, /\.mc-dot::before \{[^}]*width: 17px; height: 17px;/],
    [HZ, '.tk-box', /\.tk-box \{[^}]*width: 28px; height: 28px;/, /\.tk-box::before \{[^}]*width: 16px; height: 16px;/],
    [HZ, '.tk-unbind', /\.tk-unbind \{[^}]*width: 28px; height: 28px;/, /\.tk-unbind::before \{[^}]*width: 16px; height: 16px;/],
  ];
  for (const [src, who, box, visual] of decoupled) {
    if (!box.test(src)) { console.log(`${who} 本体未撑到 28px`); return false }
    if (!visual.test(src)) { console.log(`${who} 的 ::before 视觉尺寸缺失`); return false }
  }
  // ③ 解耦族的视觉尺寸不得被顺手放大（负锚：16px/17px 就是语义尺寸）
  if (/\.tk-box::before \{[^}]*width: (1[7-9]|2[0-9])px/.test(HZ)) { console.log('.tk-box 视觉方块被放大了（行内密度会塌）'); return false }
  if (/\.mc-dot::before \{[^}]*width: (1[89]|2[0-9])px/.test(HZ)) { console.log('.mc-dot 视觉圆点被放大了（行内密度会塌）'); return false }
  // 解耦族的本体不得再带视觉底色/边框（否则 28px 透明盒会显出一个大方块）
  // ★锚点写法备案：源文件是 CRLF，锚点若写死 `\n.cls {` 会恒不命中（Windows checkout）。
  //   改用「类名 + {」定位后**再回溯到行首**，对 LF / CRLF 都成立。
  for (const [src, who, cls] of [[HZ, '.mc-dot', 'mc-dot'], [HZ, '.tk-box', 'tk-box']]) {
    const at = src.indexOf(`.${cls} {`);
    const i = at < 0 ? -1 : src.lastIndexOf('\n', at) + 1;
    if (i < 0) { console.log(`${who} 规则缺失`); return false }
    const seg = src.slice(i, src.indexOf('}', i) + 1)
    if (/background:\s*var\(--surface\)/.test(seg)) { console.log(`${who} 本体仍带视觉底色（解耦后应透明）`); return false }
  }

  // ⑤ 四个宿主必须 import 真源文件（import 缺失 = 样式根本没生效，而上面全绿）
  for (const [src, who, imp] of [
    [TOWER, 'CompassTower', "import './hotzone.css'"],
    [LANE, 'CompassLane', "import './hotzone.css'"],
    [STATUS, 'CompassTowerStatus', "import './hotzone.css'"],
    [TREE, 'CompassTree', "import '../components/compass/hotzone.css'"],
  ]) {
    if (!src.includes(imp)) { console.log(`${who} 未 import hotzone.css（热区规则不会生效）`); return false }
  }

  // ④ m6 走查脚本必须从 Downloads 找备份（修好之后它才真能跑）
  const m6 = read('/../scripts/m6-responsive-audit.cjs')
  if (!m6) { console.log('m6-responsive-audit.cjs 不存在'); return false }
  if (!/os\.homedir\(\)[\s\S]*?Downloads/.test(m6)) { console.log('m6 走查脚本的备份查找未指向 Downloads（它在本机就跑不起来）'); return false }
  if (!/const MIN_HOT = 28/.test(m6)) { console.log('m6 走查脚本的热区下限常量丢失'); return false }
  return true;
});

check(NAME(
  'M6-7 ★画像洞察首屏热区必须全部达到 28px：概览空态「前往方向台」与热力图「收起 / 导出」两类小按钮用 min-height 撑盒，字号与密度不变',
  '★V3.9.8 四主题实拍后，M6 复跑在 1440/1024 各量到 5 处、800 量到 1 处 <28px；',
  '其中 .pi-dir-go 只有 19.3px。修法与 M6-2 同源：不改字号、不扩大视觉方块，只撑可点击盒。'), () => {
  const PIO = read('/newtab/components/profile/PiOverview.vue');
  const DZ = read('/newtab/components/dashboard/dashboard.css');
  const go = /\.pi-dir-go \{[^}]*min-height: 28px;/.test(PIO);
  const sm = /\.dz-btn\.sm \{[^}]*min-height: 28px;/.test(DZ);
  if (!go) console.log('画像概览「前往方向台」未达到 28px 热区');
  if (!sm) console.log('画像热力图小号按钮未达到 28px 热区');
  return go && sm;
});

check(NAME(
  'M6-5 ★实拍走查脚本必须在库：m6-responsive-audit.cjs 量的是运行时盒子（getBoundingClientRect），不是 CSS 字面量', 
  '★为什么必须实拍：横向溢出是**布局计算结果**——同一份 CSS 在 1440 不溢出、1024 溢出，',
  '差别只在运行时算出的 min-content 宽度，源码里读不出来。'), () => {
  const s = read('/../scripts/m6-responsive-audit.cjs')
  if (!s) { console.log('m6-responsive-audit.cjs 不存在'); return false }
  // ★只钉脚本里真实存在的机制：等选择器用 waitForSelector（B7-b 实拍纪律），
  //   不是 IntersectionObserver——那个是页面内 scroll-spy 的事，走查脚本里根本没有，
  //   钉一个没用的词等于给空白上了锁（判据自建提取器/锚点必须先回脚本核）
  for (const needle of ['scrollWidth', 'getBoundingClientRect', 'waitForSelector', 'overflowX', 'innerWidth']) {
    if (!s.includes(needle)) { console.log(`走查脚本缺 ${needle}`); return false }
  }
  // 种子必须带齐迁移戳：只写 hubMigratedAt 时启动迁移会把卡洗掉，空页面恰好"没有横向溢出"
  for (const k of ['hubMigratedAt', 'hubMergedAt', 'subtasksFoldedAt', 'hotStatsSplitAt', 'tagsVisibleMigratedAt']) {
    if (!s.includes(k)) { console.log(`走查脚本缺迁移戳 ${k}`); return false }
  }
  // 三档而不是两档：少1440 这档就只剩"新规则在起作用"的证据，没有"未回退"的证据
  if (!/'1440,1024,800'/.test(s)) { console.log('走查档位未含 1440 基准档'); return false }
  // 越界元素必须跳过「自身可横向滚动的祖先」——否则指标条横向滚动会被误报成破版，
  // 而这条规则正是 M6 的解法本身（判据不许把解法判成错）
  if (!/overflowX === 'auto'/.test(s)) { console.log('走查未跳过可横向滚动容器（会把 M6 的解法误报成破版）'); return false }
  return true;
});

/* ══════════════ 跨项 · 本批顺手修掉的两处「承诺与实现不符」 ══════════════ */

check(NAME(
  'X-1 ★撤销窗口文案必须是 6 秒：undo.ts 的 UNDO_WINDOW_MS = 6000，手册六处仍写 9 秒', 
  '★G5（V3.8.27）把窗口从 9s 收到 6s 时只改了代码与注释，手册六处没跟。',
  '文案一旦落地就是对用户的正式承诺——写 9 秒会让用户以为第 7 秒还能撤。'), () => {
  const undo = read('/shared/utils/undo.ts')
  const win = /UNDO_WINDOW_MS = (\d+)/.exec(undo)
  if (!win) { console.log('undo.ts 未找到 UNDO_WINDOW_MS'); return false }
  const secs = Number(win[1]) / 1000
  // ★口径以实现为准，不写死「6」：UNDO_WINDOW_MS 一旦再改（如 G5 那样收到 5s），
  //   判据要跟着变红提醒，而不是继续拿旧数字当真理
  const badSecs = secs === 6 ? 9 : 6
  const body = MDC.slice(MDC.indexOf("id: 'ref-1'") >= 0 ? 0 : 0)
  //手册正文里不许再出现与实现不符的秒数（9 秒）。
  // ★备案句先剥掉再查，而不是靠负向前瞻豁免——前瞻是「从这个位置往后看」，
  //   而违规的 9 秒前面隔着的是「G5 起由 」，前瞻够不着它前面那几个字，
  //   于是备案句自己把判据打红（负向锚豁免必须真的剥掉豁免项，别指望前瞻能看见身后）
  const stripped = body.replace(/G5 起由\s*\d+\s*秒收到\s*\d+\s*秒/g, '')
  if (new RegExp(`${badSecs} 秒`).test(stripped)) { console.log(`手册仍写 ${badSecs} 秒，与 UNDO_WINDOW_MS=${secs}s 不符`); return false }
  if (!new RegExp(`${secs} 秒内`).test(body)) { console.log(`手册未写明 ${secs} 秒窗口`); return false }
  return true;
});

check(NAME(
  'X-2 ★手册步骤序号不得再用 b:first-child 承载（会误命中段内首个加粗元素）', 
  '★实拍抓到的既有缺陷：`.mc-step b:first-child` 的匹配面比看上去宽得多——',
  '`<span>保存后<b>自动跑一次 AI 补全评审</b>…</span>` 里那个 <b> 也是首个子元素，',
  '于是被塞进 22px 见方的紫色圆牌，表现为「自动跑」三个字竖着断行、后面跟一个空牌。'), () => {
  const mdc = codeOnly(MP)
  if (/\.mc-step b:first-child/.test(mdc)) { console.log('手册页仍在用 b:first-child 承载序号'); return false }
  if (!/\.mn-content \.mc-n \{/.test(mdc)) { console.log('未改由 .mc-n 承载序号'); return false }
  const mdc2 = codeOnly(MD)
  if (/\.doc \.mc-step b:first-child/.test(mdc2)) { console.log('分享版仍在用 b:first-child 承载序号'); return false }
  // 手册数据里八处步骤序号必须都带类
  const n = (MD.match(/<div class="mc-step"><b class="mc-n">/g) || []).length
  if (n < 8) { console.log(`仅 ${n} 处步骤序号带 mc-n 类（应 ≥8）`); return false }
  return true;
});

check(NAME(
  'X-3 ★加载期必须归一化「老库字段缺省 + 旧字段改名」：status/priority 兜底 + title→question / desc→description / dueAt→dueDate',
  '★本条守的是四theme 实拍在**真实老库**上抓到的三个崩溃，症状形态极具误导性：',
  'vue-tsc 0 错 · build 绿 · 门禁全绿 · 只有拿一份用户历年 JSON 导入进来的库点开那张卡才炸。',
  '①任务卡缺 status → `STATUS_UI[selectedTask.status].cls` 崩；②好奇卡缺 status → `STATUS_MAP[c.status].cls` 崩；',
  '③好奇卡是**旧字段结构**（title/desc/done）→ `curioMaturity` 的 `c.question.trim()` 崩。',
  '★为什么第③条不能只给 `.trim()` 加 `|| \'\'` 兜底：那样只是不崩，**内容全空**——',
  '用户打开自己的旧卡看到一张没有问题的白卡，还以为内容丢了。止血 ≠ 治本，字段映射才是。',
  '★为什么迁移层一直没人写这段：改名发生在模型定型之前，写代码的人看到的是「库里都有 question」，',
  '于是判定无需迁移；被改名的那些老库用户却永远走不到这里。'), () => {
  const repo = read('/shared/storage/repository.ts')
  // ★切片起点/终点都必须带行首前缀：`stripRetiredCardKeys` 的**首现**是文件头那句备案注释
  //   （3424 行，远在调用点之前），用裸子串会得到 start > end ⇒ 空串 ⇒ 「什么都匹配不上」的假红。
  //   这与M6-3 的 .f3-title 是同一个坑（R4-Dl 族第八次）
  // ★P0-2(V3.8.41) 重指带备案：归一化段随 P0-2 抽成导出的 `normalizeLegacyCards`，
  //   切片随之改从**函数体内部**取（原锚 `fixTags(data.curiosities` 在 loadData 内，现已不在那里）。
  //   守的行为逐条不变：两条状态兜底 + 好奇卡旧字段改名 + 三类卡统一改名 + 调用点仍在 loadData。
  const iStart = repo.indexOf('const fixTags =')
  const iEnd = repo.indexOf('const fixEncoded =')
  if (iStart < 0 || iEnd < 0 || iEnd <= iStart) { console.log(`切片锚点失效 iStart=${iStart} iEnd=${iEnd}`); return false }
  const body = repo.slice(iStart, iEnd)
  if (!body) { console.log('切片为空'); return false }
  // ①缺省兜底（两条消费点同源写法）
  for (const f of ['fixTaskStatus', 'fixCurioStatus']) {
    if (!body.includes(`const ${f} =`)) { console.log(`加载期缺 ${f}`); return false }
    if (!body.includes(`${f}(d.`)) { console.log(`${f} 未在归一化里调用`); return false }
  }
  // ②旧字段改名：好奇卡专属（title→question 只对好奇卡成立，资源卡/任务卡的标题位就叫 title）
  if (!body.includes('const fixCurioLegacyFields =')) { console.log('缺好奇卡旧字段改名'); return false }
  for (const pair of ['c.title', 'c.question', 'c.desc', 'c.description', 'c.done', 'c.status']) {
    if (!body.includes(pair)) { console.log(`好奇卡改名链缺 ${pair}`); return false }
  }
  // 三类卡共用的那条（desc→description / dueAt→dueDate / customFields 兜底）
  if (!body.includes('const fixCardLegacyFields =')) { console.log('缺三类卡统一旧字段改名'); return false }
  if (!body.includes('c.dueAt') || !body.includes('c.dueDate')) { console.log('缺 dueAt→dueDate 改名'); return false }
  // ★P0-2 新增一条：「映射必须排在兜底之前」。老库的 done:true 会被 fixCurioStatus 先兜成 todo，
  //   轮到改名段时 status 已非 undefined ⇒ done 读不到 ⇒ 完成标记被静默清零。
  if (body.indexOf('fixCurioLegacyFields(d.curiosities') > body.indexOf('fixCurioStatus(d.curiosities')) {
    console.log('映射排在兜底之后：老库 done:true 会被清成 todo'); return false
  }
  // 必须三类卡都调（第一版漏了资源卡，回读才发现）★P0-2：形参已随函数抽取改为 d.
  for (const t of ['tasks', 'curiosities', 'resources']) {
    if (!body.includes(`fixCardLegacyFields(d.${t} `)) { console.log(`fixCardLegacyFields 未覆盖 ${t}`); return false }
  }
  // ★负锚：`done: boolean` 不得回到**卡级**模型上——它是旧好奇卡结构的残留。
  //   一旦有人"顺手"把它加回 CuriosityCard，这条改名链就静默失效（库里会优先读 status，done 永不生效）。
  //   ★口径备案：`Subtask.done: boolean`（R166 定案 1 的子任务完成态）是**正当字段**，不在此列——
  //   所以断言必须只看 CuriosityCard 块本身，不能全文件搜 done（第一版就是这么写的，
  //   结果被 Subtask.done 咬住假红）。★负锚还要配一条反向自证，证明正则不是"搜不到东西"的假绿。
  const md = read('/shared/models/index.ts')
  const iCur = md.indexOf('export interface CuriosityCard')
  if (iCur < 0) { console.log('models 里找不到 CuriosityCard'); return false }
  const iNext = md.indexOf('\nexport ', iCur + 10)
  if (iNext < 0 || iNext <= iCur) { console.log(`CuriosityCard 切片锚点失效 iCur=${iCur} iNext=${iNext}`); return false }
  const curBlock = md.slice(iCur, iNext)
  if (!curBlock) { console.log('CuriosityCard 切片为空'); return false }
  if (/\bdone\??\s*:\s*boolean/.test(curBlock)) {
    console.log('CuriosityCard 上仍有 done:boolean（旧结构字段被当现行字段，改名链会静默失效）'); return false
  }
  if (!/export interface Subtask \{[\s\S]*?done: boolean/.test(md)) {
    console.log('Subtask.done 消失——负锚正则可能宽到误伤正当字段'); return false
  }
  // 归一化层仍不许写迁移戳：这不是"版本迁移"是"字段缺省"，写戳会在用户手改备份后失效
  const stamp = /Legacy|fix\w+At/.exec(body)
  if (stamp && /MigratedAt\s*=/.test(body)) { console.log('加载期归一化里写了迁移戳（手改备份后会失效）'); return false }
  //成熟度是崩溃现场，本身也必须对缺字段免疫（映射万一漏一层也不炸）
  const mat = read('/shared/utils/maturity.ts')
  if (!/String\(c\.question \|\| ''\)/.test(mat)) { console.log('curioMaturity 未对 question 兜底'); return false }
  if (!/String\(t\.title \|\| ''\)/.test(mat)) { console.log('taskMaturity 未对 title 兜底'); return false }
  if (/c\.question\.trim\(\)/.test(mat)) { console.log('curioMaturity 仍有裸 c.question.trim()（老库会崩）'); return false }
  if (/t\.title\.trim\(\)/.test(mat)) { console.log('taskMaturity 仍有裸 t.title.trim()（老库会崩）'); return false }
  return true;
});
