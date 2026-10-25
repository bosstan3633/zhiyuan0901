/**
 * V3.9.20 · GlobalPopups 拆分 Stage 1（快速添加家族）+ 性能收口三件套搭车。
 *
 * 原型依据：无（工程治理批）。拆分模式照抄 V3.9.6 的 GlobalPopupsShortcuts 先例：
 * 按弹窗家族切、一轮一块不打包；交互、类名与 DOM 结构一字未改。
 * 这一片锁四件事：
 * - 快速添加家族（任务速记 + 好奇采集）真的住在 GlobalPopupsQuickAdd.vue，壳只挂载与转发；
 * - getRecentWebTab 升为 shared/utils/recentWebTab.ts 唯一实现（两个消费方不复制）；
 * - 壳不再持有 tc/curio 面板的实现态（PanelType 字面量除外——R55-9 前半锚）；
 * - saved 态键盘经 defineExpose 转发链在位（Enter=打开任务管理 / Esc=复位关闭）。
 */
const { check, read, codeOnly } = require('./helpers.cjs');

const GP = read('/newtab/components/GlobalPopups.vue');
const GP_C = codeOnly(GP);
const QA = read('/newtab/components/GlobalPopupsQuickAdd.vue');
const QA_C = codeOnly(QA);
const RT = read('/shared/utils/recentWebTab.ts');

console.log('【V3.9.20 · GlobalPopups 拆分 Stage 1（快速添加家族）】');

check('D20-1 ★快速添加家族独立成件：任务速记 + 好奇采集的模板（快速采集任务 / 采集好奇心）与实现（saveTaskCapture / saveCurio）都住在 GlobalPopupsQuickAdd.vue；壳里只剩挂载点（ref=quickAddRef + task/curio 两个 active props + prefill + @close）', () => {
  return QA.includes('快速采集任务') && QA.includes('采集好奇心')
    && QA_C.includes('function saveTaskCapture') && QA_C.includes('function saveCurio')
    && GP_C.includes('<GlobalPopupsQuickAdd ref="quickAddRef"')
    && GP_C.includes(":task-active=\"activePanel==='taskcapture'\"")
    && GP_C.includes(":curio-active=\"activePanel==='curio'\"");
});

check('D20-2 ★壳不残留面板实现态：tcForm / curioForm / saveTaskCapture / saveCurio / tcOpenBoard / resetTcForm 在壳的 codeOnly 里零命中（开面板初始化随 active watcher 迁入子件）；PanelType 的两个面板字面量仍在壳（状态机没拆走）', () => {
  return !GP_C.includes('tcForm') && !GP_C.includes('curioForm')
    && !GP_C.includes('saveTaskCapture') && !GP_C.includes('saveCurio')
    && !GP_C.includes('tcOpenBoard') && !GP_C.includes('resetTcForm')
    && GP_C.includes("'taskcapture'") && GP_C.includes("'curio'");
});

check('D20-3 ★getRecentWebTab 唯一实现升共享件：shared/utils/recentWebTab.ts 持有 chrome.tabs.query 本体；壳（采集预填 prefillCapture）与 QuickAdd（好奇来源捕获）都是 import 消费方，全站零第二份实现', () => {
  return RT.includes('export async function getRecentWebTab')
    && RT.includes("chrome.tabs.query({ url: ['http://*/*', 'https://*/*'] })")
    && GP_C.includes("import { getRecentWebTab } from '@/shared/utils/recentWebTab'")
    && QA_C.includes("import { getRecentWebTab } from '@/shared/utils/recentWebTab'")
    && !GP_C.includes('async function getRecentWebTab');
});

check('D20-4 ★saved 态键盘转发链在位：壳 onSavedKeydown 先问 quickAddRef.savedKey(e)（消费即返回），QuickAdd 的 savedKey 只在 taskActive 且 tcSaved 时消费 Enter（打开任务管理）/ Esc（复位并关）', () => {
  return GP_C.includes('quickAddRef.value?.savedKey(e)) return')
    && QA_C.includes('function savedKey(e: KeyboardEvent): boolean')
    && QA_C.includes("if (!props.taskActive || !tcSaved.value) return false")
    && QA_C.includes('defineExpose({ savedKey })');
});

check('D20-5 ★R172-T11 预填链换居所不断线：壳 openPanel 把 prefill 存 panelPrefill ref 经 props 下传；QuickAdd 的 taskActive watcher 读 props.prefill 预填四字段（保存键仍在用户手里）', () => {
  return GP_C.includes('panelPrefill.value = prefill')
    && GP_C.includes(':prefill="panelPrefill"')
    && QA_C.includes('tcForm.title = props.prefill?.title || \'\'');
});
