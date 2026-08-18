'use client'

import * as React from 'react'
import { api } from '@/flexgames/core/api/client'
import { useRoomContext } from '@/flexgames/rooms/room-context'

/**
 * Envoi d'une action de jeu.
 *
 * Un seul point d'entrée réseau pour tous les jeux : la plateforme route vers
 * le module serveur du jeu de la room. Un nouveau jeu n'ajoute aucune route.
 */
export function useGameAction() {
  const { session } = useRoomContext()
  const [pending, setPending] = React.useState(false)

  const send = React.useCallback(
    async <T = unknown,>(action: { type: string } & Record<string, unknown>): Promise<T> => {
      if (!session) throw new Error("Aucune partie en cours.")
      const { type, ...payload } = action
      setPending(true)
      try {
        return await api.post<T>('/api/game/action', {
          sessionId: session.id,
          type,
          payload,
        })
      } finally {
        setPending(false)
      }
    },
    [session],
  )

  return { send, pending }
}
