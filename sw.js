// TANTЯO Service Worker
// Bump APP_VERSION on each deploy to bust caches and notify users
const APP_VERSION = '3.48';
const CACHE_NAME = `tantro-v${APP_VERSION}`;

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

// Install: cache core assets (skip on old domain — assets redirect cross-origin and break caching)
self.addEventListener('install', (event) => {
    if (self.location.hostname === 'tantris.official-intelligence.art') {
        console.log('📦 PWA: Old domain detected, skipping cache — will redirect');
        self.skipWaiting();
        return;
    }
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('📦 PWA: Caching core assets for v' + APP_VERSION);
            return cache.addAll(CORE_ASSETS);
        })
    );
    // Activate immediately
    self.skipWaiting();
});

// Activate: clean up old caches, take control, then notify clients
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
        }).then(() => {
            // Take control of all pages immediately
            return self.clients.claim();
        }).then(() => {
            // Notify all open tabs that a new version is available
            // Done AFTER claim() so we actually control these clients
            return self.clients.matchAll({ type: 'window' }).then((clients) => {
                clients.forEach((client) => {
                    client.postMessage({ type: 'SW_UPDATED', version: APP_VERSION });
                });
                console.log('📦 PWA: Notified ' + clients.length + ' client(s) of v' + APP_VERSION);
            });
        })
    );
});

// Respond to version queries from the page
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'GET_VERSION') {
        event.source.postMessage({ type: 'SW_VERSION', version: APP_VERSION });
    }
});

// Fetch: network-first for API calls, cache-first for assets
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // Old domain: unregister SW and redirect to new domain
    if (url.hostname === 'tantris.official-intelligence.art' && event.request.mode === 'navigate') {
        const newUrl = 'https://tantro.official-intelligence.art' + url.pathname + url.search + url.hash;
        const html = '<!DOCTYPE html><html><head><title>Redirecting...</title></head><body>' +
            '<script>navigator.serviceWorker.getRegistrations().then(function(regs){' +
            'Promise.all(regs.map(function(r){return r.unregister()})).then(function(){' +
            'window.location.replace("' + newUrl + '")})});<\/script>' +
            '<noscript><meta http-equiv="refresh" content="0;url=' + newUrl + '"></noscript>' +
            'Redirecting to <a href="' + newUrl + '">TANTЯO</a>...</body></html>';
        event.respondWith(new Response(html, {
            headers: { 'Content-Type': 'text/html' }
        }));
        return;
    }

    // Skip non-GET requests
    if (event.request.method !== 'GET') return;

    // Skip non-http(s) schemes (e.g. chrome-extension://) — Cache API only supports http/https
    if (!url.protocol.startsWith('http')) return;

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
