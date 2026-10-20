/**
 * R175-1 分片 · 03-w11-pyramid：W11（V3.8.11）方向台战略金字塔的**结构契约**。
 *
 * 为什么独立成分片：W11 把方向台第 4 层从「三列并排网格」改成「纵向项目舱」，六层从 CompassTree.vue
 * 一个文件拆到五个（Spine/LayerPanel/Tower/Lane + compassMeta 取数层），并新增「项目全景」第二视图。
 * 这些结构一旦被悄悄改回去，症状不是报错而是**用户看得见的体验塌陷**（归属丢失、区隔消失、
 * 过滤看不出为什么少了一截），所以值得单独钉一份。
 *
 * ★本分片的判据设计原则（来自 V3.8.7 两次「少做了」实证——回归/typecheck/build 全绿但功能是残的）：
 *   **凡新增布局或交互，判据必须钉「结构归属」与「双向可达」，不能只钉「元素存在」。**
 *   两条具体形态：
 *     ① 无内容布局容器（连接线竖轨/横臂/层级带段间箭头）必须在**父容器的正确方向**下被钉住；
 *        只钉 `::before` 存在的话，把 `flex-direction: column` 写成 row 它照样绿。
 *     ② 任何展开/切换/过滤必须有**回程**，且回程入口常驻可见。只钉"展开得开"的话，
 *        单向门（开了回不去）会全绿通过。
 * 依赖基建见 ./helpers.cjs。
 */
const {
  check, read, codeOnly, CT_W11, TOWER, LANE, SPINE, PANEL, PANO, PANO_LANE, CMETA, CT_ALL
} = require('./helpers.cjs');

console.log('【W11 · 方向台战略金字塔结构契约】');

// ============== 一、六层拆分的归属与体量 ==============

check('W11-1 ★第 4 层的排布必须是「纵向舱序列」，三列并排网格彻底退役。项目之间只靠列边界时扫视易串行、归属靠"在哪一列"推断；纵向舱用「独占容器 + 左侧 4px 色条 + 舱间大间距」把区隔变成结构事实。★负锚必须走 CSS 选择器（`.tree-columns-grid {`）而不是裸类名 —— 退役说明写在注释里提到这个类名是**应该的**（那是随迁备案的一部分），裸类名负锚会把备案注释判成违规。`repeat(3, 1fr)` 收窄到树本体 CT_W11：Spine 的六层三列网格与看板列布局同形，全站扫会误伤。★W12(V3.8.12)随迁备案：舱间距由 4px 改为 40px（原型 .towers 的 `--sp-8`）—— 4px 是当初"纵向序列"刚落地时的值，舱几乎贴着舱，"区隔明确"这个本条要守的东西反而没做到。判据改为钉**间距存在且 ≥24px**，钉死具体像素会让"跟随原型调呼吸感"反复改判据；同时补钉「舱自身不再叠一份 margin」—— 两级间距相加成 80px 会把页面撑得比原型松散一倍，同样是失真', () => {
  const gapM = /\.tower-list \{[^}]*gap: (\d+)px/.exec(CT_W11);
  const gap = gapM ? Number(gapM[1]) : 0;
  return gap >= 24
    /* ★F7 随迁带备案（2026-10-16）：第 3/5/6 层专属列表占位后，塔/全景/列表走
       v-if / v-else-if 互斥链（打开列表即整体切换下方形态），本条锚随改 v-else-if ——
       守的"第 4 层 = 纵向舱序列 + id=layer-4"语义不变，互斥性反而更强。 */
    && CT_W11.includes('<div v-else-if="viewMode === \'tower\'" class="tower-list" id="layer-4"')
    && !CT_W11.includes('.tree-columns-grid {')
    /* ★间距只由 .tower-list 的 gap 承担一份，舱体自身不许再叠 margin-bottom */
    && !/\.tower \{[^}]*margin-bottom: \d+px/.test(TOWER)
    && !/grid-template-columns:\s*repeat\(\s*3,\s*1fr\s*\)/.test(CT_W11);
});

check('W11-2 ★连接线竖轨与分叉横臂必须**归属到正确的父容器方向**。这三样都是无内容元素（::before/容器 div），肉眼看不出作用，删了或挪了父容器方向，视觉归属证据就没了而门禁照绿：① .tw-rail::before 是从项目色条分下来的竖轨（挂在 .tw-rail 上，父容器 position:relative）；② .tw-rail > section::before 是每张指标卡分出的横臂；③ .metric-list::before 是 Lane 内的任务行竖轨。★所以本条同时钉「伪元素存在」+「父容器有 position:relative」+「父容器显式声明了 flex-direction」三条一起，只钉第一条会被改方向骗过去。★W12(V3.8.12)随迁备案：横臂宽 12→15px、任务轨内缩 22→26px（对齐原型 .metric::before 宽 20px / .tasks padding-left 26px），锚点改为钉**宽度存在且 >0**而非具体像素 —— 钉死像素会让"跟随原型调轨道缩进"这种纯视觉调整反复改判据，而本条守的是"臂与轨都在、且挂在正确的父容器上"', () => {
  const railInTower = /\.tw-rail \{[^}]*position: relative/.test(TOWER);
  const railLine = /\.tw-rail::before \{[^}]*position: absolute[^}]*width: \d+px/.test(TOWER);
  /* ★W12 补钉铆钉点：原型 .metric::after 那个圆点是横臂的收头，删了横臂会变成一根断头线 */
  const rivet = /\.tw-rail > :deep\(section\)::after \{[^}]*position: absolute/.test(TOWER);
  const arm = /\.tw-rail > :deep\(section\)::before \{[^}]*position: absolute[^}]*width: \d+px/.test(TOWER);
  const railBodyHasStack = /\.tw-body \{[^}]*padding:/.test(TOWER) && /\.tw-rail \{[^}]*padding-left:/.test(TOWER);
  const laneRail = /\.metric-list::before \{[^}]*position: absolute[^}]*width: \d+px/.test(LANE);
  const laneParentRel = /\.metric-list \{[^}]*position: relative/.test(LANE);
  /* .metric-list 是 <ul>（块级堆叠），任务行靠 margin/gap 自然竖排，
     所以"父方向"在这里的正确形态是「相对定位 + padding-left 让出竖轨」而不是 flex-direction ——
     钉错形态会逼着实现改结构去迎合判据，那是判据反噬。 */
  const laneParentIndent = /\.metric-list \{[^}]*padding: 0 0 0 \d+px/.test(LANE);
  const tkRowArm = /\.tk-row::before \{[^}]*position: absolute/.test(LANE);
  return railInTower && railLine && arm && rivet && railBodyHasStack && laneRail && laneParentRel && laneParentIndent && tkRowArm;
});

check('W11-3 ★所有展开/切换都必须**双向可达**（开了能回、点了有出口）。V3.8.7 两次实证的同一个坑：只给"展开"不给"收起"，用户点开后就回不去原样，且回归/typecheck/build 全绿。本条逐个钉回程：① 层级面板同层再点收起；② 项目舱 ▸/▾ 双向；③ 指标卡展开/收起；④ 视图切换两按钮常驻；⑤ 筛选态提示条带"清除筛选"。★判据钉的是"回程入口存在且文案/形态成对"（▸ 对 ▾、tower 对 pano），不是钉某个变量名。★F7 增强带备案（2026-10-16）：① 收窄为层 1/2 面板锚 + 新增第 3/5/6 层专属列表的**双回程**锚（同层再点 onLayerList 收起 + ✕ 返回按钮，两个出口都要在——只给一个入口就是又造了一扇单向门）', () => {
  return CT_W11.includes('layerOpen.value === lv ? null : lv')            /* ① 面板同层再点收起 */
    && CT_W11.includes('layerView.value === lv ? null : lv')              /* ①★F7 列表同层再点收起 */
    && CT_W11.includes('@close="layerView = null"')                       /* ①★F7 列表 ✕ 返回（第二出口） */
    && TOWER.includes(':aria-expanded="open"')
    && TOWER.includes("{{ open ? '▾' : '▸' }}")                          /* ② 舱折叠双向 */
    && LANE.includes("{{ open ? '收起 ▾' : '展开 ▸' }}")                  /* ③ 指标双向 */
    && CT_W11.includes("viewMode === 'tower'") && CT_W11.includes("viewMode === 'pano'")
    && (CT_W11.match(/class="vs-b"/g) || []).length === 2                /* ④ 两个按钮都在 */
    && CT_W11.includes('v-if="dirFilter || riskOnly"') && CT_W11.includes('clearFilters')
    && CT_W11.includes('class="hf-clear"') && CT_W11.includes('清除筛选');   /* ⑤ 筛选有出口（★B5-c：并入 hero 后类名随迁，只钉出口与文案，不钉图标尺寸） */
});

check('W11-4 ★断链必须**双向都显性**：正向「缺任务的指标」亮 ⚠ 并给虚线空位；反向「无归属任务」进收容区可一键挂指标。只做正向会漏掉"任务已经录了但没挂到指标上"这一类——它是数据录入的常态，比缺任务更隐蔽。判据钉两处宿主都在（舱内纵向 + 全景横向），且收容区必须带可点出口（只显示不给出路等于制造绝望）。★空位承重处随 W11-12 拆到 CompassPanoLane', () => {
  return LANE.includes('class="mc-orphan"')                                          /* 正向：指标卡内断链空位 */
    && TOWER.includes('class="tw-orphans"') && TOWER.includes('＋ 挂指标')           /* 反向：舱内收容 */
    && PANO.includes('class="lane orph"') && PANO.includes('＋ 挂指标')              /* 反向：全景收容泳道 */
    && CT_W11.includes('bindOrphan')
    /* ★空态不许悄悄消失：缺任务在两种视图里都要占位可见 */
    && PANO_LANE.includes('class="lane-empty"') && PANO_LANE.includes('＋ 建第一条任务')
    /* ★正向在 Lane 里也要有常规加任务出口（不能只在断链时才出现"加任务"路径） */
    && LANE.includes('＋任务');
});

// ============== 二、集中取数层 ==============

check('W11-5 ★方向台的数字必须**单一真源**：骨架条六层数、舱体计数、指标任务全部吃 compassMeta 一次聚合的结果，不许模板内逐项现算。病根是原型化改造前 `tasksForMetric()` 写在视图里、又被模板调 6 次/指标 —— 指标一多就是每轮重渲染几十次 filter + sort，是性能红线背后的暗债。★本条钉的是「取数发生在取数层」+「现算函数已消失」两端；Map 的锚点钉**实例化处**（接口里的类型声明 `byMetric: Map<...>` 与 `new Map<string, MetricMeta>()` 是两处，钉任何一处都会因改写法误红）', () => {
  return CMETA.includes('export function buildCompassMeta(')
    /* 实例化：两个索引 Map 各一处 */
    && (CMETA.match(/new Map<string, MetricMeta>\(\)/g) || []).length === 1
    && (CMETA.match(/new Map<string, ProjectMeta>\(\)/g) || []).length === 1
    /* 取数层内部必须只做一次分桶，不许每个指标各扫全表 */
    && CMETA.includes('const bucket = new Map<string, TaskCard[]>()')
    /* ★负锚：视图层的老现算函数必须消失（连同它的转发壳 metricTaskRows）。
       留着不报错、也不影响功能，但它是"以后有人顺手又用回去"的入口 —— 性能债会悄悄复活。 */
    && !/function tasksForMetric\(/.test(CT_ALL)
    && !/function metricTaskRows\(/.test(CT_ALL)
    /* 舱体 / 骨架条 / 全景都吃 CompassMeta（不是各自 props 拼数字） */
    && TOWER.includes('meta: ProjectMeta') && SPINE.includes('meta: CompassMeta')
    && PANO.includes('meta: CompassMeta');
});

check('W11-6 ★成熟度等级色只做小圆点/小徽标，绝不许用在指标名或任务名上 —— 那会造成"等级压过标题"的层级倒置（W7 的 V3.8.7 病灶在方向台的复现形态）。等级色令牌真名以 tokens.css 为准：--success / --info-blue / --warning / --danger（**没有** --ok / --info，记错就是静默失效）', () => {
  return CMETA.includes('export function gradeColorVar(')
    && CMETA.includes("grade === 'A' ? 'var(--success)'")
    && CMETA.includes("'var(--info-blue)'") && CMETA.includes("'var(--warning)'") && CMETA.includes("'var(--danger)'")
    /* ★负锚：老令牌名一旦复活就是渲染成继承色而不报错 */
    && !CMETA.includes('var(--ok)') && !CMETA.includes('var(--info)')
    /* 等级必须走 inline style 而不是给标题加 class（加了就会连带改字号）
       ★承重处随 W11-12 拆到泳道组件 */
    && PANO_LANE.includes(":style=\"{ color: gradeColorVar(gradeOf(t)) }\"")
    /* ★等级色不许落在标题/正文选择器上 —— 这是"层级倒置"的机械判据。
       踩坑账：前两版分别写成「标题不许有 color」与「除徽标外不许有 color」，两次都错锚 ——
       正文色（--text/--text-3）与完成态（--success）本来就该出现在标题上，
       真正要禁的只有**等级色四件套**（success / info-blue / warning / danger，且只在色值位置上）落在标题上。
       所以扫的是：标题类选择器（.ltask-t / .lane-n）里有没有这四个令牌当 color。 */
    && !/\.(?:ltask-t|lane-n)[^{]*\{[^}]*color:\s*var\(--(?:success|info-blue|warning|danger)\)/.test(PANO_LANE)
    && !/color:\s*var\(--(?:success|info-blue|warning|danger)\)/.test(
      PANO_LANE.slice(0, PANO_LANE.indexOf('<style')))   /* 模板内联色也不许 */
    /* 反向正锚：等级色确实用在了等级徽标上（否则本条就成了空约束） */
    && /\.lb-g \{[^}]*cursor: pointer/.test(PANO_LANE)
    && (LANE + TOWER).includes('gradeColorVar');
});

// ============== 三、项目全景（横向第二视图） ==============

check('W11-7 ★项目全景必须是**横向泳道**而不是纵向长列表的另一种写法：一根泳道 = 一条成功指标，泳道内竖排该指标的任务，顶部一条层级带把「第 4 层项目 › 第 5 层指标 › 第 6 层任务」的从属直接印在结构上。★V3.8.21 翻转带备案（用户拍板 F3，2026-10-15）：层级带由「三段等高色块 + flex 递增 1.25/2/2.6 + clip-path 折角箭头」**压成单行面包屑**（.bd-seg ×3 + .bd-sep ×2，约 28–32px 高），三段竖排副文案全砍 —— 层级带与泳道区抢首屏高度，而它承载的「从属」在单行面包屑里同样成立（分隔符 › 就是折角箭头的等价物，从属感不靠伪元素）。翻转不删断言：折角 clip-path 与三段递进宽度改钉退役负锚（回流即红），正锚改钉单行三段 + 分隔符 + 所守不变量（泳道横向 / 固定宽列向堆叠 / 组件真实挂载）。★泳道本体已随 W11-12 拆到 CompassPanoLane（承重处随之迁移，判据随迁带备案）', () => {
  const L = PANO_LANE;
  return PANO.includes('class="lanes"')
    && /\.lanes \{[^}]*display: flex[^}]*overflow-x: auto/.test(PANO)
    /* 泳道本体：一根固定宽、列向堆叠 */
    && /\.lane \{[^}]*flex: 0 0 262px[^}]*flex-direction: column/.test(L)
    /* ★V3.8.21 单行面包屑：三段 .bd-seg + 两枚 .bd-sep 分隔符（层号 + 英文标 + 计数都在段内） */
    && (PANO.match(/class="bd-seg"/g) || []).length === 3
    && (PANO.match(/class="bd-sep"/g) || []).length === 2
    && PANO.includes('第 4 层') && PANO.includes('第 5 层') && PANO.includes('第 6 层')
    /* ★退役负锚：三段等高色块与 clip-path 折角不许回流（单行面包屑是拍板后的形态） */
    && !PANO.includes('class="bd"')
    && !/\.bd:nth-child/.test(PANO)
    && !/clip-path: polygon\(0 0, 100% 50%, 0 100%\)/.test(PANO)
    /* 泳道组件必须被真实挂载（不是"文件写了但没接"） */
    && PANO.includes('<CompassPanoLane') && PANO.includes('import CompassPanoLane from');
});

check('W11-8 ★全景视图的三态必须都在：① 零任务泳道占位可见（让"缺"在全景里同样显性）；② 无归属收容泳道固定在泳道区**最后**（红框 + 挂指标出口）；③ 项目选择条常驻可点，换主体不需要回项目塔。★第③项是双向可达：只钉"能切过去"的话，选择条被条件渲染藏起来就绿了，所以判据钉它与 .pano 同级常驻。★空位可见的承重处随 W11-12 拆到 CompassPanoLane', () => {
  const L = PANO_LANE;
  return L.includes('class="lane-empty"') && L.includes('＋ 建第一条任务')
    && PANO.includes('class="lane orph"') && PANO.includes('＋ 挂指标')
    /* 收容泳道在 .lanes 内的最后一个 section（在 metrics 的 v-for 之后） */
    && PANO.indexOf('class="lane orph"') > PANO.indexOf('<CompassPanoLane')
    /* 选择条：与 pano 同级、v-for 全量项目、不受筛选影响 */
    && PANO.includes('class="pano-pick"') && PANO.includes('v-for="r in pickRows"')
    && PANO.includes("emit('pick', r.proj.id)")
    /* ★双向：全景头有「⇅ 回项目塔」，且落地时带 dirFilter + 展开该舱（不做"回来就丢上下文"的假双向） */
    && PANO.includes("emit('toTower', current.proj.id)")
    && CT_W11.includes('function backToTower(') && CT_W11.includes('dirFilter.value = owner.dir.id');
});

check('W11-9 ★全景视图必须真的是**同一份数据的第二种投影**，不是第二个实体世界：数据只来自 compassMeta 的 props，不得自行再聚合一次（两处聚合 = 两处口径，将来必然漂）。同时：形态切换不得丢筛选态（viewMode 与 dirFilter/riskOnly 互不相干），任何定位类动作（左侧项目导航 / 骨架条定位入口 / 断链行）在全景下都必须**先切回纵向再定位**——不切的话点在全景里会静默失灵，看着像坏了。★W12(V3.8.12)随迁备案：左栏由六层数字目录改为项目导航后，定位入口从 scrollToLayer(n) 改为 gotoTower(projId)，两条 ensureTower 调用点随之改钉 —— 本条守的是"任何定位都能抵达、不挑视图"，不是钉某个函数名。★F7 再随迁带备案（2026-10-16）：第 5/6 层的"定位到一条实体"由层级专属列表**行内「定位」**承担（onListLocate → 关列表 + gotoTower），骨架条第 4 层定位语义不变（onLocateLayer 收窄 lv:4，ensureTower 模板串锚与"先切回纵向"语义照旧）', () => {
  return PANO.includes('meta: CompassMeta')
    && !/buildCompassMeta\(/.test(PANO)                                 /* 组件内不重复聚合 */
    && CT_W11.includes("const viewMode = ref<'tower' | 'pano'>('tower')")
    /* 形态切换不清筛选 */
    && !/viewMode\.value = .*\n?[^\n]*dirFilter\.value = ''/.test(CT_W11)
    /* ★定位必须先 ensureTower：左侧项目导航、onLocateLayer、gotoOrphans 三处都要走它 */
    && CT_W11.includes('function ensureTower(')
    && CT_W11.includes("ensureTower('定位项目舱')")
    && CT_W11.includes('ensureTower(`定位第 ${lv} 层`)')
    /* ★F7：骨架条定位收窄为第 4 层 + 第 5/6 层走列表行内定位（同一条 ensureTower/gotoTower 通道） */
    && CT_W11.includes('function onLocateLayer(lv: 4)')
    && CT_W11.includes('function onListLocate(')
    /* ★全景下滚动不得改左栏高亮（横向视图不产生纵向层级信号，否则会乱跳） */
    && /function onCanvasScroll\(\)[\s\S]{0,200}viewMode\.value === 'pano'\) return/.test(CT_W11)
    /* 筛选态提示条：过滤是隐形的就会让人以为项目丢了。★B5-c（V3.8.33）随迁：横幅并入 hero 工具行后压成胶囊，
       类名由画布内那枚改为页头这枚 —— 钉的是"这页任何视图下都看得到被什么收窄"，不是钉它横在哪。 */
    && CT_W11.includes('class="hero-filter"')
    && CT_W11.includes('{{ dirFilterName }}');
});

check('W11-10 ★全景里的动作能力不得比项目塔少（否则"换个视图就丢功能"）。逐项对齐：勾选完成 / 成熟度详情 / 加任务 / 加指标 / AI 建议指标 / 挂指标 / 回项目塔 / 换主体（+任务详情抽屉，W12-C 起）。**跨两层组件的出口要查两跳**（泳道 emit → 全景转发 → 树本体 @监听）—— 只查一跳会漏，而漏了的表现是"按钮在、点了没反应"。同样，动作一律上抛给父组件统一执行，不自己写库、不自己弹层。★W12-E 退役带备案：「进详情页」一项从清单移除（项目塔/全景就地看全，四枚项目详情入口本轮退役），任务详情抽屉（W12-C 的 openDetail）补进清单', () => {
  const L = PANO_LANE;
  const PANO_L = PANO + '\n' + L;
  /* ① 泳道层出口 */
  const laneEmits = [
    ['勾选完成', "emit('toggleTask', t.id)"],
    ['成熟度详情', "emit('taskGrade', t.id)"],
    ['任务详情抽屉', "emit('openDetail', t.id)"],
    ['加任务-空位', '＋ 建第一条任务'],
    ['加任务-页脚', "emit('addTask', m.id, projId)"]
  ];
  const missingLane = laneEmits.filter(([, lit]) => !L.includes(lit)).map(([n]) => n);
  /* ② 全景层出口 + 透传（泳道的三项必须转发上来） */
  const panoOwn = [
    ['加指标', "emit('addMetric', current.proj.id)"],
    ['AI 建议指标', "emit('aiMetric', current.proj.id)"],
    ['挂指标', "emit('bindOrphan', t.id, current.proj.id)"],
    ['回项目塔', "emit('toTower', current.proj.id)"],
    ['换主体', "emit('pick', r.proj.id)"],
    ['透传-勾选', "@toggle-task=\"emit('toggleTask', $event)\""],
    ['透传-等级', "@task-grade=\"emit('taskGrade', $event)\""],
    ['透传-加任务', "(mid, pid) => emit('addTask', mid, pid)"],
    ['透传-详情抽屉', "@open-detail=\"emit('openDetail', $event)\""]
  ];
  const missingPano = panoOwn.filter(([, lit]) => !PANO_L.includes(lit)).map(([n]) => n);
  /* ③ 树本体 @监听逐条接线（漏接线 = 点了没反应） */
  const wired = ['@toggle-task="toggleTask"', '@task-grade="showTaskGrade"', '@open-detail="openTaskDetail"',
    '@add-task="(mid, pid) => openTaskAdd(mid, pid)"', '@add-metric="addMetric"', '@ai-metric="(id) => aiChain(\'metrics\', id)"',
    '@bind-orphan="bindOrphan"', '@to-tower="backToTower"', '@pick="panoId = $event"'];
  const notWired = wired.filter(w => !CT_W11.includes(w));
  if (missingLane.length) console.error('   · 泳道层缺出口：' + missingLane.join('、'));
  if (missingPano.length) console.error('   · 全景层缺出口：' + missingPano.join('、'));
  if (notWired.length) console.error('   · 树本体未接线：' + notWired.join('、'));
  return missingLane.length === 0 && missingPano.length === 0 && notWired.length === 0;
});

// ============== 四、焦点与层级纪律 ==============

check('W11-11 ★方向台焦点契约：**愿景是唯一的主体**。D1 已拍板（用户 2026-10-13 三选一）：愿景保持 --fs-display(22px)，**不新增 --fs-hero、不动 W8-5 判据**，主角感靠版式承担 —— 独占一行 + 上下大留白 + 强调框。配套：项目名 --fs-title(15px)、指标 --fs-sub(12px)、任务 --fs-micro，层级必须真的分层。★负锚必须走 `var(--fs-display)` / `var(--fs-hero)` 的**用法**而不是裸词：`--fs-hero` 在三个新组件的纪律注释里出现是**应该的**（那是判据自带的免责说明），裸词负锚会把自己的说明判成违规。判据钉用法（`font-size: var(--fs-display)` 计数），不钉词。★W12(V3.8.12)随迁备案：愿景正文随结构归位搬进层级面板（骨架条之下），"重边框"改为**左侧 2px accent 实轨 + 大留白** —— 面板自带卡面，块内再套卡会变成双层框把主角压下去；本条守的"主角感必须由版式承担、不许只降字号"没变，锚点随之改钉实轨', () => {
  /* 愿景正锚：.tl-text 是愿景正文的承重选择器（--fs-display） */
  const visionDisplay = /\.tl-text \{[^}]*font-size: var\(--fs-display\)/.test(CT_W11);
  /* 版式补偿：独占一行 + 大留白 + accent 实轨（外框随 W12 由 shadow-lg 重框改为实轨，面板自带卡面） */
  const heroPad = /\.tree-level-card\.hero \{[^}]*padding: 14px 0 16px 16px/.test(CT_W11);
  const heroRail = /\.tree-level-card\.hero \{[^}]*border-left: 2px solid var\(--accent\)/.test(CT_W11);
  /* 层级纪律：使命降级，不得与愿景同规格 */
  const missionSub = /\.tl-text\.sub \{[^}]*font-size: var\(--fs-headline\)/.test(CT_W11);
  /* ★负锚必须走 codeOnly：六个新组件的头部都有「★全组件不得出现 font-size: var(--fs-display)」
     这句纪律注释，而它本身含被判定的字面量 —— 不剥注释就会把自己的说明判成违规。
     这条踩坑与 R59-3 同族（codeOnly 不剥块注释，所以负锚要么走更窄的锚、要么先剥注释）。
     这里双保险：codeOnly 之外再要求"全站没有真正定义 --fs-hero 令牌"（注释提过不算）。 */
  const code = codeOnly(SPINE) + codeOnly(PANEL) + codeOnly(TOWER) + codeOnly(LANE) + codeOnly(PANO) + codeOnly(PANO_LANE);
  const noDisplay = !/font-size:\s*var\(--fs-display\)/.test(code);
  const noHeroUse = !/var\(--fs-hero\)/.test(code);
  const tokens = read('/shared/styles/tokens.css');
  const noHeroToken = !/--fs-hero\s*:/.test(tokens);
  const projectName = /\.tw-name-t \{[^}]*font-size: var\(--fs-title\)/.test(TOWER);
  const panoName = /\.ph-n \{[^}]*font-size: var\(--fs-title\)/.test(PANO);
  if (visionDisplay && (CT_W11.match(/font-size:\s*var\(--fs-display\)/g) || []).length !== 1) {
    console.error('   · 方向台 fs-display 不止一处（焦点契约要求愿景唯一）');
  }
  return visionDisplay && heroPad && heroRail && missionSub && noDisplay && noHeroUse && noHeroToken && projectName && panoName
    && (CT_W11.match(/font-size:\s*var\(--fs-display\)/g) || []).length === 1;
});

check('W11-12 ★W11 不得让方向台变成第二个"全文件巨物"。R164-2 单片 ≤900 行的增长闸只管回归分片，源码侧同样要防 —— 本条把方向台**每个组件**都钉在 400 行内（超了就是它承担了两件事，该拆），取数层钉在 260 行内。★本条在 2026-10-13 真的拦下了一次：CompassPano 初版 440 行 ⇒ 拆出 CompassPanoLane。这是"上限靠拆件而不是放宽"的第三次执行（V3.8.7 拆回归分片、W11 一批拆六层组件、本条拆全景泳道）', () => {
  const lines = (p) => read(p).split('\n').length;
  const comps = {
    'CompassSpine': lines('/newtab/components/compass/CompassSpine.vue'),
    'CompassLayerPanel': lines('/newtab/components/compass/CompassLayerPanel.vue'),
    'CompassTower': lines('/newtab/components/compass/CompassTower.vue'),
    'CompassLane': lines('/newtab/components/compass/CompassLane.vue'),
    'CompassPano': lines('/newtab/components/compass/CompassPano.vue'),
    'CompassPanoLane': lines('/newtab/components/compass/CompassPanoLane.vue')
  };
  const meta = lines('/newtab/views/compassMeta.ts');
  const over = Object.entries(comps).filter(([, n]) => n > 400);
  if (over.length) console.error(`   · 单组件超 400 行：${over.map(([k, n]) => `${k} ${n}`).join('、')}（应再拆）`);
  if (meta > 260) console.error(`   · 取数层超 260 行：${meta}（应再拆）`);
  /* 取数层必须是独立文件（判据随迁时跨文件读就靠它），且六组件都真被 import 而非"文件写了没接" */
  const imports = ['CompassSpine.vue', 'CompassLayerPanel.vue', 'CompassTower.vue', 'CompassPano.vue'];
  const notImported = imports.filter(f => !CT_W11.includes(f));
  return over.length === 0 && meta > 0 && meta <= 260 && notImported.length === 0
    && CT_W11.includes("from './compassMeta'") && CMETA.includes('export interface CompassMeta')
    /* 全景必须真的接进方向台（只做文件不接线 = 功能等于没做） */
    && CT_W11.includes("viewMode === 'pano'") && CT_W11.includes('<CompassPano');
});

check('W11-13 ★舱色六档必须**从 --accent 派生**而不是新增色系令牌（D2 已拍板：N = 88/70/52/38/26/16 的 color-mix）。理由：四主题各有一套原生色系，新增令牌就要在四个主题里各调一次，且调完没人验证；派生档位天然随主题走。★同时钉住"六档循环"（超过六个项目时档位复用而不是无限降 alpha —— 无限降会让第七个项目的舱几乎透明）。★负锚查的是**硬编码背景色**（原型阶段直接写 vio/amb/ok 的十六进制），纯白前景 `color: #fff` 是合法用法不能误伤', () => {
  const A = [88, 70, 52, 38, 26, 16];
  const okSpine = SPINE.includes('const HUES = [88, 70, 52, 38, 26, 16]') && SPINE.includes('% HUES.length]}');
  const okTree = CT_W11.includes('const HUES = [88, 70, 52, 38, 26, 16]') && CT_W11.includes('% HUES.length]}');
  const okPano = PANO.includes('HUES[k % HUES.length]');
  const style = SPINE + PANEL + TOWER + LANE + PANO + PANO_LANE;
  /* 负锚：任何 background 不得写死十六进制（写死即脱离主题） */
  const hardBg = (style.match(/background:\s*#[0-9a-fA-F]{3,6}/g) || []);
  if (hardBg.length) console.error('   · 硬编码背景色：' + hardBg.join(' / '));
  /* 负锚：原型阶段的六种具名色（vio/amb/ok/stg 类）不许复活 */
  const named = style.match(/\b(?:--)?(?:stg|vio|amb|ok)\s*:/g) || [];
  if (named.length) console.error('   · 具名色复活：' + named.join(' / '));
  return A.length === 6 && okSpine && okTree && okPano && hardBg.length === 0 && named.length === 0;
});

// ============== 四、V3.9.2 方向台体验迭代 ==============

check('W11-14 ★任务归属只有一个解析口径：项目、指标聚合、项目详情、指标详情都必须走 compassMeta 的 tasksOfProject / tasksOfMetric。指标口径必须是 `task.metricId / metric.taskIds` 双路并集，否则历史双写数据会进入项目总数、却从指标页和指标详情消失；无归属判定也必须看“指标是否认领”，不能只看 metricId', () => {
  const pd = read('/newtab/components/ProjectDetailDrawer.vue')
  const md = read('/newtab/components/compass/MetricDetailDrawer.vue')
  const buildSeg = CMETA.slice(CMETA.indexOf('export function buildCompassMeta'))
  return CMETA.includes('export function tasksOfProject')
    && CMETA.includes('export function tasksOfMetric')
    && CMETA.includes('const linkedIds = new Set(metric.taskIds || [])')
    && CMETA.includes('t.metricId === metric.id || linkedIds.has(t.id)')
    /* 聚合走单次建桶（性能红线）：两条关联路径都必须入同一桶，且 aggMetric 仍做 id 去重 */
    && buildSeg.includes('for (const t of live) if (t.metricId) addToBucket(t.metricId, t)')
    && buildSeg.includes('for (const taskId of metric.taskIds || [])')
    && buildSeg.includes('addToBucket(metric.id, task)')
    /* 桶内容仍需去重：覆盖 REQ-034 的历史重复 id 脏数据 */
    && buildSeg.includes('aggMetric(m, bucket.get(m.id) || [])')
    && CMETA.includes('function dedupeSorted(tasks: TaskCard[]): TaskCard[]')
    && CMETA.includes('const ownedTaskIds = new Set(metrics.flatMap(mm => mm.tasks.map(t => t.id)))')
    && CMETA.includes('projTasks.filter(t => !ownedTaskIds.has(t.id))')
    && pd.includes('tasksOfMetric(metric, d.value.tasks)')
    && pd.includes('const linkedIds = new Set(')
    && md.includes('tasksOfMetric(metric.value, d.value.tasks)')
    && !/\.filter\(t => !t\.deletedAt && t\.metricId === metric\.value!?\.id\)/.test(md)
});

check('W11-15 ★「下一步」是可写可选字段 + 任务自动回退的唯一解析：用户填写优先；清空后不写占位、回退到未完成任务；doing 优先于 todo，再按 updatedAt 新者优先；自动推导绝不反写 project.nextStep。三层展示（项目塔 / 全景 / 项目详情）都必须复用 resolveProjectNextStep，并给“按任务推导”弱标签', () => {
  const seg = CMETA.slice(CMETA.indexOf('export function resolveProjectNextStep'), CMETA.indexOf('/** 全罗盘聚合'));
  return CMETA.includes('export function resolveProjectNextStep')
    && seg.includes("const manual = (proj.nextStep || '').trim()")
    && seg.includes("nextStepSource: 'manual'")
    && seg.includes("filter(t => t.status !== 'done')")
    && seg.includes("Number(b.status === 'doing') - Number(a.status === 'doing')")
    && seg.includes('(b.updatedAt || 0) - (a.updatedAt || 0)')
    && seg.includes("nextStepSource: 'task'")
    && seg.includes("nextStepSource: 'empty'")
    && !seg.includes('proj.nextStep =')
    && CMETA.includes('...resolveProjectNextStep(p, projTasks)')
    && read('/newtab/components/compass/CompassTowerNext.vue').includes('>按任务推导</span>')
    && PANO.includes('>按任务推导</span>')
    && read('/newtab/components/ProjectDetailDrawer.vue').includes('>按任务推导</span>')
    && read('/newtab/components/ProjectDetailDrawer.vue').includes('project.value.nextStep = value || undefined')
});

check('W11-16 ★项目详情第一版只做「概览 / 指标 / 任务」三页签：默认概览、切换后不复用其它页面；页签按钮要有完整 WAI-ARIA tab 语义（role=tab + aria-selected + roving tabindex + controls），并支持左右方向键/Home/End；下方三个面板用 role=tabpanel 回指对应页签', () => {
  const pd = read('/newtab/components/ProjectDetailDrawer.vue')
  return pd.includes('const tab = ref<\'overview\' | \'metrics\' | \'tasks\'>(\'overview\')')
    && pd.includes("const TABS = ['overview', 'metrics', 'tasks'] as const")
    && pd.includes('@keydown="onTabKeydown($event, 0)"')
    && pd.includes("@click=\"tab = 'overview'\"")
    && pd.includes("@click=\"tab = 'metrics'\"")
    && pd.includes("@click=\"tab = 'tasks'\"")
    && (pd.match(/class="pd-tab" role="tab"/g) || []).length === 3
    && (pd.match(/:aria-selected="tab === '/g) || []).length === 3
    && (pd.match(/role="tabpanel"/g) || []).length === 3
    && pd.includes('id="pd-panel-overview"') && pd.includes('aria-labelledby="pd-tab-overview"')
    && pd.includes("key === 'ArrowRight' ? (current + 1) % TABS.length")
    && pd.includes("'ArrowLeft', 'ArrowRight', 'Home', 'End'")
});

check('W11-17 ★指标详情入口不改变既有改名习惯：指标标题单击仍进入就地改名，详情必须由独立按钮触发；项目塔、全景泳道、项目详情三处都要有明确“详情 ›”出口，并跨组件接到同一个 MetricDetailDrawer（按钮在、事件没接 = 死按钮）', () => {
  const pd = read('/newtab/components/ProjectDetailDrawer.vue')
  return LANE.includes('class="mc-title editable"')
    && LANE.includes("@click=\"$emit('editTitle', m.id, $event)\"")
    && LANE.includes('class="mc-detail"')
    && LANE.includes("emit('openMetric', m.id)")
    && PANO_LANE.includes('class="lane-detail"')
    && PANO_LANE.includes("emit('openMetric', m.id)")
    && pd.includes('class="pd-mini pd-detail"')
    && pd.includes('@click="openMetric(m.id)"')
    && pd.includes(':value="m.title" @change="renameMetric(m.id, $event)"')
    && CT_W11.includes('@open-metric="openMetricDetail"')
    && CT_W11.includes('<MetricDetailDrawer :open="metricDetailOpen"')
    && read('/newtab/components/compass/MetricDetailDrawer.vue').includes('TaskDetailDrawer')
});

check('W11-18 ★项目 → 指标 → 任务连续下钻的 Esc 边界：共享 Drawer 必须维护全局栈，只有栈顶处理 Escape；后开抽屉层级高于先开；stopPropagation 只能挡住别的节点、挡不住 document 同节点更早注册的监听，所以不能靠它替代栈；弹窗在场时任务详情仍以 closeOnEscape=false 让位', () => {
  const dr = codeOnly(read('/shared/components/Drawer.vue'));
  const td = read('/newtab/components/compass/TaskDetailDrawer.vue');
  return dr.includes('const drawerStack = ref<number[]>([])')
    && dr.includes('if (drawerStack.value[drawerStack.value.length - 1] !== drawerId) return')
    && dr.includes('drawerStack.value.push(drawerId)')
    && dr.includes('drawerStack.value.splice(at, 1)')
    && dr.includes("const overlayZ = computed(() => `calc(var(--z-overlay) + ${stackDepth.value * 2})`)")
    && dr.includes("const drawerZ = computed(() => `calc(var(--z-overlay) + ${stackDepth.value * 2 + 1})`)")
    && dr.includes('if (props.closeOnEscape === false) return')
    && dr.includes('e.stopPropagation()')
    && dr.includes('withDefaults(defineProps<') && /closeOnEscape:\s*true/.test(dr)
    && td.includes(':close-on-escape="!aiJob"');
});

check('W11-19 ★抽屉栈必须位于 SFC 模块作用域，不能写回 <script setup>：后者会被 Vue 编进每个组件实例的 setup()，三层下钻时每个 Drawer 各持一份栈，表现为第一次 Esc 关最上层、后续 Esc 全部失效。判据同时钉普通 <script> 内的声明与 <script setup> 内的负锚', () => {
  const raw = read('/shared/components/Drawer.vue').replace(/\r\n/g, '\n');
  const moduleScript = /<script lang="ts">([\s\S]*?)<\/script>/.exec(raw)?.[1] || '';
  const setupScript = /<script setup lang="ts">([\s\S]*?)<\/script>/.exec(raw)?.[1] || '';
  return moduleScript.includes('let drawerSeq = 0')
    && moduleScript.includes('const drawerStack = ref<number[]>([])')
    && !setupScript.includes('let drawerSeq = 0')
    && !setupScript.includes('const drawerStack = ref<number[]>([])');
});

check('W11-20 ★窄屏项目条不能把全部项目压进一行：800px 下左栏改横向后，项目项必须固定为可滚动宽度（flex-basis + width），否则 flex 子项收缩后每项只剩几十像素。390px 下同一条固定宽策略必须继续成立', () => {
  const css = read('/newtab/views/CompassTree.vue').replace(/\r\n/g, '\n');
  const at800 = /@media \(max-width: 800px\) \{[\s\S]*?\.ns-item \{ flex: 0 0 164px; width: 164px; scroll-snap-align: start; \}/.test(css);
  const at480 = /@media \(max-width: 480px\) \{[\s\S]*?\.ns-item \{ flex-basis: 148px; width: 148px; \}/.test(css);
  return at800 && at480;
});
