import type { SupabaseClient } from '@supabase/supabase-js'
import { ApiError } from '@/flexgames/core/errors'
import type { GameSessionRow, RoomPlayerRow, RoomRow } from '@/flexgames/core/db'
import type { GameServerModule } from '@/flexgames/core/game-server'
import type { Player, Room } from '@/flexgames/core/types'
import { trackEvent } from '@/flexgames/core/api/http'

/**
 * Cycle de vie d'une partie, côté plateforme.
 *
 * FlexGames ouvre et referme les sessions ; ce qui se passe entre les deux
 * appartient au module du jeu. Une room peut enchaîner autant de sessions que
 * voulu, avec le même jeu ou (plus tard) un autre.
 */

export function toRoom(row: RoomRow): Room {
  return {
    id: row.id,
    code: row.code,
    gameId: row.game_id,
    hostPlayerId: row.host_player_id,
    status: row.status,
    visibility: row.visibility,
    maxPlayers: row.max_players,
    createdAt: row.created_at,
    lastActivityAt: row.last_activity_at,
    expiresAt: row.expires_at,
  }
}

export function toPlayer(row: RoomPlayerRow): Player {
  return {
    id: row.id,
    roomId: row.room_id,
    nickname: row.name,
    avatarId: row.avatar_key,
    isHost: row.is_host,
    connected: row.is_present,
    joinedAt: row.joined_at,
  }
}

export async function fetchPresentPlayers(
  db: SupabaseClient,
  roomId: string,
): Promise<RoomPlayerRow[]> {
  const { data } = await db
    .from('room_players')
    .select('*')
    .eq('room_id', roomId)
    .eq('is_present', true)
    .order('joined_at', { ascending: true })
  return (data ?? []) as RoomPlayerRow[]
}

export async function findActiveSession(
  db: SupabaseClient,
  roomId: string,
): Promise<GameSessionRow | null> {
  const { data } = await db
    .from('game_sessions')
    .select('*')
    .eq('room_id', roomId)
    .eq('status', 'active')
    .maybeSingle()
  return (data as GameSessionRow | null) ?? null
}

/**
 * Ouvre une partie dans une room.
 *
 * La plateforme vérifie ce qui la concerne (effectif, session déjà ouverte),
 * crée la ligne `game_sessions`, puis laisse le module du jeu installer ses
 * propres données. Les réglages sont figés dans la session : les modifier dans
 * le salon plus tard n'altère pas une partie en cours.
 */
export async function startSession(
  db: SupabaseClient,
  room: RoomRow,
  module: GameServerModule,
  bounds: { minPlayers: number; maxPlayers: number },
  options: Record<string, unknown> = {},
): Promise<GameSessionRow> {
  const players = await fetchPresentPlayers(db, room.id)
  if (players.length < bounds.minPlayers) {
    throw new ApiError(
      `Il faut au moins ${bounds.minPlayers} joueurs pour lancer.`,
      422,
      'not_enough_players',
    )
  }
  if (players.length > bounds.maxPlayers) {
    throw new ApiError(`Ce jeu accepte ${bounds.maxPlayers} joueurs au maximum.`, 422, 'too_many_players')
  }

  const existing = await findActiveSession(db, room.id)
  if (existing) throw new ApiError('Une partie est déjà en cours.', 409, 'session_in_progress')

  const config = room.game_config
  module.validateConfig(config, players.length)

  const { data, error } = await db
    .from('game_sessions')
    .insert({ room_id: room.id, game_id: room.game_id, status: 'active', config })
    .select('*')
    .single()
  if (error || !data) throw error ?? new ApiError('Création de la partie impossible.', 500)
  const session = data as GameSessionRow

  try {
    await module.startSession({
      db,
      room: toRoom(room),
      players: players.map(toPlayer),
      sessionId: session.id,
      config: { ...(config as Record<string, unknown>), ...options },
    })
  } catch (error) {
    // Le jeu n'a pas pu démarrer : on ne laisse pas de session orpheline.
    await db.from('game_sessions').delete().eq('id', session.id)
    throw error
  }

  await db
    .from('rooms')
    .update({ status: 'in_game', last_activity_at: new Date().toISOString() })
    .eq('id', room.id)

  await trackEvent({
    event: 'game_started',
    roomId: room.id,
    gameKey: room.game_id,
    sessionId: session.id,
    playerCount: players.length,
  })

  return session
}

/** Referme une session. Appelé par le module du jeu quand la partie se termine. */
export async function finishSession(
  db: SupabaseClient,
  sessionId: string,
  outcome: { status?: 'finished' | 'abandoned'; winner?: string | null } = {},
): Promise<void> {
  const { data } = await db
    .from('game_sessions')
    .update({ status: outcome.status ?? 'finished', finished_at: new Date().toISOString() })
    .eq('id', sessionId)
    .select('room_id, game_id')
    .maybeSingle()

  const row = data as { room_id: string; game_id: string } | null
  if (!row) return

  await db
    .from('rooms')
    .update({ status: 'finished', last_activity_at: new Date().toISOString() })
    .eq('id', row.room_id)

  await trackEvent({
    event: 'game_finished',
    roomId: row.room_id,
    gameKey: row.game_id,
    sessionId,
    winner: outcome.winner ?? null,
  })
}
