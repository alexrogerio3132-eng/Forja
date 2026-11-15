/* Forja 1.7.0: guarda o app no aparelho para abrir na hora e funcionar sem internet.
   Ao publicar uma versão nova, mude o número em CACHE: o navegador baixa tudo de novo e apaga a cópia velha. */
const CACHE = 'forja-1.7.0';
const ARQS = ['./', 'index.html', 'app.js?v=1.7.0', 'alimentos.js?v=1.7.0', 'exercicios.js?v=1.7.0', 'manifest.json', 'icon-192.png', 'icon-512.png'];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ARQS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  /* o leitor de imagem (pasta ocr/) não muda entre versões do app: a cópia dele fica */
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE && !k.startsWith('forja-ocr-')).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const r = e.request;
  if (r.method !== 'GET' || new URL(r.url).origin !== location.origin) return; /* fontes e fotos dos exercícios: direto da internet */
  /* leitor de imagem: baixa só quando a pessoa usa e guarda para as próximas vezes (funciona sem internet depois) */
  if (new URL(r.url).pathname.includes('/ocr/')) {
    e.respondWith(caches.open('forja-ocr-5.1.1').then(c => c.match(r).then(m => m || fetch(r).then(resp => { if (resp.ok) c.put(r, resp.clone()); return resp; }))));
    return;
  }
  /* abrir o app (inclusive pelos atalhos ?acao=...) usa a página guardada */
  if (r.mode === 'navigate') { e.respondWith(caches.match('index.html').then(m => m || fetch(r)).catch(() => caches.match('./'))); return; }
  e.respondWith(caches.match(r).then(m => m || fetch(r)));
});
