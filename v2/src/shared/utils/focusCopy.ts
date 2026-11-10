export interface DailyFocusCopyInput {
  projectName?: string
  metricName?: string
  taskTitle?: string
}

function cleanPart(value: string | undefined): string {
  return (value || '').trim()
}

/** 今日三件事的固定外发文案；任一层级缺失时返回空串，避免生成半截句子。 */
export function buildDailyFocusCopyText(input: DailyFocusCopyInput): string {
  const project = cleanPart(input.projectName)
  const metric = cleanPart(input.metricName)
  const task = cleanPart(input.taskTitle)
  if (!project || !metric || !task) return ''
  return `今天计划推进${project}项目下${metric}成功指标的${task}任务`
}
