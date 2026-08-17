'use client'

import * as React from 'react'
import { api } from '@/lib/api/client'
import type { GamePublicStateRow } from '@/types/db'

/**
 * Applique les minuteurs écoulés (protection AFK).
 *
 * Tous les clients peuvent appeler `/api/game/tick` : le serveur revérifie
 * l'échéance et le verrou optimiste garantit qu'une seule avance est appliquée.
 * Un petit décalage aléatoire évite que tous les appareils appellent au même
 * instant.
 */
export function usePhaseTicker(
  game: GamePublicStateRow | null,
  refresh: (options?: { silent?: boolean }) => Promise<void>,
) {
  const pending = React.useRef(false)
  // Décalage aléatoire tiré dans l'effet : `Math.random()` est impur et n'a rien
  // à faire pendant le rendu.
  const jitter = React.useRef(0)

  React.useEffect(() => {
    if (!game || game.is_paused || !game.phase_ends_at || game.finished_at) return
    if (game.phase === 'results') return
    if (jitter.current === 0) jitter.current = Math.random() * 900

    const check = async () => {
      const endsAt = new Date(game.phase_ends_at as string).getTime()
      if (Date.now() < endsAt + jitter.current) return
      if (pending.current) return
      pending.current = true
      try {
        const result = await api.post<{ advanced: boolean }>('/api/game/tick', { gameId: game.id })
        if (result.advanced) await refresh({ silent: true })
      } catch {
        // Échéance non atteinte côté serveur, ou conflit de version : on réessaiera.
      } finally {
        pending.current = false
      }
    }

    const interval = setInterval(() => void check(), 1000)
    return () => clearInterval(interval)
  }, [game, refresh])
}
