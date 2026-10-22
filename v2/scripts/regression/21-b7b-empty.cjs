/**
 * 21-b7b-empty（G3 空状态场景专属化 · V3.8.37）— C5 / P3 / W4 / D3 四项断言。
 *
 * ★为什么这一分片盯的是「专属化」而不是「有没有」：
 *   G3（V3.8.27）已经把 12 个空态位收进 EmptyState 四段契约（Icon + 是什么 + 怎么开始 + 主行动），
 *   契约本身有 G3-1/2/4 三条判据守着。本分片管的是**下一层**：同一个契约下，
 *   每个场景该说什么话、配什么图标、有没有真能点的下一步，以及——
 *   ★★最重要的一条：**空态里写的承诺必须是产品真有的**。
 *
 * 本批最大的收获不是四条文案，是 D3 那个负锚（E-4）：
 *   规范原文写「删除的任务、好奇与资源可在 30 天内找回」，但源码里**没有这个机制**
 *   （软删只写 deletedAt，全库无任何定时/过期/清理逻辑，母版里「30 天」出现 0 次）。
 *   照抄就是在空态里对用户撒一个不存在的谎。这类错误静态判据查不出来（文案读起来完全合理），
 *   只能靠「先回真源核机制、再决定怎么写」这条纪律 + 一条负锚把它钉住。
 */
const { read, codeOnly, check } = require('./helpers.cjs')

const CT = read('/newtab/views/CompassTree.vue')
const PC = read('/newtab/views/ProjectCuration.vue')
const WS = read('/newtab/views/Workspace.vue')
const MAP = read('/newtab/components/curation/CurationMindMap.vue')
const RB = read('/newtab/views/RecycleBin.vue')

const NAME = (...parts) => parts.join('')

/* ══════════════ C5 · 方向台空态引导 ══════════════ */

check(NAME(
  'C5-1 ★空态有主行动（原文验收）：方向台零战略目标时给一个能点的按钮，且调的是同一个 addDirection ——',
  '不是页头按钮的复制品。★为什么允许它进层内（推翻 V3.8.27「空态只指路」的裁定）：',
  'R3-B′ 反对的是「两个入口并列让用户不知道点哪个」，这在非空态成立；',
  '但零方向时页头那个按钮挂在骨架条第 3 层、既不在视野内也无参照，等于有入口却够不到。',
  '本条钉「同一个函数」正是为了让两条纪律不打架——不存在两份实现，也就不会写歪。'), () => {
  const i = CT.indexOf('<EmptyState v-if="!d.compass.directions.length"')
  const j = i >= 0 ? CT.indexOf('/>', i) : -1
  const cell = i >= 0 && j > i ? CT.slice(i, j) : ''
  if (!cell) { console.log('     未找到方向台空态'); return false }
  if (!/icon="compass"/.test(cell)) { console.log('     图标非 compass（原文点名 Icon compass）'); return false }
  if (!/action-label="[^"]+"/.test(cell)) { console.log('     缺主行动按钮'); return false }
  if (!/@action="addDirection"/.test(cell)) { console.log('     主行动未调 addDirection'); return false }
  if (!/action-label="＋ 写下第一个战略目标"/.test(cell)) { console.log('     主行动文案须按原文口径'); return false }
  return true
})

check(NAME(
  'C5-2 ★图标语义：方向台空态用 compass 而不是 target。原文「Icon compass」有讲究——',
  'target(target) 说的是「差一个指标数」，带考核味；compass(compass) 说的是「还没有方向」，是处境。',
  '负锚：这一处不许再用 target（其它场景用 target 仍合法，故只钉这一格）。'), () => {
  const i = CT.indexOf('<EmptyState v-if="!d.compass.directions.length"')
  const j = i >= 0 ? CT.indexOf('/>', i) : -1
  const cell = i >= 0 && j > i ? CT.slice(i, j) : ''
  if (!cell) return false
  if (cell.includes('icon="target"')) { console.log('     仍是 target'); return false }
  return cell.includes('icon="compass"')
})

check(NAME(
  'C5-3 ★术语口径：文案不得把战略目标说成「愿景」。产品六层结构是',
  '愿景 → 使命 → 战略目标 → 项目 → 成功指标 → 任务——愿景是最顶上那一层，',
  '方向台这一步引导的是战略目标层。原文写的「从一句愿景开始」用词不准，按母版口径改写；',
  '但**允许**在 hint 里提到愿景与使命（那是给想先写上层的人留的路径，不是把本层改名）。'), () => {
  const i = CT.indexOf('<EmptyState v-if="!d.compass.directions.length"')
  const j = i >= 0 ? CT.indexOf('/>', i) : -1
  const cell = i >= 0 && j > i ? CT.slice(i, j) : ''
  if (!cell) return false
  // title / desc / action-label 三个「本层身份」位不许出现愿景
  const ident = ['title', 'desc', 'action-label'].map((k) => {
    const m = cell.match(new RegExp(k + '="([^"]*)"'))
    return m ? m[1] : ''
  }).join(' | ')
  if (ident.includes('愿景')) {
    console.log('     身份位出现愿景：' + ident)
    return false
  }
  if (!ident.includes('战略目标')) { console.log('     身份位应明确战略目标层'); return false }
  return true
})

/* ══════════════ P3 · 项目详情：零任务空态 + 指标口径 ══════════════ */

check(NAME(
  'P3-1 ★零任务空态存在且是**项目级**而非每指标级：任务挂在指标下，',
  '若按「每个指标零任务」各插一个 EmptyState，一个刚建的项目会一屏排出 3–5 个图标块（画布变图标墙）。',
  '本条钉住判据写法：有指标但整项目零任务时才出空态，且插在指标列表之后。'), () => {
  if (!PC.includes('projectTaskTotal')) { console.log('     缺 projectTaskTotal 项目级计数'); return false }
  if (!PC.includes('firstEmptyMetricId')) { console.log('     缺 firstEmptyMetricId（主行动要对准空指标）'); return false }
  // ★切片纪律（B5 教训）：定长窗口与 [^>]* 都会被模板里的箭头函数 `=>` 截断——
  // 本条的属性值里就有一处三元表达式（firstEmptyMetricId() ? ... : ...），
  // 正则遇到 '>' 即停。改按「起点 → 下一个 '/>' 」结构切，与属性值内容无关。
  const iZero = PC.indexOf('<EmptyState v-if="currentProject.metrics.length && !projectTaskTotal"')
  const jZero = iZero >= 0 ? PC.indexOf('/>', iZero) : -1
  if (iZero < 0 || jZero <= iZero) { console.log('     未找到项目级零任务空态'); return false }
  const cell = PC.slice(iZero, jZero)
  if (!cell.includes('size="section"')) { console.log('     尺寸应为 section（区块级，非整页）'); return false }
  // 负锚：不得出现按指标循环的空态（那是图标墙的写法）
  if (/v-for="[^"]*metrics[^"]*"[\s\S]{0,400}?<EmptyState/.test(PC)) {
    console.log('     疑似在指标 v-for 内插了 EmptyState')
    return false
  }
  return true
})

check(NAME(
  'P3-2 ★零任务空态的主行动必须落到**任务**上：任务必须挂指标才有意义，',
  '所以有空指标时主行动是「在第一个指标下新建任务」，而不是笼统的「添加成功指标」。',
  '无空指标时（理论不该发生）才退回加指标——两条路都在，不会出现点了没反应。'), () => {
  const i = PC.indexOf('<EmptyState v-if="currentProject.metrics.length && !projectTaskTotal"')
  const j = i >= 0 ? PC.indexOf('/>', i) : -1
  const cell = i >= 0 && j > i ? PC.slice(i, j) : ''
  if (!cell) return false
  if (!/action-label="[^"]*新建任务[^"]*"/.test(cell) && !/action-label="[^"]*添加成功指标[^"]*"/.test(cell)) {
    console.log('     主行动文案两态都不在')
    return false
  }
  if (!cell.includes('openTaskAdd')) { console.log('     主行动未调 openTaskAdd'); return false }
  if (!cell.includes('firstEmptyMetricId()')) { console.log('     主行动未对准空指标'); return false }
  return true
})

check(NAME(
  'P3-3 ★指标读数一律附口径 tooltip（原文第二条）：分子分母同屏可见（"2/5"）还不够——',
  '「完成」按什么判、软删任务算不算、归属怎么定，这三点必须说清，否则百分比既不知道数的是谁、',
  '也不知道点了会看到什么。口径与 metricPct 同源，不另写一套算法。'), () => {
  if (!/class="mh-meta" :title=/.test(PC)) { console.log('     mh-meta 未绑定 :title'); return false }
  const i = PC.indexOf('<span class="mh-meta" :title=')
  const j = i >= 0 ? PC.indexOf('</span>', i) : -1
  const cell = i >= 0 && j > i ? PC.slice(i, j) : ''
  if (!cell) return false
  for (const need of ['metricPct(m.id)', '已完成', '本指标任务']) {
    if (!cell.includes(need)) { console.log('     口径缺「' + need + '」'); return false }
  }
  return true
})

/* ══════════════ W4 · 策展台空态引导 ══════════════ */

check(NAME(
  'W4-1 ★（V3.9.8 随迁）策展台空态回到「策展成果」定位：旧卡片网格空态随四视图退役，',
  '现役宿主是 CurationMindMap——空画布必须用 compass 图标与「先确立中心论点」，',
  '有论点但无分支时用 hexagon 说明“结构还空”，两处都要说清用户在这里搭成果。'), () => {
  const emptyThesis = MAP.indexOf('<EmptyState v-if="!thesis"')
  const j1 = emptyThesis >= 0 ? MAP.indexOf('/>', emptyThesis) : -1
  const c1 = emptyThesis >= 0 && j1 > emptyThesis ? MAP.slice(emptyThesis, j1) : ''
  const emptyBranches = MAP.indexOf('<EmptyState v-if="thesis && !nodes.length"')
  const j2 = emptyBranches >= 0 ? MAP.indexOf('/>', emptyBranches) : -1
  const c2 = emptyBranches >= 0 && j2 > emptyBranches ? MAP.slice(emptyBranches, j2) : ''
  if (!c1 || !c2) { console.log('     未找到现役画布两处空态'); return false }
  if (!c1.includes('icon="compass"') || !c1.includes('先确立中心论点')) { console.log('     无论点空态定位不对'); return false }
  if (!c2.includes('icon="hexagon"') || !c2.includes('中心论点下面还没有分支')) { console.log('     无分支空态定位不对'); return false }
  if (WS.includes('这台策展台还空着') || WS.includes('金字塔还空着')) { console.log('     旧空态回流'); return false }
  return true
})

check(NAME(
  'W4-2 ★（V3.9.8 随迁）画布两处空态都必须有主行动：',
  '无论点 → open-create-thesis；有论点无分支 → create-child(root)。',
  '两处行动分别对应用户此刻缺的那一层，不是笼统的“新建”。'), () => {
  const i1 = MAP.indexOf('<EmptyState v-if="thesis && !nodes.length"')
  const j1 = i1 >= 0 ? MAP.indexOf('/>', i1) : -1
  const c1 = i1 >= 0 && j1 > i1 ? MAP.slice(i1, j1) : ''
  const i2 = MAP.indexOf('<EmptyState v-if="!thesis"')
  const j2 = i2 >= 0 ? MAP.indexOf('/>', i2) : -1
  const c2 = i2 >= 0 && j2 > i2 ? MAP.slice(i2, j2) : ''
  if (!c1) { console.log('     未找到零节点空态'); return false }
  if (!c2) { console.log('     未找到空金字塔空态'); return false }
  if (!c1.includes('action-label=')) { console.log('     零节点缺主行动'); return false }
  if (!c1.includes("emit('create-child', 'root')")) { console.log('     零节点主行动应为 create-child(root)'); return false }
  if (!c2.includes("emit('open-create-thesis')")) { console.log('     空画布主行动应为 open-create-thesis'); return false }
  if (!c2.includes('action-label="＋ 写下中心论点"')) { console.log('     空金字塔主行动文案不对'); return false }
  return true
})

check(NAME(
  'W4-3 ★（V3.9.8 随迁）空态次行动不丢：画布无论点时主行动是“写下中心论点”，',
  '同一宿主工具条仍保留「＋ 新建分支」作为先建结构、后补论点的开张路径。'), () => {
  if (!MAP.includes('action-label="＋ 写下中心论点"')) { console.log('     空画布主行动缺失'); return false }
  if (!WS.includes('＋ 新建分支') || !WS.includes("@click=\"mind.createChild('root')\"")) { console.log('     分支次入口缺失'); return false }
  return true
})

/* ══════════════ D3 · 回收站空态 ══════════════ */

check(NAME(
  'D3-1 ★五处空态必须**逐字不同**（按 tabMeta 的五个分区各写各的）：',
  '改前五处全是同一句「这一类还没有删除项」，用户切到任一分区看到的都一样，等于没分区。'), () => {
  const titles = [...RB.matchAll(/title="(这台删除过[^"]*)"/g)].map((m) => m[1])
  if (titles.length !== 5) { console.log('     分类标题数 = ' + titles.length + '（应为 5）'); return false }
  const uniq = new Set(titles)
  if (uniq.size !== 5) { console.log('     去重后仅 ' + uniq.size + ' 类，仍有重复'); return false }
  for (const t of titles) {
    if (!/资源卡|任务卡|好奇心卡|分类|论证卡/.test(t)) { console.log('     标题未点名分区：' + t); return false }
  }
  return true
})

check(NAME(
  'D3-2 ★★保留期口径必须与产品机制一致（本批最重要的一条）。',
  '规范 D3 原文写「可在 30 天内找回」，但源码里没有这个机制：软删只写 deletedAt，',
  '全库无任何定时/过期/清理逻辑，母版里「30 天」出现 0 次——真实口径是软删永久保留。',
  '照抄 30 天等于在空态里对用户撒一个不存在的谎（用户会以为第 31 天卡就没了，反而不敢放重要内容进去）。',
  '本条为**负锚**：回收站任何文案都不许再出现「30 天」这类未实现的期限承诺。'), () => {
  // 负锚只查渲染文案（codeOnly 剥注释），备案注释里复述该词是允许的
  const visible = codeOnly(RB)
  const bad = /30\s*天|三十天|个月内|周后自动|定期清理|自动清除/
  if (bad.test(visible)) {
    const m = visible.match(bad)
    console.log('     出现未实现的期限承诺：' + m[0])
    return false
  }
  // 正锚：必须把真实机制说出来
  if (!visible.includes('没有期限')) { console.log('     未说明「没有期限」'); return false }
  if (!visible.includes('永久删除')) { console.log('     未点明真正不可逆的动作'); return false }
  return true
})

check(NAME(
  'D3-3 ★幽灵按钮「回到调度台」五处都在：回收站空时唯一合理的事就是离开，',
  '主行动位留空（原文 D3「无主行动，或回到调度台幽灵按钮」），不硬凑一个操作。',
  '★判据按「恰好五处」写死，多一处说明有新分区没跟上，少一处说明有分区漏给出口。'), () => {
  const n = (codeOnly(RB).match(/secondary-label="回到调度台"/g) || []).length
  if (n !== 5) { console.log('     幽灵按钮数 = ' + n + '（应为 5）'); return false }
  if (!/router\.push\('\/'\)/.test(codeOnly(RB))) { console.log('     未跳转到调度台'); return false }
  return true
})

check(NAME(
  'D3-4 ★回收站空态**不许有主行动**（原文「无主行动」）：回收站里唯一可做的事是永久删除，',
  '把破坏性操作摆成主行动位，正是 R03/R10 要防的「镜子递鞭子」。',
  '本条为负锚：五处都不得出现 action-label。'), () => {
  const i = RB.indexOf('<EmptyState v-if="!res.length"')
  const j = i >= 0 ? RB.indexOf('/>', i) : -1
  const cell = i >= 0 && j > i ? RB.slice(i, j) : ''
  if (!cell) return false
  if (/action-label=/.test(cell)) { console.log('     回收站空态出现了主行动'); return false }
  return true
})

/* ══════════════ 跨项 · EmptyState 契约不得被绕过 ══════════════ */

check(NAME(
  'E-1 ★本批新增的四处空态必须全部走 EmptyState 组件，不许各写各的裸 div：',
  'G3 立组件就是为了这个——文案与形态一处一套，久了必然长成两种风格。'), () => {
  const spots = [
    [CT, '方向台还空着'],
    [PC, '项目有指标，还没有任务'],
    [MAP, '中心论点下面还没有分支'],
    [MAP, '先确立中心论点'],
    [RB, '这台删除过的资源卡会停在这里'],
  ]
  for (const [src, title] of spots) {
    const i = src.indexOf(title)
    // 往回找最近的 EmptyState 开标签
    const before = src.slice(Math.max(0, i - 400), i)
    if (!before.includes('<EmptyState')) {
      console.log('     「' + title + '」前面 400B 内无 <EmptyState')
      return false
    }
  }
  return true
})

check(NAME(
  'E-2 ★图标名必须真实存在：Icon.vue 对不存在的名字会**静默回落成 compass**，',
  '不查就会得到「看起来对、其实是罗盘」的图标（P0-S4 守的正是这条）。',
  '本批踩过一次：写了 icon="list"，实际该组件没有 list，编译与 tsc 都不会报错。'), () => {
  const iconSrc = read('/shared/components/Icon.vue')
  const start = iconSrc.indexOf('const ICONS')
  const block = iconSrc.slice(start, iconSrc.indexOf('\n}', start))
  const names = new Set([...block.matchAll(/^\s*(\w+):/gm)].map((m) => m[1]))
  const used = [
    ...CT.matchAll(/<EmptyState[^>]*icon="(\w+)"/g),
    ...PC.matchAll(/<EmptyState[^>]*icon="(\w+)"/g),
    ...WS.matchAll(/<EmptyState[^>]*icon="(\w+)"/g),
    ...RB.matchAll(/<EmptyState[^>]*icon="(\w+)"/g),
  ].map((m) => m[1])
  const bad = [...new Set(used)].filter((n) => !names.has(n))
  if (bad.length) { console.log('     不存在的图标名：' + bad.join(', ')); return false }
  if (!used.includes('clipboard')) { console.log('     零任务空态应使用 clipboard'); return false }
  return true
})

check(NAME(
  'E-3 ★术语统一负锚：本批四页的可见文案不得出现已退役的台面叫法。',
  '「工作台」已全量退役、「策展中心」只在历史沿革里出现——',
  '空态是用户第一眼看到的文案，比正文更不该带旧称。'), () => {
  const vis = [CT, PC, WS, MAP, RB].map(codeOnly).join('\n')
  // 只查空态文案片段附近，避免误伤历史注释与正文里的引述
  const titles = [
    ...vis.matchAll(/(?:title|desc|hint|action-label|secondary-label)="([^"]*)"/g),
  ].map((m) => m[1])
  const bad = titles.filter((t) => t.includes('工作台') || t.includes('策展中心'))
  if (bad.length) { console.log('     空态文案带旧称：' + bad[0]); return false }
  return true
})
