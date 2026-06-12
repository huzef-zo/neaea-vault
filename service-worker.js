/* ============================================
   NEAEA Vault — Service Worker
   Strict Cache-first strategy for full offline support
   ============================================ */

const CACHE_NAME = 'neaea-vault-v141';

// Core app shell files
const APP_SHELL = [
  './',
  'index.html',
  'style.css',
  'app.js',
  'manifest.json',
  'data/manifest.json',
  'lib/katex/katex.min.css',
  'lib/katex/katex.min.js',
  'lib/katex/contrib/auto-render.min.js',
  'lib/katex/fonts/KaTeX_AMS-Regular.woff2',
  'lib/katex/fonts/KaTeX_AMS-Regular.ttf',
  'lib/katex/fonts/KaTeX_AMS-Regular.woff',
  'lib/katex/fonts/KaTeX_Caligraphic-Bold.ttf',
  'lib/katex/fonts/KaTeX_Caligraphic-Bold.woff',
  'lib/katex/fonts/KaTeX_Caligraphic-Regular.ttf',
  'lib/katex/fonts/KaTeX_Caligraphic-Regular.woff',
  'lib/katex/fonts/KaTeX_Fraktur-Bold.ttf',
  'lib/katex/fonts/KaTeX_Fraktur-Bold.woff',
  'lib/katex/fonts/KaTeX_Fraktur-Regular.ttf',
  'lib/katex/fonts/KaTeX_Fraktur-Regular.woff',
  'lib/katex/fonts/KaTeX_Main-Bold.ttf',
  'lib/katex/fonts/KaTeX_Main-Bold.woff',
  'lib/katex/fonts/KaTeX_Main-BoldItalic.ttf',
  'lib/katex/fonts/KaTeX_Main-BoldItalic.woff',
  'lib/katex/fonts/KaTeX_Main-Italic.ttf',
  'lib/katex/fonts/KaTeX_Main-Italic.woff',
  'lib/katex/fonts/KaTeX_Main-Regular.ttf',
  'lib/katex/fonts/KaTeX_Main-Regular.woff',
  'lib/katex/fonts/KaTeX_Math-BoldItalic.ttf',
  'lib/katex/fonts/KaTeX_Math-BoldItalic.woff',
  'lib/katex/fonts/KaTeX_Math-Italic.ttf',
  'lib/katex/fonts/KaTeX_Math-Italic.woff',
  'lib/katex/fonts/KaTeX_SansSerif-Bold.ttf',
  'lib/katex/fonts/KaTeX_SansSerif-Bold.woff',
  'lib/katex/fonts/KaTeX_SansSerif-Italic.ttf',
  'lib/katex/fonts/KaTeX_SansSerif-Italic.woff',
  'lib/katex/fonts/KaTeX_SansSerif-Regular.ttf',
  'lib/katex/fonts/KaTeX_SansSerif-Regular.woff',
  'lib/katex/fonts/KaTeX_Script-Regular.ttf',
  'lib/katex/fonts/KaTeX_Script-Regular.woff',
  'lib/katex/fonts/KaTeX_Size1-Regular.ttf',
  'lib/katex/fonts/KaTeX_Size1-Regular.woff',
  'lib/katex/fonts/KaTeX_Size2-Regular.ttf',
  'lib/katex/fonts/KaTeX_Size2-Regular.woff',
  'lib/katex/fonts/KaTeX_Size3-Regular.ttf',
  'lib/katex/fonts/KaTeX_Size3-Regular.woff',
  'lib/katex/fonts/KaTeX_Size4-Regular.ttf',
  'lib/katex/fonts/KaTeX_Size4-Regular.woff',
  'lib/katex/fonts/KaTeX_Typewriter-Regular.ttf',
  'lib/katex/fonts/KaTeX_Typewriter-Regular.woff',
  'lib/katex/fonts/KaTeX_Caligraphic-Bold.woff2',
  'lib/katex/fonts/KaTeX_Caligraphic-Regular.woff2',
  'lib/katex/fonts/KaTeX_Fraktur-Bold.woff2',
  'lib/katex/fonts/KaTeX_Fraktur-Regular.woff2',
  'lib/katex/fonts/KaTeX_Main-Bold.woff2',
  'lib/katex/fonts/KaTeX_Main-BoldItalic.woff2',
  'lib/katex/fonts/KaTeX_Main-Italic.woff2',
  'lib/katex/fonts/KaTeX_Main-Regular.woff2',
  'lib/katex/fonts/KaTeX_Math-BoldItalic.woff2',
  'lib/katex/fonts/KaTeX_Math-Italic.woff2',
  'lib/katex/fonts/KaTeX_SansSerif-Bold.woff2',
  'lib/katex/fonts/KaTeX_SansSerif-Italic.woff2',
  'lib/katex/fonts/KaTeX_SansSerif-Regular.woff2',
  'lib/katex/fonts/KaTeX_Script-Regular.woff2',
  'lib/katex/fonts/KaTeX_Size1-Regular.woff2',
  'lib/katex/fonts/KaTeX_Size2-Regular.woff2',
  'lib/katex/fonts/KaTeX_Size3-Regular.woff2',
  'lib/katex/fonts/KaTeX_Size4-Regular.woff2',
  'lib/katex/fonts/KaTeX_Typewriter-Regular.woff2',
  'icons/icon-72.png',
  'icons/icon-96.png',
  'icons/icon-128.png',
  'icons/icon-144.png',
  'icons/icon-152.png',
  'icons/icon-192.png',
  'icons/icon-384.png',
  'icons/icon-512.png',
];

// Install — fetch manifest and cache everything
self.addEventListener('install', (event) => {
  event.waitUntil(
    fetch('data/manifest.json')
      .then((response) => response.json())
      .then((data) => {
        const dataFiles = [];
        // Add JSON papers
        if (data.subjects) {
          for (const subject in data.subjects) {
            data.subjects[subject].forEach((paperId) => {
              dataFiles.push(`data/${subject}/${paperId}.json`);
            });
          }
        }
        // Add images
        if (data.images) {
          dataFiles.push(...data.images);
        }

        const ALL_ASSETS = [...APP_SHELL, ...dataFiles];

        return caches.open(CACHE_NAME).then((cache) => {
          console.log('[SW] Caching all assets from manifest');
          return cache.addAll(ALL_ASSETS);
        });
      })
      .catch((err) => {
        console.error('[SW] Install failed to fetch manifest or cache assets:', err);
      })
  );
  self.skipWaiting();
});

// Activate — clean old caches immediately
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

// Fetch — strict cache-first strategy
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) {
        return cached;
      }

      // If not in cache, try network (and cache it)
      return fetch(event.request).then((response) => {
        if (!response || response.status !== 200 || response.type !== 'basic') {
          return response;
        }

        const responseToCache = response.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache);
        });

        return response;
      }).catch(() => {
        // If network fails and it's a navigation request, show offline index.html
        if (event.request.mode === 'navigate') {
          return caches.match('index.html');
        }
        // Otherwise, return a proper offline error or null
        return null;
      });
    })
  );
});
