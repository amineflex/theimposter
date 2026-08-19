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
  const refreshIdRef = React.useRef(0)

  const refresh = React.useCallback<RefreshFn>(
    async (options = {}) => {
      const refreshId = ++refreshIdRef.current
      const supabase = getSupabaseBrowserClient()
      if (!options.silent) setState((prev) => ({ ...prev, reconnecting: true }))

      try {
        const userId = userIdRef.current ?? (await ensureAnonymousSession())
        userIdRef.current = userId

        const { data: roomData, error: roomError } = await supabase
          .from('rooms')
          .select('*')
          .eq('code', code)
          .maybeSingle()
        if (roomError) throw roomError
        const room = roomData as RoomRow | null
        if (!room) {
          if (refreshId !== refreshIdRef.current) return
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
        const snapshotError = playersResult.error ?? sessionResult.error ?? messagesResult.error
        if (snapshotError) throw snapshotError

        const players = (playersResult.data ?? []) as RoomPlayerRow[]
        // Un ancien fetch ne doit jamais faire reculer la phase affichée.
        if (refreshId !== refreshIdRef.current) return
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
        if (refreshId !== refreshIdRef.current) return
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

  // Chargement initial.
  React.useEffect(() => {
    void refresh({ silent: true })
  }, [refresh])

  // Abonnements Realtime limités à la room courante.
  const roomId = state.room?.id
  React.useEffect(() => {
    if (!roomId) return
    let cancelled = false
    const supabase = getSupabaseBrowserClient()
    const synchronize = () => {
      if (!cancelled) void refresh({ silent: true })
    }
    const channel: RealtimeChannel = supabase
      .channel(`room:${code}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rooms', filter: `id=eq.${roomId}` }, synchronize)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'room_players', filter: `room_id=eq.${roomId}` }, synchronize)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'game_sessions', filter: `room_id=eq.${roomId}` }, synchronize)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `room_id=eq.${roomId}` }, synchronize)
      // Cette relecture ferme la fenêtre entre le premier fetch et l'abonnement.
      .subscribe((status) => { if (status === 'SUBSCRIBED') synchronize() })

    return () => {
      cancelled = true
      void supabase.removeChannel(channel)
    }
  }, [code, refresh, roomId])

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
