/**
 * V3.9.32（批 A）：方向树全景导出 —— 与 taskExport / projectExport 同构的单一生成器。
 *
 * 输入是 compassCurationModel.buildCurationTree 的产物（**渲染与导出同源**，防两套口径漂移）；
 * 结构化输出：愿景/使命原文 → 战略目标 → 项目（进度/主攻/状态/停滞警示）→ 指标（验收/目标日/
 * 进度/⚠缺任务）→ 任务（状态/优先级/链接/完成时间）→ 未归档任务。
 * Markdown 可直接投喂 AI 作上下文；HTML 自包含、主题跟随、链接可点击；附件不嵌本体。
 */
import type { CurationTree } from './compassCurationModel'
import { toOpenableRawLink, toOpenableUrl } from './link'
import type { Project, ResourceCard, TaskCard } from '@/shared/models'
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

export interface CompassExportTask {
  title: string
  status: string
  priority: string
  doneAt: string
  taskLink: Link
}
export interface CompassExportMetric {
  title: string
  target: string
  acceptance: string
  progress: string
  missingTasks: boolean
  tasks: CompassExportTask[]
}
export interface CompassExportProject {
  name: string
  focus: boolean
  status: string
  progress: string
  stalled: boolean
  metrics: CompassExportMetric[]
}
export interface CompassExportGoal {
  name: string
  projects: CompassExportProject[]
}
export interface CompassExportDocument {
  vision: string
  mission: string
  goals: CompassExportGoal[]
  orphans: CompassExportTask[]
  counts: { goals: number; projects: number; metrics: number; tasks: number }
  filenameBase: string
  generatedAt: number
}

const STATUS_LABEL: Record<TaskCard['status'], string> = { todo: '待开始', doing: '进行中', done: '已完成' }
const STALE_LABEL = '待开始（停滞 14 天+）'
const PRIORITY_LABEL: Record<NonNullable<TaskCard['priority']>, string> = { high: '高', medium: '中', low: '低' }
const PROJECT_STATUS_LABEL: Record<Project['status'], string> = {
  active: '进行中', paused: '暂停', done: '已完成', archived: '已归档',
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

function taskToExport(task: TaskCard, status: string): CompassExportTask {
  return {
    title: task.title.trim() || '未命名任务',
    status: status === 'stale' ? STALE_LABEL : STATUS_LABEL[task.status] || task.status,
    priority: task.priority ? PRIORITY_LABEL[task.priority] || task.priority : '—',
    doneAt: task.completedAt ? fmtTs(task.completedAt) : '',
    taskLink: {
      text: (task.link || '').trim() || '未填写任务链接',
      href: safeTaskHref(task),
    },
  }
}

export function buildCompassExportDocument(tree: CurationTree, now = new Date()): CompassExportDocument {
  let cMetrics = 0
  let cTasks = 0
  const goals = tree.goals.map(g => ({
    name: g.dir.name || '未命名战略目标',
    projects: g.projects.map(P => ({
      name: P.project.name || '未命名项目',
      focus: !!P.project.isFocused,
      status: PROJECT_STATUS_LABEL[P.project.status] || P.project.status,
      progress: `${P.doneCount}/${P.totalCount} 任务 · ${P.progress}%`,
      stalled: P.stalled,
      metrics: P.metrics.map(M => {
        cMetrics++
        return {
          title: M.metric.title || '未命名指标',
          target: (M.metric.target || '').trim(),
          acceptance: (M.metric.acceptance || '').trim(),
          progress: `${M.doneCount}/${M.totalCount} · ${M.progress}%`,
          missingTasks: M.totalCount === 0,
          tasks: M.tasks.map(T => {
            cTasks++
            return taskToExport(T.task, T.status)
          }),
        }
      }),
    })),
  }))
  const orphans = tree.orphans.map(T => taskToExport(T.task, T.status))
  return {
    vision: tree.vision || '尚未填写愿景',
    mission: tree.mission || '尚未填写使命',
    goals,
    orphans,
    counts: { goals: goals.length, projects: goals.reduce((s, g) => s + g.projects.length, 0), metrics: cMetrics, tasks: cTasks + orphans.length },
    filenameBase: `知源_方向树全景_${safeExportFileName('全景')}_${exportDateStamp(now)}`,
    generatedAt: now.getTime(),
  }
}

function markdownLink(text: string, href: string): string {
  if (!href) return escapeMarkdown(text)
  const target = href.replace(/\)/g, '%29').replace(/\s/g, '%20')
  return `[${escapeMarkdown(text)}](${target})`
}

export function compassExportMarkdown(doc: CompassExportDocument): string {
  const lines: string[] = [
    '# 知源 · 方向树全景',
    '',
    '## 愿景',
    '',
    escapeMarkdown(doc.vision),
    '',
    '## 使命',
    '',
    escapeMarkdown(doc.mission),
    '',
    `## 战略目标 ×${doc.counts.goals}`,
    '',
  ]
  doc.goals.forEach((g, gi) => {
    lines.push(`### ${gi + 1}. ${escapeMarkdown(g.name)}`, '')
    g.projects.forEach(P => {
      const tags = [P.focus ? '主攻' : '', P.status, P.stalled ? '⚠ 停滞 14 天+' : ''].filter(Boolean).join(' · ')
      lines.push(`#### 项目：${escapeMarkdown(P.name)}（${escapeMarkdown(tags)}）`, '')
      lines.push(`- 进度：${escapeMarkdown(P.progress)}`, '')
      P.metrics.forEach(M => {
        lines.push(`- 指标：${escapeMarkdown(M.title)}（${escapeMarkdown(M.progress)}）`)
        if (M.target) lines.push(`  - 目标：${escapeMarkdown(M.target)}`)
        if (M.acceptance) lines.push(`  - 验收：${escapeMarkdown(M.acceptance)}`)
        if (M.missingTasks) lines.push('  - ⚠ 缺任务：验收已定，动作未落')
        M.tasks.forEach(T => {
          const title = T.taskLink.href ? markdownLink(T.title, T.taskLink.href) : escapeMarkdown(T.title)
          lines.push(`  - 任务：${title}（${escapeMarkdown(T.status)} · ${escapeMarkdown(T.priority)}优${T.doneAt ? ' · 完成于 ' + escapeMarkdown(T.doneAt) : ''}）`)
        })
      })
      lines.push('')
    })
  })
  if (doc.orphans.length) {
    lines.push(`## 未归档任务 ×${doc.orphans.length}`, '')
    doc.orphans.forEach(T => {
      const title = T.taskLink.href ? markdownLink(T.title, T.taskLink.href) : escapeMarkdown(T.title)
      lines.push(`- ${title}（${escapeMarkdown(T.status)}）`)
    })
    lines.push('')
  }
  lines.push(
    '## 导出信息',
    '',
    `- 导出时间：${fmtTs(doc.generatedAt)}`,
    '- 数据来源：知源本机数据（只读镜像）',
    '- 用途说明：可直接投喂 AI 作上下文，或分享给协作者阅读；附件不包含本体',
    '',
    '---',
    '',
    '> 知源 ownway · 方向树全景导出',
  )
  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n'
}

function htmlLink(text: string, href: string): string {
  return href
    ? `<a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer">${escapeHtml(text)}</a>`
    : escapeHtml(text)
}

export function compassExportHtml(doc: CompassExportDocument, theme: ExportTheme = readExportTheme()): string {
  const goalBlocks = doc.goals.map((g, gi) => {
    const projects = g.projects.map(P => {
      const metrics = P.metrics.map(M => {
        const tasks = M.tasks.length
          ? `<ul class="tasks">${M.tasks.map(T =>
            `<li>${T.taskLink.href ? htmlLink(T.title, T.taskLink.href) : `${escapeHtml(T.title)} <span class="muted">（无有效链接）</span>`}<span class="badge">${escapeHtml(T.status)}</span><span class="badge">${escapeHtml(T.priority)}优</span></li>`).join('')}</ul>`
          : M.missingTasks ? '<p class="warn">⚠ 缺任务：验收已定，动作未落</p>' : ''
        return `<div class="metric"><h4>${escapeHtml(M.title)}<span class="muted"> · ${escapeHtml(M.progress)}</span></h4>${M.target ? `<p class="acc">目标：${escapeHtml(M.target)}</p>` : ''}${M.acceptance ? `<p class="acc">验收：${escapeHtml(M.acceptance)}</p>` : ''}${tasks}</div>`
      }).join('')
      return `<div class="proj"><h3>${escapeHtml(P.name)}${P.focus ? ' <span class="badge">主攻</span>' : ''}${P.stalled ? ' <span class="warn">⚠ 停滞 14 天+</span>' : ''}<span class="muted"> · ${escapeHtml(P.progress)} · ${escapeHtml(P.status)}</span></h3>${metrics}</div>`
    }).join('')
    return `<section class="goal"><h2>${gi + 1}. ${escapeHtml(g.name)}</h2>${projects}</section>`
  }).join('')
  const orphanBlock = doc.orphans.length
    ? `<section><h2>未归档任务 ×${doc.orphans.length}</h2><ul class="tasks">${doc.orphans.map(T =>
      `<li>${T.taskLink.href ? htmlLink(T.title, T.taskLink.href) : escapeHtml(T.title)}<span class="badge">${escapeHtml(T.status)}</span></li>`).join('')}</ul></section>`
    : ''
  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>知源 · 方向树全景</title>
<style>
*{box-sizing:border-box}
html{background:${theme.bg}}
body{margin:0;background:${theme.bg};color:${theme.text};font-family:${theme.fontSans};line-height:1.7;-webkit-font-smoothing:antialiased}
.wrap{max-width:860px;margin:0 auto;padding:40px 26px 56px}
.kicker{color:${theme.accentInk};font-size:11px;font-weight:700;letter-spacing:.09em}
h1{font-size:28px;line-height:1.3;margin:8px 0 18px;overflow-wrap:anywhere}
h2{font-size:16px;color:${theme.accentInk};margin:0 0 10px;line-height:1.4}
h3{font-size:14px;margin:16px 0 8px;overflow-wrap:anywhere}
h4{font-size:13px;margin:12px 0 6px;overflow-wrap:anywhere}
section{border-top:1px solid ${theme.border};padding:18px 0 2px;margin-top:18px}
.proj{margin:14px 0 20px;padding-left:14px;border-left:2px solid ${theme.border}}
.metric{margin:10px 0 14px;padding-left:14px;border-left:2px solid ${theme.border}}
p{margin:4px 0;white-space:pre-wrap;overflow-wrap:anywhere}
.acc{color:${theme.text}}
a{color:${theme.accentInk};text-decoration:underline;text-underline-offset:2px;overflow-wrap:anywhere}
a:hover{color:${theme.accent}}
ul{margin:6px 0 0;padding:0;list-style:none}
.tasks li{display:flex;align-items:center;gap:7px;flex-wrap:wrap;padding:4px 0;font-size:13px}
.badge{font-size:10px;color:${theme.accentInk};border:1px solid ${theme.accent};border-radius:999px;padding:0 6px;white-space:nowrap;font-weight:500}
.warn{color:${theme.textMuted};font-size:11px;border:1px solid ${theme.border};border-radius:999px;padding:1px 7px;display:inline-block}
.muted,.empty{color:${theme.textMuted};font-size:12px}
.footer{border-top:1px solid ${theme.border};margin-top:24px;padding-top:12px;color:${theme.textMuted};font-size:11px;display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap}
@media(max-width:640px){.wrap{padding:28px 16px 44px}h1{font-size:23px}}
@media print{html,body{background:#fff;color:#111}.wrap{max-width:none;padding:0}a{color:#111}section,.proj,.metric{break-inside:avoid}}
</style>
</head>
<body>
<main class="wrap">
  <div class="kicker">知源 ownway · 方向树全景</div>
  <h1>方向树全景</h1>
  <section><h2>愿景</h2><p>${escapeHtml(doc.vision)}</p></section>
  <section><h2>使命</h2><p>${escapeHtml(doc.mission)}</p></section>
  <section><h2>战略目标 ×${doc.counts.goals} · 项目 ×${doc.counts.projects} · 指标 ×${doc.counts.metrics} · 任务 ×${doc.counts.tasks}</h2>${goalBlocks}</section>
  ${orphanBlock}
  <section>
    <h2>导出信息</h2>
    <p>导出时间：${escapeHtml(fmtTs(doc.generatedAt))}<br>数据来源：知源本机数据（只读镜像）<br>用途说明：可作为上下文提供给 AI，或分享给协作者阅读；附件不包含本体</p>
  </section>
  <div class="footer"><span>知源 ownway · 方向树全景导出</span><span>${exportDateStamp(new Date(doc.generatedAt))}</span></div>
</main>
</body>
</html>`
}
