/**
 * R174-1 分片 · 05-compass-v3821：V3.8.21 方向台 F1–F5 + 调度台 P4（全貌改单行子任务）新增判据。
 * 为什么独立成分片：97/98/99 三片都逼近 900 行闸（R164-2 单片 ≤900），本轮 9 条翻转 + 新能力钉
 * 另开分片而不是回填旧片 —— 门禁原意是「上限靠加分片而不是放宽」。
 * 依赖基建见 ./helpers.cjs。
 */
const { fs, path, base, check, read, codeOnly, exists, LANE, TOWER, PANO, PANO_LANE, CT_W11, SCRIPTS_DIR, ANCHOR_FILE } = require('./helpers.cjs');

console.log('【V3.8.21 · 方向台 F1–F5 + 调度台 P4】');

// ────────────────────────── F1 指标删除入口下沉 ──────────────────────────
check('F1-1（V3.9.26 随迁）删除成功指标的真源只有一个（compassCrud.removeMetricWithConfirm），项目塔与项目全景两处都只从「⋯」菜单上抛 delMetric；V3.9.26 起全景主行连独立「详情」钮也收进菜单，指标头只保留单行信息', () => {
  const lane = codeOnly(LANE)
  const pl = codeOnly(PANO_LANE)
  const tw = codeOnly(TOWER)
  const tr = codeOnly(CT_W11)
  /* ① 两套卡头：删除只从「⋯」菜单上抛，主行不再露删除钮 */
  const laneDel = (lane.match(/emit\('delMetric'/g) || []).length
  const plDel = (pl.match(/emit\('delMetric'/g) || []).length
  /* ② 项目舱菜单（项目级）零指标删除 */
  const menu = tw.slice(tw.indexOf('class="tw-menu"'), tw.indexOf('class="tw-body"'))
  /* ③ 宿主真源 */
  return laneDel === 1 && plDel === 1
    && !/class="mc-del"/.test(lane)
    && lane.includes('class="mc-menu"')
    && !pl.includes('class="lo-del"') && !pl.includes('class="lane-detail"')
    && pl.includes('class="lo-more"') && pl.includes('class="lo-menu"')
    && pl.includes('打开指标详情') && pl.includes('删除本指标')
    && !menu.includes('delMetric') && !menu.includes('删除本指标')
    && tr.includes('function delMetricById(')
    && tr.includes('removeMetricWithConfirm(d.value, metricId, () => store.persist())')
    && (tr.match(/@del-metric="delMetricById"/g) || []).length === 2
    && tr.includes("import { compassNodeCounts, removeCompassNode, restoreCompassNode, removeMetricWithConfirm");
});
check('F1-2（V3.9.26 重指）项目全景指标头的详情与删除都藏进常驻「⋯」；项目塔仍保持 hover/focus 操作区。两条路径都必须键盘可达', () => {
  const lane = codeOnly(LANE)
  const pl = codeOnly(PANO_LANE)
  const laneBase = /\.mc-add, \.mc-ai, \.mc-more \{[^}]*opacity: 0/.test(lane)
    && /\.metric-card:hover \.mc-add, \.metric-card:hover \.mc-ai, \.metric-card:hover \.mc-more/.test(lane)
  const plBase = /\.lo-more \{[^}]*opacity: 1/.test(pl)
    && pl.includes('.lo-more:hover') && pl.includes('.lo-more.on')
  /* 键盘可达：hover 化不能把无鼠标用户挡在门外（两套卡头各钉一次） */
  const a11y = lane.includes('mc-more:focus-visible')
    && pl.includes(':aria-expanded="menuFor === m.id"') && pl.includes('aria-haspopup="menu"')
  return laneBase && plBase && a11y
    && lane.includes('class="mc-more"')
    && lane.includes('class="mc-menu"')
    && lane.includes('class="mc-toggle"')
    && !lane.includes('class="mc-del"')
    && lane.indexOf('class="mc-menu"') < lane.indexOf('class="mc-toggle"');
});

// ────────────────────────── F2 项目模板导入（解析粒度下移一级） ──────────────────────────
check('F2-1 ★项目层模板导入：解析粒度必须**下移一级**（# 一级 = 成功指标；## 二级 = 任务，任务下的正文 = 详情）；项目名恒等于当前选中项目（模板里不写项目名 —— 写了也没用，导入是"往既有项目里灌指标与任务"不是"再建一个项目"）。判据钉：① mdImport.ts 有 PROJECT_RULE/parseProjectTemplate/ProjImportResult 三件套 ② 解析循环里 H1→指标、H2/H3→任务、正文 flush 进 curT.detail ③ H2 先于 H1 时自动建「通用执行」承接（容错不吞内容）④ 弹窗 mode:\'project\' 三处模板分支（预览/说明/清空）与 PROJECT_RULE 文案绑定 ⑤ 宿主 confirmProjImport 把 metrics 写进**既有** proj.metrics（不是 push 新 project）', () => {
  const md = codeOnly(read('/shared/utils/mdImport.ts'))
  const modal = read('/newtab/components/ImportTemplateModal.vue')
  const tr = codeOnly(CT_W11)
  return md.includes('export const PROJECT_RULE')
    && md.includes('export interface ProjImportResult { metrics: GoalMetric[]; warns: string[] }')
    && md.includes('export function parseProjectTemplate(src: string): ProjImportResult')
    && md.includes("if (lv === 1) {\n        curM = { name, tasks: [], auto: false }")
    && md.includes("} else if (lv === 2 || lv === 3) {")
    && md.includes('通用执行')
    && md.includes('curT.detail = curT.detail ?')
    && modal.includes("mode: 'goal' | 'pyramid' | 'project'")
    && (modal.match(/v-if="mode === 'project'"/g) || []).length >= 2
    && modal.includes('PROJECT_RULE')
    && modal.includes('parseProjectTemplate(src.value)')
    && tr.includes('function confirmProjImport(')
    /* 写入循环：同名指标跳过（sk++）+ 查重后 proj.metrics.push(met) —— 钉"写进既有项目"与"不重复导入" */
    && tr.includes('let met = proj.metrics.find(x => x.title === m.name)')
    && tr.includes('proj.metrics.push(met)')
    && tr.includes('sk++; continue')
    /* 负锚：确认路径只写 metrics 与 tasks，不许顺手新建 project（项目名恒等于当前项目） */
    && !tr.includes('projects.push')
});
check('F2-2 ★项目层模板导入的入口有两处且都接真源（用户拍板：全景项目头 📋 + 项目舱「⋯」菜单 📋，两处都进）：入口 emit(\'importTemplate\' → 宿主 openProjImport 开弹窗（mode=project、targetName=当前项目名）→ confirm 写入。判据钉完整链路：两入口组件各一次 emit + 宿主两个 @import-template 各一次 + openProjImport 置 open:true + 弹窗实例 mode="project"', () => {
  const tw = codeOnly(TOWER)
  const pa = codeOnly(PANO)
  const tr = codeOnly(CT_W11)
  const modalInst = CT_W11.slice(CT_W11.indexOf('mode="project"') - 400, CT_W11.indexOf('mode="project"') + 400)
  return (tw.match(/emit\('importTemplate', proj\.id\)/g) || []).length === 1
    && (pa.match(/emit\('importTemplate', current\.proj\.id\)/g) || []).length === 1
    && (tr.match(/@import-template="openProjImport"/g) || []).length === 2
    && tr.includes('function openProjImport(')
    && tr.includes('projImport.value = { open: true, projId, projName: proj.name }')
    && modalInst.includes('<ImportTemplateModal')
    && modalInst.includes(':target-name="projImport.projName"')
    && modalInst.includes('@confirm="confirmProjImport"');
});

// ────────────────────────── F4 诊断宿主下沉（三处入口共用一份会话缓存） ──────────────────────────
check('F4-1 ★三处入口共用一份诊断会话缓存（用户拍板：全景项目头 + 项目详情页页头都要两态入口）：状态与流程收在 composable useProjectDiag（模块级单例 sharedDiags/sharedDiagOpen），宿主只传 d 与 setJob；入口复用 CompassTowerStatus（两态 1:1，不新写第二套两态 DOM）。判据钉：① composable 单例三件套在位 ② 两宿主都调 useProjectDiag({ d, setJob }) ③ 两宿主都挂 CompassTowerStatus 且零第二份 sharedDiags 声明（防"各宿主各存一份"）', () => {
  const dg = codeOnly(read('/newtab/composables/useProjectDiag.ts'))
  const tr = codeOnly(CT_W11)
  const pc = codeOnly(read('/newtab/views/ProjectCuration.vue'))
  const st = read('/newtab/components/compass/CompassTowerStatus.vue')
  /* ① 单例：模块级声明 + 共享导出 */
  const singleton = dg.includes('const sharedDiags = shallowRef<Record<string, ProjectDiagnosis>>({})')
    && dg.includes('const sharedDiagOpen = ref(false)')
    && dg.includes('export function useProjectDiag(')
    /* ② 两宿主接线（不带 opts 的第二份状态） */
    && (tr.match(/useProjectDiag\(/g) || []).length === 1
    && tr.includes('useProjectDiag({ d, setJob:')
    && (pc.match(/useProjectDiag\(/g) || []).length === 1
    && pc.includes('useProjectDiag({ d, setJob:')
  /* ③ 不许宿主自存第二份 */
  const noDup = !/const diags = shallowRef|const diags = ref/.test(tr) && !/const diags = shallowRef|const diags = ref/.test(pc)
  /* 入口挂件本体未新写：方向台树经 CompassTower 转挂（塔已 import CompassTowerStatus，P4/F4 拆件后不再由树直接挂），
     项目详情页页头直挂；两态 DOM 只有 CompassTowerStatus 一份 */
  const tw = codeOnly(TOWER)
  const reuse = st.includes('class="tw-diag"')
    && tw.includes("import CompassTowerStatus from './CompassTowerStatus.vue'")
    && tw.includes('<CompassTowerStatus')
    && pc.includes('<CompassTowerStatus')
    && (st.match(/class="tw-diag"/g) || []).length === 1
  return singleton && noDup && reuse;
});

// ────────────────────────── P4 全貌改单行子任务（宿主接线） ──────────────────────────
check('P4-1 ★V3.9.1 随迁备案：FocusDetail 全貌区退役后，子任务能力继续从右侧任务详情进入。旧 @toggle-sub/@split 宿主接线不再挂在首页，但「拆分子任务并聚焦输入框」的抽屉链路必须原样保留，避免随布局迁移丢能力', () => {
  const ch = codeOnly(CT_ALL_HOME())
  const fd = codeOnly(read('/newtab/components/compass/FocusDetail.vue'))
  const dr = codeOnly(read('/newtab/components/compass/TaskDetailDrawer.vue'))
  const sl = codeOnly(read('/shared/components/SubtaskList.vue'))
  /* ① 模块头退役：无 events/locate/supports 三件套（D4 整体退役的负锚） */
  const headGone = !ch.includes('focusDetailEvents') && !fd.includes('events?:') && !fd.includes('locate?:') && !fd.includes('supports?:')
    && !fd.includes("(e: 'locate'") && !fd.includes("(e: 'events'")
  /* ② 首页不再挂 FocusDetail，子任务从共享详情进入 */
  const wired = !ch.includes('<FocusDetail')
    && ch.includes('function openCellTask(c: FocusCell)')
    && ch.includes('drawerRef.value?.open(c.task)')
    && dr.includes('function open(task: TaskCard, opts?: { focusSub?: boolean })')
  /* ③④ 聚焦链 */
  const chain = dr.includes('function open(task: TaskCard, opts?: { focusSub?: boolean })')
    && dr.includes('subListRef.value?.focusAdd()')
    && dr.includes('<SubtaskList ref="subListRef"')
    && sl.includes('function focusAdd()')
    && sl.includes('defineExpose({ focusAdd })')
  return headGone && wired && chain;
});
/* CT_ALL_HOME 的取数点（避免 helpers 再加导出：调度台宿主只有 CompassHome 一处） */
function CT_ALL_HOME() { return read('/newtab/views/CompassHome.vue') }

check('P4-2 ★P4 留痕文档必须在位（用户拍板"一次打包交付"的交付物之一）：docs/需求梳理_P4_全貌单行子任务_2026-10-15.md 存在且写明 D1–D5 五条决策（前3条+溢出 / 就地勾选 / 属性带去向 / 下一步整体退役 / 空态拆分去处）与"七层全貌退役"的缘由 —— 留痕是下一轮翻转判据时的**理由真源**，判据不认"拍板过但没写下来"', () => {
  const p = path.resolve(SCRIPTS_DIR, '..', '..', 'docs', '需求梳理_P4_全貌单行子任务_2026-10-15.md')
  if (!fs.existsSync(p)) return false
  const doc = fs.readFileSync(p, 'utf8')
  return doc.includes('D1') && doc.includes('D5') && doc.includes('54px')
    && doc.includes('七层') && doc.includes('退役');
});
