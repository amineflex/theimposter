'use client'

import * as React from 'react'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { ensureAnonymousSession, getSupabaseBrowserClient } from '@/flexgames/core/supabase/client'
import type {
  ChatMessageRow,
  GameSessionRow,
  RoomPlayerRow,
  RoomRow,
} from '@/flexgames/core/db'

/**
 * Synchronisation d'une room FlexGames.
 *
 * Portée volontairement limitée au commun : la room, ses joueurs, le chat et la
 * session en cours. L'état de jeu appartient au module du jeu, qui l'écoute avec
 * son propre hook (`useGameData`) sur ses propres tables.
 *
 * Le serveur reste la source de vérité : ce hook lit, il ne calcule rien.
 */
export interface RoomSnapshot {
  room: RoomRow | null
  players: RoomPlayerRow[]
  /** Partie en cours ou dernière partie jouée dans cette room. */
  session: GameSessionRow | null
  messages: ChatMessageRow[]
  me: RoomPlayerRow | null
  loading: boolean
  reconnecting: boolean
  error: string | null
}

export type RefreshFn = (options?: { silent?: boolean }) => Promise<void>

const EMPTY: RoomSnapshot = {
  room: null,
  players: [],
  session: null,
  messages: [],
  me: null,
  loading: true,
  reconnecting: false,
  error: null,
}

export function useRoom(code: string): RoomSnapshot & { refresh: RefreshFn } {
  const [state, setState] = React.useState<RoomSnapshot>(EMPTY)
  const userIdRef = React.useRef<string | null>(null)

  const refresh = React.useCallback<RefreshFn>(
    async (options = {}) => {
      const supabase = getSupabaseBrowserClient()
      if (!options.silent) setState((prev) => ({ ...prev, reconnecting: true }))

      try {
        const userId = userIdRef.current ?? (await ensureAnonymousSession())
        userIdRef.current = userId

        const { data: roomData } = await supabase
          .from('rooms')
          .select('*')
          .eq('code', code)
          .maybeSingle()
        const room = roomData as RoomRow | null
        if (!room) {
          setState((prev) => ({ ...prev, loading: false, reconnecting: false, error: 'not_found' }))
          return
        }

        const [playersResult, sessionResult, messagesResult] = await Promise.all([
          supabase.from('room_players').select('*').eq('room_id', room.id).order('joined_at'),
          supabase
            .from('game_sessions')
            .select('*')
            .eq('room_id', room.id)
            .order('created_at', { ascending: false })
            .limit(1),
          supabase
            .from('chat_messages')
            .select('*')
            .eq('room_id', room.id)
            .order('created_at', { ascending: false })
            .limit(60),
        ])

        const players = (playersResult.data ?? []) as RoomPlayerRow[]
        setState({
          room,
          players,
          session: ((sessionResult.data ?? [])[0] ?? null) as GameSessionRow | null,
          messages: ((messagesResult.data ?? []) as ChatMessageRow[]).slice().reverse(),
          me: players.find((player) => player.user_id === userId) ?? null,
          loading: false,
          reconnecting: false,
          error: null,
        })
      } catch (error) {
        setState((prev) => ({
          ...prev,
          loading: false,
          reconnecting: false,
          error: error instanceof Error ? error.message : 'unknown',
        }))
      }
    },
    [code],
  )

  // Chargement initial + abonnements Realtime communs.
  React.useEffect(() => {
    let channel: RealtimeChannel | null = null
    let cancelled = false

    const setup = async () => {
      await refresh({ silent: true })
      if (cancelled) return

      const supabase = getSupabaseBrowserClient()
      channel = supabase
        .channel(`room:${code}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'rooms' }, () => {
          void refresh({ silent: true })
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'room_players' }, () => {
          void refresh({ silent: true })
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'game_sessions' }, () => {
          void refresh({ silent: true })
        })
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages' }, () => {
          void refresh({ silent: true })
        })
        .subscribe()
    }

    void setup()
    return () => {
      cancelled = true
      if (channel) void getSupabaseBrowserClient().removeChannel(channel)
    }
  }, [code, refresh])

  // Reconnexion : retour d'onglet ou de réseau.
  React.useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') void refresh({ silent: true })
    }
    window.addEventListener('visibilitychange', onVisible)
    window.addEventListener('online', onVisible)
    return () => {
      window.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('online', onVisible)
    }
  }, [refresh])

  /*
   * Filet de sécurité : un WebSocket perdu sans coupure réseau signalée ne
   * déclenche aucun événement. Cadence lente, le Realtime reste le canal normal.
   */
  React.useEffect(() => {
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') void refresh({ silent: true })
    }, 20000)
    return () => clearInterval(interval)
  }, [refresh])

  return { ...state, refresh }
}
