/**
 * 23-b7d-d1（D1 恢复即时 + 撤销 · V3.8.39）— 判据分片。
 *
 * 规范原文两行：「恢复点击即生效 + Toast『已恢复到原位置 · 撤销』；卡片行恢复后本地淡出 150ms；
 * 筛选（类型/时间）保持收藏的断点行为」。
 *
 * ★落地时先撞上一处**规范指向了不存在的东西**：原文要求「筛选（类型/时间）保持收藏的断点行为」，
 *   但回收站既没有收藏、也没有时间筛选——它只有五个分区 tab（type）。核过源码：全文件
 *   `favorite / dateFrom / sortBy / filter` 零命中。所以这条**不能照抄**（D3 的「30 天」是同类），
 *   本批改为守真正存在的那份断点行为：**页面在 KeepAlive 白名单里，tab 状态跨路由切换不丢**
 *   （S5-3）。不给不存在的功能编判据，也不给判据开天窗。
 *
 * ★本分片真正的重心是 D1-2：**撤销必须整笔回滚，不是只把 deletedAt 塞回去**。
 *   恢复一个动作改了 6 处：deletedAt / updatedAt / workspaceId / categoryId（rehomeIfOrphan 换台）/
 *   metric.taskIds（任务卡回填引用）/ convertedAt+convertedTo（好奇卡清转化戳）。
 *   少回滚任何一处都会留下一张「半恢复」的卡——最隐蔽的是 taskIds：只回滚 deletedAt 而没摘引用，
 *   指标上就挂着一个指向已软删任务的死 id，正是 `sanitizeMetricTaskIds` 启动期要消毒的那类脏数据，
 *   却在「撤销＝回到旧样」这条最该干净的路径上重新造了一遍。D1-2 是逐项点名式断言。
 */
const { read, codeOnly, check } = require('./helpers.cjs')

const RB = read('/newtab/views/RecycleBin.vue')
const RBC = codeOnly(RB)
/**
 * 取一个函数的函数体（按花括号配平）。
 *
 * ★这里踩过一个真实的坑：早先版本从 `indexOf('{', i)` 起算括号深度，而 TS 的**参数类型注解里
 * 本来就有花括号**——`function restoreCat(c: { id: ID; deletedAt?: number })` 的第一个 `{` 是类型注解，
 * 不是函数体。于是配平在注解处提前闭合，restoreCat 只截到 53 字符（真正的函数体有 200+），
 * withLeaving 则因注解更复杂直接截到 0。这不是"判据太严"，是**提取器把函数体认错了**——
 * 而一个会静默认错函数体的判据，等于给一段空白上了锁：D1-1/D1-2/D1-4 三条一起假红。
 *
 * 所以这里找的不是"第一个花括号"，而是**签名闭合后的那个**：从 `(` 起做括号配平（同样跳过字符串），
 * 配平点之后遇到的第一个 `{` 才是函数体首。
 * ★还要先跳过**泛型参数段**：泛型写在 `(` 之前（`function f<T extends { id: ID }>(…)`），
 *   里面自成一对花括号。不跳的话，函数体的深度计数会从泛型的 `}` 上开始，错位一格就再也闭合不上，
 *   `withLeaving` 会返回空串——判据给一段空白上了锁（D1-4 首次跑就假红在这里）。
 */
function fnBody(src, name) {
  const i = src.indexOf(name)
  if (i < 0) return ''
  let k = i + name.length
  // 跳过泛型 <...>（只可能出现在签名左括号之前）
  if (src[k] === '<') {
    let d = 0
    for (; k < src.length; k++) {
      if (src[k] === '<') d++
      else if (src[k] === '>') { d--; if (d === 0) { k++; break } }
    }
  }
  const p = src.indexOf('(', k)
  if (p < 0) return ''
  let depth = 0
  k = p
  for (; k < src.length; k++) {
    const ch = src[k]
    if (ch === '(') depth++
    else if (ch === ')') { depth--; if (depth === 0) break }
    else if (ch === "'" || ch === '"' || ch === '`') {
      const q = ch; k++
      while (k < src.length && src[k] !== q) { if (src[k] === '\\') k++; k++ }
    }
  }
  if (k >= src.length) return ''
  let j = src.indexOf('{', k)
  if (j < 0) return ''
  depth = 0
  for (let m = j; m < src.length; m++) {
    const ch = src[m]
    if (ch === '{') depth++
    else if (ch === '}') { depth--; if (depth === 0) return src.slice(i, m + 1) }
    else if (ch === "'" || ch === '"' || ch === '`') {
      const q = ch; m++
      while (m < src.length && src[m] !== q) { if (src[m] === '\\') m++; m++ }
    }
  }
  return ''
}

/** 多行判据名拼成一段（与 22 分片同一写法；check 只接 name/fn 两个参数） */
const NAME = (...parts) => parts.join('')

/* ══════════════ D1-1 · 恢复即时 + 可撤销 ══════════════ */

check(NAME(
  'D1-1 ★恢复点击即生效 + Toast 带撤销：五类恢复（资源/任务/好奇/分类/论证）全部经 restored() 统一出口，回执挂 label: \'撤销\' 动作',
  '规范原文只说「恢复点击即生效 + Toast 撤销」。这里的守卫是**五类一个都不能漏**——',
  '回收站有五个分区，只给前四个加撤销、第五个照旧，用户在论证卡分区就会发现「撤销」时有时无。',
  '另：撤销动作经 showToast 第二个参数传入（toast.ts 自动登记全局撤销栈，Ctrl/Cmd+Z 同寿 6s）。'), () => {
  for (const fn of ['restoreRes', 'restoreTask', 'restoreCurio', 'restoreCat', 'restoreArg']) {
    const body = fnBody(RBC, `function ${fn}`)
    if (!body) { console.log(`未找到 ${fn}`); return false }
    if (!/restored\(s,/.test(body)) { console.log(`${fn} 未走 restored() 统一回执`); return false }
  }
  const r = fnBody(RBC, 'function restored')
  if (!/label: '撤销'/.test(r)) { console.log('restored() 回执未挂撤销动作'); return false }
  // 撤销回调必须走 rollback()（整笔回滚），不能是就地改一个字段
  if (!/rollback\(s\)/.test(r)) { console.log('撤销回调未走 rollback()'); return false }
  // 恢复路径零确认弹层：恢复是安全动作，弹确认会让「即时」变成两拍
  if (/useConfirm/.test(fnBody(RBC, 'function restoreRes(') + fnBody(RBC, 'function restoreTask('))) {
    console.log('恢复路径出现确认弹层，破坏「点击即生效」'); return false
  }
  return true;
});

/* ══════════════ D1-2 · 撤销必须整笔回滚（本批重心） ══════════════ */

check(NAME(
  'D1-2 ★撤销完整性：一次恢复改了 6 处，rollback() 必须逐项还回去（deletedAt / updatedAt / workspaceId / categoryId / convertedAt+convertedTo / metric.taskIds）',
  '★本批最容易被写成"看起来对"的错法：只把 deletedAt 塞回去就算撤销。',
  '实际恢复动作还改了 5 处，每处漏掉都会留下一张半恢复的卡——',
  '尤其 taskIds：恢复时把任务挂回指标，撤销不摘就等于指标上留着一个指向已软删任务的死 id，',
  '正是 sanitizeMetricTaskIds 启动期要消毒的那类脏数据，却在「撤销＝回到旧样」这条路上重造一遍。',
  '★所以这一条是**逐项点名**断言，不是"检查一下有回滚"：少一项就红。'), () => {
  const b = fnBody(RBC, 'function rollback')
  if (!b) { console.log('未找到 rollback()'); return false }
  const must = [
    ['cur.deletedAt = s.deletedAt', 'deletedAt 未回滚'],
    ['any.updatedAt = s.updatedAt', 'updatedAt 未回滚'],
    ['any.workspaceId = s.workspaceId', 'workspaceId 未回滚（rehomeIfOrphan 换过的台没还回去）'],
    ['any.categoryId = s.categoryId', 'categoryId 未回滚'],
    ['any.convertedAt = s.convertedAt', 'convertedAt 未回滚（好奇卡转化戳复原不了）'],
    ['any.convertedTo = s.convertedTo', 'convertedTo 未回滚'],
    ['detachTaskFromMetrics(d.value, s.id)', 'metric.taskIds 未摘（指标上留死 id）']
  ]
  for (const [needle, why] of must) {
    if (!b.includes(needle)) { console.log(why); return false }
  }
  // 快照必须早于改动：snapOf 只读，错位调用会让回滚把"改动后的值"再写回去
  for (const fn of ['restoreRes', 'restoreTask', 'restoreCurio', 'restoreCat', 'restoreArg']) {
    const body = fnBody(RBC, `function ${fn}`)
    const snap = body.indexOf('snapOf(')
    const clr = body.indexOf('.deletedAt = undefined')
    if (snap < 0) { console.log(`${fn} 未拍快照`); return false }
    if (clr >= 0 && snap > clr) { console.log(`${fn} 快照晚于改动，回滚会写回改动后的值`); return false }
  }
  // REQ-030 口径：persist 后整树替换引用，撤销必须按 id 回当前树找，不能用闭包旧引用
  if (!/find\(x => x\.id === s\.id\)/.test(b)) { console.log('撤销未按 id 回当前树定位（旧引用已失效）'); return false }
  return true;
});

check(NAME(
  'D1-3 ★撤销失败要如实说：找不到卡（已被永久删除）时返回 false 并给「无法撤销」，不假装成功',
  '撤销窗口 6 秒里，用户完全可能先把同一张卡永久删除。此时若仍然报「已撤销」，',
  '界面说撤销成功、数据里卡却真没了——这是回执撒谎，比撤销失败严重得多。',
  '批量恢复更要说清数：可能只有部分条目还能撤，报告要说 n 而不是含糊的「已撤销」。'), () => {
  const r = fnBody(RBC, 'function restored')
  if (!/if \(rollback\(s\)\)/.test(r)) { console.log('未按 rollback 返回值分支'); return false }
  if (!/无法撤销/.test(RBC)) { console.log('缺「无法撤销」失败口径'); return false }
  const all = fnBody(RBC, 'function restoreAll')
  if (!/for \(const s of snaps\) \{ unmarkLeaving\(s\.id\); if \(rollback\(s\)\) n\+\+ \}/.test(all)) {
    console.log('批量撤销未逐条计数并如实报数'); return false
  }
  if (!/已撤销恢复 \$\{n\} 项/.test(all)) { console.log('批量撤销回执未报实际条数'); return false }
  return true;
});

/* ══════════════ D1-4 · 恢复行 150ms 淡出 ══════════════ */

check(NAME(
  'D1-4 ★恢复行淡出 150ms：本地 leaving 缓冲 + .leaving 样式；缓冲行按原 deletedAt 插回原位，且只并入不在 live 里的行',
  '★为什么必须本地缓冲而不能只挂 CSS 动画类：卡片一恢复，软删 computed 当场就不含它了，',
  'v-for 直接把 DOM 节点摘掉——纯 CSS 的 fade-out 类根本没机会播。',
  '★两条合流约束都不可省：① 只并入不在 live 里的行，否则同一张卡渲染两次；',
  '② 按原 deletedAt 插回原位，直接 append 会让恢复中间行时它先跳到末尾再淡出（看着像列表乱滚）。'), () => {
  const b = fnBody(RBC, 'function withLeaving')
  if (!b) { console.log('未找到 withLeaving()'); return false }
  if (!/!live\.some\(y => y\.id === x\.id\)/.test(b)) { console.log('未按 id 去重（同一张卡会渲染两次）'); return false }
  if (!/merged\.splice\(i, 0, e\.obj\)/.test(b)) { console.log('缓冲行未插回原排序位（会跳到末尾再淡出）'); return false }
  // 150ms 与 :class 挂载：五个分区都要接上，否则只有部分分区有淡出
  const ms = /const LEAVE_MS = (\d+)/.exec(RBC)
  if (!ms) { console.log('未定义 LEAVE_MS'); return false }
  if (ms[1] !== '150') { console.log(`淡出时长是 ${ms[1]}ms，规范要求 150ms`); return false }
  for (const v of ['r', 't', 'c', 'a']) {
    if (!new RegExp(`:class="\\{ leaving: isLeaving\\(${v}\\.id\\) \\}"`).test(RBC)) {
      console.log(`有分区未挂 .leaving 类`); return false
    }
  }
  const tpl = RBC.match(/<template>[\s\S]*<\/template>/)
  if (!tpl) { console.log('未取到模板'); return false }
  for (const rows of ['resRows', 'taskRows', 'curioRows', 'catRows', 'argRows']) {
    if (!tpl[0].includes(`in ${rows}`)) { console.log(`模板未使用 ${rows}`); return false }
    if (!RBC.includes(`const ${rows} = computed(`)) { console.log(`未定义 ${rows}`); return false }
  }
  return true;
});

check(NAME(
  'D1-4′ ★回染棘轮：.leaving 必须有 opacity 回落 + pointer-events: none（淡出期间不可再点）',
  'R153-4「降噪只动字号与间距、不降对比度」管的是静态可读性；这里是一次性离场动效，',
  '透明回落正是"走了"的信号，不受那条约束。但**只许在 .leaving 上降**，',
  '不许把 .rb-item 自身的 opacity 或颜色改淡——那会让所有行一起变灰，是实打实的降噪违规。',
  'pointer-events: none 是功能项：淡出中的行若还能点，用户会在它消失后再触发一次操作。'), () => {
  const st = /\.rb-item\.leaving \{([^}]*)\}/.exec(RB)
  if (!st) { console.log('未找到 .rb-item.leaving 规则'); return false }
  if (!/opacity: 0/.test(st[1])) { console.log('.leaving 未回落 opacity'); return false }
  if (!/pointer-events: none/.test(st[1])) { console.log('.leaving 未禁交互'); return false }
  const base = /\.rb-item \{([^}]*)\}/.exec(RB)
  if (base && /opacity\s*:/.test(base[1])) { console.log('.rb-item 自身被改了 opacity（会把所有行一起变灰）'); return false }
  return true;
});

check(NAME(
  'D1-5 ★撤销先摘淡出缓冲再回滚：否则用户点撤销时那一行还在 150ms 缓冲里，看到的是「撤销了却什么都没回来」',
  '这是一条**时序**断言，不是存在性断言：unmarkLeaving 与 rollback 的先后顺序错了，',
  '功能都在、判据都绿，但用户体感是撤销失灵——只有实拍才看得出来，所以在这里钉死。'), () => {
  const r = fnBody(RBC, 'function restored')
  const u = r.indexOf('unmarkLeaving(s.id)')
  const b = r.indexOf('rollback(s)')
  if (u < 0) { console.log('撤销未摘淡出缓冲'); return false }
  if (b < 0) { console.log('撤销未走 rollback'); return false }
  if (u > b) { console.log('顺序反了：应先 unmarkLeaving 再 rollback'); return false }
  const all = fnBody(RBC, 'function restoreAll')
  if (!/unmarkLeaving\(s\.id\); if \(rollback\(s\)\)/.test(all)) { console.log('批量撤销未按同一时序摘缓冲'); return false }
  return true;
});

/* ══════════════ D1-6 · 断点行为（否决不存在的"筛选/收藏"） ══════════════ */

check(NAME(
  'D1-6（V3.9.23 随迁）★回收站取消独立路由与二级页面，直接内嵌设置页右侧；旧 /recycle 深链重定向到设置页，组件仍不得凭空长出收藏/时间筛选',
  '规范原文写「筛选（类型/时间）保持收藏的断点行为」，但回收站**既没有收藏也没有时间筛选**——',
  '核过源码：favorite / dateFrom / sortBy / filter 零命中，只有五个分区 tab。',
  '★照抄会给用户一个不存在的承诺。故本条改为守真正存在的断点：KeepAlive 白名单（那是 tab 跨路由不丢的地基，',
  '★名字被移出白名单就静默失效），并对"收藏/时间筛选"立负锚，防止有人照着规范真去造一个。'), () => {
  const APP = read('/newtab/App.vue')
  const GS = read('/newtab/views/GlobalSettings.vue')
  const ROUTER = read('/newtab/router.ts')
  if (!GS.includes('<RecycleBin v-else-if="activePage === \'recycle\'" embedded')) {
    console.log('回收站未内嵌到设置页右侧内容区'); return false
  }
  if (!ROUTER.includes("path: '/recycle'") || !ROUTER.includes("redirect: { path: '/settings', query: { page: 'recycle' } }")) {
    console.log('旧 /recycle 深链未重定向到设置页内嵌回收站'); return false
  }
  if (!APP.includes('GlobalSettingsView')) {
    console.log('设置页宿主不在 KeepAlive 白名单'); return false
  }
  if (/\b(favorite|favorited|dateFrom|sortBy|filterBy)\b/.test(RBC)) {
    console.log('回收站长出了收藏/时间筛选——规范原文指向的功能并不存在，别照抄'); return false
  }
  return true;
});

check(NAME(
  'D1-7 ★文案诚实性：不许一律写「已恢复到原位置」——归属被改过的恢复必须说出来',
  '规范原文示例是「已恢复到原位置 · 撤销」。但资源卡恢复时可能已被 rehomeIfOrphan 换台/换分类，',
  '此时写「原位置」就是在骗用户；分类恢复更是明说了"其下卡片不会自动归位"。',
  '★所以文案必须跟着 rehome 的实际返回值走（note），有换台才提示，没有就不提示。'), () => {
  const res = fnBody(RBC, 'function restoreRes(')
  if (!/const note = rehomeIfOrphan\(r\)/.test(res)) { console.log('恢复未取 rehome 的真实结果'); return false }
  if (!/restored\(s, note\)/.test(res)) { console.log('回执未按 note 说话'); return false }
  const r = fnBody(RBC, 'function restored')
  if (/已恢复到原位置/.test(r)) { console.log('回执写死「已恢复到原位置」（归属被换过时会撒谎）'); return false }
  // 换台说明必须在场：那正是 rehomeIfOrphan 已经在产出的诚实文案
  const rh = fnBody(RBC, 'function rehomeIfOrphan')
  if (!/原策展台已删除/.test(rh) || !/原分类已删除/.test(rh)) { console.log('换台/换类说明丢失'); return false }
  return true;
});
