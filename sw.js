/* =====================================================================
   GATHIRL — service worker : ouverture quasi instantanée, surtout depuis
   l'écran d'accueil du téléphone (iPhone, Android).

   - La page (index.html) : réseau d'abord, pour toujours avoir la dernière
     version ; si le réseau ne répond pas en 2,5 s (ou hors ligne), la copie
     gardée sur l'appareil s'affiche.
   - Les scripts et styles versionnés (?v=…), les polices et la bibliothèque
     Supabase : jamais modifiés à la même adresse, donc servis depuis
     l'appareil sans aucun aller-retour réseau.
   - Les images et autres fichiers : copie de l'appareil tout de suite, mise
     à jour discrète en arrière-plan.
   - Jamais mis en cache : les données (API Supabase) et version.json.
   ===================================================================== */
const VERSION = "202611142335";   // remplacé par tools/bump-version.sh à chaque mise en ligne
const STATIC = `gathirl-${VERSION}`;
const RUNTIME = "gathirl-runtime";
const PAGE = "gathirl-page";

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (e) => {
  e.waitUntil((async () => {
    const keep = new Set([STATIC, RUNTIME, PAGE]);
    for (const k of await caches.keys()) if (k.startsWith("gathirl-") && !keep.has(k)) await caches.delete(k);
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.hostname.endsWith("supabase.co") || url.pathname.endsWith("/version.json")) return;

  if (req.mode === "navigate") { e.respondWith(page(req)); return; }

  const same = url.origin === self.location.origin;
  if ((same && url.searchParams.has("v")) || url.hostname === "fonts.gstatic.com" || url.hostname === "cdn.jsdelivr.net") {
    e.respondWith(cacheFirst(req, same ? STATIC : RUNTIME));
    return;
  }
  if (same || url.hostname === "fonts.googleapis.com") e.respondWith(staleWhileRevalidate(req, e));
});

/* La page : réseau d'abord, copie de l'appareil si le réseau tarde ou manque */
async function page(req) {
  const cache = await caches.open(PAGE);
  const key = new URL(req.url); key.search = "";   // ?v=… ou ?code=… : une seule copie de la page
  const network = fetch(req).then((res) => {
    if (res.ok) cache.put(key.href, res.clone());
    return res;
  });
  const saved = await cache.match(key.href);
  if (!saved) return network;
  const slow = new Promise((resolve) => setTimeout(() => resolve(saved), 2500));
  return Promise.race([network.catch(() => saved), slow]);
}

async function cacheFirst(req, name) {
  const cache = await caches.open(name);
  const hit = await cache.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok || res.type === "opaque") cache.put(req, res.clone());
  return res;
}

async function staleWhileRevalidate(req, e) {
  const cache = await caches.open(RUNTIME);
  const hit = await cache.match(req);
  const update = fetch(req).then((res) => {
    if (res.ok) cache.put(req, res.clone());
    return res;
  });
  if (hit) { e.waitUntil(update.catch(() => {})); return hit; }
  return update;
}
