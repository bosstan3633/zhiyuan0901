/**
 * R179 断言随迁脚本（一次性）：按「精确原文 → 替换文」批量改写回归分片。
 * 用途：V3.7.0 资源台退役 / 池语义 / 论证节点卡的断言退役与重指。
 * 每条替换前校验原文存在，未命中即报错退出（防止静默漏改）；重复运行以「已应用」标记跳过。
 */
const fs = require('fs')
const path = require('path')
// 归档后自 archive/ 上溯两级到 v2/ 根（原先在 v2/ 根运行，归档移动后此处随迁修正）
const ROOT = path.join(__dirname, '..', '..', 'scripts', 'regression')
const MARK = '// R179-MIGRATED'

const edits = [
  // ===== 10-foundations.cjs =====
  {
    file: '10-foundations.cjs', id: 'R37-5',
    find: "check('R37-5/R50-F3 导航 Tab：首页→调度台、方向台、资源台（R45：任务角标彻底移除；R61 更名）', () => { const s = read('/newtab/App.vue'); return s.includes('>调度台') && s.includes('>方向台') && s.includes('>资源台') && !s.includes('taskBadge'); });",
    replace: "// V3.7.0（R179）随迁重写：固定页签 = 调度台 / 方向台（资源台退役，收敛到调度台「3张卡」）\ncheck('R37-5/R50-F3 导航 Tab（V3.7.0 重指）：首页→调度台、方向台两固定页签；资源台页签退役', () => { const s = read('/newtab/App.vue'); return s.includes('>调度台') && s.includes('>方向台') && !s.includes('>资源台') && !s.includes('taskBadge') && s.includes('资源台退役，资源卡管理收敛到调度台'); });"
  },
  // ===== 20-req39-64.cjs =====
  {
    file: '20-req39-64.cjs', id: 'R49-1',
    find: "check('R49-1/R50-F3（R73 修订）顶部导航三系统页：调度台（默认/）+ 方向台（/compass）+ 资源台（/curation → redirect 到 hub 工作区）', () => { const a = read('/newtab/App.vue'); const r = read('/newtab/router.ts'); return a.includes('>调度台') && a.includes('>方向台') && a.includes('>资源台') && a.includes(\"navigate('/curation')\") && r.includes(\"path: '/curation'\") && r.includes('redirect: to =>'); });",
    replace: "// V3.7.0（R179）随迁重写：顶部导航两系统页 + /curation 深链 redirect 回首页\ncheck('R49-1/R50-F3（V3.7.0 重指）顶部导航：调度台（默认/）+ 方向台（/compass）；/curation 深链 redirect 回首页', () => { const a = read('/newtab/App.vue'); const r = read('/newtab/router.ts'); return a.includes('>调度台') && a.includes('>方向台') && !a.includes(\"navigate('/curation')\") && r.includes(\"path: '/curation'\") && r.includes(\"redirect: () => ({ path: '/' })\"); });"
  },
  {
    file: '20-req39-64.cjs', id: 'R49-7',
    find: "check('R49-7 I2（R117 修订）数字槽：switchToIndex 1=调度台 2=方向台 3=资源台，用户策展台从 4 起（n-4）按台签顺序', () => { const a = read('/newtab/App.vue'); return a.includes(\"if (n === 1) { navigate('/'); return }\") && a.includes('if (n === 2) { openCompass(); return }') && a.includes('if (n === 3) { openResource(); return }') && a.includes('const ws = store.workspaces[n - 4]') && !a.includes('store.workspaces[n - 1]'); });",
    replace: "// V3.7.0（R179）随迁重写：数字槽顺延——1=调度台 2=方向台 3+ 策展台（资源台退役）\ncheck('R49-7 I2（V3.7.0 重指）数字槽：switchToIndex 1=调度台 2=方向台 3+ 策展台（n-3）按台签顺序', () => { const a = read('/newtab/App.vue'); return a.includes(\"if (n === 1) { navigate('/'); return }\") && a.includes('if (n === 2) { openCompass(); return }') && a.includes('const ws = store.workspaces[n - 3]') && !a.includes('openResource'); });"
  },
  {
    file: '20-req39-64.cjs', id: 'R50-10',
    find: "check('R50-10（R73 重写）资源台路由收敛：/curation 为 redirect（显式透传 query，保 ?hl= 定位）而非独立组件；hub 承接原生卡 curOrder', () => { const r = read('/newtab/router.ts'); const w = read('/newtab/views/Workspace.vue'); const m = read('/shared/models/index.ts'); return r.includes(\"path: '/curation'\") && r.includes('CURATION_WS_ID') && r.includes('query: to.query') && w.includes('curOrder') && m.includes('CurationProjection') && m.includes(\"CURATION_WS_ID = 'zy-curation'\"); });",
    replace: "// V3.7.0（R179）随迁重写：/curation redirect 回首页；池语义落模型（CURATION_WS_ID 常量与 CurationProjection 保持）\ncheck('R50-10（V3.7.0 重指）资源台路由退役：/curation redirect 回首页；池语义落模型', () => { const r = read('/newtab/router.ts'); const w = read('/newtab/views/Workspace.vue'); const m = read('/shared/models/index.ts'); return r.includes(\"path: '/curation'\") && r.includes(\"redirect: () => ({ path: '/' })\") && !r.includes('CURATION_WS_ID') && w.includes('curOrder') && m.includes('CurationProjection') && m.includes(\"CURATION_WS_ID = 'zy-curation'\"); });"
  },
  {
    file: '20-req39-64.cjs', id: 'R53-11',
    find: "check('R53-11（R74 重写）卡面镜像入口：资源台卡面 📡 镜像到策展台；策展台侧旧入口已拆', () => {\r\n  const w = read('/newtab/views/Workspace.vue');\r\n  return w.includes('title=\"镜像到策展台\"') && w.includes('openMirrorCard(r)') && !w.includes('projectCardToCuration');\r\n});",
    replace: "// V3.7.0（R179）退役：📡 单卡镜像推送入口随资源台退役（真身唯一入池，策展台经投射引用；拉取走挂载/关联资源卡）。"
  },
  {
    file: '20-req39-64.cjs', id: 'R61-8',
    find: "check('R61-8 命名切换：顶栏/路由/弹窗 策展中心→资源台、工作台→策展台；App.vue 打包镜像退役', () => { const r = read('/newtab/router.ts'); const a = read('/newtab/App.vue'); const c = read('/newtab/views/Workspace.vue'); return r.includes(\"meta: { title: '知源调度台 · 资源台' }\") && a.includes('>资源台') && a.includes('策展台「${name}」已创建')\n  // R84 重指：原验写死的 `<b>资源台</b>`；W1 起页头台名取 workspace.name（种子数据里即\"资源台\"），\n  // **不写死比写死更正确**——改名也能跟着变。旧称零出现仍守住（见下）。\n  && c.includes(\"class=\\\"wsh-name\\\">{{ wsDisplayNameOf(workspace) }}\") && !c.includes('<b>资源台</b>')\n  && !a.includes('>策展中心') && !a.includes('工作台「${name}」已创建'); });",
    replace: "// V3.7.0（R179）随迁重写：旧称清零口径保留——「资源台」页签/路由 title 退役，顶栏两页签 + 策展台命名不变\ncheck('R61-8 命名切换（V3.7.0 重指）：「资源台」Tab 与路由 title 退役；旧称（策展中心/工作台）零出现仍守住', () => { const r = read('/newtab/router.ts'); const a = read('/newtab/App.vue'); const c = read('/newtab/views/Workspace.vue'); return !r.includes(\"title: '知源调度台 · 资源台'\") && !a.includes('>资源台') && a.includes('策展台「${name}」已创建')\n  && c.includes(\"class=\\\"wsh-name\\\">{{ wsDisplayNameOf(workspace) }}\") && !c.includes('<b>资源台</b>')\n  && !a.includes('>策展中心') && !a.includes('工作台「${name}」已创建'); });"
  },
  {
    file: '20-req39-64.cjs', id: 'R62-5',
    find: " && w.includes('curationMetrics(d.value, workspaceId.value, allResources.value)') && w.includes('v-if=\"!isHub\"') && h.includes('attachmentItems'); });",
    replace: " && w.includes('curationMetrics(d.value, workspaceId.value, allResources.value)') && h.includes('attachmentItems'); });"
  },
  {
    file: '20-req39-64.cjs', id: 'R62-11',
    find: "check('R62-11 镜像分类弹窗：hubCatOptions（treeCatOptions）+ confirmMirrorCat 调 mirrorCategoryToBoard + 重复镜像提示', () => { const w = read('/newtab/views/Workspace.vue'); return w.includes('mirrorCatModal') && read('/newtab/composables/useWorkspaceMirror.ts').includes('treeCatOptions(d.value.categories.filter(c => c.workspaceId === CURATION_WS_ID))') && read('/newtab/composables/useWorkspaceMirror.ts').includes('mirrorCategoryToBoard(d.value, catId, workspaceId.value)') && read('/newtab/composables/useWorkspaceMirror.ts').includes('该分类已镜像过本台'); });",
    replace: "// V3.7.0（R179）退役：📤 分类镜像弹窗随 hub 分类退役（hubCatOptions 恒空；金字塔节点菜单已移除该项）。"
  },
  {
    file: '20-req39-64.cjs', id: 'R64-12',
    find: "check('R64-12 采集默认资源台：defaultCaptureWsId 资源台优先 + 打开时回显', () => { const g = read('/newtab/components/GlobalPopups.vue'); return g.includes('function defaultCaptureWsId') && g.includes('capForm.workspaceId || defaultCaptureWsId()') && g.includes(\"if (!capForm.workspaceId) capForm.workspaceId = defaultCaptureWsId()\"); });",
    replace: "// V3.7.0（R179）随迁重写：采集统一入池\ncheck('R64-12（V3.7.0 重指）采集统一入资源卡池：workspaceId 固定 CURATION_WS_ID、categoryId 置空，台面/分类选择器退役', () => { const g = read('/newtab/components/GlobalPopups.vue'); return g.includes('workspaceId: CURATION_WS_ID') && g.includes(\"categoryId: ''\") && !g.includes('defaultCaptureWsId') && g.includes('🗂 资源卡池'); });"
  },
]

let applied = 0, skipped = 0
for (const e of edits) {
  const p = path.join(ROOT, e.file)
  let src = fs.readFileSync(p, 'utf8')
  if (src.includes(MARK + ' ' + e.id)) { skipped++; continue }
  // 行尾自适应：分片文件是 CRLF（git autocrlf），脚本内多行文案按 \n 书写——
  // 首查不中时把 find/replace 一起换成 \r\n 再试（R53-11 已手工改过，此处兜住其余多行条目）。
  let find = e.find, rep = e.replace, nl = '\n'
  if (!src.includes(find)) {
    const winFind = find.replace(/\n/g, '\r\n')
    if (src.includes(winFind)) { find = winFind; rep = rep.replace(/\n/g, '\r\n'); nl = '\r\n' }
  }
  if (!src.includes(find)) { console.error('未命中原文 [' + e.id + ']：' + find.slice(0, 70)); process.exit(1) }
  fs.writeFileSync(p, src.replace(find, MARK + ' ' + e.id + nl + rep))
  applied++
}
console.log(`OK: applied=${applied} skipped=${skipped}`)
