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

check('W12-1 ★HERO 区必须是**独立两栏**而不是把工具挤成一条横排。★病根：实际实现把面包屑/6 项读数/7 个按钮全塞进 .tree-page-head 一行 flex，结果首屏第一眼是一行密排小字，原型的 Slogan 完全缺席 —— 结构缺了，不是样式没调好。★本条钉三件事：① <section class="hero"> 在 .tree-layout 之前 ② 左栏 .hero-l 装文案（面包屑/eyebrow/Slogan/副标）③ 右栏 .hero-r 装动作（.hero-acts 视图切换+展开收起+战略目标+AI / .hero-meta 返回+已完成+健康度 / .hero-stats 读数）。★负锚：.tree-page-head 一行密排形态不许复活', () => {
  const t = codeOnly(CT_W11);
  return t.includes('<section class="hero">')
    && t.includes('class="hero-l"') && t.includes('class="hero-r"')
    && t.includes('class="hero-acts"') && t.includes('class="hero-meta"') && t.includes('class="hero-stats"')
    && /^\.hero \{[^}]*display: flex/m.test(t)
    && /\.hero-l \{ flex: 1; min-width: 340px; \}/.test(t)
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

check('W12-6 ★指标头的操作钮必须让位给读 —— 常驻两枚按钮会把指标名挤到换行。★这条钉的是「hover 才显形」这个交互决策本身，防止后续轮次为了"让入口更好找"把它改回常驻（那正是实际截图里"指标名后面跟一排小方块"的成因）。★同时钉住**能力没丢**：两枚按钮仍在模板里（R32-14 加任务 / R135-4 任务层 AI 是六入口之二），只是不再常驻可见', () => {
  const l = codeOnly(LANE);
  const hasBtns = l.includes('@click="emit(\'addTask\', m.id)"') && l.includes('@click="emit(\'aiTask\', m.id)"');
  const hoverOnly = /\.mc-add, \.mc-ai \{[^}]*opacity: 0/.test(l)
    && /\.metric-card:hover \.mc-add, \.metric-card:hover \.mc-ai/.test(l);
  /* 键盘可达：focus-visible 必须也显形，否则 hover 化会把无鼠标用户彻底挡在门外 */
  const a11y = l.includes('mc-add:focus-visible') || l.includes('mc-ai:focus-visible');
  return hasBtns && hoverOnly && a11y;
});

check('W12-7 ★容器内边距属**跨页一致性**纪律，原型的值不许覆盖。★本轮实战：曾把 .compass-layout 的 padding 从 `20px 36px 64px` 改成原型 .page 的 `26px 32px 64px`，结果 R21-3 / R123-3 / R125-1 三条同时红 —— R125「骨架 1440+36」把四页页边距拍成一条纪律，方向台侧的内缩就落在这条规则上。★所以本条把这条纪律显式钉住：容器 padding 必须保持原值，HERO 区的呼吸由 .hero 自身的 margin 承担，不许拿原型的数值去动它', () => {
  const t = codeOnly(CT_W11);
  return t.includes('.compass-layout { display: block; min-height: 100%; padding: 20px 36px 64px; max-width: 1440px; margin: 0 auto; }')
    && /^\.hero \{[^}]*margin-bottom: 22px/m.test(t);
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
  const panelOk = /const layerOpen = ref<1 \| 2 \| 3 \| null>\(null\)/.test(t)
    && /<CompassLayerPanel[\s\S]{0,120}v-if="layerOpen"/.test(t)
  // ③ 折叠判据必须量可见性：v-show 收起时节点仍在 DOM，查存在性会误报
  const audit = codeOnly(fs.readFileSync(path.join(SCRIPTS_DIR, 'theme-audit.cjs'), 'utf8'))
  const foldOk = /offsetParent !== null \|\| getComputedStyle\(body\)\.display !== 'none'/.test(audit)
    && !/const bad = foldedTowers\.filter\(t => t\.querySelectorAll\('\.metric-card'\)\.length > 0\)/.test(audit)
  // ④ 数全年格子的场景必须先点「看全年 ›」进展开态 ——
  //   全年网格自 V3.8.7 起默认收起，dz-heatmap 直接数 .dz-cell 会在收起态数出 0（从 V3.8.7 起就一直红着）。
  //   ★W12 补跑后收窄到「只对 dz-heatmap 生效」：dz-day 的 act 要挑「有记录的格子」
  //   （四格统计带 v-if="dlSum.n" 前置，展开后若再统一展开一次，它的 act 会点到第二层去）。
  const expandOk = /if \(sc\.id === 'dz-heatmap'\)/.test(audit)
    && /await page\.locator\('\.dz-mini-more'\)\.first\(\)\.click/.test(audit)
  return btnOk && panelOk && foldOk && expandOk
});

check('W12-13 ★theme-audit 的场景宿主随 W10 三段式重构搬进了弹窗，判据与 act 必须跟着搬；且「关浮层」要认新弹窗壳。★这一族是本轮补跑真机抓出来的最后一批红：① 概览带宿主 DashboardOverview.vue 整体退役，职责落到 PiHero 的 .pi-hchip 五枚（原判据还钉 .dz-ov/.dz-chip/.dz-calib ⇒ chip=0/5）② 日详情搬进 Heatmap 的 Teleport 弹窗 .dz-day-modal-overlay，且四格统计带 v-if="dlSum.n" 前置 ⇒ act 必须挑「有记录的格子」，点首格必是空白日 ③ ReviewPanel 搬进画像页中央弹窗 .pi-rev-modal，于是 .dz-kpi / .dz-rev-grid / .dz-rpt 三个判据全在空 body 上找 ⇒ 全 0 ④ overlayOpen 只认前两代壳 ⇒ closeOverlays 直接 return，弹窗跨场景残留，把 ② ③ 的红进一步放大。★判据随迁只换承重锚不换所守行为：概览带仍守「五枚 + 同排 + 带口径 + 无错误徽章」', () => {
  const audit = codeOnly(fs.readFileSync(path.join(SCRIPTS_DIR, 'theme-audit.cjs'), 'utf8'))
  // ① closeOverlays 必须认画像页两个新弹窗壳，否则前一场的弹窗会残留到下一场
  const shellsOk = /\.dz-day-modal-overlay, \.pi-rev-overlay/.test(audit)
    && /\.pi-rev-close/.test(audit)
  // ② 概览带判据改钉 PiHero 五枚 chip，且必须钉「同排一行」与「每枚带口径 title」
  const ovOk = /id: 'dz-overview', name: '页头 KPI 带'/.test(audit)
    && /pi-hero-sum \.pi-hchip/.test(audit)
    && /base\.rows === 1/.test(audit)
    && /base\.titled === 5/.test(audit)
  // ③ 负锚：已退役的 DashboardOverview 三件套不得复活（dashboard.css 里仍有 7 条 .dz-calib 规则，
  //    但无任何模板挂载点 —— 样式孤儿不是活体，判据不许再拿它当活证据）
  const ovDead = !/querySelectorAll\('\.dz-ov \.dz-chip'\)/.test(audit)
    && !/\.dz-calib \.cb \.r/.test(audit)
  // ④ 日详情 act 必须挑「有记录的格子」：四格统计带 v-if="dlSum.n" 前置，点首格（全年第一格）必是空白日。
  //    锚「有记录就挑它、挑不到才退回首格」这个兜底语义，不锚整串三元表达式 ——
  //    ★两个踩坑叠在一起：① 锚跨表达式的长字面量，一个转义括号写错就恒红，而它红的方式
  //    与「能力真丢」一模一样；② codeOnly() 抹注释时按等长空白填充，源码里的换行会变成
  //    别的空白形态，所以**不能用 \s+ 去跨行匹配**（实测 \s+ 版恒不匹配、点号版恒匹配）。
  const dayOk = /\.dz-cell\.l1:not\(\.future\)/.test(audit)
    && /has\.count\(\) \? has : page\.locator/.test(audit)
  // ⑤ 三个宿主在弹窗里的场景必须自带开弹窗这一步，且场景 hash 指向画像页
  const modalOk = /async function openReviewModal\(page\)/.test(audit)
    && (audit.match(/await openReviewModal\(page\)/g) || []).length === 3
    && (audit.match(/hash: '#\/profile'/g) || []).length === 3
  // ⑥ 图例判据不许写死数量：V3.8.7 加了第 7 枚「今天」说明项（当日格底色是 heat-N，
  //    图例块要用 accent 描边另画），原判据 `legend.length === 6` 从那版起就一直红。
  //    改成钉「前六项严格等于 LV_NAME 六档 + 第七项必须是今天」—— 少档/改名/多无关项都会红。
  const lgOk = /const SIX = \['静默', '轻触', '常规', '高负荷', '冲刺', '满格'\]/.test(audit)
    && /legend\.slice\(0, 6\)\.join\('\/'\) === SIX\.join\('\/'\)/.test(audit)
    && /legend\[6\] === '今天'/.test(audit)
    && !/legend\.length === 6/.test(audit)
  return shellsOk && ovOk && ovDead && dayOk && modalOk && lgOk
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

check('W12-C4 ★W12-A 的时间轴接线修法必须是「结构性对齐」而不是「把 30px 调成 39px」。原 `.pi-rail::before` 把线钉死在 left:30px，圆点却跟 align-items:center 走 78px 列宽（中心 39px），两套坐标系横向差 7.5px、整列圆点浮在线右侧（2026-10-13 反馈）。修法改为每节点画自己那段连线、与圆点共用 left:50% ⇒ 以后改列宽也不会再偏。判据：① 负锚：.pi-rail::before 与 left:30px 一行都不许回来 ② 连线段挂在 :not(:last-child)::after 且用 left:50% + translateX(-50%) ③ 末节点 padding-bottom:0（线不再向下悬空）④ 线以 bottom:-12px 落在下一个圆点中心（不穿过标签）。★负锚走 codeOnly：修法本身要在注释里讲清「原来错在哪、为何这么改」，而注释里必然出现 `.pi-rail::before` 与 `left:30px` 这两个退役字面量，不剥注释判据恒假（R166 纪律）', () => {
  const raw = read('/newtab/components/profile/pi-timeline.css');
  const css = codeOnly(raw);
  if (/\.pi-rail::before/.test(css)) return false;
  if (/left:\s*30px/.test(css)) return false;
  if (!/\.pi-rnode:not\(:last-child\)::after/.test(css)) return false;
  if (!/left:\s*50%/.test(css)) return false;
  if (!/translateX\(-50%\)/.test(css)) return false;
  if (!/\.pi-rnode:last-child \{ padding-bottom: 0/.test(css)) return false;
  if (!/bottom:\s*-12px/.test(css)) return false;
  // 正锚：注释里必须留改靶缘由（防后来人只看到代码不知道为何这么写）
  return /结构性对齐|永不再偏/.test(raw);
});

check('W12-C5 ★方向台大标题下的定位语必须单行且可读全文。原文 43 字在 620px 容器折成两行，把「六层思维链」大标题的视觉重心往下拽（2026-10-13 反馈）。用户拍板 C4 选「截断 + title 悬浮全文」而非缩小字号——压字号会掉到可读下限以下，而这行是定位语不是正文。判据：① .hero-sub 有 nowrap + 省略三件套 ② 模板带 title 且 title 与正文一字不差（防改了正文忘改悬浮全文）③ 负锚：不许出现改字号的写法（font-size 仍须是 var(--fs-body)）', () => {
  const ct = read('/newtab/views/CompassTree.vue');
  const m = ct.match(/\.hero-sub \{[\s\S]*?\n\}/);
  if (!m) return false;
  const b = m[0];
  if (!b.includes('white-space: nowrap')) return false;
  if (!b.includes('overflow: hidden')) return false;
  if (!b.includes('text-overflow: ellipsis')) return false;
  if (!b.includes('font-size: var(--fs-body)')) return false;
  // title 与正文一致
  const tt = ct.match(/<p class="hero-sub" title="([^"]+)">[\s\S]*?<\/p>/);
  if (!tt) return false;
  const body = ct.match(/<p class="hero-sub" title="[^"]+">\s*([\s\S]*?)\s*<\/p>/);
  if (!body) return false;
  return tt[1].replace(/\s+/g, '') === body[1].replace(/\s+/g, '');
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
  if (!h.includes('>🗂 全部记录</button>')) return false;
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

check('W12-B2 ★「全部记录」必须收敛成**全页唯一一枚**。原先底部底栏一枚、近期模块「操作流」分段头里一枚，共两枚；按拍板上提页头后另两枚都要退役。判据：① 底栏整条不存在（.pi-endbar 与那段「只读纪律」文字一并退役）② PiRhythm 里的「全部记录 ›」按钮零命中，且其 open-log emit 声明也已移除（留声明就是没人 emit 的死通道）③ PiRhythm 那处横向筛选行改用独立类 .pi-flowbar —— 指标行容器 .pi-strip 已改纵向 flex，若还借用会把「筛选器靠左 · 错误出口靠右」的横向布局压坏。★三条负锚一律走 codeOnly：退役缘由必须写在注释里，而注释里必然出现「只读纪律」「全部记录」「.pi-endbar」这些退役字面量，不剥注释判据恒假（R166 纪律）。★另：PiRhythm 底部那句用户可见提示「更早的记录在『全部记录』抽屉按日检索」**不在**收敛范围——入口仍在页面里（只是换了位置），指引依然成立，按 W13 视觉轮统一措辞', () => {
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
  // ③ 横向筛选行独立成类
  if (!rh.includes('class="pi-flowbar"')) return false;
  if (!/\.pi-flowbar \{[^}]*display: flex/.test(css)) return false;
  return true;
});

check('W12-B3 ★指标行必须网格化，且是「方案 A · B3-a」这一支：chip 变等宽网格单元、标签提为独立表头行，列数 = 各模块自身 chip 数（今日 6 / 近期 5 / 全年 4），不强求与下方网格同列数。判据钉住实现形态而不只是效果：① 容器 .pi-strip 改纵向 flex（标签在上、网格行在下）② 新增 .pi-strip-row 用 grid-auto-flow:column + grid-auto-columns:1fr（均分铺满，不靠内容自适应宽）③ .pi-chip 补 min-width:0 + justify-content:center + overflow:hidden，窄屏下数字与标签整体居中不左偏 ④ 三个模块模板各有且仅有一层 .pi-strip-row 包裹 ⑤ hover / active 两态不得在改版中丢掉', () => {
  const css = read('/newtab/components/profile/pi-timeline.css')
  const strip = (css.match(/\.pi-strip \{[^}]*\}/) || [''])[0]
  if (!/\.pi-strip \{[^}]*flex-direction: column/.test(css)) return false
  const row = (css.match(/\.pi-strip-row \{[^}]*\}/) || [''])[0]
  if (!row.includes('grid-auto-flow: column')) return false
  if (!row.includes('grid-auto-columns: 1fr')) return false
  const chip = (css.match(/\.pi-chip \{[^}]*\}/) || [''])[0]
  for (const n of ['min-width: 0', 'justify-content: center', 'overflow: hidden']) if (!chip.includes(n)) return false
  if (!/\.pi-chip:hover \{/.test(css)) return false
  if (!/\.pi-chip:active \{/.test(css)) return false
  for (const f of ['PiToday', 'PiRhythm', 'PiYear']) {
    const s = read('/newtab/components/profile/' + f + '.vue')
    const n = (s.match(/class="pi-strip-row"/g) || []).length
    if (n !== 1) return false
    // 标签必须在 grid 行之外（表头行），不能在网格行里面
    const seg = s.slice(s.indexOf('class="pi-strip"'), s.indexOf('class="pi-strip-row"'))
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

check('W12-D4 ★热力图必须真的退役：调度台无 HeatmapModule 引用，且那个槽位改挂 FocusDetail 且顺序仍在「今日三件事之后、三卡之前」（原热力图的位置锚点不许漂）。同时 Heatmap 组件本体保留——画像洞察页仍在用它，不许连锅端', () => {
  const ch = read('/newtab/views/CompassHome.vue');
  const iH = ch.indexOf('<FocusDetail');
  const iF = ch.indexOf('focusAllDone');
  const iC = ch.indexOf('id="zy-mod-curiosity"');
  if (ch.includes('HeatmapModule')) return false;
  if (iH < 0 || iF < 0 || iC < 0) return false;
  if (!(iH > iF && iH < iC)) return false;
  // Heatmap 本体保留（画像洞察页在用）
  const exists = require('fs').existsSync(require('path').resolve('D:/zhiyuan0904/v2/src/newtab/components/dashboard/Heatmap.vue'));
  if (!exists) return false;
  // 画像洞察页仍在用
  return read('/newtab/components/profile/PiYear.vue').includes('Heatmap');
});

check('W12-D5 ★选中空槽必须显引导态、**不许静默回落**。原式 `focusTasks[selIdx] || focusTasks.find(t => !!t) || null` 会在选到空槽时悄悄回落到另一条任务——你点 02 看的是 01 的内容却以为在看 02（用户 2026-10-13 拍板）。判据：① selTask 只取该槽、无 find 兜底 ② 有 selSlotEmpty 区分「选到空位」③ FocusDetail 有空槽引导态与未选态两种分支', () => {
  const ch = read('/newtab/views/CompassHome.vue');
  const fd = read('/newtab/components/compass/FocusDetail.vue');
  const m = ch.match(/const selTask = computed<TaskCard \| null>\(\(\) =>([^)]*)\)/);
  if (!m) return false;
  if (m[1].includes('find(')) return false;
  if (!ch.includes('const selSlotEmpty = computed')) return false;
  // FocusDetail 两分支 + 引导态文案
  if (!fd.includes('emptySlot')) return false;
  if (!fd.includes('这个位置还空着')) return false;
  if (!fd.includes('点上面任意一件')) return false;
  return true;
});

check('W12-D6 ★七层全貌七层都在，且 ⑥ 那层必须是**本地规则式**、不得出现 AI 调用的痕迹（用户拍板 B4-a：先不做单任务 AI 解读，因为产品里没有这个现成能力，硬上要新增 prompt 与门禁；本地规则按优先级/成熟度/截止/子任务/久未推进/未被调用给直白建议）。判据逐层点名 + 负锚：无 fetch / no AI import / 标题写明「本地判断」', () => {
  const fd = read('/newtab/components/compass/FocusDetail.vue');
  for (const layer of ['是什么', '属于哪', '要做什么', '凭什么', '走过什么', '下一步', '动作']) {
    if (!fd.includes(layer)) return false;
  }
  // 六层链：愿景/使命/战略目标/攻坚项目/成功指标
  for (const lv of ['愿景', '使命', '战略目标', '攻坚项目', '成功指标']) {
    if (!fd.includes(lv)) return false;
  }
  // ⑥ 本地规则：不含 AI 调用痕迹
  if (/fetch\(|XMLHttpRequest|runAI|@\/shared\/ai\//.test(fd)) return false;
  if (!fd.includes('本地判断')) return false;
  // 限高 + 内滚动（用户拍板）
  if (!/max-height:/.test(fd) || !/overflow-y: auto/.test(fd)) return false;
// 两个出口上抛而不自行改数据（纯只读）：负锚 —— 本组件不得出现任何落库动作
  if (!fd.includes("(e: 'edit', task: TaskCard): void")) return false;
  if (fd.includes('store.persist')) return false;
  return true;
});

check('W12-D7 ★双击行为迁移：不再弹抽屉，改走既有 ?hl 定位通道滚动+高亮下方任务列表（用户拍板 B2：同页上方已常驻展示全貌，重复弹抽屉价值不大且列表里双击易误触）。判据：① openCellTask 走 router.push query hl+hk ② 不再 drawerRef.open(c.task) ③ 抽屉改从「全貌」模块的编辑按钮进（onFocusDetailEdit 仍 drawerRef.open）——共享抽屉能力一项未减', () => {
  const ch = read('/newtab/views/CompassHome.vue');
  const m = ch.match(/function openCellTask\(c: FocusCell\) \{[\s\S]{0,300}?\n\}/);
  if (!m) return false;
  const body = m[0];
  if (!body.includes("hk: 'task'")) return false;
  if (!body.includes('hl: c.task.id')) return false;
  if (body.includes('drawerRef')) return false;
  // 抽屉仍在：从全貌模块的编辑按钮进
  if (!ch.includes('function onFocusDetailEdit')) return false;
  if (!ch.includes('drawerRef.value?.open(t)')) return false;
  // 定位通道确实存在（TaskManagerPanel 在 watch 这两个 query）
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
  if (!/function onPageEsc\(e: KeyboardEvent\)[\s\S]{0,300}goBack\(\)/.test(ct)) return false;
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