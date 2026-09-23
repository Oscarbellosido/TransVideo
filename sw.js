/* Resum de vídeos — Service Worker (instal·lable + funciona sense connexió)
   - Fitxers propis (pàgina i dades/resums.js): primer la xarxa, perquè els resums canvien cada dia;
     si no hi ha connexió, la darrera còpia desada.
   - Miniatures de YouTube: primer la còpia desada (no canvien mai). */
const CACHE = 'transvideo-v1';
const SHELL = ['./', './index.html', './dades/resums.js', './manifest.json', './icon.svg', './icon-192.png', './icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    await Promise.all(SHELL.map(u => c.add(u).catch(() => {})));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

function fetchTimeout(req, ms) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('timeout')), ms);
    fetch(req).then(r => { clearTimeout(t); resolve(r); }, err => { clearTimeout(t); reject(err); });
  });
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  if (url.hostname === 'i.ytimg.com') {
    e.respondWith((async () => {
      const c = await caches.open(CACHE);
      const desat = await c.match(req);
      if (desat) return desat;
      const r = await fetch(req);
      c.put(req, r.clone()).catch(() => {});
      return r;
    })());
    return;
  }

  if (url.origin !== self.location.origin) return;
  e.respondWith((async () => {
    const c = await caches.open(CACHE);
    try {
      const r = await fetchTimeout(req, 5000);
      if (r.ok) c.put(req, r.clone()).catch(() => {});
      return r;
    } catch {
      return (await c.match(req, { ignoreSearch: true })) || (req.mode === 'navigate' && await c.match('./index.html')) || Response.error();
    }
  })());
});
