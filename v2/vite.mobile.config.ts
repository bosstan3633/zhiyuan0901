import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'

// 移动端采集 PWA 独立构建（不碰扩展主构建）
export default defineConfig({
  plugins: [vue()],
  define: { __VUE_OPTIONS_API__: false, __VUE_PROD_DEVTOOLS__: false },
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  root: fileURLToPath(new URL('./src/mobile', import.meta.url)),
  base: '/zhiyuan0901/',
  publicDir: fileURLToPath(new URL('./mobile-public', import.meta.url)),
  build: {
    outDir: fileURLToPath(new URL('./dist-pwa', import.meta.url)),
    emptyOutDir: true,
    target: 'esnext',
  },
})
