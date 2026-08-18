'use client'

import * as React from 'react'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { getSupabaseBrowserClient } from '@/flexgames/core/supabase/client'
import { api } from '@/flexgames/core/api/client'
import { useRoomContext, type RoomContextValue } from '@/flexgames/rooms/room-context'
import type { RoomPlayerRow } from '@/flexgames/core/db'
import type {
  GameDescriptionRow,
  GamePlayerStatusRow,
  GamePublicStateRow,
} from '../types/db'
import type { Role } from '../engine/types'

/**
 * État de partie propre à The Imposter.
 *
 * La plateforme fournit la room, les joueurs et la session ; ce hook y ajoute ce
 * que seul ce jeu connaît : la vue publique de la partie, l'état de chaque
 * joueur, les descriptions écrites, et  ·  via `/api/game/private-state`  ·  le rôle privé
 * du joueur courant. Aucun secret n'est déduit côté client.
 */
export interface MyRole {
  playerId: string
  role: Role | null
  word: string | null
  hint: string | null
  spectator: boolean
  isPendingMrWhite: boolean
}

export interface ImposterRoom extends RoomContextValue {
  game: GamePublicStateRow | null
  statuses: GamePlayerStatusRow[]
  descriptions: GameDescriptionRow[]
  myRole: MyRole | null
}

interface GameData {
  game: GamePublicStateRow | null
  statuses: GamePlayerStatusRow[]
  descriptions: GameDescriptionRow[]
  myRole: MyRole | null
}

const EMPTY: GameData = { game: null, statuses: [], descriptions: [], myRole: null }

export function useImposterRoom(): ImposterRoom {
  const room = useRoomContext()
  const sessionId = room.session?.id ?? null
  const myPlayerId = room.me?.id ?? null
  const [data, setData] = React.useState<GameData>(EMPTY)
  const roleFetchedFor = React.useRef<string | null>(null)
  const myRoleRef = React.useRef<MyRole | null>(null)

  /** Lecture pure : aucun état React n'est écrit ici. */
  const fetchData = React.useCallback(async (): Promise<GameData> => {
    if (!sessionId) {
      roleFetchedFor.current = null
      myRoleRef.current = null
      return EMPTY
    }
    const supabase = getSupabaseBrowserClient()
    const { data: gameRows } = await supabase
      .from('game_public_state')
      .select('*')
      .eq('session_id', sessionId)
      .limit(1)
    const game = ((gameRows ?? [])[0] ?? null) as GamePublicStateRow | null
    if (!game) return EMPTY

    const [statusResult, descriptionResult] = await Promise.all([
      supabase.from('game_player_status').select('*').eq('game_id', game.id),
      supabase
        .from('game_descriptions')
        .select('*')
        .eq('game_id', game.id)
        .order('created_at', { ascending: true }),
    ])

    // Le rôle personnel n'est (re)demandé qu'au changement de partie.
    let myRole: MyRole | null = null
    if (myPlayerId) {
      if (roleFetchedFor.current === game.id && myRoleRef.current) {
        myRole = { ...myRoleRef.current, isPendingMrWhite: game.pending_mr_white_id === myPlayerId }
      } else {
        try {
          const response = await api.get<{ state: MyRole | null }>(
            `/api/game/private-state?sessionId=${sessionId}`,
          )
          myRole = response.state
          roleFetchedFor.current = game.id
        } catch {
          myRole = null
        }
      }
    }
    myRoleRef.current = myRole

    return {
      game,
      statuses: (statusResult.data ?? []) as GamePlayerStatusRow[],
      descriptions: (descriptionResult.data ?? []) as GameDescriptionRow[],
      myRole,
    }
  }, [sessionId, myPlayerId])

  // L'écriture d'état a toujours lieu APRÈS un `await` : pas de rendu en cascade.
  const load = React.useCallback(async () => {
    setData(await fetchData())
  }, [fetchData])

  /** Resynchronise la room ET l'état de jeu. */
  const refresh = React.useCallback(
    async (options?: { silent?: boolean }) => {
      await Promise.all([room.refresh(options), load()])
    },
    [room, load],
  )

  // Chargement initial : l'écriture d'état a lieu après l'`await`.
  React.useEffect(() => {
    let cancelled = false
    void (async () => {
      const next = await fetchData()
      if (!cancelled) setData(next)
    })()
    return () => {
      cancelled = true
    }
  }, [fetchData])

  // Abonnements Realtime propres au jeu.
  React.useEffect(() => {
    if (!sessionId) return
    const supabase = getSupabaseBrowserClient()
    const channels: RealtimeChannel[] = [
      supabase
        .channel(`imposter:${sessionId}`)
        // `games` n'est pas lisible pendant la partie : le signal de phase passe
        // par une table publique dédiée, sans aucune donnée sensible.
        .on('postgres_changes', { event: '*', schema: 'public', table: 'game_phase_events' }, () => {
          void load()
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'game_player_status' }, () => {
          void load()
        })
        .subscribe(),
      supabase
        .channel(`imposter:${sessionId}:descriptions`)
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'game_descriptions' },
          () => {
            void load()
          },
        )
        .subscribe(),
    ]
    return () => {
      for (const channel of channels) void supabase.removeChannel(channel)
    }
  }, [sessionId, load])

  /*
   * Filet de sécurité : les phases d'affichage durent quelques secondes, une
   * cadence courte évite qu'un WebSocket perdu ne fige la partie.
   */
  const active = Boolean(data.game && !data.game.finished_at && data.game.phase !== 'results')
  React.useEffect(() => {
    if (!active) return
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') void load()
    }, 8000)
    return () => clearInterval(interval)
  }, [active, load])

  return { ...room, ...data, refresh }
}

/** Joueur de room enrichi de son état de partie. */
export interface ImposterPlayerView {
  id: string
  name: string
  avatarKey: string
  isHost: boolean
  isYou: boolean
  isPresent: boolean
  isAlive: boolean
  hasVoted: boolean
  hasSeenRole: boolean
  revealedRole: Role | null
  eliminatedRound: number | null
}

export function buildPlayerViews(
  players: RoomPlayerRow[],
  statuses: GamePlayerStatusRow[],
  me: RoomPlayerRow | null,
): ImposterPlayerView[] {
  const statusById = new Map(statuses.map((status) => [status.room_player_id, status]))
  return players.map((player) => {
    const status = statusById.get(player.id)
    return {
      id: player.id,
      name: player.name,
      avatarKey: player.avatar_key,
      isHost: player.is_host,
      isYou: me?.id === player.id,
      isPresent: player.is_present,
      isAlive: status?.is_alive ?? true,
      hasVoted: status?.has_voted ?? false,
      hasSeenRole: status?.has_seen_role ?? false,
      revealedRole: status?.revealed_role ?? null,
      eliminatedRound: status?.eliminated_round ?? null,
    }
  })
}

/** Joueurs participant à la partie en cours (ceux qui ont un statut). */
export function playersInGame(
  views: ImposterPlayerView[],
  statuses: GamePlayerStatusRow[],
): ImposterPlayerView[] {
  if (statuses.length === 0) return views
  const ids = new Set(statuses.map((status) => status.room_player_id))
  return views.filter((view) => ids.has(view.id))
}
