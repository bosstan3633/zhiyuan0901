/**
 * V4.7.1 · 任务/选题详情“安排历程”主模块。
 *
 * 锁定：
 *   · 历程是纵向时间轴，含当前计划、次数、操作时间、来源、删除与撤销；
 *   · 任务详情把历程放在归属之前，日期收进主模块，“设为今日重点”降为次级链接；
 *   · 选题详情同构，不再使用整块 topic-focus-btn。
 */
const { check, read, segOf } = require('./helpers.cjs')

console.log('【V4.7.1 · 安排历程主模块】')

const PSH = read('/newtab/components/compass/PlanScheduleHistory.vue')
const TASK = read('/newtab/components/compass/TaskDetailDrawer.vue')
const TOPIC = read('/newtab/components/compass/TopicDetailDrawer.vue')

check('HIST156-1 ★安排历程含当前计划 chip、次数与最近时间', () => {
  return PSH.includes('class="psh-current"')
    && PSH.includes('<i>当前计划</i>')
    && PSH.includes('{{ currentLabel }}')
    && PSH.includes('{{ events.length }} 次安排')
    && PSH.includes('最近 {{ fmtAt(latestAt) }}')
})

check('HIST156-2 ★纵向时间轴：节点、改期链、操作时间、来源标签、最新强调', () => {
  return PSH.includes('class="psh-timeline"')
    && PSH.includes('class="psh-rail"')
    && PSH.includes('class="psh-from"')
    && PSH.includes(':class="{ latest: index === 0 }"')
    && PSH.includes('{{ fmtAt(event.at) }}')
    && PSH.includes('{{ SOURCE_LABEL[event.source] }}')
})

check('HIST156-3 ★删除单条历程不改变当前计划，Toast 可撤销', () => {
  return PSH.includes('title="删除这条安排记录（不改当前计划）"')
    && PSH.includes('removePlanEvent(d.value, event.id)')
    && PSH.includes("label: '撤销'")
    && PSH.includes('restorePlanEvent(d.value, event.id)')
})

check('HIST156-4 ★超过 5 条才显示“显示全部/收起”，空态说明从本版本开始记录', () => {
  return PSH.includes('v-if="events.length > 5"')
    && PSH.includes('显示全部 ${events.length} 条')
    && PSH.includes('从本版本开始记录安排动作')
})

check('HIST156-5 ★任务详情：安排历程主模块位于归属之前，日期收进模块，今日重点降为次级', () => {
  const plan = TASK.indexOf('class="ts-section ts-plan-hero"')
  const owner = TASK.indexOf('class="ts-section ts-owner')
  const body = TASK.indexOf('<div class="ts-body">')
  const planSeg = segOf(TASK, '<section class="ts-section ts-plan-hero">', '</section>')
  return body >= 0 && plan > body && owner > plan
    && planSeg.includes('<PlanScheduleHistory')
    && planSeg.includes('class="ts-plan-edit"')
    && planSeg.includes('class="ts-focus-link"')
    && planSeg.includes('设为今日重点')
    && !planSeg.includes('class="ts-focus-btn"')
    && !TASK.includes('class="ts-focus-btn"')
})

check('HIST156-6 ★选题详情同构：计划主模块在成果出口之前，今日重点降为次级链接', () => {
  const plan = TOPIC.indexOf('class="topic-plan topic-plan-hero"')
  const outcome = TOPIC.indexOf('class="topic-outcome"')
  const planSeg = segOf(TOPIC, '<section class="topic-plan topic-plan-hero">', '</section>')
  return plan >= 0 && outcome > plan
    && planSeg.includes('<PlanScheduleHistory')
    && planSeg.includes('class="topic-plan-edit"')
    && planSeg.includes('class="topic-focus-link"')
    && !planSeg.includes('class="topic-focus-btn"')
    && !TOPIC.includes('class="topic-focus-btn"')
})

check('HIST156-7 ★任务/选题两处都保留日期清除入口且不改状态', () => {
  return TASK.includes('class="ts-plan-clear"')
    && TASK.includes("updatePlannedDate('')")
    && TOPIC.includes('class="topic-plan-clear"')
    && TOPIC.includes("updateDueDate('')")
})
