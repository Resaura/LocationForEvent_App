// ═══════════════════════════════════════════════════════════════
// SERVICE WORKER — LocationForEvent
// Stratégie : Network-First pour JS/CSS (mises à jour immédiates)
//             Cache-First pour images/fonts
//             Jamais de cache pour Supabase
//
// RÈGLE : incrémenter CACHE_VERSION à chaque modification JS/CSS
// ═══════════════════════════════════════════════════════════════

const CACHE_VERSION = 'lfe-v38';
const STATIC = ['/', '/index.html', '/css/style.css', '/manifest.json'];

// ── Install — cache uniquement les fichiers statiques de base ──
self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE_VERSION).then(c => c.addAll(STATIC)));
});

// ── Activate — supprime tous les anciens caches ────────────────
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys =>
        Promise.all(keys.filter(k => k !== CACHE_VERSION).map(k => caches.delete(k)))
      )
      .then(() => clients.claim())
  );
});

// ── Fetch — stratégie mixte ────────────────────────────────────
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // Toujours réseau pour Supabase — jamais de cache
  if (url.hostname.includes('supabase.co')) return;

  // Network-First pour JS et CSS — mises à jour immédiates
  if (url.pathname.endsWith('.js') || url.pathname.endsWith('.css')) {
    e.respondWith(
      fetch(e.request)
        .then(res => {
          const clone = res.clone();
          caches.open(CACHE_VERSION).then(c => c.put(e.request, clone));
          return res;
        })
        .catch(() => caches.match(e.request))
    );
    return;
  }

  // Cache-First pour images et fonts
  if (url.pathname.match(/\.(png|jpg|jpeg|webp|woff2|woff|ico|svg)$/)) {
    e.respondWith(
      caches.match(e.request).then(cached => cached || fetch(e.request))
    );
    return;
  }

  // Network-First pour tout le reste (HTML, manifest…)
  e.respondWith(
    fetch(e.request).catch(() => caches.match(e.request))
  );
});
