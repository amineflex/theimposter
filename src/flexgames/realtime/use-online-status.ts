'use client'

import * as React from 'react'

function subscribe(onChange: () => void) {
  window.addEventListener('online', onChange)
  window.addEventListener('offline', onChange)
  return () => {
    window.removeEventListener('online', onChange)
    window.removeEventListener('offline', onChange)
  }
}

/**
 * État de connexion réseau du navigateur.
 *
 * `useSyncExternalStore` évite tout état local : la valeur est lue directement
 * depuis le navigateur, et vaut `true` au rendu serveur (on suppose la
 * connexion présente jusqu'à preuve du contraire).
 */
export function useOnlineStatus(): boolean {
  return React.useSyncExternalStore(
    subscribe,
    () => navigator.onLine,
    () => true,
  )
}
