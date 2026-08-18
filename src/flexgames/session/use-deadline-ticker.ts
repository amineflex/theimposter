'use client'

import * as React from 'react'

/**
 * Minuteur d'échéance partagé (protection AFK).
 *
 * Un jeu qui a des phases chronométrées passe la date de fin ; quand elle est
 * dépassée, `onExpired` est appelé  ·  typiquement une action `tick` que le
 * serveur revérifie. Un décalage aléatoire évite que tous les appareils
 * appellent au même instant, et le verrou optimiste côté serveur garantit
 * qu'une seule avance est appliquée.
 *
 * La plateforme ne sait pas ce qu'est une « phase » : elle ne connaît qu'une
 * date et une fonction à rappeler.
 */
export function useDeadlineTicker({
  endsAt,
  active = true,
  onExpired,
}: {
  endsAt: string | null | undefined
  active?: boolean
  onExpired: () => Promise<void>
}) {
  const pending = React.useRef(false)
  // Décalage tiré dans l'effet : `Math.random()` est impur et n'a rien à faire
  // pendant le rendu.
  const jitter = React.useRef(0)
  // `useEffectEvent` : le rappel reste frais sans relancer le minuteur.
  const fire = React.useEffectEvent(() => onExpired())

  React.useEffect(() => {
    if (!active || !endsAt) return
    if (jitter.current === 0) jitter.current = Math.random() * 900

    const check = async () => {
      if (Date.now() < new Date(endsAt).getTime() + jitter.current) return
      if (pending.current) return
      pending.current = true
      try {
        await fire()
      } catch {
        // Échéance non atteinte côté serveur, ou conflit de version : on réessaiera.
      } finally {
        pending.current = false
      }
    }

    const interval = setInterval(() => void check(), 1000)
    return () => clearInterval(interval)
  }, [endsAt, active])
}
