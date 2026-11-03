/* 知源 · 移动采集 PWA Service Worker —— 只缓存 app shell，绝不缓存 /auth/v1 与 /rest/v1 */
const CACHE = 'zy-mobile-shell-v1'
const SHELL = ['./', './index.html', './mobile-manifest.webmanifest']

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()))
})
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()))
})
self.addEventListener('fetch', (e) => {
  const u = new URL(e.request.url)
  if (u.pathname.startsWith('/auth/') || u.pathname.startsWith('/rest/') || e.request.method !== 'GET') {
    return // 网络直通，不缓存
  }
  e.respondWith(
    caches.match(e.request).then((hit) => hit || fetch(e.request).then((res) => {
      const copy = res.clone()
      if (res.ok && (u.origin === location.origin)) caches.open(CACHE).then((c) => c.put(e.request, copy))
      return res
    }).catch(() => caches.match('./index.html')))
  )
})
