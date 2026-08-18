/**
 * Tables propres à The Imposter.
 *
 * Elles portent tout ce que la plateforme ne doit pas connaître : rôles, mots
 * secrets, votes, descriptions. Chaque ligne est rattachée à une session
 * FlexGames (`session_id`), qui reste la seule notion partagée.
 */
import type { Difficulty, GameMode, GameSettings, Phase, Role, Winner } from '../engine/types'

export interface GameRow {
  id: string
  session_id: string
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
 * Vue `game_public_state` : `GameRow` sans les mots secrets.
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
