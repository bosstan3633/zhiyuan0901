import { defineManifest } from '@crxjs/vite-plugin'

export default defineManifest({
  manifest_version: 3,
  name: '知源工作台',
  short_name: '知源',
  version: '2.14.1',
  description: '源头信息与好奇心工作台 · 从好奇出发，向源头求证 · 纯本地 · Chrome MV3',
  permissions: ['storage', 'unlimitedStorage', 'tabs', 'activeTab', 'commands', 'scripting'],
  host_permissions: ['<all_urls>', 'file:///*'],
  chrome_url_overrides: {
    newtab: 'src/newtab/index.html'
  },
  action: {
    default_title: '知源工作台 · 点击打开采集小窗'
  },
  options_page: 'src/options/index.html',
  background: {
    service_worker: 'src/background/index.ts',
    type: 'module'
  },
  commands: {
    'open-dashboard': {
      suggested_key: { default: 'Ctrl+Shift+K', mac: 'MacCtrl+Shift+K' },
      description: '打开知源工作台（新标签页）'
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
      description: '打开全局设置'
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
