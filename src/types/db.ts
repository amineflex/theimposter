/**
 * Types des lignes de base de données réellement lues/écrites par l'app.
 *
 * Choix : plutôt qu'un fichier généré de plusieurs milliers de lignes, on
 * déclare explicitement les formes utilisées. Elles sont vérifiées par les
 * migrations SQL et par le typage des helpers d'accès aux données.
 */
import type {
  Difficulty,
  GameMode,
  GameSettings,
  Phase,
  Role,
  Winner,
} from '@/lib/game-engine/types'

export type RoomStatus = 'lobby' | 'in_game' | 'finished' | 'cancelled' | 'expired'
export type RoomVisibility = 'private' | 'public'

export interface RoomRow {
  id: string
  code: string
  host_player_id: string | null
  status: RoomStatus
  visibility: RoomVisibility
  mode: GameMode
  settings: GameSettings
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
  recent_special_count: number
  joined_at: string
  last_seen_at: string
}

export interface GameRow {
  id: string
  room_id: string
  mode: GameMode
  settings: GameSettings
  phase: Phase
  round: number
  description_pass: number
  speaking_order: string[]
  current_speaker_index: number
  base_order: string[]
  first_speaker_offset: number
  runoff_candidates: string[] | null
  runoff_count: number
  empty_vote_streak: number
  pending_mr_white_id: string | null
  last_vote: LastVoteJson | null
  last_mr_white_guess: MrWhiteGuessJson | null
  eliminations: EliminationJson[]
  winner: Winner | null
  abandoned: boolean
  word_source_id: string | null
  civilian_word: string
  undercover_word: string | null
  impostor_hint: string | null
  accepted_answers: string[]
  word_category: string | null
  word_difficulty: Difficulty | null
  phase_ends_at: string | null
  is_paused: boolean
  version: number
  started_at: string
  finished_at: string | null
}

/**
 * Vue `game_public_state` : identique à `GameRow` sans les mots secrets.
 * Les champs lexicaux ne sont renseignés qu'une fois la partie terminée.
 */
export type GamePublicStateRow = Omit<
  GameRow,
  'civilian_word' | 'undercover_word' | 'impostor_hint' | 'accepted_answers' | 'word_source_id'
> & {
  civilian_word: string | null
  undercover_word: string | null
  impostor_hint: string | null
  word_source_id: string | null
}

export interface LastVoteJson {
  votes: { voterId: string; targetId: string }[]
  tally: Record<string, number>
  eliminatedId: string | null
  tie: boolean
  resolvedByChance: boolean
}

export interface MrWhiteGuessJson {
  playerId: string
  guess: string
  correct: boolean
}

export interface EliminationJson {
  round: number
  playerId: string
  role: Role
  votes: { voterId: string; targetId: string }[]
  tally: Record<string, number>
}

export interface GamePlayerRow {
  id: string
  game_id: string
  room_player_id: string
  user_id: string
  role: Role
  word: string | null
  hint: string | null
  has_seen_role: boolean
}

export interface GamePlayerStatusRow {
  game_id: string
  room_player_id: string
  is_alive: boolean
  eliminated_round: number | null
  revealed_role: Role | null
  has_seen_role: boolean
  has_voted: boolean
}

export interface VoteRow {
  id: string
  game_id: string
  round: number
  runoff: number
  voter_id: string
  target_id: string
  user_id: string
  created_at: string
}

/** Description écrite par un joueur à son tour de parole. */
export interface GameDescriptionRow {
  id: string
  game_id: string
  room_player_id: string
  round: number
  pass: number
  body: string
  created_at: string
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
  mode: GameMode
  status: RoomStatus
  created_at: string
  last_activity_at: string
  max_players: number
  difficulty: string | null
  player_count: number
}

export interface PackRow {
  id: string
  slug: string
  name: string
  description: string
  emoji: string
  sort_order: number
  is_active: boolean
}

export interface ImpostorWordRow {
  id: string
  slug: string
  word: string
  hint: string
  category_id: string | null
  difficulty: Difficulty
  accepted_answers: string[]
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface WordPairRow {
  id: string
  slug: string
  civilian_word: string
  undercover_word: string
  category_id: string | null
  difficulty: Difficulty
  accepted_answers: string[]
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface CategoryRow {
  id: string
  slug: string
  name: string
}

export interface AdminStats {
  games_today: number
  games_total: number
  players_today: number
  active_rooms: number
  avg_duration_seconds: number
  avg_player_count: number
  most_played_mode: GameMode | null
  top_packs: { pack: string; games: number }[]
  open_reports: number
  words_total: number
}
