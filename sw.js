// Service Worker for Offline Support
const CACHE_NAME = 'agenthub-v1';
const ASSETS = [
    '/',
    '/index.html',
    '/styles.css',
    '/app.js',
    '/modules/storage.js',
    '/modules/ai-tools.js'
];

// Install
self.addEventListener('install', (e) => {
    e.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('[SW] Caching assets');
            return cache.addAll(ASSETS);
        })
    );
    self.skipWaiting();
});

// Activate
self.addEventListener('activate', (e) => {
    e.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
            );
        })
    );
    self.clients.claim();
});

// Fetch with network-first strategy for API calls, cache-first for assets
self.addEventListener('fetch', (e) => {
    const url = new URL(e.request.url);

    // Network-first for API calls
    if (url.pathname.includes('/api/') || url.hostname !== location.hostname) {
        e.respondWith(
            fetch(e.request).catch(() => caches.match(e.request))
        );
        return;
    }

    // Cache-first for assets
    e.respondWith(
        caches.match(e.request).then((cached) => {
            const fetched = fetch(e.request).then((response) => {
                const clone = response.clone();
                caches.open(CACHE_NAME).then((cache) => cache.put(e.request, clone));
                return response;
            });
            return cached || fetched;
        })
    );
});

// Background sync for offline actions
self.addEventListener('sync', (e) => {
    if (e.tag === 'sync-state') {
        e.waitUntil(syncState());
    }
});

async function syncState() {
    // Sync pending actions when back online
    console.log('[SW] Syncing state...');
}

// Push notifications
self.addEventListener('push', (e) => {
    const data = e.data?.json() || { title: 'AgentHub', body: 'Nueva notificación' };

    e.waitUntil(
        self.registration.showNotification(data.title, {
            body: data.body,
            icon: '/icon-192.png',
            badge: '/badge-72.png',
            vibrate: [100, 50, 100],
            data: data.data
        })
    );
});

self.addEventListener('notificationclick', (e) => {
    e.notification.close();
    e.waitUntil(
        clients.openWindow('/')
    );
});
