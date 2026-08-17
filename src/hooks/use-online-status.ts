'use client'

import * as React from 'react'

/** État de connexion réseau du navigateur. */
export function useOnlineStatus(): boolean {
  const [online, setOnline] = React.useState(true)

  React.useEffect(() => {
    setOnline(navigator.onLine)
    const goOnline = () => setOnline(true)
    const goOffline = () => setOnline(false)
    window.addEventListener('online', goOnline)
    window.addEventListener('offline', goOffline)
    return () => {
      window.removeEventListener('online', goOnline)
      window.removeEventListener('offline', goOffline)
    }
  }, [])

  return online
}
