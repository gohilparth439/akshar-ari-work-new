/* ============================================================
   AKSHAR ARI WORK — PWA Service Worker
   Offline Support, Fast Caching & Android APK / PWABuilder Ready
   Preserves Real-time Firebase Firestore Sync
   ============================================================ */

const CACHE_NAME = 'akshar-ari-work-v2.2';

// App shell assets to precache
const PRECACHE_ASSETS = [
    './',
    './index.html',
    './style.css',
    './script.js',
    './firebase-config.js',
    './manifest.json',
    './icons/icon-192.png',
    './icons/icon-512.png',
    './icons/icon-maskable-192.png',
    './icons/icon-maskable-512.png',
    './icon-192.png',
    './icon-512.png',
    './icon-maskable-192.png',
    './icon-maskable-512.png',
    './favicon.ico',
    './favicon.png'
];

// 1. INSTALL: Precache local shell assets immediately
self.addEventListener('install', event => {
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => {
            console.log('[ServiceWorker] Precaching app shell assets');
            return Promise.all(
                PRECACHE_ASSETS.map(url => {
                    return cache.add(url).catch(err => {
                        console.warn('[ServiceWorker] Precache skipped for:', url, err);
                    });
                })
            );
        })
    );
});

// 2. ACTIVATE: Clean up outdated caches & claim control
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(name => {
                    if (name !== CACHE_NAME) {
                        console.log('[ServiceWorker] Purging old cache:', name);
                        return caches.delete(name);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

// 3. FETCH: Smart caching strategy
self.addEventListener('fetch', event => {
    const request = event.request;
    if (request.method !== 'GET') return;

    const url = new URL(request.url);

    // BYPASS Firestore / Firebase API endpoints so real-time cloud data is never cached stale
    if (
        url.hostname.includes('firestore.googleapis.com') ||
        url.hostname.includes('firebaseio.com') ||
        url.hostname.includes('identitytoolkit.googleapis.com') ||
        url.pathname.includes('/google.firestore.')
    ) {
        return; // Handled directly by native browser network
    }

    // Navigation requests (HTML page): Network-first with cache fallback
    if (request.mode === 'navigate') {
        event.respondWith(
            fetch(request)
                .then(networkResponse => {
                    if (networkResponse && networkResponse.status === 200) {
                        const copy = networkResponse.clone();
                        caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
                    }
                    return networkResponse;
                })
                .catch(async () => {
                    const cached = await caches.match(request);
                    if (cached) return cached;
                    return caches.match('./index.html') || caches.match('./');
                })
        );
        return;
    }

    // Static assets & CDN libraries: Stale-While-Revalidate
    event.respondWith(
        caches.match(request).then(cachedResponse => {
            const fetchPromise = fetch(request)
                .then(networkResponse => {
                    if (networkResponse && (networkResponse.status === 200 || networkResponse.type === 'opaque')) {
                        const copy = networkResponse.clone();
                        caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
                    }
                    return networkResponse;
                })
                .catch(() => {
                    // Network offline: cached response will serve
                });

            return cachedResponse || fetchPromise;
        })
    );
});
