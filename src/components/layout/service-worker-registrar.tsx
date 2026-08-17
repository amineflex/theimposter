'use client'

import * as React from 'react'

/**
 * Enregistre le service worker (PWA + mode local hors connexion).
 * En développement, l'enregistrement est ignoré pour ne pas masquer les
 * changements de code par le cache.
 */
export function ServiceWorkerRegistrar() {
  React.useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return
    if (!('serviceWorker' in navigator)) return

    const register = () => {
      navigator.serviceWorker.register('/sw.js').catch((error) => {
        console.warn('[pwa] enregistrement du service worker impossible', error)
      })
    }

    if (document.readyState === 'complete') register()
    else window.addEventListener('load', register, { once: true })
  }, [])

  return null
}
