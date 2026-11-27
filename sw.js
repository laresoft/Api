// Service Worker básico: guarda la interfaz en caché para que cargue rápido.
// Los datos siguen viniendo siempre de la API (no se guardan aquí).

const NOMBRE_CACHE = 'cuentas-v33';
const ARCHIVOS = ['/', '/index.html', '/style.css', '/script.js', '/manifest.webmanifest',
                  '/icon-192.png', '/icon-512.png'];

self.addEventListener('install', (evento) => {
  evento.waitUntil(
    caches.open(NOMBRE_CACHE).then(cache => cache.addAll(ARCHIVOS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (evento) => {
  evento.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== NOMBRE_CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (evento) => {
  // Solo cacheamos archivos de la interfaz; las llamadas a la API siempre van a la red
  if (evento.request.method !== 'GET') return;
  const url = new URL(evento.request.url);
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/gastos') ||
      url.pathname.startsWith('/ingresos') || url.pathname.startsWith('/balance') ||
      url.pathname.startsWith('/reporte') || url.pathname.startsWith('/login') ||
      url.pathname.startsWith('/registro')) return;

  evento.respondWith(
    caches.match(evento.request).then(respuesta =>
      respuesta || fetch(evento.request)
    )
  );
});
