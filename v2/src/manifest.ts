import { defineManifest } from '@crxjs/vite-plugin'

export default defineManifest({
  manifest_version: 3,
  name: '知源调度台',
  short_name: '知源',
  version: '2.30.0',
  description: '信息洪流中的控制中心 · 个人资源调度台 · 本地优先 · Chrome MV3',
  permissions: ['storage', 'unlimitedStorage', 'tabs', 'activeTab', 'commands', 'scripting', 'downloads'],
  host_permissions: ['<all_urls>', 'file:///*'],
  chrome_url_overrides: {
    newtab: 'src/newtab/index.html'
  },
  action: {
    default_title: '知源调度台 · 点击打开采集小窗'
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
    // R49-I1 + R50-F3/F8：方向台/策展中心/完整方向树浏览器级命令（无默认键，chrome://extensions/shortcuts 自定义）
    'open-compass': {
      description: '打开方向台'
    },
    'open-resource': {
      description: '打开策展中心'
    },
    'open-tree': {
      description: '打开完整方向树'
    },
    // R55-C：快速采集任务（无默认键，chrome://extensions/shortcuts 自定义）
    'open-tasks': {
      description: '快速采集任务'
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
      resources: ['src/popup/index.html', 'assets/*'],
      matches: ['<all_urls>']
    }
  ]
})
