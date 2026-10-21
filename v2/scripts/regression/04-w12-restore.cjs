/**
 * R174-1 分片 · 04-w12-restore：W12（V3.8.12）方向台按原型 1:1 还原。
 *
 * 为什么要单独开一片：W12 全部动作都是「把已交付的结构摆回原型指定的位置」。
 * 这类改动的失效形态与 W11 完全不同 —— W11 是「新增结构时少做一层」，
 * W12 是「结构都在，但摆错了地方」：元素在、样式在、能力在，唯独**不在原型说的那个位置上**。
 * 而"位置对不对"这件事，W8 / W11 现有的 17 条判据全都钉不到（它们守的是层级与归属，不是版面顺序）。
 * 于是本片专门钉「谁在谁的上面」这条版面关系。
 *
 * 三条踩坑账（照抄本项目既有教训，不新造）：
 *  ① 判据钉跨标签字面量（`class="x"` 后紧跟模板串）对空白极敏感，一次格式化就静默失效 ⇒ 一律用正则或分段锚
 *  ② 删掉一块 UI 会同时产生**样式孤儿**，删完不跑 dead-css-scan 就留下一笔看不见的债（本轮实测：删左栏留下 5 条）
 *  ③ 容器 padding 属跨页一致性纪律，原型的值不能拿来覆盖（W12 试过，撞红 R123/R125/R21-3 三条后改回）
 */
const {
  fs, path, base, check, read, codeOnly, SCRIPTS_DIR, CT_W11, CT_ALL, TOWER, LANE, SPINE, PANEL, CMETA
} = require('./helpers.cjs');

console.log('【W12 · 方向台 1:1 还原（版面归属）】');

check('W12-1 ★HERO 区必须是**独立结构**而不是把工具挤成一条横排。V3.9.7 再重指：视图切换迁到下方项目层行，页头只留全页级别动作；项目塔/全景仍双向可达。★负锚：.tree-page-head、退役的 .hero-l/.hero-r、.hero-tools-menu 下拉壳不许回流', () => {
  const t = codeOnly(CT_W11);
  const hero = t.slice(t.indexOf('<section class="hero">'), t.indexOf('class="hero-stats"'))
  const row = t.slice(t.indexOf('<div class="tl-head-row">'), t.indexOf('<CompassLayerList'))
  return t.includes('<section class="hero">')
    && t.includes('class="hero-acts"') && t.includes('class="hero-stats"')
    && t.includes('class="hero-tools"')
    && !hero.includes('class="view-seg"')
    && row.includes('class="view-seg"')
    && row.includes('项目塔') && row.includes('项目全景')
    && t.includes('↕ ') && t.includes('<Icon name="eye" :size="13"/> 已完成项目')   /* ★F6 ④ 两枚常驻（在 .hero-acts 链上的 .hero-tools 内；G1 迁移后 Icon eye） */
    && !t.includes('hero-tools-menu') && !t.includes('toolsOpen') /* ★F6 负锚：下拉壳与开关 state 零残留 */
    && t.includes('class="dhi-badge"')
    && /^\.hero \{[^}]*display: flex/m.test(t)
    && /\.hero \{[^}]*flex-direction: column/m.test(t)
    && !t.includes('class="hero-l"') && !t.includes('class="hero-r"')
    && !t.includes('class="tree-page-head"');
});

check('W12-2 ★第 1/2 层正文必须住在**层级面板里**而不是在骨架条上方另开一块。★这是本轮最关键的一处归位：原型是 spine → lvpanel → towers 三段，第 1/2 层内容只在 lvpanel 里出现；而实际实现把愿景 22px 大卡摆在 spine **之上**，等于在六层链条之外另起一个平级区块，首屏被它吃掉、"逐层收窄"在版面上断掉。★本条钉「位置」而非「存在」：愿景块必须落在 <template #entity> 插槽内（由 CompassLayerPanel 渲染在骨架条之下），且该插槽必须真的被 CompassTree 提供。★切片锚点踩坑：插槽内是嵌套 <template v-if>，所以收尾必须锚 `</CompassLayerPanel>` 而不是首个 `</template>` —— 后者早于插槽起点，切出来是空串，正锚恒假而负锚恒绿（判据自己骗自己）。★同时钉住**双份文本**这条负锚：面板里不得再写一份只读的愿景/使命（同一句话出现两次会各自漂移，且用户分不清哪份能改）', () => {
  const t = codeOnly(CT_W11);
  const slot = t.slice(t.indexOf('<template #entity>'), t.indexOf('</CompassLayerPanel>'));
  return t.includes('<template #entity>')
    /* 愿景/使命块本体在插槽里 */
    && slot.includes('class="tree-level-card hero" id="layer-1"')
    && slot.includes("startEdit('vision'") && slot.includes("startEdit('mission'")
    /* 就地编辑与关联卡片能力跟着走（能力保留，不许在搬家过程中丢） */
    && slot.includes("toggleLinkPop('vision')") && slot.includes("toggleLinkPop('mission')")
    /* 面板接收插槽 */
    && PANEL.includes('<slot name="entity">')
    /* 骨架条在面板之前 —— 顺序反了就等于面板挂在骨架条之上，与原型相反 */
    && t.indexOf('<CompassSpine') < t.indexOf('<template #entity>')
    /* ★负锚：面板自带一份只读文本 = 双份愿景 */
    && !/\{\{ vision \|\|/.test(PANEL) && !/\{\{ mission \|\|/.test(PANEL);
});

check('W12-3 ★骨架条必须有**头部行**，六层宽度必须编码层级流向。★病根：没有头部的骨架条看起来像"一排统计标签"而不是"六层的骨架"，读者看不出层级从哪开始往哪收。★本条钉：① .spine-h 存在且含名称 + 定位语 + 右侧提示 ② 六层里 1/2/3 段按内容宽（flex:0 0 auto）、4/5/6 段按等分宽（flex:1 1 0）—— 宽度递减就是"逐层收窄"的视觉语法，少了它六层就退化成六个等大的标签', () => {
  const s = codeOnly(SPINE);
  return s.includes('class="spine-h"')
    && s.includes('战略骨架') && s.includes('上层定方向 · 下层见动作')
    && s.includes('class="spine-b"')
    /* 上层三段按内容宽 */
    && /\.spine-lv\.lv1, \.spine-lv\.lv2, \.spine-lv\.lv3 \{[^}]*flex: 0 0 auto/.test(s)
    /* 下层三段按等分宽 —— 两条合起来才是"宽度编码层级流向" */
    && /\.spine-lv\.lv4, \.spine-lv\.lv5, \.spine-lv\.lv6 \{[^}]*flex: 1 1 0/.test(s);
});

check('W12-4 ★左栏必须是**项目导航**而不是六层数字目录。★病根：六层目录是一排纯数字（看不出层级关系），而且它做的事（定位到某一层）骨架条的 1~6 按钮已经在做 —— 同一件事摆两处，第二处就变成"看着像导航、点了其实是另一套"。原型 .navside 是项目清单。★本条钉：① .navside 内是 .ns-item 项目条目（序号/项目名/指标任务数），零 .lt-item ② 定位入口是 gotoTower(projId) 且走 ensureTower（全景下也能抵达）③ 滚动跟随的对象是舱（[data-tower]）不是层', () => {
  const t = codeOnly(CT_W11);
  return /^\.ns-item \{[^}]*cursor: pointer/m.test(t)
    && t.includes('class="ns-item"') && t.includes('class="ns-n"') && t.includes('class="ns-m"')
    && t.includes('function gotoTower(projId: string)')
    && t.includes("ensureTower('定位项目舱')")
    /* 滚动联动的锚是舱容器 */
    && t.includes("querySelectorAll('[data-tower]')")
    /* ★负锚：六层数字目录整族退役（含模板零引用后的样式清账） */
    && !t.includes('class="lt-item"') && !t.includes('.lt-title') && !t.includes('class="layer-toc"')
    && !t.includes('function scrollToLayer(');
});

check('W12-5 ★舱 / 指标 / 任务三层的**尺寸**必须撑得起原型给的呼吸感。★病根：实际截图里舱头右侧（进度环/完成数/六个按钮）在窄栏下挤成两行、任务行只有 4px 上下内边距于是十几条糊成一条灰带 —— "任务属于哪个指标"这条最核心的归属证据反而看不见。★本条钉三处承重：① 舱头右区 .tw-right 必须 flex:none（唯一的换行点是 .tw-head 本身，右区一旦参与换行就叠行）② 指标头必须有一条真正的进度**条**（.mc-bar 轨道 + 数字），不是裸百分数 ③ 任务行必须是独立白底卡（padding 9px 12px + 悬停右移 2px），不是裸行', () => {
  const w = codeOnly(TOWER), l = codeOnly(LANE);
  return /\.tw-right \{[^}]*flex: none/.test(w)
    && /\.tw-idx \{[^}]*width: 34px/.test(w)                 /* 序号牌：舱身份印章，22px 时与指标序号同量级 */
    && /\.tw-ring \{[^}]*width: 42px/.test(w)                 /* 进度环：24px 时光环细到看不出进度 */
    && /\.tw-num b \{[^}]*display: block/.test(w)             /* 完成数两行块，不再与舱头标题同排糊成一行 */
    /* 指标级进度条 */
    && /class="mc-bar"/.test(l) && /\.mc-track \{[^}]*width: 56px/.test(l) && /\.mc-fill \{/.test(l)
    /* 任务行独立卡 + 悬停右移 */
    && /\.tk-row \{[^}]*padding: 9px 12px[^}]*background: var\(--surface\)/.test(l)
    && /\.tk-row:hover \{[^}]*transform: translateX\(2px\)/.test(l)
    /* 任务轨内缩对齐原型 .tasks 的 26px */
    && /\.metric-list \{[^}]*padding: 0 0 0 26px/.test(l);
});

check('W12-6 ★指标头的操作钮必须让位给读 —— 常驻按钮会把指标名挤到换行。★这条钉的是「hover 才显形」这个交互决策本身，防止后续轮次为了"让入口更好找"把它改回常驻（那正是实际截图里"指标名后面跟一排小方块"的成因）。★同时钉住**能力没丢**：按钮仍在模板里（R32-14 加任务 / R135-4 任务层 AI 是六入口之二），只是不再常驻可见。★F1 随迁带备案（2026-10-15）：删除成功指标（.mc-del）与指标「⋯」菜单（.mc-more）并入**同一套 hover 门**——新增入口不新开显形规则，指标头仍只 hover 出一排（选择器锚由两枚扩为四枚，所守决策一字未改；.mc-more.on 常驻显形是菜单展开态，属可见性兜底不算常驻位）', () => {
  const l = codeOnly(LANE);
  const hasBtns = l.includes('@click="emit(\'addTask\', m.id)"') && l.includes('@click="emit(\'aiTask\', m.id)"')
    && l.includes('@click="emit(\'delMetric\', m.id)"');
  const hoverOnly = /\.mc-add, \.mc-ai, \.mc-del, \.mc-more \{[^}]*opacity: 0/.test(l)
    && /\.metric-card:hover \.mc-add, \.metric-card:hover \.mc-ai/.test(l)
    && /\.metric-card:hover \.mc-del, \.metric-card:hover \.mc-more/.test(l);
  /* 键盘可达：focus-visible 必须也显形，否则 hover 化会把无鼠标用户彻底挡在门外 */
  const a11y = l.includes('mc-add:focus-visible') || l.includes('mc-ai:focus-visible');
  /* ★F1 负锚：删除/更多两枚不许自己另开一条常驻显形（opacity: 0 是同一段声明里的基线） */
  const noIndependent = !/\.mc-del \{[^}]*opacity: 1/.test(l) && !/\.mc-more \{[^}]*opacity: 1/.test(l);
  return hasBtns && hoverOnly && a11y && noIndependent;
});

check('W12-7 ★容器内边距属**跨页一致性**纪律，原型的值不许覆盖。★本轮实战：曾把 .compass-layout 的 padding 从 `20px 36px 64px` 改成原型 .page 的 `26px 32px 64px`，结果 R21-3 / R123-3 / R125-1 三条同时红 —— R125「骨架 1440+36」把四页页边距拍成一条纪律，方向台侧的内缩就落在这条规则上。★所以本条把这条纪律显式钉住：容器 padding 必须保持原值，HERO 区的呼吸由 .hero 自身的 margin 承担，不许拿原型的数值去动它。★V3.8.20 值同步（用户拍板「间隙温和 +8」）：.hero 与 .spine-bar 的 margin-bottom 由 22px 提到 30px（左文案栏退役后纵向堆叠变薄，温和补回呼吸；容器 padding 仍一字不动）', () => {
  const t = codeOnly(CT_W11);
  return t.includes('.compass-layout { display: block; min-height: 100%; padding: 20px 36px 64px; max-width: 1440px; margin: 0 auto; }')
    && /^\.hero \{[^}]*margin-bottom: 30px/m.test(t);
});

check('W12-8 ★拆版式不许顺手删能力：HERO 重构后页头原有的八个出口必须逐项在位。★这条是本项目的核心教训「少做了门禁抓不到」的对冲 —— 一次结构调整最容易丢的不是样式而是入口（按钮被并进菜单、返回钮被省掉、统计从模板里消失）。★逐项点名：返回项目详情 / 已完成显隐 / 健康度 / 视图切换双向 / 展开 / 收起 / ＋战略目标 / AI 建议目标 / 项目详情', () => {
  const t = codeOnly(CT_W11);
  return ['goBack', 'toggleShowDone', 'dhiStatus', 'viewMode === \'tower\'', 'viewMode === \'pano\'',
    'expandAllNodes', 'collapseAllNodes', 'addDirection', "aiChain('directions'", '/compass/projects']
    .every(k => t.includes(k));
});

check('W12-9 ★战略目标分组头必须补回原型 .dir-head 的两件承重：「N 战略目标」pill 与右侧发丝线。★病根：实际实现只有一个纯数字方块 + 一整条 border-bottom。数字方块回答不了"这是第几层"，整条下边框则把行内读数与动作组硬生生切成两块 —— 前者丢了第 3 层的语义，后者让按钮组孤零零吊在行尾。原型两件都在：pill 收在左且**点即过滤**（与骨架条芯片同源），发丝线在右收口', () => {
  const t = codeOnly(CT_W11);
  return t.includes('class="dir-badge"')
    && /\{\{ dg\.i \+ 1 \}\} 战略目标/.test(t)
    /* pill 必须真的接上过滤动作，不能只是个静态标签 */
    && /class="dir-badge"[^>]*@click\.stop="onDirFilter\(dg\.dir\.id\)"/.test(t)
    && t.includes('class="dh-line"')
    && /\.dh-line \{[^}]*flex: 1/.test(t)
    /* 下边框退役（发丝线取代它） */
    && !/\.dir-head \{[^}]*border-bottom/.test(t);
});

check('W12-10 ★左栏序号必须**短**，且舱间距只由一层承担。★两条踩坑：① 左栏只有 210px 宽，「目标·项目」复合号（3·1）既占掉项目名前面的空间、又与舱头的 tw-idx 对不上号（读者在两处看到两把不同的尺子），改回「N.M」两级短号；② 舱间距曾同时给 .tower-list 的 gap 与 .tower 的 margin-bottom，两级相加成 80px，比原型松散一倍 —— 间距叠加同样是失真', () => {
  const t = codeOnly(CT_W11);
  return /\{\{ dg\.i \+ 1 \}\}\.\{\{ pi \+ 1 \}\}/.test(t)
    && !t.includes('dg.projs.indexOf(row)')
    && /v-for="\(row, pi\) in dg\.projs"/.test(t)
    /* 间距只由 .tower-list 的 gap 承担一份 */
    && !/\.tower \{[^}]*margin-bottom: \d+px/.test(TOWER);
});

check('W12-11 ★项目舱的渲染顺序必须真的按「主攻 → 置顶 → order」排。★这是 E2E-29 在真机上抓到的真产品缺陷（不是判据漂移）：onProjDrop 把顺序写进了 order 字段、并重排了 visibleProjectsOf 返回的那个 slice 副本，而 dir.projects 原数组的元素顺序从未变；项目舱的渲染顺序又走 compassMeta 的 dir.projects.map（不排序）⇒ 用户拖完看到 toast 报「排到第 N 位」，视觉顺序一动不动。同一根因还有第二个表现：主攻/置顶项目也未必真在前排（E2E-30 只验徽标、从不验排序位置）。★修法：① compassMeta 成顺序唯一真源，对 projects 施加与 visibleProjectsOf 同源的排序键（isFocused → pinned → order，缺省 999）② onProjDrop 把同一份顺序写回 dir.projects。★本条钉两处承重都在，且负锚钉「取数层不得回退成不排序」', () => {
  const meta = codeOnly(CMETA)
  const t = codeOnly(CT_W11)
  // 拆成四个独立布尔再合取 —— 不要写成 `return 注释 表达式`：
  // ASI 会把「return 后换行」判成返回 undefined，判据恒红而每个子句单独跑都是 PASS（本条踩过）。
  // ① 取数层：排序键三段齐，且 projects 是排过的新数组
  const metaOk = meta.includes('projById')
    && /Number\(!!pb\?\.isFocused\) - Number\(!!pa\?\.isFocused\)/.test(meta)
    && /Number\(!!pb\?\.pinned\) - Number\(!!pa\?\.pinned\)/.test(meta)
    && /\(\(pa\?\.order\) \?\? 999\) - \(\(pb\?\.order\) \?\? 999\)/.test(meta)
    && /return \{ dir, projects: sorted \}/.test(meta)
  // 负锚：取数层不得回退成「原数组序直出」—— 那正是本缺陷的成因
  const metaNoRegress = !/return \{ dir, projects \}/.test(meta)
  // ② 落位后把顺序写回原数组（否则下次渲染 / 重开又回旧序）
  const dropOk = t.includes('const orderedIds = list.map((p) => p.id)')
    && /dir\.projects\.sort\(/.test(t)
  // 排序键仍单点承担：视图侧 visibleProjectsOf 保留（它承担已完成项目显隐过滤）
  const keyStillHere = /Number\(b\.isFocused\) - Number\(a\.isFocused\)/.test(t)
  return metaOk && metaNoRegress && dropOk && keyStillHere
});

check('W12-12 ★方向台四个组件里所有 button 都必须显式压掉浏览器默认底色，且层级面板默认收起、判折叠按可见性、仪表盘场景先展开（与原型/现役结构一致）。★四条都是 theme-audit 实跑抓到的：① .tw-act / .twm-item / .mc-toggle / .tk-grade / .tk-unbind 只给了 color 与 padding（或只给 hover 底色），没给静止态background 与 border ⇒ 浏览器默认 buttonface 白底透出来，在 linear/raycast 深色主题下是一排白块、文字被吃掉，看着像"按钮坏了"（notion 下则是白底带框）。② 层级面板默认收起这件事被实现注释写成"默认展开第 1 层"，与原型 .lvpanel 的 max-height 初值 0 相反 —— 注释错会诱导下轮误改成默认展开。③ 判定"折叠是否真折叠"必须查**可见性**不能查 DOM 存在性：舱身用 v-show，收起时 display:none 但节点仍在，按 querySelectorAll 判会误报"假折叠"（本条踩过，一次误报 8 项）。④ 全年网格自 V3.8.7 起默认收起，dz-* 四场景直接找 .dz-cell/.dz-kpi/.dz-ov 会在收起态全落空（这批从 V3.8.7 起就一直红着，本轮才暴露）', () => {
  const tw = codeOnly(TOWER);
  const ln = codeOnly(LANE);
  const t = codeOnly(CT_W11);
  // ① 逐个 button 类：静止态规则里必须自带 background
  // ★用「按类名切开取第一段花括号」而不是正则扫全文 —— 正则在本项目里反复踩坑
  //   （codeOnly 后 \b 边界对 .tw-act 这类带点的名字匹配不到，规则数恒 0 ⇒ 判据恒红）。
  //   切块时顺带跳过所有 `xxx:hover` / `xxx.on` 变体段，只取**静止态**那一段。
  const bodyOf = (src, cls) => {
    let from = 0
    for (;;) {
      const at = src.indexOf(cls, from)
      if (at < 0) return ''
      from = at + cls.length
      const braceAt = src.indexOf('{', at)
      if (braceAt < 0) return ''
      const between = src.slice(at + cls.length, braceAt)
      // 静态段：类名与 { 之间只允许 , 空格 和 换行；带 : / . 的都是变体段，跳过
      if (!/^[\s,]*$/.test(between)) continue
      const close = src.indexOf('}', braceAt)
      return close < 0 ? '' : src.slice(braceAt + 1, close)
    }
  }
  const needBg = [[tw, '.tw-act'], [tw, '.twm-item'], [ln, '.mc-toggle'], [ln, '.tk-grade'], [ln, '.tk-unbind']]
  const btnOk = needBg.every(([src, cls]) => /background\s*:/.test(bodyOf(src, cls)))
  // ② 层级面板默认收起：初值必须是 null（原型 lvpanel 的 max-height 初值就是 0）
  // ★F7 随迁带备案（2026-10-16）：类型由 1|2|3 收窄为 1|2（第 3 层迁出面板改走
  //   layerView 层级专属列表），初值 null 与 v-if 结构不变。
  const panelOk = /const layerOpen = ref<1 \| 2 \| null>\(null\)/.test(t)
    && /<CompassLayerPanel[\s\S]{0,120}v-if="layerOpen"/.test(t)
  // ③ 折叠判据必须量可见性：v-show 收起时节点仍在 DOM，查存在性会误报
  const audit = codeOnly(fs.readFileSync(path.join(SCRIPTS_DIR, 'theme-audit.cjs'), 'utf8'))
  const foldOk = /offsetParent !== null \|\| getComputedStyle\(body\)\.display !== 'none'/.test(audit)
    && !/const bad = foldedTowers\.filter\(t => t\.querySelectorAll\('\.metric-card'\)\.length > 0\)/.test(audit)
  // ④ V3.9.3：画像洞察页的年度热力图默认展开，不再需要点「看全年 ›」。
  //   场景仍要先验证年度宿主在位；折叠概览条只留给其它宿主，展开/收起双回程由 W7-3 守。
  const expandOk = /if \(sc\.id === 'dz-heatmap'\)/.test(audit)
    && /\.dz-months \.dz-cell'\)\.first\(\)\.waitFor/.test(audit)
    && /default-expanded/.test(read('/newtab/components/profile/PiYear.vue'))
    && !/await page\.locator\('\.dz-mini-more'\)\.first\(\)\.click/.test(audit)
  return btnOk && panelOk && foldOk && expandOk
});

check('W12-13 ★theme-audit 的场景宿主每迁一次，判据与 act 就必须跟着搬一次；「关浮层」要认当届弹窗壳。★这一族是补跑真机抓出来的红，已迁五次：① 概览带宿主 DashboardOverview 退役 → PiHero ② 日详情搬进 Heatmap 的 Teleport 弹窗 ③ ReviewPanel 迁入画像页中央弹窗 ④ overlayOpen 壳名失配导致残留 ⑤ ★V3.9.3 四格核心读数从 PiHero 归位 PiOverview（`.pi-ov-kpis > .pi-ov-kpi`）。热力图宿主仍是画像页 PiYear，点热力格现为当日战报直接入口；ReviewPanel 四条场景已产品侧退役并留复活指引。★判据随迁只换承重锚，不换所守行为。', () => {
  const audit = codeOnly(fs.readFileSync(path.join(SCRIPTS_DIR, 'theme-audit.cjs'), 'utf8'))
  // ① closeOverlays 必须认画像页两个新弹窗壳，否则前一场的弹窗会残留到下一场
  const shellsOk = /\.dz-day-modal-overlay, \.pi-rev-overlay/.test(audit)
    && /\.pi-rev-close/.test(audit)
  // ② ★V3.9.3 第五次重指：四格读数从 PiHero 迁入 PiOverview，承重锚改为
  //    `.pi-ov-kpis > .pi-ov-kpi`。旧 `.hero-kpis-grid` 已清零，不许借判据回流。
  //    守的还是同一批行为——四枚都在 / 同排一行 / 每枚带title 口径 / 无错误徽章；
  //    数量由 5 改 4 不是放权：第五枚「活跃度」的维度已并进其余四格的 title 口径里。
  const ovOk = /id: 'dz-overview', name: '概览 KPI 带'/.test(audit)
    && /\.pi-ov-kpis > \.pi-ov-kpi/.test(audit)
    && /base\.rows === 1/.test(audit)
    && /base\.titled === N/.test(audit)
    && /base\.n === N/.test(audit)
  // ③ 负锚：已退役的 DashboardOverview 三件套不得复活。
  //    ★B8（V3.8.41）补：原注释写「dashboard.css 里仍有 7 条 .dz-calib 规则，但无任何模板挂载点」——
  //    换真 census 后那13 条已被 dead-css-scan 判死并删除，负锚从「不许复活」升级为
  //    「CSS 与组件两头都不许再有」，故加一条 dashboard.css 零命中。
  //    备案教训：★「样式孤儿不是活体」这条判断，在 census 失真时只能靠人眼维持；
  //    census 一旦可信，判死就该真删——留着负锚只当护栏、不当记账。
  //    ★B7-e 补一条：`.pi-hchip` 也进了负锚——它与 .dz-calib 同族（只在 CSS 里有字面量）。
  const DASH_CSS = read('/newtab/components/dashboard/dashboard.css');
  const ovDead = !/querySelectorAll\('\.dz-ov \.dz-chip'\)/.test(audit)
    && !/\.dz-calib \.cb \.r/.test(audit)
    && !/pi-hero-sum \.pi-hchip/.test(audit) && !/hero-kpis-grid > \.hero-kpi/.test(audit)
    && !/\.dz-calib/.test(DASH_CSS) && !/\.dz-ov-say/.test(DASH_CSS) && !/\.dz-recentry/.test(DASH_CSS)
  // ④ ★V3.9.3 重指：热力格恢复为当日战报的直接入口（PiYear 的 onHeatmapSel 先保留
  //    selDay 再 emit open-battle）。dz-day 场景走 PiToday 的「打开战报」，
  //    两条入口都必须落到同一枚 .pi-day-modal；判据仍要求 ≥4 格 + 热力带 + 时间线。
  const dayOk = /打开战报/.test(audit)
    && /\.pi-day-modal/.test(audit)
    && /onHeatmapSel/.test(read('/newtab/components/profile/PiYear.vue'))
    && /emit\('open-battle', day\)/.test(read('/newtab/components/profile/PiYear.vue'))
  // ⑤ ★B7-e 重指：⑧ 之后 `openReviewModal` 已随四条场景一起下线（原为恰好 3 处），
  //    改守「**退役的四条场景在代码里有活凭据**」——
  //    ★锚必须落在**代码**而不是注释上：判据跑在 `codeOnly()` 上，注释会被抹成等长空白，
  //    拿注释当锚是这一族第二次栽（第一次是 ④ 的 `has.count() ? has : page.locator`）。
  //    `RETIRED_DASH_SCENES` 这个数组就是给判据看的"这四条已下线"凭据，
  //    配一条反向自证（openReviewModal 已随之删除，复活它必须同时删这个数组）。
  const modalOk = /const RETIRED_DASH_SCENES = \['dz-drill', 'dz-review', 'dz-report', 'dz-entry'\]/.test(audit)
    && !/id: 'dz-(review|report|drill|entry)'/.test(audit)
    && !/async function openReviewModal\(page\)/.test(audit)
  // ⑥ 图例判据不许写死数量：V3.8.7 加了第 7 枚「今天」说明项（当日格底色是 heat-N，
  //    图例块要用 accent 描边另画），原判据 `legend.length === 6` 从那版起就一直红。
  //    改成钉「前六项严格等于 LV_NAME 六档 + 第七项必须是今天」—— 少档/改名/多无关项都会红。
  const lgOk = /const SIX = \['静默', '轻触', '常规', '高负荷', '冲刺', '满格'\]/.test(audit)
    && /legend\.slice\(0, 6\)\.join\('\/'\) === SIX\.join\('\/'\)/.test(audit)
    && /legend\[6\] === '今天'/.test(audit)
    && !/legend\.length === 6/.test(audit)
  // ⑦ ★B7-e 新增：热力图场景的 hash 必须已从调度台改到画像页，且必须声明 host ——
  //    `page.goto(hash)` 只改 hash 不同文档，而画像洞察页是懒 chunk，`settle()` 的稳定判据
  //    里hash 已经是新值了、DOM 节点数还是旧页面的 ⇒ 判成"已沉降"立刻返回，
  //    于是整段判据量的是**上一个镜头的页面**（四主题读数一模一样：chip=0/ 格=0 / 日详情=false）。
  //    这正是「四主题全0 = 都没渲染」那类假绿的变体。守的是「判据之前先验宿主在不在」。
  //★宿主推导必须**按 hash 前缀逐场景分派**（第一版一律落 `.pi-hero`，把标签双栏/手册/⌘K 面板
  //    五屏误判成「未挂载」——守卫自己成了新的假红来源）。三类各钉一个分支，防再退化。
  const hostOk = /host: '\.pi-hmbox'/.test(audit)
    && /const HOST = sc\.host/.test(audit)
    && /sc\.hash\.startsWith\('#\/settings'\) \? '\.gs-panel'/.test(audit)
    && /sc\.hash === '#\/manual' \? '\.mn-page'/.test(audit)
    && !/id: 'dz-heatmap'[^\n]*hash: '#\//.test(audit)
    && !/id: 'dz-day'[^\n]*hash: '#\//.test(audit)
  return shellsOk && ovOk && ovDead && dayOk && modalOk && lgOk && hostOk
});

// ============== W12-C（V3.8.13）任务详情抽屉接线 ==============
console.log('【W12-C · 方向台任务详情抽屉接线】');
check('W12-C1 ★「点了详情不滑出抽屉」这条接线必须真的在：抽屉组件在位（CompassTree 挂 <TaskDetailDrawer ref="detailRef">）且 open 的调用点不止「新建任务成功后」一处。根因备案：W11/W12 新增项目塔与全景时，任务行/详情按钮没有一条 emit 通到 detailRef.open()——抽屉在位、唯独唯一调用点是 onTaskCreated，于是点了没反应（2026-10-13 真机反馈 bug）。判据钉两侧：① 宿主有 openTaskDetail(taskId) 且按 id 找卡后 open ② 项目塔与全景两处模板都绑了 @open-detail ③ CompassLane 声明 openDetail、CompassTower 原样透传——任一侧断掉即红（这正是本条要防的「接线再丢一次」）', () => {
  const ct = read('/newtab/views/CompassTree.vue');
  const lane = read('/newtab/components/compass/CompassLane.vue');
  const tower = read('/newtab/components/compass/CompassTower.vue');
  const tdd = read('/newtab/components/compass/TaskDetailDrawer.vue');
  if (!ct.includes('<TaskDetailDrawer ref="detailRef" />')) return false;
  if (!/function openTaskDetail\(taskId: string\)/.test(ct)) return false;
  if (!/openTaskDetail[\s\S]{0,400}detailRef\.value\?\.open\(t\)/.test(ct)) return false;
  if ((ct.match(/detailRef\.value\?\.open\(/g) || []).length < 2) return false;
  if ((ct.match(/@open-detail="openTaskDetail"/g) || []).length !== 2) return false;
  if (!lane.includes("(e: 'openDetail', taskId: string): void")) return false;
  if (!lane.includes("emit('openDetail', t.id)")) return false;
  if (!tower.includes("(e: 'openDetail', taskId: string): void")) return false;
  if (!tower.includes('@open-detail="emit(\'openDetail\', $event)"')) return false;
  return /defineExpose\(\{[\s\S]{0,200}open/.test(tdd);
});

check('W12-C2 ★那枚写着「详情」实则开成熟度弹层的按钮必须正名（命名陷阱）。它走 emit(\'grade\') → showTaskGrade = 优先级成熟度依据弹层，从来不是任务详情抽屉；叫「详情」会把人引到错的去处——与 C1 的接线缺失叠加，才凑成用户报的「点了没反应」。判据：① 按钮文案是「成熟度」且带 title 说明 ② 负锚：任务行不许再出现文案为「详情」而指向 grade 的按钮 ③ 真正的详情入口挂在任务标题上（tk-title 由 span 改 button，单击 openDetail，带 title 提示）', () => {
  const t = read('/newtab/components/compass/CompassLane.vue');
  const lane = codeOnly(t);
  if (!lane.includes('>成熟度</button>')) return false;
  if (!t.includes('看这条任务的优先级成熟度依据')) return false;
  if (/<button[^>]*>\s*详情\s*<\/button>/.test(lane)) return false;
  if (/emit\('grade'[^)]*\)">详情/.test(t)) return false;
  if (!/<button[^>]*class="tk-title"[^>]*@click="emit\('openDetail', t\.id\)"/.test(t)) return false;
  if (!t.includes('title="打开任务详情抽屉"')) return false;
  return true;
});

check('W12-C3 ★tk-title 由 span 改 button 之后样式不得裸奔：浏览器默认按钮外观（背景/边框/内边距/字体/左对齐/指针）必须显式归零，只给交互态（hover 下划线 + focus-visible 焦点环）加反馈，不许顺手改动既有字号与字色——那两处是 W8-2 六层字阶要守的东西。判据：① 归零六件套齐全 ② hover/focus-visible 两态在位 ③ fs-body / text-2 原值一字未动 ④ 负锚：块内不得硬编码色值。★取块必须锚基础规则（`\\n.tk-title {`）：本文件另有一条 `.tk-row.done .tk-title`（已完成划线态），非锚定会先撞上它', () => {
  const s = read('/newtab/components/compass/CompassLane.vue');
  const block = (s.match(/\n\.tk-title \{[\s\S]*?\n\}/) || [''])[0];
  if (!block) return false;
  const need = ['background: none', 'border: 0', 'padding: 0', 'font-family: inherit', 'text-align: left', 'cursor: pointer'];
  if (!need.every(n => block.includes(n))) return false;
  if (!block.includes('font-size: var(--fs-body)')) return false;
  if (!block.includes('color: var(--text-2)')) return false;
  if (!/\.tk-title:hover \{/.test(s)) return false;
  if (!/\.tk-title:focus-visible \{/.test(s)) return false;
  // 负锚：已完成态那条划线规则必须仍在（别把删除线顺手删了）
  if (!/\.tk-row\.done \.tk-title \{[^}]*line-through/.test(s)) return false;
  return !/#[0-9a-f]{3,6}|rgba?\(/i.test(block);
});

check('W12-C4 ★时间轴接线判据（★W17-C09 · 2026-10-20 用户拍板重指带备案）：原判据守「rail 连线与圆点结构性对齐（left:50%）」。本批用户明确要求「移除时间线及节点」——整条 rail（含连线、圆点、节点间距）随 PiRail 退役，原对齐技法失去承载对象。所守意图改为负锚三条：① 宿主零挂载 PiRail；② .pi-rail / .pi-rnode 活规则零命中（codeOnly，注释里的退役说明不咬）；③ 周期区不再是「78px 轨 + 内容」双列（.pi-tl 不得是 grid 双列）。★这是拍板变更，不是判据调松：导航唯一性由 A3-2 的正锚承担。', () => {
  const pi = read('/newtab/views/ProfileInsights.vue');
  const css = codeOnly(read('/newtab/components/profile/pi-timeline.css'));
  if (pi.includes('<PiRail')) return false;
  if (/\.pi-rail\s*\{/.test(css)) return false;
  if (/\.pi-rnode[\s:.]/.test(css)) return false;
  if (/\.pi-tl \{[^}]*grid-template-columns:\s*78px/.test(css)) return false;
  return /退役/.test(read('/newtab/components/profile/pi-timeline.css'));
});

check('W12-C5 ★方向台大标题下的定位语（.hero-sub）。【W12-A 原判 · V3.8.13】钉 nowrap 截断 + title 同源。★V3.8.20 翻转带备案（用户拍板 2026-10-15）：定位语连同整个左文案栏（.hero-l：面包屑/眉标/大标题/副标）与 N4 就地编辑一并退役 —— 定调语由骨架条 .spine-h「上层定方向 · 下层见动作」承担，方向台首屏直接给「动作 + 状态」。翻转不删断言：正锚改钉退役负锚（.hero-sub 与 cpSub 在 CompassTree codeOnly 零命中，防"文案区回流"），退役缘由写在这里。能力守恒：方向台的"定位语"能力未删 —— 它换了居所（.spine-h 定位语 + 层级面板内联说明），不是消失。', () => {
  const t = codeOnly(read('/newtab/views/CompassTree.vue'));
  return !t.includes('class="hero-sub"') && !t.includes('cpSub') && !t.includes('.hero-sub');
});

// ============== W12-B（V3.8.15）画像洞察页入口收敛 + 指标行网格化 ==============
console.log('【W12-B · 画像洞察页入口收敛与指标版式】');
check('W12-B1 ★页头动作区收敛后必须仍是「刷新 · 导出 ·（错误 N，仅计数>0）· 全部记录」四类能力齐全，一条不减。判据：① 负锚：「AI 解读」与「今日战报」两枚按钮在本组件内零命中（按用户 2026-10-13 拍板，能力由下方模块同级入口承接，不是删除）② 「全部记录」在位且带 title 说明 ③ 错误出口仍是条件渲染 ④ emit 声明与模板一致：ai-read / battle 已从声明里移除，open-log 已加 —— 防「模板改了声明没改」留下没人 emit 的死通道', () => {
  const h = codeOnly(read('/newtab/components/profile/PiHero.vue'));
  const raw = read('/newtab/components/profile/PiHero.vue');
  // ① 负锚
  if (h.includes('AI 解读')) return false;
  if (h.includes('ai-read')) return false;
  if (h.includes("emit('battle')")) return false;
  // ② 全部记录在位
  if (!h.includes('<Icon name="folder" :size="13"/> 全部记录</button>')) return false; /* G1 迁移后 Icon folder */
  if (!raw.includes('打开全量操作记录（类型 / 动作 / 时间三维筛选 + CSV 导出）')) return false;
  // ③ 错误出口仍是条件渲染
  if (!h.includes('v-if="props.errorCount > 0"')) return false;
  // ④ emit 声明同步
  if (!h.includes("(e: 'open-log'): void")) return false;
  if (/\(e: 'ai-read'\)/.test(h)) return false;
  if (/\(e: 'battle'\)/.test(h)) return false;
  // 其余两枚能力仍在
  if (!h.includes('⟳ 刷新')) return false;
  if (!h.includes('<ExportMenu')) return false;
  return true;
});

check('W12-B2 ★「全部记录」必须收敛成**全页唯一一枚**。原先底部底栏一枚、近期模块「操作流」分段头里一枚，共两枚；按拍板上提页头后另两枚都要退役。判据：① 底栏整条不存在（.pi-endbar 与那段「只读纪律」文字一并退役）② PiRhythm 里的「全部记录 ›」按钮零命中，且其 open-log emit 声明也已移除（留声明就是没人 emit 的死通道）③ ★W13-F13 再随迁带备案（2026-10-16）：操作流分段头那处横向筛选行 `.pi-flowbar`（连同 `.pi-seg` 筛选钮与 50 条未按周过滤流水 `.pi-flow`/`.pi-frow`）随 F13「同屏只留一个事实来源」整体退役——原③「改用独立类」的布局保护随主体消失而消解，负锚改为退役后**零命中**（模板 + CSS 双侧，codeOnly 剥注释），正锚钉退役备案注释在位（W13-F13 字样）防无声删除。★三条负锚一律走 codeOnly：退役缘由必须写在注释里，而注释里必然出现「只读纪律」「全部记录」「.pi-endbar」这些退役字面量，不剥注释判据恒假（R166 纪律）。★另：PiRhythm 底部那句用户可见提示「更早的记录在『全部记录』抽屉按日检索」**不在**收敛范围——入口仍在页面里（只是换了位置），指引依然成立，按 W13 视觉轮统一措辞', () => {
  const pi = codeOnly(read('/newtab/views/ProfileInsights.vue'));
  const rh = read('/newtab/components/profile/PiRhythm.vue');
  const rhCode = codeOnly(rh);
  const css = codeOnly(read('/newtab/components/profile/pi-timeline.css'));
  // ① 底栏退役
  if (pi.includes('pi-endbar')) return false;
  if (pi.includes('只读纪律')) return false;
  if (/\.pi-endbar/.test(css)) return false;
  // ② 模块内那枚按钮退役 + 声明不留（负锚只认按钮与 emit，不认注释里的退役说明）
  if (/\.pi-btn[^\n]*全部记录/.test(rhCode)) return false;
  if (/\(e: 'open-log'\): void/.test(rhCode)) return false;
  if (rhCode.includes("emit('open-log'")) return false;
  // ③ 筛选行随操作流整体退役（★W13-F13 带备案：模板与 CSS 零命中，退役注释在位）
  if (rhCode.includes('pi-flowbar')) return false;
  if (css.includes('pi-flowbar')) return false;
  if (!rh.includes('W13-F13') || !read('/newtab/components/profile/pi-timeline.css').includes('W13-F13')) return false;
  return true;
});

check('W12-B3 ★指标行必须网格化，且是「方案 A · B3-a」这一支：chip 变等宽网格单元、标签提为独立表头行。★W13-D2 终态化（2026-10-16 · W13-T6 收官）：四时间模块全部落定 `.strip4`（T3 今日 → T4 本周 → T5 本月 → T6 本年），迁移期「两种容器二选一」的双态判据结束——终态钉死 ① 容器 .pi-strip 纵向 flex（标签在上、网格行在下）② 模板侧：四模块各恰一枚 class="strip4"，迁移期自适应容器在模板零命中 ③ CSS 侧：.strip4 规则 repeat(4,1fr) 在位，自适应容器的样式规则退役（剥注释后零命中——退役带备案只许留在注释里）④ .pi-chip 补 min-width:0 + justify-content:center + overflow:hidden，窄屏下数字与标签整体居中不左偏 ⑤ 标签必须在指标行容器之外（pi-strip-lab 表头行）⑥ hover / active 两态不得丢掉', () => {
  const css = read('/newtab/components/profile/pi-timeline.css')
  const cssCode = css.replace(/\/\*[\s\S]*?\*\//g, '')
  if (!/\.pi-strip \{[^}]*flex-direction: column/.test(css)) return false
  // ③ 终态：自适应容器规则退役——代码（剥注释后）零命中，备案只许在注释里
  if (cssCode.includes('.pi-strip-row {')) return false
  const s4 = (css.match(/\.strip4 \{[^}]*\}/) || [''])[0]
  if (!s4.includes('repeat(4, 1fr)')) return false
  const chip = (css.match(/\.pi-chip \{[^}]*\}/) || [''])[0]
  for (const n of ['min-width: 0', 'justify-content: center', 'overflow: hidden']) if (!chip.includes(n)) return false
  if (!/\.pi-chip:hover \{/.test(css)) return false
  if (!/\.pi-chip:active \{/.test(css)) return false
  for (const f of ['PiToday', 'PiRhythm', 'PiMonth', 'PiYear']) {
    const s = read('/newtab/components/profile/' + f + '.vue')
    // ② 终态：恰一枚 strip4；迁移期容器模板零命中（不许回潮）
    if ((s.match(/class="strip4"/g) || []).length !== 1) return false
    if (s.includes('class="pi-strip-row"')) return false
    // ⑤ 标签必须在指标行容器之外（表头行），不能在网格行里面
    const idx = s.indexOf('class="strip4"')
    if (idx < 0) return false
    const seg = s.slice(s.indexOf('class="pi-strip"'), idx)
    if (!seg.includes('pi-strip-lab')) return false
  }
  return true
});
// ============== W12-D（V3.8.16）调度台：热力图退役 + 今日战报解耦 + 全貌模块 ==============
console.log('【W12-D · 调度台热力图退役与全貌模块】');
check('W12-D1 ★DayDetail 必须**从 Heatmap 里解耦出去**、且解耦是完整的一条：import 走了、Teleport 块走了、open-log emit 声明也走了，三样都干净。这条判据专门防「以为解耦了、其实只删了模板」——留下孤儿 import 会让 build 报错，留下没人 emit 的声明则是死通道。宿主侧 TodayBattleHost 必须把三样都接回来（import + Teleport + @open-log）', () => {
  const hm = codeOnly(read('/newtab/components/dashboard/Heatmap.vue'));
  const tbh = read('/newtab/components/dashboard/TodayBattleHost.vue');
  // Heatmap 侧三样都干净
  if (hm.includes('DayDetail')) return false;
  if (hm.includes('dz-day-modal-overlay')) return false;
  if (/\(e: 'open-log'/.test(hm)) return false;
  // 宿主侧三样都接回
  if (!tbh.includes("import DayDetail from './DayDetail.vue'")) return false;
  if (!tbh.includes('<Teleport to="body">')) return false;
  if (!tbh.includes('dz-day-modal-overlay') && !tbh.includes('dz-day-modal')) return false;
  if (!tbh.includes('@open-log="onOpenLog"')) return false;
  return true;
});

check('W12-D2 ★今日战报宿主必须是「自包含」的：数据桥 useDashboardStats + 事件日志读取 readEventLog + 派生回退 + DayDetail + DashboardLogDrawer 五件都在组件内，CompassHome 一行挂载且源码里不出现 readEventLog（R49-3 负锚）。这正是 HeatmapModule 当年被评为「自包含宿主」的同一套口径，TodayBattleHost 照搬不得缩水——否则 HeatmapModule 一退役，调度台就丢了读日志的通道', () => {
  const tbh = read('/newtab/components/dashboard/TodayBattleHost.vue');
  const ch = read('/newtab/views/CompassHome.vue');
  for (const n of ['useDashboardStats', 'readEventLog', 'derivedEvents', 'DayDetail', 'DashboardLogDrawer', 'useDailyLogRequest']) {
    if (!tbh.includes(n)) return false;
  }
  // 派生回退与刷新语义
  if (!tbh.includes('logEmpty.value ? derivedEvents.value : eventLog.value')) return false;
  if (!tbh.includes('await refreshEventLog()')) return false;
  // 页面侧只挂一行、不碰事件日志
  if (!ch.includes('<TodayBattleHost ref="battleHost" />')) return false;
  if (/readEventLog/.test(ch)) return false;
  return true;
});

check('W12-D3 ★开战报前必须重读事件日志（keep-alive 陷阱的备案）。本组件走 keep-alive 全会话只挂载一次，refreshEventLog 仅在 onMounted 跑；此后新增/删除/调出只进 zy_event_log 缓存，UI 侧 eventLog 快照会冻结在首次挂载那一刻 ⇒ 战报统计过时。判据：watch(pendingDay) 里先 await refreshEventLog() 再消费，onMounted 里也 refresh 一次', () => {
  const tbh = read('/newtab/components/dashboard/TodayBattleHost.vue');
  if (!/watch\(pendingDay,[\s\S]{0,400}await refreshEventLog\(\)/.test(tbh)) return false;
  if (!/onMounted\(\(\) => \{[\s\S]{0,120}void refreshEventLog\(\)/.test(tbh)) return false;
  // openToday 走今天
if (!/openToday\s*=\s*\(\)\s*=>/.test(tbh) || !tbh.includes('todayKey()')) return false;
  if (!tbh.includes('defineExpose({ openToday })')) return false;
  return true;
});

check('W12-D4 ★V3.9.1 随迁备案：热力图仍不得回调度台；原「全貌」槽位已被两栏工作台吸收，今日三件事整行直接打开右侧任务详情。Heatmap 本体仍留在画像洞察页，能力与位置约束继续成立', () => {
  const ch = read('/newtab/views/CompassHome.vue');
  if (ch.includes('HeatmapModule')) return false;
  if (ch.includes('<FocusDetail')) return false;
  if (!ch.includes('@click="openCellTask(c)"')) return false;
  if (!ch.includes('drawerRef.value?.open(c.task)')) return false;
  /* 原热力图槽位现在由今日工作单本身承接：工作单必须在手边卡之前。 */
  if (!(ch.indexOf('class="work-board"') < ch.indexOf('class="hand-board"'))) return false;
  // Heatmap 本体保留（画像洞察页在用）——基路径走 helpers 的 base，禁止硬编码盘符（原 D:/… 在非 Windows 环境恒 false）
  const exists = fs.existsSync(base + '/newtab/components/dashboard/Heatmap.vue');
  if (!exists) return false;
  // 画像洞察页仍在用
  return read('/newtab/components/profile/PiYear.vue').includes('Heatmap');
});

check('W12-D5 ★V3.9.1 随迁备案：空槽仍必须是明确入口，不许静默回落。现役形态为空行「从任务库选取」，点击打开带搜索/项目/状态筛选的弹窗；FocusDetail 的旧空槽分支保留为能力证据，但首页不再以隐式选中态渲染它', () => {
  const ch = read('/newtab/views/CompassHome.vue');
  const fd = read('/newtab/components/compass/FocusDetail.vue');
  if (!ch.includes('class="focus-row empty-row"')) return false;
  if (!ch.includes('@click="openPicker(c.idx)"')) return false;
  if (!ch.includes('class="picker-modal"')) return false;
  if (!ch.includes('v-model="pickerProject"') || !ch.includes('v-model="pickerStatus"')) return false;
  // FocusDetail 两分支 + 引导态文案
  if (!fd.includes('emptySlot')) return false;
  if (!fd.includes('这个位置还空着')) return false;
  if (!fd.includes('点上面任意一件')) return false;
  return true;
});

check('W12-D6 ★「全貌」模块形态与能力守恒。【W12-D 原判】钉七层纵向全貌 + ⑥ 本地规则式（无 AI 痕迹）+ 限高内滚动。★V3.8.21 翻转带备案（用户拍板 P4，2026-10-15）：整块全貌**退役**，改单行三个子任务（恒高 54px）——三栏/七层把「属于哪 / 走过什么 / 下一步 / 属性带」压在首屏，真正要看的三张卡被顶出一屏，"看选中项"反而挡住"选下一件事"。逐条能力去向（属迁移不属丢）：属于哪→卡片 🏷 与抽屉六层链；走过什么→抽屉历史；属性带→卡片徽章 + 抽屉；下一步（本地规则）→ D4 拍板整体退役，判断由 AI 诊断与停滞标承担。翻转不删断言：七层文案/六层链/限高滚动改钉退役负锚（回流即红，说明"全貌"被悄悄搬回来）；正锚改钉单行三态（D1 前3条+溢出 / D2 单击就地勾选 / D5 空态拆分去处）+ 纯只读（不落库）+ 无 AI 调用痕迹这条原判一字未改', () => {
  const fd = read('/newtab/components/compass/FocusDetail.vue');
  const c = codeOnly(fd);
  /* ★退役负锚：七层全貌与六层链文案不许回流（那是被拍板删掉的形态）。
     走 codeOnly —— 文件头注释必须写清退役缘由与能力去向，裸读会把免责说明判成违规 */
  for (const layer of ['是什么', '属于哪', '要做什么', '凭什么', '走过什么', '下一步']) {
    if (c.includes(layer)) return false;
  }
  if (c.includes('本地判断')) return false;
  if (/max-height:/.test(c) || /overflow-y: auto/.test(c)) return false;
  /* ★正锚①：单行三子任务恒高 54px，只摆前 3 条 + 溢出徽标（D1） */
  if (!/min-height: 54px/.test(fd)) return false;
  if (!fd.includes('VISIBLE_MAX = 3')) return false;
  if (!fd.includes('overflow > 0')) return false;
  /* ★正锚②：D2 单击子任务条目 = 就地勾选，emit 上抛宿主（本组件不落库） */
  if (!fd.includes("(e: 'toggleSub', taskId: string, subId: string): void")) return false;
  if (!fd.includes('@click="onToggleSub(st.id)"')) return false;
  /* ★正锚③：D5 空态给「＋ 拆分」直达出口（能力不因删全貌而失去去处） */
  if (!fd.includes("'＋ 拆分'")) return false;
  if (!fd.includes("(e: 'split', task: TaskCard): void")) return false;
  /* ★原判未改：无 AI 调用痕迹（F4 诊断是另一条链，不进这个组件） */
  if (/fetch\(|XMLHttpRequest|runAI|@\/shared\/ai\//.test(c)) return false;
  /* 两个出口上抛而不自行改数据（纯只读）：负锚 —— 本组件不得出现任何落库动作
     （走 codeOnly：文件头注释必须写明"纯只读纪律不变"，查散文会把这句免责判成违规） */
  if (!fd.includes("(e: 'edit', task: TaskCard): void")) return false;
  if (c.includes('store.persist')) return false;
  return true;
});

check('W12-D7 ★V3.9.1 再随迁备案：三件事从「双击」升级为「整行单击」打开共享任务详情；不再跳页，勾选框只负责完成。`?hl=<id>&hk=task` 定位通道保留，二级任务列表继续消费并高亮目标', () => {
  const ch = read('/newtab/views/CompassHome.vue');
  const m = ch.match(/function openCellTask\(c: FocusCell\) \{[\s\S]{0,400}?\n\}/);
  if (!m) return false;
  const body = m[0];
  // ① 整行 → 共享抽屉
  if (!body.includes('drawerRef.value?.open(c.task)')) return false;
  // ② 不再跳转
  if (body.includes('router.push')) return false;
  if (body.includes("hk: 'task'")) return false;
  // ③ 整行绑定与勾选阻断：点勾选不能顺带打开详情
  if (!ch.includes('@click="openCellTask(c)"')) return false;
  if (!ch.includes('@click.stop="c.slot && toggleTodayDone(c.slot)"')) return false;
  // ④ 定位通道与消费方一字未动
  const tmp = read('/newtab/components/compass/TaskManagerPanel.vue');
  return tmp.includes('route.query.hl') && tmp.includes('hk') && tmp.includes('scrollIntoView');
});
// ============== W12-E/F/G（V3.8.17）项目详情入口退役 · 全景联动 · 按钮可读性 ==============
console.log('【W12-E/F/G · 方向台入口退役 · 全景联动 · 可读性】');
check('W12-E1 ★「进项目详情」四枚入口必须真的退役：舱内菜单「📄 进入项目详情页」、全景「📄 详情」、页头「📄 项目详情」、「← 返回项目详情」。判据查**代码形态**（按钮标签闭合、emit 调用、绑定）而不是注释散文——改靶缘由必须留在注释里，查散文判据恒假。/compass/projects 整页与路由未动（⌘K 仍可达），一并钉住', () => {
  const t = CT_ALL;
  const tCode = codeOnly(t);
  // 四枚按钮的代码形态零命中
  if (t.includes("emit('gotoDetail', proj.id)")) return false;
  if (t.includes("emit('gotoDetail', current.proj.id)")) return false;
  if (t.includes('>📄 项目详情</button>')) return false;
  if (t.includes('>← 返回项目详情</button>')) return false;
  if (/>📄 详情<\/button>/.test(t)) return false;
  if (t.includes('@goto-detail=')) return false;
  // gotoDetail emit 声明零命中（codeOnly 剥注释）
  if (tCode.includes('gotoDetail')) return false;
  // 整页与路由仍在
  if (!require('fs').existsSync(path.resolve(base, 'newtab/views/ProjectCuration.vue'))) return false;
  if (!read('/newtab/router.ts').includes("path: '/compass/projects'")) return false;
  return true;
});

check('W12-E2 ★「← 返回项目详情」退役，但**来路感知必须保留**：fromProjId 解析 / goBack 函数 / Esc 接线三件一件不许少——那是「从项目详情深链进来后按 Esc 送回原处」的返回行为（R54-A1），不是"进项目详情"的入口，两者语义不同。这条专门防「删按钮时把 Esc 返回一起删了」。★Esc 接线要在 CompassTree 本体里查（CT_ALL 是多文件拼接，跨文件正则会误判）', () => {
  const ct = read('/newtab/views/CompassTree.vue');
  if (!ct.includes('function goBack')) return false;
  if (!ct.includes('fromProjId')) return false;
  // V3.9.1：KeepAlive 路由守卫加在 Esc 与 goBack 之间，判据只守接线仍在，不限制注释/守卫长度。
  if (!/function onPageEsc\(e: KeyboardEvent\)[\s\S]{0,800}goBack\(\)/.test(ct)) return false;
  // 旧入口「返回方向台」仍零命中
  if (CT_ALL.includes('返回方向台')) return false;
  return true;
});

check('W12-F1 ★全景泳道必须有贯穿连接轨（用户拍板 C2）：项目→成功指标→任务的从属不能只靠"排列在同一条泳道里"推断，要有一条竖轨从指标头垂到最后一个任务行 + 每行一个分支点，轨道色取泳道主色 --hue 与进度条同源。判据：① 轨道与节点 DOM 在位 ② .lane-b 是定位上下文 ③ 轨道用 color-mix(--hue) 而非新增色系令牌 ④ 任务行左侧留出内边距让节点不压文字', () => {
  const L = read('/newtab/components/compass/CompassPanoLane.vue');
  if (!L.includes('class="lane-spine"')) return false;
  if (!L.includes('class="ltask-node"')) return false;
  if (!/\.lane-b \{ position: relative/.test(L)) return false;
  if (!/\.lane-spine \{[\s\S]*?var\(--hue\)/.test(L)) return false;
  if (!/\.ltask \{[\s\S]*?padding: 9px 10px 9px 30px/.test(L)) return false;
  // 负锚：不许硬编码色
  if (/#[0-9a-f]{3,6}/i.test(L.match(/\.lane-spine \{[\s\S]*?\n\}/) ? L.match(/\.lane-spine \{[\s\S]*?\n\}/)[0] : '')) return false;
  return true;
});

check('W12-F2 ★全景泳道的任务标题必须能开任务详情抽屉——这条链路此前**从未存在**，泳道里任务标题只是个 div，点了没反应（W11-10 断言本轮重指时暴露，与 W12-C 的项目塔同款 bug）。判据钉两跳透传：① 泳道层 emit openDetail + 标题改 button（键盘可达）② 全景层 @open-detail 转发 + emit 声明 ③ 树本体 @open-detail="openTaskDetail"。另钉样式归零：div 改 button 后浏览器默认外观必须显式归零，字号字色不动', () => {
  const lane = read('/newtab/components/compass/CompassPanoLane.vue');
  const pano = read('/newtab/components/compass/CompassPano.vue');
  const ct = read('/newtab/views/CompassTree.vue');
  // ① 泳道层
  if (!lane.includes("(e: 'openDetail', taskId: string): void")) return false;
  if (!lane.includes("emit('openDetail', t.id)")) return false;
  if (!/<button[^>]*class="ltask-t"[^>]*@click="emit\('openDetail', t\.id\)"/.test(lane)) return false;
  // ② 全景层
  if (!pano.includes("(e: 'openDetail', taskId: string): void")) return false;
  if (!pano.includes('@open-detail="emit(\'openDetail\', $event)"')) return false;
  // ③ 树本体
  if ((ct.match(/@open-detail="openTaskDetail"/g) || []).length !== 2) return false;
  // 样式归零、字色不动
  const b = (lane.match(/\.ltask-t \{[\s\S]*?\n\}/) || [''])[0];
  for (const n of ['background: none', 'border: 0', 'font-family: inherit', 'text-align: left', 'cursor: pointer']) {
    if (!b.includes(n)) return false;
  }
  if (!b.includes('font-size: var(--fs-micro)')) return false;
  if (!b.includes('color: var(--text)')) return false;
  if (!/\.ltask-t:hover \{/.test(lane)) return false;
  return true;
});

check('W12-G1 ★组件级可读性门禁必须真的在 theme-contrast.cjs 里跑（本条钉门禁本体）：用户 2026-10-13 报「不同主题下按钮看不清」，而令牌门禁当时**全绿**——因为它验的是令牌对，验不到组件自己挑了哪一档。根因实例：notion 主题 --text-4 是 30% 不透明度的深色（对 surface-2 ≈2:1），而一批带文字标签的按钮恰恰挑了它。判据：① theme-contrast.cjs 有 W12-G 段（扫全站交互控件不许用 --text-4）② 本轮修掉的那几处不再用 --text-4 ③ 白名单只放纯装饰/次要标记且逐条写明理由', () => {
  const g = require('fs').readFileSync(path.resolve(SCRIPTS_DIR, 'theme-contrast.cjs'), 'utf8');
  if (!g.includes('W12-G')) return false;
  if (!/交互控件不许用最淡的/.test(g)) return false;
  if (!/W12G_OK/.test(g)) return false;
  // 本轮修掉的几处
  const lane = read('/newtab/components/compass/CompassLane.vue');
  const tg = (lane.match(/\.tk-grade \{[\s\S]*?\n\}/) || [''])[0];
  if (/var\(--text-4\)/.test(tg)) return false;
  const pano = read('/newtab/components/compass/CompassPanoLane.vue');
  const la = (pano.match(/\.lane-add \{[\s\S]*?\n\}/) || [''])[0];
  if (/var\(--text-4\)/.test(la)) return false;
  const cz = read('/newtab/components/compass/CuriosityPanel.vue');
if (/var\(--text-4\)/.test((cz.match(/\.cz-kb-ai \{[\s\S]*?\n\}/) || [''])[0])) return false;
  return true;
});

// ============== N 系列 · 批 A/B/C（V3.8.18）：原型评审 15 条需求落库 ==============
console.log('【N 系列 · 画像洞察 N9 战报入口收敛】');
check('N9 ★PiToday 战报入口收敛（同一弹窗只留一个入口）。【N9 原判 · V3.8.18】strip 里退役「写入记录」「复盘就绪」两枚 chip，只留模块头右上的战报入口。病根＝那两枚不是读数，是**同一个弹窗的另两个入口**（都 emit open-battle），六个 chip 里三个跳同一处，读者要试过才知道它们是一件事；而 strip 自己的语义是"六格读数"。【2026-10-15 用户拍板翻转 ③】同一弹窗不给两个入口，模块头只留一枚战报按钮。【2026-10-16 ★W13-F8 再随迁 ①】四枚读数 chip 定版为 今日入台/今日调出/今日焦点/已备弹药——「今日移出」随 F8 四格定版退役出 strip（全量删除下钻仍在 DashboardLogDrawer 动作筛选，能力一项未减）、「连续打卡」迁 PiYear 年度段（W13-D1 指标去重，全页仅时间轴一处），drill 键随之收窄为 d-in/d-call 两枚（焦点格 → open-focus 跳调度台、弹药格 → 读数徽标非下钻）。现行判据：① 写入记录/复盘就绪两枚重复入口零残留（codeOnly 负锚）② strip 恰为四枚读数 chip（入台/调出/焦点/弹药）且 d-in/d-call 两枚 drill 键在位、d-out/streak 零残留 ③ 模块头只剩一枚 open-battle 入口（文字「打开战报」）④ open-battle emit 通道未被顺手删（模板真实调用 + defineEmits 声明双在）⑤ 宿主侧死数据链已拔（writeCount/reviewReady 零残留），且 onTodayDrill 类型收窄为 d-in/d-call（与 strip 定版同源）。★负锚走 codeOnly：退役理由的注释里必然回指那些词，拿原文直查会自己咬自己', () => {
  const t = codeOnly(read('/newtab/components/profile/PiToday.vue'));
  const p = codeOnly(read('/newtab/views/ProfileInsights.vue'));
  // ① 两枚重复 chip 必须真的不在
  if (t.includes('写入记录')) return false;
  if (t.includes('复盘就绪')) return false;
  // ② ★W13-F8 定版四枚 + drill 收窄（d-out/streak 零残留）
  for (const k of ['d-in', 'd-call']) {
    if (!t.includes(`emit('drill', '${k}')`)) return false;
  }
  // ★W15-T1（用户拍板 2026-10-16）：弹药格由"读数徽标非下钻"改可点 —— 四格不许有死格，
  // 「已备弹药 N 张」的承诺必须能兑现成一份卡片清单（原先点不动）。
  if (!t.includes(`emit('drill', 'd-ammo')`)) return false;
  for (const lab of ['今日入台', '今日调出', '今日焦点', '已备弹药']) {
    if (!t.includes(`>${lab}<`)) return false;
  }
  if (t.includes(`emit('drill', 'd-out')`)) return false;
  if (t.includes(`emit('drill', 'streak')`)) return false;
  // ★W15-T1 终态化：弹药格必须是 button（可点）而非 span —— "能点"这条不许退化成"看着能点"
  // ③ 模块头只剩一枚战报入口（2026-10-15 翻转：由"≥2"改"恰好 1"，理由写在判据正文）
  if ((t.match(/emit\('open-battle'\)/g) || []).length !== 1) return false;
  // ④ emit 通道本身还在（模板里必须有 open-battle 的真实调用，不许只留 defineEmits 声明）
  if (!t.includes(`@click="emit('open-battle')"`) || !t.includes('open-battle')) return false;
  if (!t.includes(`(e: 'open-battle'): void`)) return false;
  // ⑤ 宿主侧死数据链已拔 + onTodayDrill 随 strip 定版收窄
  if (p.includes('const writeCount')) return false;
  if (p.includes('const reviewReady')) return false;
  if (p.includes(':write-count=')) return false;
  if (p.includes(':review-ready=')) return false;
  if (!p.includes(`function onTodayDrill(k: 'd-in' | 'd-call' | 'd-ammo')`)) return false;
  return true;
});

console.log('【N 系列 · 画像洞察 N6 时间轨吸顶 / N7 Hero KPI 居中】');
check('N6 ★时间轨吸顶判据（★W17-C09 · 2026-10-20 用户拍板重指带备案）：原判据守「左轨 sticky 三件套」——本批时间线整体退役，rail 不再存在，吸顶无从谈起。所守意图改为「导航不许丢」的新承载：① 周期区唯一导航是 PiRangeTabs（role="tablist" + 四枚 tab）；② 页签常驻在周期面板之上，切范围不需要滚动找段落；③ 负锚：宿主不再用 IntersectionObserver / scrollIntoView 在四个时间尺度之间做"滚到隐藏段"的导航。', () => {
  const pi = read('/newtab/views/ProfileInsights.vue');
  const range = read('/newtab/components/profile/PiRangeTabs.vue');
  if (pi.includes('<PiRail')) return false;
  if (!pi.includes('<PiRangeTabs')) return false;
  if (!range.includes('role="tablist"')) return false;
  if (!pi.includes("activeRange === 'today'") && !pi.includes('activeRange')) return false;
  /* 注释里允许留「原 timelineAnchor 已删除」的备案，故剥离注释后判 */
  if (/timelineAnchor/.test(codeOnly(pi))) return false;
  /* 只禁「切周期时滚到隐藏段落」的旧接线；wakeCooling 滚 #lc-sec 是年度段内导航，与本条无关。 */
  if (/timelineAnchor/.test(codeOnly(pi))) return false;
  return /退役/.test(pi);
});

check('N7 ★V3.9.3 再随迁：原判「Hero 5 枚 KPI 药丸必须居中」→ 四格读数归位概览后，概览四格仍须等宽铺满。现行判据：① `.pi-ov-kpis` 主规则在位且含 repeat(4, minmax(0, 1fr))（等宽 = 居中语义消解）② 退役负锚走 codeOnly：`.pi-hero-sum {`、`.pi-hchip {` 与旧 Hero 四格规则零命中 ③ 概览四格容器不许 justify-content: flex-start、不许 margin auto 假居中', () => {
  const c = read('/newtab/components/profile/pi-timeline.css');
  const cod = codeOnly(c);
  const m = c.match(/\.pi-ov-kpis \{[\s\S]*?\}/);
  if (!m) return false;
  const s = m[0];
  if (!s.includes('repeat(4, minmax(0, 1fr))')) return false;
  if (/justify-content:\s*flex-start/.test(s)) return false;
  if (/margin:\s*0 auto|margin-left:\s*auto|margin-right:\s*auto/.test(s)) return false;
  // ② 退役负锚（codeOnly 剥注释，防备案注释自匹配）
  return !cod.includes('.pi-hero-sum {') && !cod.includes('.pi-hchip {')
    && !cod.includes('.hero-kpis-grid {') && !cod.includes('.hero-kpi {');
});


check('N8 ★资源卡镜像到策展台（推送方向恢复）：V3.7.0（R179）把镜像入口整条删掉时，统一的只是**数据方向**（真身统一入池），但人的**动作方向**没统一——池里要把一张卡投给某台，得先切台→找节点→点「关联资源卡」→在选择器里搜，四步且是在别的台里做。N8 恢复推送，与策展台侧的拉取同一条 projectCardToBoard（hub.ts），不是两套机制。★本条钉六件事：① 右键菜单非镜像分支含「📡 镜像到策展台…」且序在「移动分类」之后 ② 实现走 projectCardToBoard（引用投射），**不许物理移动**（负锚：给 .workspaceId 直接赋值，= 后面不是 = 的那种）③ 两宿主都有入口（Workspace 选台弹窗 + ResourceDetailDrawer 行内选台）——只改一边等于交付一半，这是 R167 那条规矩 ④ 镜像卡本身不许再投射（isMirrorView 守卫）⑤ App 级宿主的镜像行必须落在 #extra 面板区，**不许进 #footer**（footer 仍是「删除 + 保存」两钮，drawer-res 场景 footCount===2 是 theme-audit 硬门禁）⑥ 老实现 openMirrorCard 仍零残留（N8 新写的是 openMirrorToBoard）', () => {
  const res = read('/newtab/composables/useResourceDrawer.ts');
  const c = codeOnly(res);
  // ① 菜单入口在，且排在「移动分类」之后
  const iMove = c.indexOf("label: '移动分类'");
  const iMir = c.indexOf("label: '📡 镜像到策展台…'");
  if (iMove < 0 || iMir <= iMove) return false;
  // ② 走投影，不许物理移动
  if (!c.includes('projectCardToBoard(')) return false;
  if (/\.workspaceId\s*=(?!=)/.test(c)) return false;
  // ④ 镜像卡守卫
  if (!c.includes('if (isMirrorView(r))')) return false;
  // ⑥ 老实现零残留
  if (c.includes('openMirrorCard')) return false;
  // ③ 宿主一：Workspace 选台弹窗（两钮 + 目标台下拉）
  const ws = read('/newtab/views/Workspace.vue');
  if (!ws.includes('mirrorWsId')) return false;
  if (!ws.includes('确认镜像')) return false;
  if (!ws.includes(':disabled="!mirrorWsId"')) return false;
  if (!ws.includes('v-if="mirrorOpen"')) return false;
// ★宿主二：App 级抽屉 —— ★W17-C06（2026-10-20 用户拍板）重指：
  //   行内「选台下拉」随镜像改判为**中央多选弹窗**而退役（勾选=镜像 / 取消勾选=移出 / 可多选），
  //   所守意图不变：抽屉仍有镜像入口、仍走 projectCardToBoard 引用投射、仍不物理搬卡。
  //   承重锚改为「抽屉入口 + 共享弹窗 + 弹窗内两个写操作」。
  const rdd = read('/newtab/components/ResourceDetailDrawer.vue');
  const c2 = codeOnly(rdd);
  if (!c2.includes('ResourceMirrorModal')) return false;
  if (!c2.includes('mirrorOpen = true')) return false;
  const mm = codeOnly(read('/newtab/components/ResourceMirrorModal.vue'));
  if (!mm.includes('projectCardToBoardEx')) return false;
  if (!mm.includes('removeProjection')) return false;
  /* ★W15-T3（用户拍板 2026-10-16）⑤ 重指：镜像控件由「#extra 属性区」提到 **#link-actions 链接工具行**
     —— 原入口埋在属性区里，用户找不到（列表侧同期补了行内 🪞，两处同口径）。
     ⑤ 守的**意图**是「镜像控件不许进 #footer」（footer 仍是删除 + 保存两钮，theme-audit drawer-res
     footCount===2 是硬门禁），位置在主区任一处都满足；故改钉「#link-actions 或 #extra 内有它」。 */
  const la = rdd.indexOf('<template #link-actions>');
  const lae = rdd.indexOf('</template>', la);
  const es = rdd.indexOf('<template #extra>');
  const ee = rdd.indexOf('</template>', es);
  if (la < 0 || lae < 0 || es < 0 || ee < 0) return false;
  if (!rdd.slice(la, lae).includes('mirrorOpen = true') && !rdd.slice(es, ee).includes('mirrorOpen = true')) return false;
  const fs = rdd.indexOf('<template #footer>');
  const fe = rdd.indexOf('</template>', fs);
  if (fs < 0 || fe < 0) return false;
  const footer = rdd.slice(fs, fe);
  if (/mirror|镜像/i.test(footer)) return false;
  // footer 仍是两钮（与 theme-audit 的 drawer-res footCount===2 同一口径）
  // footer 双钮 = ArmDeleteButton（组件内一只 button）+ 「✓ 保存」——与 theme-audit 的 drawer-res footCount===2 同一口径
  const btns = (footer.match(/<button/g) || []).length + (footer.match(/<ArmDeleteButton/g) || []).length;
  if (btns !== 2) return false;
  return true;
});

check('N2 ★单项目 AI 诊断（与设置页 diagnose 整库会诊**各走各的**）：① 五维度结论由**规则算死**、枚举写死在引擎里（进度停滞=近 14 天无状态变更、指标空转=挂载任务数=0……模型改一个结论就无法断言）② AI **只写建议动作**，parse 对 advice 做长度/条数消毒 ③ 报告存 **chrome.storage.session**（会话缓存，不进主数据、不进导出链）④ 方向台**两态入口**：没报告=🧠 AI 诊断（点开即跑），有报告=标签组 + 📄 诊断报告（打开中央弹窗）⑤ **手动触发**（无定时/无自动跑）⑥ 过期只降亮**不撤标签**（撤了反而看不出这个项目曾经有过结论）。另钉：registry 里 project-diagnose 与 diagnose 两个入口并存（独立新 job，不是改旧的）', () => {
  // ① 引擎：五维度枚举写死 + 规则函数是导出的纯函数
  const eng = read('/shared/ai/projectDiagnose.ts');
  const c = codeOnly(eng);
  if (!c.includes('export function runProjectDiagnosis')) return false;
  if (!c.includes('export const DIAG_DIM_LABEL')) return false;
  if (!/progress: '项目完成情况'[\s\S]*metrics: '成功指标'[\s\S]*breakdown: '任务与任务拆解'[\s\S]*completion: '任务完成情况'[\s\S]*overall: '项目整体进展'/.test(c)) return false;
  if (!c.includes('STALL_WINDOW = 14 * DAY')) return false;
  if (!c.includes('OVER_SUBTASKS = 8')) return false;
  // ① 枚举标签只能经 f() 助手产出（AI 拿到的是 tag 名，自造词不进标签组）
  if (!c.includes('function f(dim')) return false;
  // ② AI 只写建议：apply 必须拿**规则重算**的那份盖章，不是拿模型回的结论
  if (!c.includes('const fresh = runProjectDiagnosis(ctx.d, ctx.projId) || rep')) return false;
  if (!c.includes('fresh.advice = advice')) return false;
  if (!c.includes('buildFactsText')) return false;
  if (!c.includes('projectDiagSystem')) return false;
  if (!c.includes('rows.length >= 5')) return false;
  if (!c.includes('s.length > 200')) return false;
  // ③ 会话缓存 + keys 真源
  if (!c.includes('storage?.session')) return false;
  if (!c.includes('K.PROJ_DIAG')) return false;
  const keys = codeOnly(read('/shared/storage/keys.ts'));
  if (!keys.includes("PROJ_DIAG: 'zy_proj_diag_v1'")) return false;
  // ⑤ 手动触发：引擎与宿主都不许有定时器/自动跑
  if (/setInterval\(/.test(c)) return false;
  // ④ 两态入口落在舱头状态挂件里（W11-12 把只读侧整块拆出 CompassTowerStatus，
  //    塔本体只留 props + 两个 emit —— 判据跟着组件走，不许在塔里找已搬走的东西）
  const st = read('/newtab/components/compass/CompassTowerStatus.vue');
  if (!st.includes('class="tw-diag"')) return false;
  if (!st.includes("@click=\"emit('diagReport', projId)\"")) return false;
  if (!st.includes("@click=\"emit('diagRun', projId)\"")) return false;
  if (!st.includes('🧠 AI 诊断')) return false;
  if (!st.includes('📄 诊断报告')) return false;
  if (!st.includes('v-for="t in tags"')) return false;
  if (!st.includes('.tw-diag.stale .dt')) return false;
  if (!st.includes('stale?: boolean')) return false;
  // 塔侧只负责接线（挂件真被 import + 两态 emit 通到宿主，能力没在拆件时丢）
  const cp = read('/newtab/components/compass/CompassTower.vue');
  if (!cp.includes("import CompassTowerStatus from './CompassTowerStatus.vue'")) return false;
  if (!cp.includes('@diag-run=')) return false;
  if (!cp.includes('@diag-report=')) return false;
  if (!cp.includes("(e: 'diagRun', projId: string)")) return false;
  if (!cp.includes("(e: 'diagReport', projId: string)")) return false;
  if (!cp.includes('diagStale?: boolean')) return false;
  // ⑥ 宿主：恢复缓存 + 采纳回调顶开弹窗 + 中央弹窗挂载
  // ★F4 随迁带备案（2026-10-15）：诊断入口从「只有项目塔一处」扩到三处（全景项目头 + 项目策展页头），
  //   会话缓存必须全站一份 ⇒ 三段宿主逻辑（建 job / 恢复缓存 / 采纳顶开）下沉 composable useProjectDiag
  //   单一实现，三个宿主共用；判据跟着搬进 composable —— 所守行为（手动触发 / 恢复 / 顶开）一字未改。
  const dg = codeOnly(read('/newtab/composables/useProjectDiag.ts'));
  if (!dg.includes('buildProjectDiagnoseJob(')) return false;
  if (!dg.includes('loadAllDiagnoses()')) return false;
  if (!dg.includes('setProjectDiagSavedHandler(')) return false;
  /* 懒加载红线：诊断引擎按需 import，AI 栈不进宿主的入口 chunk */
  if (!dg.includes("import('@/shared/ai/projectDiagnose')")) return false;
  /* 模块级单例：跨宿主共享同一份会话缓存（否则塔里诊断完全景还是空的） */
  if (!/const sharedDiags = shallowRef/.test(dg)) return false;
  const tr = read('/newtab/views/CompassTree.vue');
  if (!tr.includes('useProjectDiag(')) return false;
  if (!tr.includes('<ProjectDiagnoseModal')) return false;
  if (!tr.includes(':diag="diagFor(panoEffectiveId)"')) return false;
  if (!tr.includes(':diag="diagFor(row.proj.id)"')) return false;
  /* ★F4 三处入口：全景项目头 + 项目策展页头都挂 CompassTowerStatus 两态挂件 */
  const pano = read('/newtab/components/compass/CompassPano.vue');
  if (!pano.includes('class="ph-diag"') || !pano.includes('<CompassTowerStatus')) return false;
  const pc = read('/newtab/views/ProjectCuration.vue');
  if (!pc.includes('useProjectDiag(') || !pc.includes('<CompassTowerStatus')) return false;
  // 弹窗形态：Teleport + overlay + 过期条 + 导出 HTML/MD（PNG 二批）
  const md = read('/newtab/components/compass/ProjectDiagnoseModal.vue');
  if (!md.includes('<Teleport to="body">')) return false;
  if (!md.includes('class="pd-stale"')) return false;
  if (!md.includes('function exportHtml()') || !md.includes('function exportMd()')) return false;
  // 与设置页 diagnose 并存（不是改旧的）
  const reg = codeOnly(read('/shared/ai/jobs/registry.ts'));
  if (!reg.includes("id: 'project-diagnose'")) return false;
  if (!reg.includes("id: 'diagnose'")) return false;
  return true;
});
