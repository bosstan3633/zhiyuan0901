/**
 * V4.7.0 · F5/T6：画像洞察「主攻项目」弹窗改项目全貌树。
 *
 * 本分片只守本轮新增的结构契约：
 *   项目头 → 成功指标 → 指标下任务 / 选题 → 未归属；
 *   任务与选题都走双写口径；导出顺序同步为项目 → 指标 → 任务 → 选题。
 */
const { check, read, segOf } = require('./helpers.cjs');

console.log('【V4.7.0 · 项目弹窗全貌树】');

const TREE = read('/newtab/views/projectTree.ts');
const PDD = read('/newtab/components/ProjectDetailDrawer.vue');
const PEXPORT = read('/shared/utils/projectExport.ts');

check('TREE470-1 ★buildProjectTree 是项目全貌的唯一取数入口：任务/选题分别复用 compassTaskMeta 与 compassTopicMeta 的双写口径，未归属按指标认领结果统一归组', () => {
  return TREE.includes('tasksOfProject(project, d.tasks || [])')
    && TREE.includes('topicsOfProject(project, d.topics || [])')
    && TREE.includes('tasksOfMetric(metric, d.tasks || [])')
    && TREE.includes('topicsOfMetric(metric, d.topics || [])')
    && TREE.includes('const ownedTaskIds = new Set(metrics.flatMap(row => row.tasks.map(task => task.id)))')
    && TREE.includes('const ownedTopicIds = new Set(metrics.flatMap(row => row.topics.map(topic => topic.id)))')
    && TREE.includes('const orphanTasks = allTasks.filter(task => !ownedTaskIds.has(task.id))')
    && TREE.includes('const orphanTopics = allTopics.filter(topic => !ownedTopicIds.has(topic.id))')
    && TREE.includes('progress: allTasks.length ? Math.round(done / allTasks.length * 100)');
});

check('TREE470-2 ★项目弹窗不再有「概览 / 指标 / 任务」三页签与四格统计：单页直出项目头、指标、指标下任务/选题、未归属分组', () => {
  return !PDD.includes('class="pd-tabs"')
    && !PDD.includes('class="pd-stats"')
    && !PDD.includes('role="tabpanel"')
    && PDD.includes('buildProjectTree')
    && PDD.includes('v-for="m in projectTree.metrics"')
    && PDD.includes('v-for="task in m.tasks"')
    && PDD.includes('v-for="topic in m.topics"')
    && PDD.includes('projectTree.orphanTasks')
    && PDD.includes('projectTree.orphanTopics')
    && PDD.includes('暂无任务与选题');
});

check('TREE470-3 ★头部信息不抢主体但能力不丢：项目名/主攻/战略路径/下一步/一行摘要/导出保留；改名、加指标、加任务、切换战略目标收进行内或设置层', () => {
  return PDD.includes('#title')
    && PDD.includes('class="pd-focus-badge"')
    && PDD.includes('{{ dir?.name || \'未隶属战略目标\' }}')
    && PDD.includes('按任务推导')
    && PDD.includes('project.value.nextStep = value || undefined')
    && PDD.includes('{{ summary }}')
    && PDD.includes("<ExportMenu :formats=\"['md', 'html']\" align=\"end\" @pick=\"exportProject\" />")
    && PDD.includes('@blur="renameProject"')
    && PDD.includes('@click="addMetric"')
    && PDD.includes('@click="openTaskAdd(m.id)"')
    && PDD.includes('@change="switchDirection"');
});

check('TREE470-4 ★指标默认全展开且可折叠；任务/选题点击打开现有详情抽屉，不关闭项目弹窗', () => {
  return PDD.includes('const collapsedMetrics = ref<Record<string, boolean>>({})')
    && PDD.includes('function toggleMetric(metricId: string)')
    && PDD.includes(':aria-expanded="!isMetricCollapsed(m.id)"')
    && PDD.includes('v-show="!isMetricCollapsed(m.id)"')
    && PDD.includes('@click="openTask(task)"')
    && PDD.includes('@click="openTopic(topic)"')
    && PDD.includes("emitOpenDrawer({ kind: 'topic', id: topic.id })")
    && PDD.includes('task.dueDate ? `计划 ${planDateLabel(task.dueDate)}` : \'未落图\'')
    && PDD.includes('topic.dueDate ? `计划 ${planDateLabel(topic.dueDate)}` : \'未落图\'');
});

check('TREE470-5 ★导出补选题并保持树顺序：项目 → 指标 → 任务 → 选题 → 未归属；旧字段与断链/附件说明不变', () => {
  const md = segOf(PEXPORT, 'export function projectExportMarkdown', '\nfunction htmlLink');
  const metricStart = md.indexOf('for (const metric of doc.metrics)');
  const orphanStart = md.indexOf("lines.push('## 未归属（项目内未挂指标）'");
  const metricSeg = metricStart >= 0 && orphanStart > metricStart ? md.slice(metricStart, orphanStart) : '';
  const html = segOf(PEXPORT, 'export function projectExportHtml', '\n  return `<!doctype html>');
  return PEXPORT.includes('export interface ProjectExportTopic')
    && PEXPORT.includes('topics: ProjectExportTopic[]')
    && PEXPORT.includes('orphanTasks: ProjectExportTask[]')
    && PEXPORT.includes('orphanTopics: ProjectExportTopic[]')
    && PEXPORT.includes('const topicList = topics.filter(topic => topic.metricId === metric.id || linkedTopicIds.has(topic.id))')
    && metricSeg.includes('pushMarkdownTask(lines, task)')
    && metricSeg.includes('pushMarkdownTopic(lines, topic)')
    && metricSeg.indexOf('pushMarkdownTask(lines, task)') < metricSeg.indexOf('pushMarkdownTopic(lines, topic)')
    && orphanStart > metricSeg.indexOf('pushMarkdownTopic(lines, topic)')
    && html.includes('htmlTaskList(metric.tasks)')
    && html.includes('htmlTopicList(metric.topics)')
    && html.indexOf('htmlTaskList(metric.tasks)') < html.indexOf('htmlTopicList(metric.topics)')
    && PEXPORT.includes('⚠ 缺任务')
    && PEXPORT.includes('不包含附件本体');
});
