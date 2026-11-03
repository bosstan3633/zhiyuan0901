import { createApp } from 'vue'
import App from './App.vue'
import './mobile.css'

createApp(App).mount('#app')

// 注册 Service Worker（仅缓存 app shell，不缓存 /auth/v1 与 /rest/v1）
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./mobile-sw.js').catch(() => { /* noop */ })
  })
}
