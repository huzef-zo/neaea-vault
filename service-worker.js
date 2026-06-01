/* ============================================
   NEAEA Vault — Service Worker
   Cache-first strategy for full offline support
   ============================================ */

const CACHE_NAME = 'neaea-vault-v73';

// Core app shell
const APP_SHELL = [
  '/',
  '/index.html',
  '/style.css',
  '/app.js',
  '/manifest.json',
  '/data/manifest.json',
];

// Data files — automatically generated
const DATA_FILES = [
  '/data/aptitude/2015_p1.json',
  '/data/aptitude/2017_p1.json',
  '/data/aptitude/2018_p1.json',
  '/data/aptitude/2018_p2.json',
  '/data/aptitude/2018_p3.json',
  '/data/biology/2012_p1.json',
  '/data/biology/2013_p1.json',
  '/data/biology/2013_p2.json',
  '/data/biology/2015_p1.json',
  '/data/biology/2017_p1.json',
  '/data/biology/2017_p2.json',
  '/data/biology/2018_p1.json',
  '/data/biology/2018_p2.json',
  '/data/biology/2018_p3.json',
  '/data/biology/2018_p4.json',
  '/data/biology/2018_p5.json',
  '/data/biology/2018_p6.json',
  '/data/biology/2018_p7.json',
  '/data/chemistry/2012_p1.json',
  '/data/chemistry/2013_p1.json',
  '/data/chemistry/2015_p1.json',
  '/data/chemistry/2017_p1.json',
  '/data/chemistry/2017_p2.json',
  '/data/chemistry/2017_p3.json',
  '/data/chemistry/2017_p4.json',
  '/data/chemistry/2018_p1.json',
  '/data/chemistry/2018_p2.json',
  '/data/chemistry/2018_p3.json',
  '/data/chemistry/2018_p4.json',
  '/data/chemistry/2018_p5.json',
  '/data/english/2012_p1.json',
  '/data/english/2013_p1.json',
  '/data/english/2015_p1.json',
  '/data/english/2016_p1.json',
  '/data/english/2017_p1.json',
  '/data/english/2017_p2.json',
  '/data/english/2018_p1.json',
  '/data/english/2018_p2.json',
  '/data/english/2018_p3.json',
  '/data/english/2018_p4.json',
  '/data/english/2018_p5.json',
  '/data/mathematics/2015_p1.json',
  '/data/physics/2015_p1.json',
  '/data/manifest.json',
];

// Icon files
const ICON_FILES = [
  '/icons/icon-72.png',
  '/icons/icon-96.png',
  '/icons/icon-128.png',
  '/icons/icon-144.png',
  '/icons/icon-152.png',
  '/icons/icon-192.png',
  '/icons/icon-384.png',
  '/icons/icon-512.png',
];

const ALL_ASSETS = [...APP_SHELL, ...DATA_FILES, ...ICON_FILES];

// Install — cache everything
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Caching app shell and data');
      return cache.addAll(ALL_ASSETS);
    })
  );
  self.skipWaiting();
});

// Activate — clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

// Fetch — cache-first with network fallback
self.addEventListener('fetch', (event) => {
  // Only handle GET requests
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) {
        return cached;
      }

      // Network fallback
      return fetch(event.request).then((response) => {
        // Cache successful responses for data files and images
        if (response.ok) {
          const url = new URL(event.request.url);
          if (url.pathname.startsWith('/data/') || url.pathname.startsWith('/icons/')) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseClone);
            });
          }
        }
        return response;
      }).catch(() => {
        // Offline fallback for navigation
        if (event.request.mode === 'navigate') {
          return caches.match('/index.html');
        }
      });
    })
  );
});
