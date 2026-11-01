const CACHE_NAME = 'chenshitujian-v1';
const HTML_TIMEOUT = 800;
const PRECACHE = [
  './',
  './assets/Electricity-a49f598745.webp',
  './assets/Electricity2-1-b43ee42d13.webp',
  './assets/Electricity3-1-d1f9ddc5c6.webp',
  './assets/Electricity4-1-d2f80ff2df.webp'
];

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await Promise.allSettled(PRECACHE.map(url => cache.add(url)));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys
      .filter(key => key.startsWith('chenshitujian-') && key !== CACHE_NAME)
      .map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

function isCacheable(response) {
  return response && response.ok && response.type === 'basic';
}

async function putInCache(request, response) {
  if (!isCacheable(response)) return response;
  const cache = await caches.open(CACHE_NAME);
  await cache.put(request, response.clone());
  return response;
}

function timeout(ms) {
  return new Promise(resolve => setTimeout(() => resolve(null), ms));
}

async function fetchAndCache(request) {
  try {
    const response = await fetch(request);
    if (!isCacheable(response)) return { response, ok: false };
    const cache = await caches.open(CACHE_NAME);
    await cache.put(request, response.clone());
    return { response, ok: true };
  } catch {
    return { response: null, ok: false };
  }
}

async function networkFirst(event) {
  const { request } = event;
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request, { ignoreSearch: true });
  if (!cached) {
    const result = await fetchAndCache(request);
    return result.response || Response.error();
  }

  const update = fetchAndCache(request);
  const result = await Promise.race([update, timeout(HTML_TIMEOUT)]);
  if (result && result.ok) return result.response;
  if (result && result.response) return cached;

  event.waitUntil(update);
  return cached;
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  if (cached) return cached;
  return putInCache(request, await fetch(request));
}

self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(event));
  } else if (request.destination === 'image') {
    event.respondWith(cacheFirst(request));
  }
});
