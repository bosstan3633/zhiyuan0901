export interface DailyFocusCopyInput {
  projectName?: string
  metricName?: string
  taskTitle?: string
}

function cleanPart(value: string | undefined): string {
  return (value || '').trim()
}

function mocProjectName(project: string): string {
  return `MOC-${project.replace(/^MOC-/i, '').trim()}`
}

/** 今日三件事的固定外发文案；任一层级缺失时返回空串，避免生成半截句子。 */
export function buildDailyFocusCopyText(input: DailyFocusCopyInput): string {
  const project = cleanPart(input.projectName)
  const metric = cleanPart(input.metricName)
  const task = cleanPart(input.taskTitle)
  if (!project || !metric || !task) return ''
  return `推进[[${mocProjectName(project)}]]项目，${task}，助力【${metric}】指标落实到位`
}
