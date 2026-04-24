const CACHE_NAME = 'laser-eyes-v1';
const STATIC_ASSETS = [
    './',
    './index.html',
    './big_mouth.html',
    './standard.html',
    './space_evaders.html',
    './star_horde.html',
    './uncle_sam.html',
    './glass.html',
    './tracker.js',
    './shared.css',
    'https://cdn.jsdelivr.net/npm/webgazer@2.1.1/dist/webgazer.js',
    'https://cdn.tailwindcss.com'
];

// Domains that we want to cache dynamically (like ML models)
const DYNAMIC_CACHE_DOMAINS = [
    'tfhub.dev',
    'gstatic.com'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('[Service Worker] Pre-caching static assets');
            return cache.addAll(STATIC_ASSETS);
        })
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('[Service Worker] Removing old cache', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
});

self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // Strategy: Cache First for heavy libs and models
    const isHeavyLib = url.hostname.includes('jsdelivr.net') || 
                       url.hostname.includes('tfhub.dev') || 
                       url.hostname.includes('gstatic.com');
    
    const isStaticLocal = STATIC_ASSETS.some(asset => event.request.url.includes(asset.replace('./', '')));

    if (isHeavyLib || isStaticLocal) {
        event.respondWith(
            caches.match(event.request).then((response) => {
                if (response) {
                    return response; // Return from cache
                }
                
                // Not in cache, fetch and cache
                return fetch(event.request).then((networkResponse) => {
                    if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic' && networkResponse.type !== 'cors') {
                        return networkResponse;
                    }

                    const responseToCache = networkResponse.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(event.request, responseToCache);
                    });

                    return networkResponse;
                }).catch(() => {
                    // Fallback or error handling
                });
            })
        );
    } else {
        // Default: Network First or Stale-While-Revalidate for other things
        event.respondWith(
            caches.match(event.request).then((response) => {
                return response || fetch(event.request);
            })
        );
    }
});
