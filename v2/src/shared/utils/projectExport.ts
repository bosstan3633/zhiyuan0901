/**
 * V3.9.31（F5）：项目导出 —— 项目全景与项目详情弹窗共用的单一生成器。
 *
 * 与 taskExport.ts 平行同构：build → markdown / html 两个序列化器，链接安全、
 * 主题跟随、文件名规范全部复用 cardExport / link 既有工具（不另立标准）。
 * 结构化口径（需求清单 F5 拍板）：
 *   项目头（战略链 / 主攻 / 状态 / 下一步 / 进度 / 断链警示）
 *   → 指标 ×N（进度 / ⚠ 缺任务警示）
 *   → 指标下任务 ×N（标题 / 状态 / 计划执行日期 / 任务链接）
 *   → 指标下选题 ×N（标题 / 状态 / 计划执行日期 / 选题链接）
 *   → 未归属任务 / 选题（项目内存在但没有任何指标认领）
 *   → 任务支撑资源（SupportLink → 资源卡标题 + 可点击链接，不可用显式标注）
 * 附件不嵌本体（与任务卡导出同一口径：只留清单信息，不读 IndexedDB Blob）。
 */
import type { AppData, Project, ResourceCard, SupportLink, TaskCard, TopicCard } from '@/shared/models'
import { toOpenableRawLink, toOpenableUrl } from './link'
import { topicStatusOf } from './topicStatus'
import {
  escapeHtml,
  escapeMarkdown,
  exportDateStamp,
  readExportTheme,
  safeExportFileName,
  safeExportLink,
  type ExportTheme,
} from './cardExport'

type Link = { text: string; href: string; unavailable?: boolean }

export interface ProjectExportTask {
  title: string
  status: string
  dueDate: string
  taskLink: Link
  supports: { title: string; href: string; why: string; source: string; unavailable: boolean }[]
}

export interface ProjectExportTopic {
  title: string
  status: string
  dueDate: string
  topicLink: Link
}

export interface ProjectExportMetric {
  title: string
  progress: string
  missingTasks: boolean
  tasks: ProjectExportTask[]
  topics: ProjectExportTopic[]
}

export interface ProjectExportDocument {
  projectName: string
  filenameBase: string
  chain: string
  status: string
  isFocused: boolean
  nextStep: string
  progress: string
  hasBrokenLink: boolean
  metrics: ProjectExportMetric[]
  orphanTasks: ProjectExportTask[]
  orphanTopics: ProjectExportTopic[]
  generatedAt: number
}

const STATUS_LABEL: Record<TaskCard['status'], string> = {
  todo: '待开始',
  doing: '进行中',
  done: '已完成',
}
const SOURCE_LABEL: Record<SupportLink['from'], string> = { ai: 'AI', manual: '手动' }
const PROJECT_STATUS_LABEL: Record<Project['status'], string> = {
  active: '进行中',
  paused: '暂停',
  done: '已完成',
  archived: '已归档',
}

const fmtTs = (ts?: number): string =>
  ts ? new Date(ts).toLocaleString('zh-CN', { hour12: false }) : '—'

function safeResourceHref(resource?: ResourceCard): string {
  if (!resource || resource.deletedAt) return ''
  const link = safeExportLink(toOpenableUrl(resource.linkType, resource.link))
  return link.clickable ? link.href : ''
}

function safeTaskHref(task: TaskCard): string {
  const normalized = toOpenableRawLink(task.link || '')
  const link = safeExportLink(normalized || task.link)
  return link.clickable ? link.href : ''
}

function projectTasks(d: AppData, project: Project): TaskCard[] {
  const trackIds = new Set(project.metrics.flatMap(m => m.taskIds || []))
  const metricIds = new Set(project.metrics.map(m => m.id))
  const seen = new Set<string>()
  const out: TaskCard[] = []
  for (const t of d.tasks || []) {
    if (t.deletedAt || seen.has(t.id)) continue
    if (t.projectId !== project.id && !(t.metricId && metricIds.has(t.metricId)) && !trackIds.has(t.id)) continue
    seen.add(t.id)
    out.push(t)
  }
  return out
}

function projectTopics(d: AppData, project: Project): TopicCard[] {
  const trackIds = new Set(project.metrics.flatMap(m => m.topicIds || []))
  const metricIds = new Set(project.metrics.map(m => m.id))
  const seen = new Set<string>()
  const out: TopicCard[] = []
  for (const topic of d.topics || []) {
    if (topic.deletedAt || seen.has(topic.id)) continue
    if (topic.projectId !== project.id && !(topic.metricId && metricIds.has(topic.metricId)) && !trackIds.has(topic.id)) continue
    seen.add(topic.id)
    out.push(topic)
  }
  return out
}

function taskToExport(d: AppData, task: TaskCard): ProjectExportTask {
  const links = (d.supportLinks || []).filter(link => link.taskId === task.id)
  const supports = links.map(link => {
    const resource = (d.resources || []).find(card => card.id === link.resourceId)
    const unavailable = !resource || !!resource.deletedAt
    return {
      title: resource?.title?.trim() || '资源已删除或不可用',
      href: safeResourceHref(resource),
      why: (link.why || '').trim(),
      source: SOURCE_LABEL[link.from] || link.from,
      unavailable,
    }
  })
  return {
    title: task.title.trim() || '未命名任务',
    status: STATUS_LABEL[task.status] || task.status,
    dueDate: task.dueDate || '未落图',
    taskLink: {
      text: (task.link || '').trim() || '未填写任务链接',
      href: safeTaskHref(task),
    },
    supports,
  }
}

function safeTopicHref(topic: TopicCard): string {
  const normalized = toOpenableRawLink(topic.link || '')
  const link = safeExportLink(normalized || topic.link)
  return link.clickable ? link.href : ''
}

function topicToExport(d: AppData, topic: TopicCard): ProjectExportTopic {
  return {
    title: topic.title.trim() || '未命名选题',
    status: topicStatusOf(d, topic.statusId)?.name || '未设置状态',
    dueDate: topic.dueDate || '未落图',
    topicLink: {
      text: (topic.link || '').trim() || '未填写选题链接',
      href: safeTopicHref(topic),
    },
  }
}

export function buildProjectExportDocument(d: AppData, project: Project, now = new Date()): ProjectExportDocument {
  const name = project.name.trim() || '未命名项目'
  const tasks = projectTasks(d, project)
  const topics = projectTopics(d, project)
  const doneCount = tasks.filter(t => t.status === 'done').length
  const pct = tasks.length ? Math.round(doneCount / tasks.length * 100) : 0
  const dir = (d.compass.directions || []).find(item => (item.projects || []).some(p => p.id === project.id))
  const chainParts = [
    (d.compass.vision?.content || '').trim(),
    (d.compass.mission?.content || '').trim(),
    (dir?.name || '').trim(),
  ].filter(Boolean)
  let hasBrokenLink = false
  const ownedTaskIds = new Set<string>()
  const ownedTopicIds = new Set<string>()
  const metrics: ProjectExportMetric[] = (project.metrics || []).map(metric => {
    // 双路并集（同 compassMeta 口径）：task.metricId 与 metric.taskIds 任一命中都算本指标
    const linkedIds = new Set(metric.taskIds || [])
    const list = tasks.filter(t => t.metricId === metric.id || linkedIds.has(t.id))
    for (const task of list) ownedTaskIds.add(task.id)
    // 选题同走双写口径：topic.metricId 与 metric.topicIds 任一命中都算本指标
    const linkedTopicIds = new Set(metric.topicIds || [])
    const topicList = topics.filter(topic => topic.metricId === metric.id || linkedTopicIds.has(topic.id))
    for (const topic of topicList) ownedTopicIds.add(topic.id)
    const mDone = list.filter(t => t.status === 'done').length
    if (!hasBrokenLink) {
      hasBrokenLink = list.some(t => !(t.link || '').trim())
    }
    return {
      title: metric.title || '未命名指标',
      progress: `${mDone}/${list.length} · ${list.length ? Math.round(mDone / list.length * 100) : 0}%`,
      missingTasks: list.length === 0,
      tasks: list.map(t => taskToExport(d, t)),
      topics: topicList.map(topic => topicToExport(d, topic)),
    }
  })
  const orphanTasks = tasks.filter(task => !ownedTaskIds.has(task.id))
  const orphanTopics = topics.filter(topic => !ownedTopicIds.has(topic.id))
  return {
    projectName: name,
    filenameBase: `知源_项目全景_${safeExportFileName(name)}_${exportDateStamp(now)}`,
    chain: chainParts.length ? chainParts.join(' → ') : '尚未填写愿景 / 使命 / 战略目标',
    status: PROJECT_STATUS_LABEL[project.status] || project.status,
    isFocused: !!project.isFocused,
    nextStep: (project.nextStep || '').trim() || '未填写下一步（可在项目详情中补写）',
    progress: `${doneCount}/${tasks.length} 任务 · ${pct}%`,
    hasBrokenLink,
    metrics,
    orphanTasks: orphanTasks.map(task => taskToExport(d, task)),
    orphanTopics: orphanTopics.map(topic => topicToExport(d, topic)),
    generatedAt: now.getTime(),
  }
}

function markdownLink(text: string, href: string): string {
  if (!href) return escapeMarkdown(text)
  const target = href.replace(/\)/g, '%29').replace(/\s/g, '%20')
  return `[${escapeMarkdown(text)}](${target})`
}

function pushMarkdownTask(lines: string[], task: ProjectExportTask): void {
  const title = task.taskLink.href
    ? markdownLink(task.title, task.taskLink.href)
    : escapeMarkdown(task.title)
  lines.push(`- ${title}（${escapeMarkdown(task.status)} · 计划 ${escapeMarkdown(task.dueDate)}）`)
  for (const sup of task.supports) {
    const supTitle = sup.unavailable
      ? `${escapeMarkdown(sup.title)}（不可用）`
      : markdownLink(sup.title, sup.href)
    lines.push(`  - 资源支持：${supTitle}（${escapeMarkdown(sup.source)}）`)
  }
}

function pushMarkdownTopic(lines: string[], topic: ProjectExportTopic): void {
  const title = topic.topicLink.href
    ? markdownLink(topic.title, topic.topicLink.href)
    : escapeMarkdown(topic.title)
  lines.push(`- ✦ 选题：${title}（${escapeMarkdown(topic.status)} · 计划 ${escapeMarkdown(topic.dueDate)}）`)
}

export function projectExportMarkdown(doc: ProjectExportDocument): string {
  const lines: string[] = [
    `# ${escapeMarkdown(doc.projectName)}`,
    '',
    '## 项目头',
    '',
    `- 战略链：${escapeMarkdown(doc.chain)}`,
    `- 状态：${escapeMarkdown(doc.status)}${doc.isFocused ? ' · 主攻' : ''}`,
    `- 进度：${escapeMarkdown(doc.progress)}`,
    `- 下一步：${escapeMarkdown(doc.nextStep)}`,
  ]
  if (doc.hasBrokenLink) lines.push('- ⚠ 项目内存在断链（部分任务缺失链接），已按原样导出')

  lines.push('', '## 成功指标 · 任务与选题', '')
  if (doc.metrics.length) {
    for (const metric of doc.metrics) {
      lines.push(`### ${escapeMarkdown(metric.title)}`, '')
      if (metric.missingTasks) lines.push('⚠ 缺任务：目标已定，动作还没落', '')
      lines.push(`进度：${escapeMarkdown(metric.progress)}`, '')
      if (!metric.tasks.length && !metric.topics.length) {
        lines.push('暂无任务与选题', '')
        continue
      }
      if (metric.tasks.length) for (const task of metric.tasks) pushMarkdownTask(lines, task)
      else lines.push('暂无任务')
      if (metric.tasks.length) lines.push('')
      if (metric.topics.length) for (const topic of metric.topics) pushMarkdownTopic(lines, topic)
      else lines.push('暂无选题')
      lines.push('')
    }
  } else {
    lines.push('暂无成功指标', '')
  }

  if (doc.orphanTasks.length || doc.orphanTopics.length) {
    lines.push('## 未归属（项目内未挂指标）', '')
    if (doc.orphanTasks.length) {
      for (const task of doc.orphanTasks) pushMarkdownTask(lines, task)
      lines.push('')
    }
    if (doc.orphanTopics.length) {
      for (const topic of doc.orphanTopics) pushMarkdownTopic(lines, topic)
      lines.push('')
    }
  }

  lines.push(
    '## 导出信息',
    '',
    `- 导出时间：${fmtTs(doc.generatedAt)}`,
    '- 数据来源：知源本机数据',
    '- 附件说明：不包含附件本体；链接为可点击原始地址',
    '',
    '---',
    '',
    '> 知源 ownway · 项目全景导出',
  )
  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n'
}

function htmlLink(text: string, href: string): string {
  return href
    ? `<a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer">${escapeHtml(text)}</a>`
    : escapeHtml(text)
}

function htmlTaskList(tasks: ProjectExportTask[]): string {
  return `<ul class="tasks">${tasks.map(task => {
    const head = task.taskLink.href
      ? htmlLink(task.title, task.taskLink.href)
      : `${escapeHtml(task.title)} <span class="muted">（无有效链接）</span>`
    const sups = task.supports.length
      ? `<ul class="sups">${task.supports.map(sup =>
        `<li>${sup.unavailable ? `${escapeHtml(sup.title)} <span class="badge unavailable">不可用</span>` : htmlLink(sup.title, sup.href)}<span class="badge">${escapeHtml(sup.source)}</span></li>`).join('')}</ul>`
      : ''
    return `<li><div class="t-head">${head}<span class="badge">${escapeHtml(task.status)}</span><span class="muted">计划 ${escapeHtml(task.dueDate)}</span></div>${sups}</li>`
  }).join('')}</ul>`
}

function htmlTopicList(topics: ProjectExportTopic[]): string {
  return `<ul class="topics">${topics.map(topic => {
    const head = topic.topicLink.href
      ? htmlLink(topic.title, topic.topicLink.href)
      : `${escapeHtml(topic.title)} <span class="muted">（无有效链接）</span>`
    return `<li><div class="t-head"><span class="topic-mark">✦ 选题</span>${head}<span class="badge">${escapeHtml(topic.status)}</span><span class="muted">计划 ${escapeHtml(topic.dueDate)}</span></div></li>`
  }).join('')}</ul>`
}

export function projectExportHtml(doc: ProjectExportDocument, theme: ExportTheme = readExportTheme()): string {
  const metricBlocks = doc.metrics.length
    ? doc.metrics.map(metric => {
      const cards = !metric.tasks.length && !metric.topics.length
        ? '<p class="empty">暂无任务与选题</p>'
        : `${metric.tasks.length ? htmlTaskList(metric.tasks) : '<p class="empty">暂无任务</p>'}${metric.topics.length ? htmlTopicList(metric.topics) : '<p class="empty">暂无选题</p>'}`
      return `<section class="metric"><h2>${escapeHtml(metric.title)}${metric.missingTasks ? ' <span class="warn">⚠ 缺任务</span>' : ''}</h2><p class="muted">进度 ${escapeHtml(metric.progress)}</p>${cards}</section>`
    }).join('')
    : '<p class="empty">暂无成功指标</p>'
  const orphanBlock = doc.orphanTasks.length || doc.orphanTopics.length
    ? `<section class="metric orphan"><h2>未归属 <span class="warn">项目内未挂指标</span></h2>${doc.orphanTasks.length ? htmlTaskList(doc.orphanTasks) : ''}${doc.orphanTopics.length ? htmlTopicList(doc.orphanTopics) : ''}</section>`
    : ''

  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(doc.projectName)} · 项目全景</title>
<style>
*{box-sizing:border-box}
html{background:${theme.bg}}
body{margin:0;background:${theme.bg};color:${theme.text};font-family:${theme.fontSans};line-height:1.7;-webkit-font-smoothing:antialiased}
.wrap{max-width:860px;margin:0 auto;padding:40px 26px 56px}
.kicker{color:${theme.accentInk};font-size:11px;font-weight:700;letter-spacing:.09em}
h1{font-size:28px;line-height:1.3;margin:8px 0 18px;overflow-wrap:anywhere}
h2{font-size:16px;color:${theme.accentInk};margin:0 0 10px;line-height:1.4}
section{border-top:1px solid ${theme.border};padding:18px 0 2px;margin-top:18px}
.metric h2{margin-top:0}
.summary{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:10px}
.summary div{background:${theme.surface};border:1px solid ${theme.border};border-radius:9px;padding:10px 12px}
.summary span{display:block;color:${theme.textMuted};font-size:11px;margin-bottom:2px}
.summary b{font-size:14px;overflow-wrap:anywhere}
p{margin:0 0 8px;white-space:pre-wrap;overflow-wrap:anywhere}
a{color:${theme.accentInk};text-decoration:underline;text-underline-offset:2px;overflow-wrap:anywhere}
a:hover{color:${theme.accent}}
ul{margin:6px 0 0;padding:0;list-style:none}
.tasks>li,.topics>li{padding:9px 0;border-top:1px solid ${theme.border}}
.tasks>li:first-child,.topics>li:first-child{border-top:0}
.t-head{display:flex;align-items:center;gap:7px;flex-wrap:wrap;font-weight:600}
.topic-mark{font-size:11px;color:${theme.accentInk};font-weight:600}
.badge{font-size:10px;color:${theme.accentInk};border:1px solid ${theme.accent};border-radius:999px;padding:0 6px;white-space:nowrap;font-weight:500}
.badge.unavailable{color:${theme.textMuted};border-color:${theme.border}}
.warn{color:${theme.textMuted};font-size:11px;border:1px solid ${theme.border};border-radius:999px;padding:1px 7px}
.sups{margin:5px 0 0 4px}
.sups li{display:flex;align-items:center;gap:7px;flex-wrap:wrap;font-size:12px;padding:2px 0}
.muted,.empty{color:${theme.textMuted};font-size:12px}
.footer{border-top:1px solid ${theme.border};margin-top:24px;padding-top:12px;color:${theme.textMuted};font-size:11px;display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap}
@media(max-width:640px){.wrap{padding:28px 16px 44px}h1{font-size:23px}}
@media print{html,body{background:#fff;color:#111}.wrap{max-width:none;padding:0}.summary div{border-color:#ccc;background:#fff}a{color:#111}section,.tasks>li,.topics>li{break-inside:avoid}}
</style>
</head>
<body>
<main class="wrap">
  <div class="kicker">知源 ownway · 项目全景</div>
  <h1>${escapeHtml(doc.projectName)}${doc.isFocused ? ' <span class="badge">主攻</span>' : ''}</h1>
  <section>
    <h2>项目头</h2>
    <div class="summary">
      <div><span>战略链</span><b>${escapeHtml(doc.chain)}</b></div>
      <div><span>状态</span><b>${escapeHtml(doc.status)}</b></div>
      <div><span>进度</span><b>${escapeHtml(doc.progress)}</b></div>
      <div><span>下一步</span><b>${escapeHtml(doc.nextStep)}</b></div>
    </div>
    ${doc.hasBrokenLink ? '<p class="warn" style="margin-top:9px">⚠ 项目内存在断链（部分任务缺失链接），已按原样导出</p>' : ''}
  </section>
  <section><h2>成功指标 · 任务与选题</h2>${metricBlocks}</section>
  ${orphanBlock}
  <section>
    <h2>导出信息</h2>
    <p>导出时间：${escapeHtml(fmtTs(doc.generatedAt))}<br>数据来源：知源本机数据<br>附件说明：不包含附件本体；链接为可点击原始地址</p>
  </section>
  <div class="footer"><span>知源 ownway · 项目全景导出</span><span>${exportDateStamp(new Date(doc.generatedAt))}</span></div>
</main>
</body>
</html>`
}
