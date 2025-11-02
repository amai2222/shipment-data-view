// 中科物流管理系统 - Service Worker
// 提供离线缓存和性能优化

const CACHE_NAME = 'zkwl-v1.0.0';
const RUNTIME_CACHE = 'zkwl-runtime';

// 需要预缓存的静态资源
const PRECACHE_URLS = [
  '/m/',
  '/m/dashboard/transport',
  '/m/dashboard/shipper',
  '/offline.html'
];

// 安装事件 - 预缓存静态资源
self.addEventListener('install', (event) => {
  console.log('[Service Worker] 安装中...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[Service Worker] 预缓存静态资源');
        return cache.addAll(PRECACHE_URLS);
      })
      .then(() => self.skipWaiting())
  );
});

// 激活事件 - 清理旧缓存
self.addEventListener('activate', (event) => {
  console.log('[Service Worker] 激活中...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME && cacheName !== RUNTIME_CACHE) {
            console.log('[Service Worker] 删除旧缓存:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// 请求拦截 - 缓存策略
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // 跳过非 GET 请求
  if (request.method !== 'GET') {
    return;
  }

  // 跳过 Supabase API 请求（始终从网络获取）
  if (url.hostname.includes('supabase')) {
    return;
  }

  // 跳过 Chrome 扩展请求
  if (url.protocol === 'chrome-extension:') {
    return;
  }

  // HTML 页面：网络优先，失败时使用缓存
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // 克隆响应，一份用于缓存，一份返回
          const responseToCache = response.clone();
          caches.open(RUNTIME_CACHE).then((cache) => {
            cache.put(request, responseToCache);
          });
          return response;
        })
        .catch(() => {
          return caches.match(request)
            .then((cachedResponse) => {
              if (cachedResponse) {
                return cachedResponse;
              }
              // 如果缓存中也没有，返回离线页面
              return caches.match('/offline.html');
            });
        })
    );
    return;
  }

  // 静态资源：缓存优先，失败时从网络获取
  if (
    request.destination === 'script' ||
    request.destination === 'style' ||
    request.destination === 'font' ||
    request.destination === 'image'
  ) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }
        return fetch(request).then((response) => {
          // 只缓存成功的响应
          if (response && response.status === 200) {
            const responseToCache = response.clone();
            caches.open(RUNTIME_CACHE).then((cache) => {
              cache.put(request, responseToCache);
            });
          }
          return response;
        });
      })
    );
    return;
  }

  // 其他请求：网络优先
  event.respondWith(
    fetch(request).catch(() => {
      return caches.match(request);
    })
  );
});

// 消息事件 - 用于手动更新缓存
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'CLEAR_CACHE') {
    event.waitUntil(
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => caches.delete(cacheName))
        );
      })
    );
  }
});

// 后台同步（如果支持）
if ('sync' in self.registration) {
  self.addEventListener('sync', (event) => {
    if (event.tag === 'sync-data') {
      console.log('[Service Worker] 后台同步数据');
      // 这里可以添加离线数据同步逻辑
    }
  });
}

console.log('[Service Worker] 已加载');

