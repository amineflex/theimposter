'use client'

import * as React from 'react'

/**
 * Décompte basé sur une échéance absolue fournie par le serveur.
 *
 * On ne stocke jamais « le temps restant » : on le recalcule depuis `endsAt`, ce
 * qui reste juste après une mise en veille de l'appareil ou un changement
 * d'onglet. Branché sur `useSyncExternalStore` : aucun état, aucune écriture
 * depuis un effet.
 */
export function useCountdown(endsAt: string | null | undefined, paused = false): number | null {
  const deadline = endsAt ? new Date(endsAt).getTime() : null

  const subscribe = React.useCallback(
    (onChange: () => void) => {
      if (deadline === null || paused) return () => {}
      const interval = setInterval(onChange, 250)
      return () => clearInterval(interval)
    },
    [deadline, paused],
  )

  const getSnapshot = React.useCallback(() => remainingFrom(deadline), [deadline])

  return React.useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}

function remainingFrom(deadline: number | null): number | null {
  if (deadline === null) return null
  return Math.max(0, Math.ceil((deadline - Date.now()) / 1000))
}

/**
 * Décompte local (mode hors ligne) : compte à rebours depuis une durée.
 *
 * L'échéance est fixée au démarrage du minuteur et le temps restant n'est mis à
 * jour que depuis le callback de l'intervalle — jamais dans le corps d'un effet,
 * pour éviter les rendus en cascade.
 */
export function useLocalCountdown(
  seconds: number | null,
  running: boolean,
  onExpire?: () => void,
): number | null {
  const [remaining, setRemaining] = React.useState(seconds)
  // `useEffectEvent` garde la dernière callback sans relancer l'intervalle.
  const expire = React.useEffectEvent(() => onExpire?.())

  React.useEffect(() => {
    if (!running || seconds === null || seconds <= 0) return
    const deadline = Date.now() + seconds * 1000

    const interval = setInterval(() => {
      const next = Math.max(0, Math.ceil((deadline - Date.now()) / 1000))
      setRemaining(next)
      if (next <= 0) {
        clearInterval(interval)
        expire()
      }
    }, 250)

    return () => clearInterval(interval)
  }, [running, seconds])

  return seconds === null ? null : remaining
}
