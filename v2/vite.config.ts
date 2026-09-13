import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { crx } from '@crxjs/vite-plugin'
import UnoCSS from 'unocss/vite'
import { fileURLToPath, URL } from 'node:url'
import fs from 'node:fs'
import path from 'node:path'
import manifest from './src/manifest'

/**
 * R114-59：content script 隔离世界里的相对动态 import 会被浏览器解析到**宿主页 origin**
 * （如 https://目标站/assets/chunk-*.js → 404 / MIME 拒绝 → 浮层实现与拼音字典链路静默失效，
 * 且每次 Ctrl+K 都要吃一次 404 网络往返——这正是「全局搜索慢」的元凶之一）。
 * 构建期把 dist 内所有相对路径动态 import 统一改写为 chrome.runtime.getURL 绝对路径——
 * content 与扩展页两个世界都有 chrome.runtime，改写对两界皆安全、零行为差异。
 */
function fixContentDynamicImports() {
  return {
    name: 'fix-content-dynamic-imports',
    closeBundle() {
      const dir = fileURLToPath(new URL('./dist/assets', import.meta.url))
      if (!fs.existsSync(dir)) return
      let fixed = 0
      for (const f of fs.readdirSync(dir)) {
        if (!f.endsWith('.js')) continue
        const p = path.join(dir, f)
        const src = fs.readFileSync(p, 'utf8')
        const out = src.replace(/import\((["'])(\.\.?\/[^"']+\.js)\1\)/g, (_m, _q, rel: string) => {
          const name = rel.replace(/^(\.\.\/)+/, '').replace(/^assets\//, '')
          fixed++
          return `import(chrome.runtime.getURL("assets/${name}"))`
        })
        if (out !== src) fs.writeFileSync(p, out)
      }
      if (fixed) console.log(`  [fix-content-dynamic-imports] 改写 ${fixed} 处相对动态 import → chrome.runtime.getURL`)
    }
  }
}

export default defineConfig({
  plugins: [vue(), crx({ manifest }), UnoCSS(), fixContentDynamicImports()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  },
  build: {
    target: 'esnext',
    // R114-59：禁用 modulePreload——其依赖链接以 document base 解析，在 content script 隔离世界
    // 会打到「宿主页 origin」（https://目标站/assets/chunk-*.js → 404 + MIME 报错），
    // 每次 Ctrl+K 白吃 2~3 个跨域 404 往返（全局搜索慢的元凶之一）；扩展场景本地磁盘加载，preload 无收益。
    modulePreload: false,
    // R70：生成 sourcemap（hidden = 产出 .map 但不写引用注释）。
    // 此前 dist 内 0 个 .map，用户侧报错只能拿到压缩后的堆栈（runtimeError.ts 记的错误日志也无法定位）。
    // 用户安装包在打包时排除 *.map，分发体积不变。
    sourcemap: 'hidden',
    rollupOptions: {
      output: {
        chunkFileNames: 'assets/chunk-[hash].js',
        // R70：把 pinyin-pro（约 296KB 字典）隔离为独立 chunk——它只在打开搜索浮层时才动态 import，
        // 隔离后可确保不被卷进共享 chunk 拖累首屏，也便于长期缓存。
        manualChunks(id: string) {
          if (id.includes('pinyin-pro')) return 'pinyin'
          return undefined
        }
      }
    }
  },
  server: {
    port: 5173,
    strictPort: true,
    hmr: {
      port: 5173
    }
  }
})
