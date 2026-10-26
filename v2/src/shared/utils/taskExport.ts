import type { AppData, AssetMeta, ResourceCard, SupportLink, TaskCard } from '@/shared/models'
import { toOpenableRawLink, toOpenableUrl } from './link'
import {
  escapeHtml,
  escapeMarkdown,
  exportDateStamp,
  formatBytes,
  readExportTheme,
  safeExportFileName,
  safeExportLink,
  type ExportTheme,
} from './cardExport'

type Link = { text: string; href: string; unavailable?: boolean }

export interface TaskExportGroup {
  label: string
  items: {
    title: string
    href: string
    why: string
    source: string
    unavailable: boolean
  }[]
}

export interface TaskExportDocument {
  task: TaskCard
  filenameBase: string
  status: string
  priority: string
  subtaskProgress: string
  project: string
  metric: string
  tags: string
  createdAt: string
  updatedAt: string
  completedAt: string
  description: string
  taskLink: Link
  subtasks: { title: string; done: boolean; note: string }[]
  supportGroups: TaskExportGroup[]
  attachments: AssetMeta[]
  generatedAt: number
}

const STATUS_LABEL: Record<TaskCard['status'], string> = {
  todo: '待开始',
  doing: '进行中',
  done: '已完成',
}
const PRIORITY_LABEL: Record<TaskCard['priority'], string> = {
  high: '高',
  medium: '中',
  low: '低',
}
const KIND_LABEL: Record<AssetMeta['kind'], string> = {
  image: '图片',
  html: 'HTML',
  pdf: 'PDF',
}
const SOURCE_LABEL: Record<SupportLink['from'], string> = { ai: 'AI', manual: '手动' }

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

function compassNames(d: AppData, task: TaskCard): { project: string; metric: string } {
  for (const direction of d.compass.directions || []) {
    for (const project of direction.projects || []) {
      if (project.id !== task.projectId) continue
      const metric = project.metrics.find(item => item.id === task.metricId)
      return { project: project.name || '未命名项目', metric: metric?.title || '未关联指标' }
    }
  }
  return {
    project: task.projectId ? '项目已删除或不可用' : '未关联项目',
    metric: task.metricId ? '指标已删除或不可用' : '未关联指标',
  }
}

function supportGroups(d: AppData, task: TaskCard): TaskExportGroup[] {
  const links = (d.supportLinks || []).filter(link => link.taskId === task.id)
  const groups: TaskExportGroup[] = []
  const bySub = new Map<string, SupportLink[]>()
  const taskLevel: SupportLink[] = []

  for (const link of links) {
    if (!link.subId) {
      taskLevel.push(link)
      continue
    }
    const list = bySub.get(link.subId)
    if (list) list.push(link)
    else bySub.set(link.subId, [link])
  }

  const toItem = (link: SupportLink) => {
    const resource = (d.resources || []).find(card => card.id === link.resourceId)
    const unavailable = !resource || !!resource.deletedAt
    return {
      title: resource?.title?.trim() || '资源已删除或不可用',
      href: safeResourceHref(resource),
      why: (link.why || '').trim(),
      source: SOURCE_LABEL[link.from] || link.from,
      unavailable,
    }
  }

  if (taskLevel.length) {
    groups.push({ label: '任务级资源支持', items: taskLevel.map(toItem) })
  }
  for (const subtask of task.subtasks || []) {
    const rows = bySub.get(subtask.id)
    if (!rows?.length) continue
    groups.push({
      label: `子任务：${subtask.title || '未命名子任务'}${subtask.done ? '（已完成）' : ''}`,
      items: rows.map(toItem),
    })
    bySub.delete(subtask.id)
  }
  for (const rows of bySub.values()) {
    if (!rows.length) continue
    groups.push({ label: '已删除子任务的资源支持', items: rows.map(toItem) })
  }
  return groups
}

export function buildTaskExportDocument(d: AppData, task: TaskCard, now = new Date()): TaskExportDocument {
  const title = task.title.trim() || '未命名任务'
  const subtasks = task.subtasks || []
  const done = subtasks.filter(item => item.done).length
  const names = compassNames(d, task)
  const taskLinkHref = safeTaskHref(task)
  return {
    task: { ...task, title },
    filenameBase: `知源_任务卡_${safeExportFileName(title)}_${exportDateStamp(now)}`,
    status: STATUS_LABEL[task.status] || task.status,
    priority: PRIORITY_LABEL[task.priority] || task.priority,
    subtaskProgress: subtasks.length ? `${done}/${subtasks.length}（${Math.round(done / subtasks.length * 100)}%）` : '无子任务',
    project: names.project,
    metric: names.metric,
    tags: task.tags?.length ? task.tags.map(tag => `#${tag}`).join(' ') : '无',
    createdAt: fmtTs(task.createdAt),
    updatedAt: fmtTs(task.updatedAt),
    completedAt: fmtTs(task.completedAt),
    description: (task.description || '').trim() || '暂无说明',
    taskLink: {
      text: (task.link || '').trim() || '未填写任务链接',
      href: taskLinkHref,
    },
    subtasks: subtasks.map(item => ({
      title: item.title || '未命名子任务',
      done: !!item.done,
      note: (item.note || '').trim(),
    })),
    supportGroups: supportGroups(d, task),
    attachments: [...(task.assets || [])],
    generatedAt: now.getTime(),
  }
}

function markdownLink(text: string, href: string): string {
  if (!href) return escapeMarkdown(text)
  const target = href.replace(/\)/g, '%29').replace(/\s/g, '%20')
  return `[${escapeMarkdown(text)}](${target})`
}

function supportMd(group: TaskExportGroup): string[] {
  const lines = [`### ${escapeMarkdown(group.label)}`]
  for (const item of group.items) {
    const title = item.unavailable
      ? `${escapeMarkdown(item.title)}（不可用）`
      : markdownLink(item.title, item.href)
    lines.push(`- ${title}`)
    lines.push(`  - 来源：${escapeMarkdown(item.source)}`)
    if (item.why) lines.push(`  - AI 判词：${escapeMarkdown(item.why)}`)
    if (!item.href) lines.push('  - 链接：无有效可打开链接')
  }
  return lines
}

export function taskExportMarkdown(doc: TaskExportDocument): string {
  const title = doc.task.title
  const lines: string[] = [
    `# ${escapeMarkdown(title)}`,
    '',
    '## 状态摘要',
    '',
    `- 状态：${doc.status}`,
    `- 优先级：${doc.priority}`,
    `- 子任务进度：${doc.subtaskProgress}`,
    '',
    '## 基本信息',
    '',
    `- 项目：${escapeMarkdown(doc.project)}`,
    `- 指标：${escapeMarkdown(doc.metric)}`,
    `- 标签：${escapeMarkdown(doc.tags)}`,
    `- 创建：${doc.createdAt}`,
    `- 更新：${doc.updatedAt}`,
    `- 完成：${doc.completedAt}`,
    '',
    '## 说明',
    '',
    escapeMarkdown(doc.description),
    '',
    '## 任务链接',
    '',
    `- ${markdownLink(doc.taskLink.text, doc.taskLink.href)}`,
  ]
  if (!doc.taskLink.href) lines.push('- 链接：无有效可打开链接')

  lines.push('', '## 子任务清单', '')
  if (doc.subtasks.length) {
    for (const subtask of doc.subtasks) {
      lines.push(`- [${subtask.done ? 'x' : ' '}] ${escapeMarkdown(subtask.title)}`)
      if (subtask.note) lines.push(`  - 备注：${escapeMarkdown(subtask.note)}`)
    }
  } else {
    lines.push('暂无子任务')
  }

  lines.push('', '## 资源支持', '')
  if (doc.supportGroups.length) {
    for (const group of doc.supportGroups) lines.push(...supportMd(group), '')
  } else {
    lines.push('暂无资源支持')
  }

  lines.push('## 附件清单', '')
  if (doc.attachments.length) {
    for (const asset of doc.attachments) {
      lines.push(`- ${escapeMarkdown(asset.name || '未命名附件')}（${KIND_LABEL[asset.kind] || asset.kind} · ${formatBytes(asset.size)}）`)
    }
  } else {
    lines.push('暂无附件')
  }

  lines.push(
    '',
    '## 导出信息',
    '',
    `- 导出时间：${fmtTs(doc.generatedAt)}`,
    '- 数据来源：知源本机数据',
    '- 附件说明：仅导出附件名称、类型与大小，不包含附件本体',
    '',
    '---',
    '',
    '> 知源 ownway · 任务卡导出',
  )
  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n'
}

function htmlLink(text: string, href: string): string {
  return href
    ? `<a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer">${escapeHtml(text)}</a>`
    : escapeHtml(text)
}

function supportHtml(group: TaskExportGroup): string {
  const items = group.items.map(item => {
    const title = item.unavailable
      ? `${escapeHtml(item.title)} <span class="badge unavailable">不可用</span>`
      : htmlLink(item.title, item.href)
    const why = item.why ? `<p class="why">AI 判词：${escapeHtml(item.why)}</p>` : ''
    const linkState = item.href ? '' : '<p class="muted">无有效可打开链接</p>'
    return `<li><div class="support-main">${title}<span class="badge">${escapeHtml(item.source)}</span></div>${why}${linkState}</li>`
  }).join('')
  return `<div class="support-group"><h3>${escapeHtml(group.label)}</h3><ul class="support-list">${items}</ul></div>`
}

export function taskExportHtml(doc: TaskExportDocument, theme: ExportTheme = readExportTheme()): string {
  const subtasks = doc.subtasks.length
    ? `<ul class="subtasks">${doc.subtasks.map(item =>
      `<li><span class="check ${item.done ? 'done' : ''}">${item.done ? '✓' : ''}</span><span><span class="${item.done ? 'done-text' : ''}">${
        escapeHtml(item.title)
      }</span>${item.note ? `<small>${escapeHtml(item.note)}</small>` : ''}</span></li>`).join('')}</ul>`
    : '<p class="empty">暂无子任务</p>'
  const supports = doc.supportGroups.length
    ? doc.supportGroups.map(supportHtml).join('')
    : '<p class="empty">暂无资源支持</p>'
  const attachments = doc.attachments.length
    ? `<ul class="attachments">${doc.attachments.map(asset =>
      `<li><span>${escapeHtml(asset.name || '未命名附件')}</span><span class="muted">${escapeHtml(KIND_LABEL[asset.kind] || asset.kind)} · ${formatBytes(asset.size)}</span></li>`
    ).join('')}</ul>`
    : '<p class="empty">暂无附件</p>'
  const taskLink = `<p>${htmlLink(doc.taskLink.text, doc.taskLink.href)}</p>${doc.taskLink.href ? '' : '<p class="muted">无有效可打开链接</p>'}`

  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(doc.task.title)} · 任务卡</title>
<style>
*{box-sizing:border-box}
html{background:${theme.bg}}
body{margin:0;background:${theme.bg};color:${theme.text};font-family:${theme.fontSans};line-height:1.7;-webkit-font-smoothing:antialiased}
.wrap{max-width:860px;margin:0 auto;padding:40px 26px 56px}
.kicker{color:${theme.accentInk};font-size:11px;font-weight:700;letter-spacing:.09em}
h1{font-size:28px;line-height:1.3;margin:8px 0 22px;overflow-wrap:anywhere}
h2{font-size:16px;color:${theme.accentInk};margin:0 0 12px;line-height:1.4}
h3{font-size:13px;color:${theme.text};margin:0 0 8px}
section{border-top:1px solid ${theme.border};padding:20px 0 2px;margin-top:20px}
.summary{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px}
.summary div,.meta div{background:${theme.surface};border:1px solid ${theme.border};border-radius:9px;padding:10px 12px}
.summary span,.meta span{display:block;color:${theme.textMuted};font-size:11px;margin-bottom:2px}
.summary b{font-size:15px}
.meta{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:9px}
.meta b{font-weight:600;overflow-wrap:anywhere}
p{margin:0 0 8px;white-space:pre-wrap;overflow-wrap:anywhere}
a{color:${theme.accentInk};text-decoration:underline;text-underline-offset:2px;overflow-wrap:anywhere}
a:hover{color:${theme.accent}}
ul{margin:6px 0 0;padding:0;list-style:none}
.subtasks li{display:flex;gap:9px;padding:7px 0;border-top:1px solid ${theme.border}}
.subtasks li:first-child{border-top:0}
.check{width:18px;height:18px;border:1px solid ${theme.border};border-radius:5px;display:grid;place-items:center;flex:none;color:transparent;margin-top:2px}
.check.done{background:${theme.accent};border-color:${theme.accent};color:${theme.bg}}
.done-text{text-decoration:line-through;color:${theme.textMuted}}
.subtasks small{display:block;color:${theme.textMuted};font-size:11px;margin-top:2px}
.support-group+.support-group{margin-top:16px}
.support-list li{border-top:1px solid ${theme.border};padding:8px 0}
.support-list li:first-child{border-top:0}
.support-main{display:flex;align-items:center;gap:7px;flex-wrap:wrap}
.badge{font-size:10px;color:${theme.accentInk};border:1px solid ${theme.accent};border-radius:999px;padding:0 6px;white-space:nowrap}
.badge.unavailable{color:${theme.textMuted};border-color:${theme.border}}
.why{margin:4px 0 0;color:${theme.textMuted};font-size:12px}
.muted,.empty{color:${theme.textMuted};font-size:12px}
.attachments li{display:flex;justify-content:space-between;gap:14px;padding:7px 0;border-top:1px solid ${theme.border};overflow-wrap:anywhere}
.attachments li:first-child{border-top:0}
.footer{border-top:1px solid ${theme.border};margin-top:24px;padding-top:12px;color:${theme.textMuted};font-size:11px;display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap}
@media(max-width:640px){.wrap{padding:28px 16px 44px}h1{font-size:23px}}
@media print{html,body{background:#fff;color:#111}.wrap{max-width:none;padding:0}.summary div,.meta div{border-color:#ccc;background:#fff}a{color:#111}section,.support-group,.subtasks li{break-inside:avoid}}
</style>
</head>
<body>
<main class="wrap">
  <div class="kicker">知源 ownway · 任务卡</div>
  <h1>${escapeHtml(doc.task.title)}</h1>
  <section>
    <h2>状态摘要</h2>
    <div class="summary">
      <div><span>状态</span><b>${escapeHtml(doc.status)}</b></div>
      <div><span>优先级</span><b>${escapeHtml(doc.priority)}</b></div>
      <div><span>子任务进度</span><b>${escapeHtml(doc.subtaskProgress)}</b></div>
    </div>
  </section>
  <section>
    <h2>基本信息</h2>
    <div class="meta">
      <div><span>项目</span><b>${escapeHtml(doc.project)}</b></div>
      <div><span>指标</span><b>${escapeHtml(doc.metric)}</b></div>
      <div><span>标签</span><b>${escapeHtml(doc.tags)}</b></div>
      <div><span>创建</span><b>${escapeHtml(doc.createdAt)}</b></div>
      <div><span>更新</span><b>${escapeHtml(doc.updatedAt)}</b></div>
      <div><span>完成</span><b>${escapeHtml(doc.completedAt)}</b></div>
    </div>
  </section>
  <section><h2>说明</h2><p>${escapeHtml(doc.description)}</p></section>
  <section><h2>任务链接</h2>${taskLink}</section>
  <section><h2>子任务清单</h2>${subtasks}</section>
  <section><h2>资源支持</h2>${supports}</section>
  <section><h2>附件清单</h2>${attachments}</section>
  <section>
    <h2>导出信息</h2>
    <p>导出时间：${escapeHtml(fmtTs(doc.generatedAt))}<br>数据来源：知源本机数据<br>附件说明：仅导出附件名称、类型与大小，不包含附件本体</p>
  </section>
  <div class="footer"><span>知源 ownway · 任务卡导出</span><span>${exportDateStamp(new Date(doc.generatedAt))}</span></div>
</main>
</body>
</html>`
}
