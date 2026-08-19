export const LETTER_POP_CATEGORY_IDS = [
  'first-name', 'country', 'city', 'animal', 'job', 'object', 'food', 'brand',
  'entertainment', 'celebrity', 'sport', 'clothing',
] as const
export const LETTER_POP_PRESETS = ['classic', 'pop', 'mix', 'custom'] as const
export const LETTER_POP_DIFFICULTIES = ['easy', 'normal', 'hard'] as const
export const LETTER_POP_ROUND_COUNTS = [3, 5, 7, 10] as const
export const LETTER_POP_DURATIONS = [30, 45, 60] as const
export const LETTER_POP_CATEGORY_COUNTS = [4, 5, 6, 7, 8] as const
export const LETTER_POP_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('') as LetterPopLetter[]

export type LetterPopCategoryId = (typeof LETTER_POP_CATEGORY_IDS)[number]
export type LetterPopPreset = (typeof LETTER_POP_PRESETS)[number]
export type LetterPopDifficulty = (typeof LETTER_POP_DIFFICULTIES)[number]
export type LetterPopRoundCount = (typeof LETTER_POP_ROUND_COUNTS)[number]
export type LetterPopDuration = (typeof LETTER_POP_DURATIONS)[number]
export type LetterPopCategoryCount = (typeof LETTER_POP_CATEGORY_COUNTS)[number]
export type LetterPopLetter =
  | 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H' | 'I' | 'J' | 'K' | 'L' | 'M'
  | 'N' | 'O' | 'P' | 'Q' | 'R' | 'S' | 'T' | 'U' | 'V' | 'W' | 'X' | 'Y' | 'Z'

export interface LetterPopConfig {
  roundCount: LetterPopRoundCount
  durationSeconds: LetterPopDuration
  categoryCount: LetterPopCategoryCount
  preset: LetterPopPreset
  difficulty: LetterPopDifficulty
  customLetter: LetterPopLetter | null
  customCategories: LetterPopCategoryId[]
}

export type LetterPopPhase =
  | 'round_intro'
  | 'answering'
  | 'final_countdown'
  | 'validation'
  | 'reveal'
  | 'round_results'
  | 'mid_leaderboard'
  | 'results'

export interface LetterPopRoundPlan {
  letter: LetterPopLetter
  categories: LetterPopCategoryId[]
}

export interface LetterPopPlayer {
  id: string
  name: string
  avatarId: string
  isHost: boolean
  score: number
  uniqueCount: number
  previousRank: number
  roundScore: number
}

export interface LetterPopLeaderboardEntry extends LetterPopPlayer {
  rank: number
}

export type LetterPopMatchStatus =
  | 'empty'
  | 'wrong-letter'
  | 'exact'
  | 'alias'
  | 'fuzzy'
  | 'unknown'

export interface LetterPopEvaluatedAnswer {
  categoryId: LetterPopCategoryId
  original: string
  status: LetterPopMatchStatus
  entityId?: string
  canonical?: string
  comparisonKey?: string
  confidence?: number
  valid: boolean | null
  points: 0 | 50 | 100
}

export interface LetterPopRoundPlayerResult {
  playerId: string
  answers: Partial<Record<LetterPopCategoryId, LetterPopEvaluatedAnswer>>
  score: number
  uniqueCount: number
}

export interface LetterPopPendingDecision {
  id: string
  playerId: string
  playerName: string
  categoryId: LetterPopCategoryId
  original: string
  mode: 'host' | 'vote'
  voteCount: number
  validVotes: number
  invalidVotes: number
}

export interface LetterPopPrivateState {
  schemaVersion: 1
  phase: LetterPopPhase
  config: LetterPopConfig
  roundIndex: number
  rounds: LetterPopRoundPlan[]
  phaseStartedAt: string
  phaseEndsAt: string | null
  triggeredByPlayerId: string | null
  validationPrepared: boolean
  validationTotal: number
  validationResolved: number
  pending: LetterPopPendingDecision[]
  revealIndex: number
  roundResults: LetterPopRoundPlayerResult[]
  players: LetterPopPlayer[]
  midLeaderboardShown: boolean
  winnerIds: string[]
}

export interface LetterPopRevealEntry {
  playerId: string
  name: string
  avatarId: string
  answer: string
  points: 0 | 50 | 100
  verdict: 'unique' | 'duplicate' | 'invalid'
}

export interface LetterPopPublicState {
  schemaVersion: 1
  phase: LetterPopPhase
  config: LetterPopConfig
  roundIndex: number
  totalRounds: number
  letter: LetterPopLetter
  categories: LetterPopCategoryId[]
  phaseStartedAt: string
  phaseEndsAt: string | null
  triggeredBy: { id: string; name: string } | null
  validation: {
    prepared: boolean
    total: number
    resolved: number
    pending: number
    mode: 'host' | 'vote' | null
    votesCast: number
    votersTotal: number
  }
  reveal: { categoryId: LetterPopCategoryId; entries: LetterPopRevealEntry[] } | null
  leaderboard: LetterPopLeaderboardEntry[]
  winnerIds: string[]
}

export interface LetterPopAdjudication {
  id: string
  categoryId: LetterPopCategoryId
  letter: LetterPopLetter
  playerName: string
  answer: string
  mode: 'host' | 'vote'
  voteCount: number
  votersTotal: number
  hasVoted: boolean
}

export interface LetterPopPlayerPrivateView {
  playerId: string
  roundIndex: number
  spectator: boolean
  answers: Partial<Record<LetterPopCategoryId, string>>
  locked: boolean
  savedAt: string | null
  adjudication: LetterPopAdjudication | null
}

export interface LetterPopAnswerRow {
  session_id: string
  round_index: number
  room_player_id: string
  answers: Partial<Record<LetterPopCategoryId, string>>
  evaluations: Partial<Record<LetterPopCategoryId, LetterPopEvaluatedAnswer>>
  locked_at: string | null
  updated_at: string
}

export function isLetterPopPublicState(value: unknown): value is LetterPopPublicState {
  if (!value || typeof value !== 'object') return false
  const state = value as Partial<LetterPopPublicState>
  return state.schemaVersion === 1
    && typeof state.phase === 'string'
    && typeof state.roundIndex === 'number'
    && typeof state.letter === 'string'
    && Array.isArray(state.categories)
    && Array.isArray(state.leaderboard)
}
