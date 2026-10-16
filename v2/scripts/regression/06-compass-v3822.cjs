/**
 * 分片 · 06-compass-v3822：V3.8.22 批一 P5/F6/F7 三项界面调整的新增判据（G5-1/G6-1/G7-1）。
 * 为什么独立成分片：05 起各片逼近 900 行闸（R164-2 单片 ≤900），本轮新能力钉另开分片 ——
 * 门禁原意是「上限靠加分片而不是放宽」。W13 画像洞察批另开 07-w13-profile.cjs。
 * 依赖基建见 ./helpers.cjs。
 */
const { check, codeOnly, CT_W11, SPINE, PANEL, path, fs, SCRIPTS_DIR } = require('./helpers.cjs');
const READ = (p) => codeOnly(fs.readFileSync(path.join(SCRIPTS_DIR, '..', p), 'utf8'));
const RAW = (p) => fs.readFileSync(path.join(SCRIPTS_DIR, '..', p), 'utf8');
const LIST = READ('src/newtab/components/compass/CompassLayerList.vue');
const HOME = READ('src/newtab/views/CompassHome.vue');
const HOME_RAW = RAW('src/newtab/views/CompassHome.vue');

console.log('【V3.8.22 · 批一 P5/F6/F7 三项界面调整】');

// ────────────────────────── P5 调度台卡内子任务视口退役 ──────────────────────────
check('G5-1 ★调度台「今日三件事」卡内子任务视口必须退役（P5，用户拍板 2026-10-16）：卡内子任务列表（tc-subs 模板块 + sub* 五声明与滚动函数）整段删除，子任务读写走 FocusDetail 单行链唯一通道 —— 判据钉：① 负锚 tc-subs 模板块与 sub* 滚动函数不许回流 ② toggleSlotSub 函数保留且仍接 @toggle-sub（子任务勾选能力没丢，只是视口没了）③ 备案注释在位（退役物必须留证，否则下轮会当"漏实现"补回来）', () => {
  return !HOME.includes('class="tc-subs"')
    && !HOME.includes('function onSubScroll') && !HOME.includes('function subScrollAt')
    && !HOME.includes('const SUB_VISIBLE_ROWS') && !HOME.includes('function subMoreCount')
    && HOME.includes('function toggleSlotSub')
    && HOME.includes('@toggle-sub="(tid, sid) => selTask && toggleSlotSub(selTask, sid)"')
    && HOME_RAW.includes('tc-subs 模板块一并退役')   /* ③ 备案锚查原始文本（在块注释里，codeOnly 已剥） */
});

// ────────────────────────── F6 读数行左对齐 ──────────────────────────
check('G6-1 ★方向台 F6 读数行与工具常驻（用户拍板 2026-10-16）：① .hero-stats 的 justify-content 必须是 flex-start —— 右对齐时健康度徽章（行首元素）被推到最右，视线要横跨整行才读到；健康度是这行的第一个判断，应该在视线落点上（负锚 flex-end）② 两枚工具钮常驻 + 下拉菜单负锚不回流（与 W12-1 ④ / R17-4 双钉同一件事：G6 钉样式面，那两条钉结构面）', () => {
  const t = codeOnly(CT_W11)
  const m = t.match(/\.hero-stats \{[^}]*justify-content: ([^;]+);/)
  return !!m && m[1].trim() === 'flex-start'
    && t.includes('.hero-stats {')                          /* 规则本体在位（防整段被删的假绿） */
    && !/\.hero-stats \{[^}]*justify-content:\s*flex-end/.test(t)
    && !t.includes('class="hero-tools-menu"')
});

// ────────────────────────── F7 骨架 3/5/6 层级专属列表 ──────────────────────────
check('G7-1 ★骨架第 3/5/6 层必须是「层级专属列表视图」而不是"定位到一条 + toast"（F7，用户拍板 2026-10-16）：点第 6 层的预期是看到全部任务，旧行为只滚到第一条 —— "定位到一条"和"看到全部"差一个数量级。判据钉：① layerView 状态三态 3|5|6 + spine 路由（1/2 面板 / 4 定位 / 3、5、6 列表）② 三态列表模板互斥占位（CompassLayerList v-if ↔ Pano/tower v-else-if 链 = 打开列表整体切换、关闭即恢复 viewMode 记忆）③ 双回程（同层再点 + ✕ 返回）④ 行内能力迁移（第 3 层点行过滤 onDirFilter · 第 5/6 层行内定位 onListLocate → gotoTower）⑤ 第 4 层定位保留（onLocateLayer lv:4 + ensureTower）⑥ 第 1/2 层面板保留（CompassLayerPanel 仍在、layerOpen 1|2）。负锚：定位旧形态 .metric-card/.tk-row 首条 flash 的分支不许回流', () => {
  const t = codeOnly(CT_W11)
  const s = codeOnly(SPINE)
  return t.includes('const layerView = ref<3 | 5 | 6 | null>(null)')
    && t.includes('@list="onLayerList"')                                   /* ① spine 接线（宿主侧） */
    && s.includes('function onLv(') && s.includes("emit('list', n as 3 | 5 | 6)")
    && t.includes('v-if="layerView"') && t.includes('v-else-if="viewMode === \'pano\'"')
    && t.includes('v-else-if="viewMode === \'tower\'"')                    /* ② 互斥占位链 */
    && t.includes('layerView.value === lv ? null : lv') && t.includes('@close="layerView = null"') /* ③ 双回程 */
    && t.includes('@dir="onDirFilter"') && t.includes('@locate="onListLocate"') /* ④ 行内能力 */
    && t.includes('function onLocateLayer(lv: 4)') && t.includes('ensureTower(`定位第 ${lv} 层`)') /* ⑤ 层 4 */
    && t.includes('const layerOpen = ref<1 | 2 | null>(null)') && t.includes('<CompassLayerPanel')  /* ⑥ 层 1/2 */
    && !t.includes(".metric-card')") && !t.includes("'.tk-row'")          /* ⑥★负锚：旧"滚到第一条"定位分支不许回流 */
    && LIST.includes('id="lvlist-anchor"') && LIST.includes("emit('close')") && LIST.includes("emit('dir'")
    && LIST.includes("emit('locate'")
});
check('G7-2 ★层级专属列表的数据必须与骨架条同源（W11-5 口径的延伸）：第 3 层吃 compassMeta.dirs、第 5 层吃 dirs→projects→metrics 遍历（= counts.metrics 口径）、第 6 层吃 d.tasks 未删除过滤（= counts.tasks 口径，含无归属孤儿）——组件零 store 零再聚合，行数据由宿主算好经 props 传入；否则列表数与骨架条六层数字对不上，"看全部"就名不副实', () => {
  const t = codeOnly(CT_W11)
  return t.includes('const layerRows3 = computed(() => compassMeta.value.dirs.map')
    && t.includes('const layerRows5 = computed(') && t.includes('for (const m of pm.metrics) out.push')
    && t.includes('const layerRows6 = computed(') && t.includes('d.value.tasks.filter(t => !t.deletedAt)')
    && !require('fs').readFileSync(require('path').join(__dirname, '..', '..', 'src', 'newtab', 'components', 'compass', 'CompassLayerList.vue'), 'utf8').includes('useAppStore')
});
