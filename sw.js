const CACHE_NAME = 'mondial-2026-v3';
const URLS_TO_CACHE = [
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

// تثبيت الـ Service Worker وتخزين الملفات الأساسية
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(URLS_TO_CACHE))
  );
  self.skipWaiting();
});

// تفعيل الـ Service Worker وحذف الكاش القديم
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) =>
      Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      )
    )
  );
  self.clients.claim();
});

// استراتيجية: Network First لـ Supabase + index.html (دايماً أحدث نسخة)، Cache First للباقي (أيقونات...)
self.addEventListener('fetch', (event) => {
  const url = event.request.url;

  // ما نتدخل بطلبات Supabase أبداً — لازم تكون دايماً Live
  if (url.includes('supabase.co')) {
    return;
  }

  // index.html والتنقلات (فتح التطبيق): Network First — جيب الأحدث دايماً، واستخدم الكاش بس لو الإنترنت مقطوع
  const isHTML = event.request.mode === 'navigate' || url.endsWith('/index.html') || url.endsWith('/');
  if (isHTML) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response && response.status === 200) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseClone));
          }
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // باقي الملفات الثابتة (أيقونات، إلخ): Cache First
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) return cachedResponse;
      return fetch(event.request).then((response) => {
        if (response && response.status === 200 && event.request.method === 'GET') {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseClone));
        }
        return response;
      }).catch(() => cachedResponse);
    })
  );
});
