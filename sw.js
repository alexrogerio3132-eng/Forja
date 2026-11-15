/* Forja 1.7.2: guarda o app no aparelho para abrir na hora e funcionar sem internet.
   Ao publicar uma versão nova, mude o número em CACHE: o navegador baixa tudo de novo e apaga a cópia velha. */
const CACHE = 'forja-1.7.2';
const ARQS = ['./', 'index.html', 'app.js?v=1.7.2', 'alimentos.js?v=1.7.2', 'exercicios.js?v=1.7.2', 'manifest.json', 'icon-192.png', 'icon-512.png'];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ARQS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const r = e.request;
  if (r.method !== 'GET' || new URL(r.url).origin !== location.origin) return; /* fontes e fotos dos exercícios: direto da internet */
  /* abrir o app (inclusive pelos atalhos ?acao=...) usa a página guardada */
  if (r.mode === 'navigate') { e.respondWith(caches.match('index.html').then(m => m || fetch(r)).catch(() => caches.match('./'))); return; }
  e.respondWith(caches.match(r).then(m => m || fetch(r)));
});
