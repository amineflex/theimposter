'use client'

import * as React from 'react'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { ensureAnonymousSession, getSupabaseBrowserClient } from '@/lib/supabase/client'
import { api } from '@/lib/api/client'
import type {
  ChatMessageRow,
  GamePlayerStatusRow,
  GamePublicStateRow,
  RoomPlayerRow,
  RoomRow,
} from '@/types/db'

export interface MyRole {
  playerId: string
  role: 'civilian' | 'impostor' | 'undercover' | 'mr_white' | null
  word: string | null
  hint: string | null
  spectator: boolean
  isPendingMrWhite: boolean
}

export interface RoomSnapshot {
  room: RoomRow | null
  players: RoomPlayerRow[]
  game: GamePublicStateRow | null
  statuses: GamePlayerStatusRow[]
  messages: ChatMessageRow[]
  me: RoomPlayerRow | null
  myRole: MyRole | null
  loading: boolean
  reconnecting: boolean
  error: string | null
}

/**
 * Synchronisation d'une room.
 *
 * Le serveur reste la source de vérité : ce hook ne calcule aucun état de jeu,
 * il se contente de lire (`rooms`, `room_players`, `game_public_state`,
 * `game_player_status`, `chat_messages`) et de rafraîchir sur événement
 * Realtime. Le rôle personnel est demandé à `/api/game/me`, jamais déduit
 * localement.
 */
export function useRoom(code: string) {
  const [state, setState] = React.useState<RoomSnapshot>({
    room: null,
    players: [],
    game: null,
    statuses: [],
    messages: [],
    me: null,
    myRole: null,
    loading: true,
    reconnecting: false,
    error: null,
  })
  const userIdRef = React.useRef<string | null>(null)
  const gameIdRef = React.useRef<string | null>(null)
  const roleFetchedFor = React.useRef<string | null>(null)

  const refresh = React.useCallback(
    async (options: { silent?: boolean } = {}) => {
      const supabase = getSupabaseBrowserClient()
      if (!options.silent) setState((prev) => ({ ...prev, reconnecting: true }))

      try {
        const userId = userIdRef.current ?? (await ensureAnonymousSession())
        userIdRef.current = userId

        const { data: roomData } = await supabase.from('rooms').select('*').eq('code', code).maybeSingle()
        const room = roomData as RoomRow | null
        if (!room) {
          setState((prev) => ({
            ...prev,
            loading: false,
            reconnecting: false,
            error: 'not_found',
          }))
          return
        }

        const [playersResult, gameResult, messagesResult] = await Promise.all([
          supabase.from('room_players').select('*').eq('room_id', room.id).order('joined_at'),
          supabase
            .from('game_public_state')
            .select('*')
            .eq('room_id', room.id)
            .order('started_at', { ascending: false })
            .limit(1),
          supabase
            .from('chat_messages')
            .select('*')
            .eq('room_id', room.id)
            .order('created_at', { ascending: false })
            .limit(60),
        ])

        const players = (playersResult.data ?? []) as RoomPlayerRow[]
        const game = ((gameResult.data ?? [])[0] ?? null) as GamePublicStateRow | null
        const messages = ((messagesResult.data ?? []) as ChatMessageRow[]).slice().reverse()
        const me = players.find((player) => player.user_id === userId) ?? null

        let statuses: GamePlayerStatusRow[] = []
        if (game) {
          const { data } = await supabase.from('game_player_status').select('*').eq('game_id', game.id)
          statuses = (data ?? []) as GamePlayerStatusRow[]
        }

        // Le rôle personnel n'est (re)demandé qu'au changement de partie.
        let myRole: MyRole | null = null
        if (game && me) {
          if (roleFetchedFor.current === game.id && state.myRole) {
            myRole = { ...state.myRole, isPendingMrWhite: game.pending_mr_white_id === me.id }
          } else {
            try {
              myRole = await api.get<MyRole>(`/api/game/me?gameId=${game.id}`)
              roleFetchedFor.current = game.id
            } catch {
              myRole = null
            }
          }
        }
        if (!game) roleFetchedFor.current = null

        gameIdRef.current = game?.id ?? null
        setState({
          room,
          players,
          game,
          statuses,
          messages,
          me,
          myRole,
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
    // `state.myRole` est lu volontairement sans être une dépendance : on ne veut
    // pas relancer `refresh` à chaque mise à jour de rôle.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [code],
  )

  // Chargement initial + abonnements Realtime.
  React.useEffect(() => {
    let channel: RealtimeChannel | null = null
    let cancelled = false

    const setup = async () => {
      await refresh({ silent: true })
      if (cancelled) return

      const supabase = getSupabaseBrowserClient()
      channel = supabase
        .channel(`room:${code}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'room_players' }, () => {
          void refresh({ silent: true })
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'rooms' }, () => {
          void refresh({ silent: true })
        })
        // Signal public de changement de phase : `games` n'est pas lisible
        // pendant la partie, donc c'est cette table qui porte l'événement.
        .on('postgres_changes', { event: '*', schema: 'public', table: 'game_phase_events' }, () => {
          void refresh({ silent: true })
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'game_player_status' }, () => {
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

  // Reconnexion : au retour d'onglet ou de réseau, on resynchronise.
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
   * Filet de sécurité (uniquement un secours).
   *
   * Les transitions arrivent normalement par Realtime via `game_phase_events`.
   * Ce minuteur couvre le cas d'un WebSocket perdu sans que le navigateur ait
   * signalé de coupure réseau : cadence courte pendant une partie (les phases
   * d'affichage durent quelques secondes), lente dans le salon.
   */
  const gameActive = Boolean(state.game && !state.game.finished_at && state.game.phase !== 'results')
  React.useEffect(() => {
    const delay = gameActive ? 8000 : 20000
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') void refresh({ silent: true })
    }, delay)
    return () => clearInterval(interval)
  }, [refresh, gameActive])

  return { ...state, refresh }
}
