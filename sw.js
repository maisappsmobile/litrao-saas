// Service Worker - Litrão do Reset & Plataforma Herbalife (PWA)
const CACHE_NAME = 'litrao-reset-v11';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/painel.html',
  '/catalogo.html',
  '/avaliacao.html',
  '/favicon.ico',
  '/favicon.png',
  '/favicon-16x16.png',
  '/favicon-32x32.png',
  '/apple-touch-icon.png',
  '/icon-192.png',
  '/icon-512.png',
  '/app-icon.png',
  '/reset-icon.png',
  '/reset-logo.png',
  '/divulgacao_litrao_reset_oficial.png',
  '/flyer_kit_semanal_reset_base.jpg',
  '/pacotes_reset_base.png',
  '/manifest.json',
  '/manifest-consultor.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE).catch((err) => {
        console.warn('Falha parcial no cache inicial:', err);
      });
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // Estratégia Network First com fallback para Cache
  if (event.request.method !== 'GET') return;
  
  // Não intercepta chamadas de API externas do Supabase ou WhatsApp
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (!response || response.status !== 200 || response.type !== 'basic') {
          return response;
        }
        const responseToCache = response.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache);
        });
        return response;
      })
      .catch(() => {
        return caches.match(event.request);
      })
  );
});
