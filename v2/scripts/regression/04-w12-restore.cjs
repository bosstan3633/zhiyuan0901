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
  fs, path, check, read, codeOnly, SCRIPTS_DIR, CT_W11, TOWER, LANE, SPINE, PANEL
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
