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
  // 全项目均为 <script setup> / 组合式 API，Options API 合并与运行时代理分支
  // 可以安全裁掉；这是 Vue 官方支持的编译期能力开关，不改变业务行为。
  define: {
    __VUE_OPTIONS_API__: false,
    __VUE_PROD_DEVTOOLS__: false
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  },
  build: {
    target: 'esnext',
    // 发布包预算以磁盘字节为准。esbuild 的最小化已接近下限，
    // 改用 Terser 做一次更彻底的符号/表达式折叠，换取稳定的 2 MiB 余量。
    minify: 'terser',
    // Lightning CSS 对 Vue scoped 选择器与自定义属性做更紧的序列化；
    // 不改变选择器层级或运行时样式语义。
    cssMinify: 'lightningcss',
    // MV3 只面向现代 Chromium；显式声明目标，避免为旧浏览器保留无用的兼容降级。
    cssTarget: 'chrome120',
    terserOptions: {
      compress: {
        passes: 4,
        drop_console: false,
        toplevel: true,
        drop_debugger: true,
        // 保留 error/warn：线上排障与失败提示仍依赖它们；只去掉纯开发日志。
        pure_funcs: ['console.log', 'console.info', 'console.debug']
      },
      mangle: {
        toplevel: true
      },
      format: {
        comments: false,
        // Terser 会按 ASI 规则保留必要分号；去掉可选尾分号不改变语句边界。
        semicolons: false
      }
    },
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
        // V3.9.16：pinyin-pro 已退出运行时（两层内联表），旧的 manualChunks 规则只剩死配置，清掉。
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
