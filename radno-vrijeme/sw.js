/*
 * sw.js — service worker: aplikacija radi bez mreže.
 *
 * Datoteke aplikacije spremaju se pri instalaciji i poslužuju iz predmemorije,
 * pa nakon prvog otvaranja internet više nije potreban. Zahtjevi prema drugim
 * poslužiteljima (Google prijava i Drive) namjerno se ne diraju.
 */
const CACHE = 'radno-vrijeme-v1';

const ASSETS = [
    './',
    './index.html',
    './css/styles.css',
    './js/store.js',
    './js/drive.js',
    './js/app.js',
    './manifest.webmanifest',
    './icons/icon-192.png',
    './icons/icon-512.png',
    './icons/icon-maskable-512.png'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE)
            .then((cache) => cache.addAll(ASSETS))
            .then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys()
            .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
            .then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (event) => {
    const request = event.request;
    if (request.method !== 'GET') return;

    const url = new URL(request.url);
    if (url.origin !== self.location.origin) return; // Google prijava i Drive idu na mrežu

    // Otvaranje aplikacije bez mreže uvijek završi na spremljenoj početnoj stranici.
    if (request.mode === 'navigate') {
        event.respondWith(
            fetch(request).catch(() => caches.match('./index.html', { ignoreSearch: true }))
        );
        return;
    }

    event.respondWith(
        caches.match(request, { ignoreSearch: true }).then((cached) => {
            if (cached) {
                // Osvježi u pozadini da sljedeće otvaranje ima noviju verziju.
                fetch(request)
                    .then((response) => {
                        if (response && response.ok) {
                            caches.open(CACHE).then((cache) => cache.put(request, response));
                        }
                    })
                    .catch(() => {});
                return cached;
            }
            return fetch(request);
        })
    );
});
