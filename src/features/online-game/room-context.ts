'use client'

import type { RoomSnapshot } from './use-room'
import type { GamePlayerStatusRow, RoomPlayerRow } from '@/types/db'
import type { Role } from '@/lib/game-engine/types'

/** Vue d'un joueur, combinant identité de room et état public de partie. */
export interface RoomPlayerView {
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

export interface RoomViewModel extends RoomSnapshot {
  refresh: (options?: { silent?: boolean }) => Promise<void>
}

/** Fusionne `room_players` et `game_player_status` en une liste affichable. */
export function buildPlayerViews(
  players: RoomPlayerRow[],
  statuses: GamePlayerStatusRow[],
  me: RoomPlayerRow | null,
): RoomPlayerView[] {
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
export function playersInGame(views: RoomPlayerView[], statuses: GamePlayerStatusRow[]): RoomPlayerView[] {
  if (statuses.length === 0) return views
  const ids = new Set(statuses.map((status) => status.room_player_id))
  return views.filter((view) => ids.has(view.id))
}
