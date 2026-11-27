/**
 * V4.7.1 · 资源夹分层：系统夹（全部资源卡 / 今日采集）紧凑但更醒目，
 * 自建常用夹独立成区；全部资源卡抽屉隐藏重复的顶部常用夹入口。
 */
const { check, read, segOf } = require('./helpers.cjs')

console.log('【V4.7.1 · 资源系统夹与自建常用夹分层】')

const GRID = read('/newtab/components/compass/HomeResourceFolderGrid.vue')
const POOL = read('/newtab/components/compass/PoolCardsPanel.vue')

check('RES471-1 全部资源卡抽屉向 PoolCardsPanel 传 hide-folder-entry，顶部重复入口由开关关闭', () => {
  return GRID.includes('<PoolCardsPanel hide-folder-entry />')
    && POOL.includes('hideFolderEntry?: boolean')
    && POOL.includes('hideFolderEntry: false')
    && segOf(POOL, '<DeckControls panel="pool"', '</DeckControls>').includes('v-if="!hideFolderEntry"')
})

check('RES471-2 系统夹固定两枚：全部资源卡 / 今日采集在先，自建夹标题与新建管理入口在后', () => {
  const template = GRID.slice(GRID.indexOf('<template>'))
  return GRID.includes('class="hrf-folder is-all hrf-system-folder"')
    && GRID.includes('class="hrf-folder is-today hrf-system-folder"')
    && template.indexOf('全部资源卡') < template.indexOf('今日采集')
    && template.indexOf('今日采集') < template.indexOf('v-for="item in folderModules"')
    && GRID.includes('class="hrf-system-grid"')
    && GRID.includes('我的常用夹')
    && GRID.includes('class="hrf-section-actions"')
    && GRID.includes('＋ 新建常用夹')
})

check('RES471-3（V4.7.4 重指）系统夹与常用夹同步瘦身：系统夹 48px、常用夹 54px，仍一行两枚系统夹、强调底色、左色条与更小图标', () => {
  return /\.hrf-system-grid \{[^}]*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/.test(GRID)
    && /\.hrf-system-folder \{[^}]*min-height: 48px/.test(GRID)
    && /\.hrf-folder \{[^}]*min-height: 54px/.test(GRID)
    && GRID.includes('.hrf-system-folder::before')
    && /\.hrf-system-folder::before \{[^}]*background: var\(--accent\)/.test(GRID)
    && GRID.includes('.hrf-system-folder .hrf-icon')
})

check('RES471-4 空态只占自建区，不挤占系统夹；无自建夹时系统夹仍完整渲染', () => {
  const systemEnd = GRID.indexOf('</section>', GRID.indexOf('class="hrf-section hrf-system"'))
  return systemEnd > 0
    && GRID.indexOf('v-else class="hrf-empty"') > systemEnd
    && GRID.includes('class="hrf-empty"')
    && !segOf(GRID, 'class="hrf-section hrf-system"', '</section>').includes('hrf-empty')
})

check('RES471-5 单卡「加入常用夹」与批量 / 镜像 / 右键能力保留，不只靠顶部入口', () => {
  return POOL.includes('function openSingleFolder(')
    && POOL.includes('openSingleFolder(r)')
    && POOL.includes('加入常用夹')
    && POOL.includes('<DeckBatchBar')
    && POOL.includes('openMirror(r)')
    && POOL.includes('@contextmenu="openCtx($event, r)"')
})
