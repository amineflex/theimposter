/*
 * Service worker de The Imposter.
 *
 * Objectif : rendre le mode LOCAL réellement jouable hors connexion, sans jamais
 * servir de données de partie périmées pour le mode en ligne.
 *
 * Stratégies :
 *  - navigations (documents) : réseau d'abord, repli sur le cache puis sur la
 *    page hors connexion ;
 *  - ressources statiques Next.js (/_next/static, icônes, manifeste) :
 *    cache d'abord (elles sont versionnées par leur nom) ;
 *  - API et Supabase : jamais mis en cache (données de jeu temps réel).
 */

const VERSION = 'v1'
const STATIC_CACHE = `imposter-static-${VERSION}`
const PAGES_CACHE = `imposter-pages-${VERSION}`
const OFFLINE_URL = '/hors-connexion'

// Coquille minimale nécessaire au mode local.
const PRECACHE_URLS = [
  '/',
  '/local',
  '/regles',
  OFFLINE_URL,
  '/manifest.webmanifest',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(PAGES_CACHE)
      // `reload` évite de pré-cacher une réponse déjà obsolète.
      await Promise.allSettled(PRECACHE_URLS.map((url) => cache.add(new Request(url, { cache: 'reload' }))))
      await self.skipWaiting()
    })(),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys()
      await Promise.all(
        keys.filter((key) => key !== STATIC_CACHE && key !== PAGES_CACHE).map((key) => caches.delete(key)),
      )
      await self.clients.claim()
    })(),
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return

  const url = new URL(request.url)

  // Jamais de cache pour les API, l'admin et Supabase : données sensibles ou
  // temps réel, et l'administration doit être indisponible hors connexion.
  if (
    url.origin !== self.location.origin ||
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/admin')
  ) {
    return
  }

  // Ressources versionnées : cache d'abord.
  if (
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.startsWith('/icons/') ||
    url.pathname === '/manifest.webmanifest'
  ) {
    event.respondWith(cacheFirst(request, STATIC_CACHE))
    return
  }

  // Navigations : réseau d'abord pour rester à jour, cache en secours.
  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request))
  }
})

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName)
  const cached = await cache.match(request)
  if (cached) return cached
  try {
    const response = await fetch(request)
    if (response.ok) cache.put(request, response.clone())
    return response
  } catch (error) {
    if (cached) return cached
    throw error
  }
}

async function networkFirst(request) {
  const cache = await caches.open(PAGES_CACHE)
  try {
    const response = await fetch(request)
    if (response.ok) cache.put(request, response.clone())
    return response
  } catch (error) {
    const cached = await cache.match(request)
    if (cached) return cached
    const offline = await cache.match(OFFLINE_URL)
    if (offline) return offline
    return new Response(
      '<!doctype html><meta charset="utf-8"><title>Hors connexion</title><body style="background:#FFF8E7;color:#202020;font-family:system-ui;padding:2rem"><h1>Vous êtes hors connexion</h1><p>Le mode local reste disponible depuis l’accueil.</p></body>',
      { headers: { 'content-type': 'text/html; charset=utf-8' }, status: 503 },
    )
  }
}
