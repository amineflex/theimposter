/**
 * Lignes de base de données COMMUNES à tous les jeux.
 *
 * Les tables propres à un jeu sont déclarées dans son module
 * (ex. `src/games/the-imposter/types/db.ts`). Rien ici ne parle de gameplay.
 */
import type { RoomStatus, RoomVisibility, SessionStatus } from './types'

export interface RoomRow {
  id: string
  code: string
  /** Jeu choisi pour cette room (id du registry). */
  game_id: string
  /** Réglages du jeu, opaques pour la plateforme. */
  game_config: Record<string, unknown>
  host_player_id: string | null
  status: RoomStatus
  visibility: RoomVisibility
  max_players: number
  created_by: string | null
  created_at: string
  last_activity_at: string
  expires_at: string
}

export interface RoomPlayerRow {
  id: string
  room_id: string
  user_id: string
  name: string
  avatar_key: string
  is_host: boolean
  is_present: boolean
  /** Compteur d'équité inter-parties, utilisé par les jeux à rôles. */
  recent_special_count: number
  joined_at: string
  last_seen_at: string
}

/** Une partie jouée dans une room. Le détail appartient au jeu. */
export interface GameSessionRow {
  id: string
  room_id: string
  game_id: string
  status: SessionStatus
  /** Réglages figés au démarrage de la partie. */
  config: Record<string, unknown>
  /** État public des jeux simples ; les jeux à secrets utilisent leurs tables. */
  state: Record<string, unknown>
  version: number
  created_at: string
  finished_at: string | null
}

export interface ChatMessageRow {
  id: string
  room_id: string
  room_player_id: string
  kind: 'text' | 'reaction'
  body: string
  created_at: string
}

export interface PublicRoomRow {
  code: string
  game_id: string
  status: RoomStatus
  created_at: string
  last_activity_at: string
  max_players: number
  player_count: number
}

/** Agrégats du dashboard d'administration (fonction SQL `admin_stats`). */
export interface AdminStats {
  games_today: number
  games_total: number
  players_today: number
  active_rooms: number
  avg_duration_seconds: number
  avg_player_count: number
  most_played_game: string | null
  games_by_id: { game: string; sessions: number }[]
  top_packs: { pack: string; games: number }[]
  open_reports: number
  words_total: number
}
