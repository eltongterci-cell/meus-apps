/* Service worker do Quick Massage · Bem+VIVER
   - Páginas e arquivos: busca sempre a versão nova na internet (para as atualizações aparecerem na hora)
     e guarda uma cópia para abrir mesmo sem sinal.
   - Dados (Supabase) nunca são guardados. */
const CACHE = "bemviver-v1";
const BASE = ["./", "./index.html", "./painel.html", "./logo-medsenior.png", "./manifest.webmanifest", "./painel.webmanifest",
  "./icons/icon-192.png", "./icons/icon-512.png", "./icons/apple-touch-icon.png", "./icons/favicon-32.png"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(BASE)).catch(() => {}));
  self.skipWaiting();
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  const req = e.request;
  if(req.method !== "GET") return;
  const url = new URL(req.url);
  if(url.origin !== location.origin) return;              /* Supabase, fontes etc.: direto na rede */
  e.respondWith(
    fetch(req).then(res => {
      if(res && res.ok){ const copia = res.clone(); caches.open(CACHE).then(c => c.put(req, copia)); }
      return res;
    }).catch(() => caches.match(req, {ignoreSearch: true}).then(r => r || caches.match(url.pathname.includes("painel") ? "./painel.html" : "./index.html")))
  );
});
