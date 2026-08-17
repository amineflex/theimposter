'use client'

import * as React from 'react'

/**
 * Décompte basé sur une échéance absolue fournie par le serveur.
 *
 * On ne stocke jamais « le temps restant » côté client : on recalcule depuis
 * `endsAt`, ce qui reste juste après une mise en veille de l'appareil ou un
 * changement d'onglet.
 */
export function useCountdown(endsAt: string | null | undefined, paused = false): number | null {
  const [remaining, setRemaining] = React.useState<number | null>(() => compute(endsAt))

  React.useEffect(() => {
    if (!endsAt || paused) {
      setRemaining(paused ? compute(endsAt) : null)
      return
    }
    setRemaining(compute(endsAt))
    const interval = setInterval(() => setRemaining(compute(endsAt)), 250)
    return () => clearInterval(interval)
  }, [endsAt, paused])

  return remaining
}

function compute(endsAt: string | null | undefined): number | null {
  if (!endsAt) return null
  const diff = new Date(endsAt).getTime() - Date.now()
  return Math.max(0, Math.ceil(diff / 1000))
}

/** Décompte local (mode hors ligne) : compte à rebours depuis une durée. */
export function useLocalCountdown(seconds: number | null, running: boolean, onExpire?: () => void) {
  const [remaining, setRemaining] = React.useState<number | null>(seconds)
  const callback = React.useRef(onExpire)
  callback.current = onExpire

  React.useEffect(() => {
    setRemaining(seconds)
  }, [seconds])

  React.useEffect(() => {
    if (!running || seconds === null || seconds <= 0) return
    const deadline = Date.now() + seconds * 1000
    const interval = setInterval(() => {
      const next = Math.max(0, Math.ceil((deadline - Date.now()) / 1000))
      setRemaining(next)
      if (next <= 0) {
        clearInterval(interval)
        callback.current?.()
      }
    }, 250)
    return () => clearInterval(interval)
  }, [running, seconds])

  return remaining
}
