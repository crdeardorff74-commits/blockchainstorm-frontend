// TaNTЯiS Service Worker
// Bump APP_VERSION on each deploy to bust caches and notify users
const APP_VERSION = '3.28';
const CACHE_NAME = `tantris-v${APP_VERSION}`;

// Core files to cache for offline play
const CORE_ASSETS = [
    '/',
    '/index.html',
    '/style.css',
    '/game.js',
    '/ai-player.js',
    '/ai-worker.js',
    '/audio.js',
    '/color-palettes.js',
    '/controls-config.js',
    '/game-recorder.js',
    '/histogram.js',
    '/i18n.js',
    '/leaderboard.js',
    '/render-utils.js',
    '/settings-sync.js',
    '/starfield.js',
    '/storm-effects.js',
    '/auth.js',
    '/config.js',
    '/manifest.json',
    '/favicon.ico'
];

// Install: cache core assets and notify clients of update
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('📦 PWA: Caching core assets for v' + APP_VERSION);
            return cache.addAll(CORE_ASSETS);
        }).then(() => {
            // Notify all open tabs that a new version is available
            return self.clients.matchAll({ type: 'window' }).then((clients) => {
                clients.forEach((client) => {
                    client.postMessage({ type: 'SW_UPDATED', version: APP_VERSION });
                });
            });
        })
    );
    // Activate immediately
    self.skipWaiting();
});

// Activate: clean up old caches
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames
                    .filter((name) => name !== CACHE_NAME)
                    .map((name) => {
                        console.log('🗑️ PWA: Removing old cache:', name);
                        return caches.delete(name);
                    })
            );
        })
    );
    // Take control of all pages immediately
    self.clients.claim();
});

// Fetch: network-first for API calls, cache-first for assets
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // Skip non-GET requests
    if (event.request.method !== 'GET') return;

    // API calls and analytics: network only, don't cache
    if (url.hostname.includes('onrender.com') ||
        url.hostname.includes('github.com') ||
        url.pathname.startsWith('/api/')) {
        return;
    }

    // Music files: cache on first fetch (too large to precache)
    if (url.pathname.endsWith('.mp3') || url.pathname.endsWith('.ogg')) {
        event.respondWith(
            caches.match(event.request).then((cached) => {
                if (cached) return cached;
                return fetch(event.request).then((response) => {
                    if (response.ok) {
                        const clone = response.clone();
                        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
                    }
                    return response;
                });
            })
        );
        return;
    }

    // Everything else: cache-first, fall back to network
    event.respondWith(
        caches.match(event.request).then((cached) => {
            if (cached) {
                // Return cache but also update in background
                fetch(event.request).then((response) => {
                    if (response.ok) {
                        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, response));
                    }
                }).catch(() => {});
                return cached;
            }
            return fetch(event.request).then((response) => {
                if (response.ok) {
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
                }
                return response;
            });
        })
    );
});
