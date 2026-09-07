/* 极简 Service Worker（免费，本地缓存 + 网络优先回退缓存）
 * 启用条件：仅缓存同源静态资源（GET 200），不缓存 API（SSE/POST/JSON）。
 * 缓存策略：stale-while-revalidate（先返回缓存再后台刷新）。
 * 升级缓存版本号 = CACHE 字符串变更即触发 activate 清理旧缓存。
 */
const CACHE = 'fy-credit-v1';
const ASSETS = ['/', '/index.html', '/logo.jpg', '/manifest.webmanifest'];

self.addEventListener('install', (e) => {
  // 预缓存核心资源
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).catch(() => {}));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  // 仅处理 GET + 同源
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  // API 请求不缓存（避免脏数据）
  if (url.pathname.startsWith('/api/')) return;

  e.respondWith(
    caches.match(req).then((cached) => {
      const fetchPromise = fetch(req)
        .then((res) => {
          // 仅缓存 200 响应，避免缓存错误页
          if (res && res.status === 200) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
          }
          return res;
        })
        .catch(() => cached);
      return cached || fetchPromise;
    })
  );
});