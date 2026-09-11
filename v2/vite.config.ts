import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { crx } from '@crxjs/vite-plugin'
import UnoCSS from 'unocss/vite'
import { fileURLToPath, URL } from 'node:url'
import manifest from './src/manifest'

export default defineConfig({
  plugins: [vue(), crx({ manifest }), UnoCSS()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  },
  build: {
    target: 'esnext',
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
