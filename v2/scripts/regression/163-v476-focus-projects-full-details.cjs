const { check, read } = require('./helpers.cjs')

console.log('【V4.7.6 · 主攻项目与时间轴完整详情】')

const STORE = read('/newtab/stores/compass.ts')
const HOME = read('/newtab/views/CompassHome.vue')
const PROFILE = read('/newtab/views/ProfileInsights.vue')

check('V476-1 主攻项目上限统一为 3，存量超出项目不被强制裁剪', () => {
  return STORE.includes('export const FOCUS_PROJECT_LIMIT = 3')
    && STORE.includes('if (others.length >= FOCUS_PROJECT_LIMIT)')
})

check('V476-1b（V4.7.7 重指）方向台与内置手册的主攻上限同为三个；画像方向状态退役后不再展示主攻口径，也不得把 1-2 个的旧文案带回界面。', () => {
  const HOOK = read('/newtab/views/useProfileInsights.ts')
  const OVERVIEW = read('/newtab/components/profile/PiOverview.vue')
  const TREE = read('/newtab/views/CompassTree.vue')
  const MANUAL = read('/newtab/manual-data.ts')
  const DETAIL = read('/newtab/views/useCompassHomeDetail.ts')
  return HOOK.includes('if (out.length >= 3) break')
    && DETAIL.includes('1-3 个项目标为主攻')
    && TREE.includes('（上限 3 个）')
    && MANUAL.includes('上限 3 个')
    && !OVERVIEW.includes('你的方向状态')
    && !OVERVIEW.includes('1-3 个项目标为主攻')
    && !OVERVIEW.includes('1-2 个项目')
    && !TREE.includes('上限 2 个')
    && !MANUAL.includes('上限 2 个')
})

check('V476-2 调度台移除大标题与页头推荐入口，最多展示三个主攻项目', () => {
  return HOME.includes('focusedProjects.slice(0, 3)')
    && HOME.includes('class="desk-focus-project"')
    && !HOME.includes('<h1>调度台</h1>')
    && !HOME.includes('label="AI 推荐今日重点"')
})

check('V476-3 点击主攻项目右侧滑出完整项目详情', () => {
  return HOME.includes('@click="openFocusProject(project)"')
    && HOME.includes(':project-id="readonlyProjectId" mode="drawer"')
})

check('V476-4 画像时间轴点击打开四类卡的完整详情，不再打开摘要抽屉', () => {
  const start = PROFILE.indexOf('function openTimelineEntry(')
  const end = PROFILE.indexOf('function openTimelineEntryLink(', start)
  const body = PROFILE.slice(start, end)
  return body.includes('taskDetailRef.value?.open(task)')
    && body.includes("entry.kind === 'resource' ? 'res'")
    && body.includes("entry.kind === 'topic' ? 'topic'")
    && body.includes("entry.kind === 'curiosity' ? 'curio'")
    && body.includes('emitOpenDrawer')
    && !body.includes('timelineOpen.value = true')
    && !PROFILE.includes('<PiTimelineDrawer')
})
