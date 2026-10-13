import { defineManifest } from '@crxjs/vite-plugin'

export default defineManifest({
  manifest_version: 3,
  name: '知源调度台',
  short_name: '知源',
    version: '3.8.11',
  description: '你在浏览器里的个人调度中台 · 万千可调用，自有我方向 · 本地优先 · Chrome MV3',
  permissions: ['storage', 'unlimitedStorage', 'tabs', 'activeTab', 'commands', 'scripting', 'downloads', 'alarms'],
  host_permissions: ['<all_urls>', 'file:///*'],
  chrome_url_overrides: {
    newtab: 'src/newtab/index.html'
  },
  action: {
    default_title: '知源调度台 · 点击打开采集面板'
  },
  options_page: 'src/options/index.html',
  background: {
    service_worker: 'src/background/index.ts',
    type: 'module'
  },
  commands: {
    'open-dashboard': {
      suggested_key: { default: 'Ctrl+Shift+K', mac: 'MacCtrl+Shift+K' },
      description: '打开知源调度台（新标签页）'
    },
    'quick-capture': {
      suggested_key: { default: 'Ctrl+Shift+J', mac: 'MacCtrl+Shift+J' },
      description: '快速采集当前浏览的页面'
    },
    search: {
      suggested_key: { default: 'Ctrl+K', mac: 'MacCtrl+K' },
      description: '打开全局搜索'
    },
    inspire: {
      suggested_key: { default: 'Ctrl+Shift+I', mac: 'MacCtrl+Shift+I' },
      description: '好奇心采集'
    },
    // 第卅五轮 REQ-037：不配 suggested_key（不占用 4 键上限），由用户在 chrome://extensions/shortcuts 手动分配
    'open-settings': {
      description: '全局设置'
    },
    // R49-I1 + R50-F3/F8 + R65-F6：浏览器级命令（无默认键，chrome://extensions/shortcuts 自定义）
    // R68-F3：「打开方向台」「打开资源台」退役——方向台/资源台/策展台改由应用内 Alt+数字（台签顺序）切台
    'open-tree': {
      description: '打开完整方向树'
    },
    // R55-C：快速采集任务（无默认键，chrome://extensions/shortcuts 自定义）
    'open-tasks': {
      description: '快速采集任务'
    },
    // R63-8：Airtable 手动同步（无默认键，不占 4 键上限）
    'sync-airtable': {
      description: '同步到 Airtable'
    },
    // R67-F4 + R68-F3：模块直达（无默认键，chrome://extensions/shortcuts 自定义；打开目标台并滚动定位+高亮）
    'goto-curiosity': {
      description: '直达好奇心培养模块'
    },
    'goto-tasks': {
      description: '直达任务调度模块'
    }
  },
  content_scripts: [
    {
      matches: ['http://*/*', 'https://*/*', 'file://*/*'],
      js: ['src/content/search-overlay.ts'],
      run_at: 'document_idle',
      all_frames: true
    }
  ],
  icons: {
    16: 'icons/icon16.png',
    48: 'icons/icon48.png',
    128: 'icons/icon128.png'
  },
  web_accessible_resources: [
    {
      resources: ['assets/*'],
      matches: ['<all_urls>']
    }
  ]
})
