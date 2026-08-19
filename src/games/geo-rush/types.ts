export const GEO_DIFFICULTIES = ['easy', 'normal', 'hard'] as const
export const GEO_REGIONS = ['world', 'europe', 'africa', 'asia', 'americas', 'oceania'] as const
export const GEO_QUESTION_COUNTS = [10, 15, 30] as const
export const GEO_DURATIONS = [10, 15, 20] as const

export type GeoDifficulty = (typeof GEO_DIFFICULTIES)[number]
export type GeoRegion = (typeof GEO_REGIONS)[number]
export type GeoQuestionCount = (typeof GEO_QUESTION_COUNTS)[number]
export type GeoDuration = (typeof GEO_DURATIONS)[number]

export interface GeoConfig {
  questionCount: GeoQuestionCount
  durationSeconds: GeoDuration
  difficulty: GeoDifficulty
  region: GeoRegion
}

export type GeoQuestionType =
  | 'map-capital'
  | 'map-country'
  | 'flag-country'
  | 'country-capital'
  | 'capital-country'
  | 'silhouette-country'

interface GeoQuestionBase {
  id: string
  prompt: string
}

export type GeoPublicQuestion =
  | (GeoQuestionBase & {
      type: 'map-capital'
      answerMode: 'text'
      geometryIndex: number
      capitalCoordinates: readonly [number, number]
    })
  | (GeoQuestionBase & { type: 'capital-country'; answerMode: 'text' })
  | (GeoQuestionBase & { type: 'flag-country'; answerMode: 'choices'; choices: string[]; countryCode: string })
  | (GeoQuestionBase & {
      type: 'map-country'
      answerMode: 'choices'
      choices: string[]
      geometryIndex: number
      focused: boolean
    })
  | (GeoQuestionBase & { type: 'silhouette-country'; answerMode: 'choices'; choices: string[]; geometryIndex: number })
  | (GeoQuestionBase & { type: 'country-capital'; answerMode: 'choices'; choices: string[] })

export type GeoQuestion = GeoPublicQuestion & {
  countryKey: string
  correctAnswer: string
  acceptedAnswers: string[]
}

export interface GeoParticipant {
  id: string
  name: string
  avatarId: string
}

export interface GeoLeaderboardEntry extends GeoParticipant {
  score: number
  streak: number
  rank: number
  previousRank: number
}

export interface GeoRoundResult extends GeoParticipant {
  correct: boolean
  score: number
  totalScore: number
  responseMs: number
  streak: number
}

export interface GeoStoredAnswer {
  room_player_id: string
  submitted_answer: string
  is_correct: boolean
  response_ms: number
  score: number
  streak: number
}

export type GeoPhase = 'countdown' | 'question' | 'reveal' | 'leaderboard' | 'results'

export interface GeoReveal {
  correctAnswer: string
  results: GeoRoundResult[]
}

export interface GeoPublicState {
  schemaVersion: 1
  phase: GeoPhase
  config: GeoConfig
  roundIndex: number
  totalQuestions: number
  phaseStartedAt: string
  phaseEndsAt: string | null
  question: GeoPublicQuestion | null
  responseCount: number
  totalPlayers: number
  reveal: GeoReveal | null
  leaderboard: GeoLeaderboardEntry[]
  winnerId: string | null
}

export interface GeoPlayerProgress extends GeoParticipant {
  score: number
  streak: number
  previousRank: number
}

export interface GeoPrivateState extends Omit<GeoPublicState, 'question'> {
  questions: GeoQuestion[]
  players: GeoPlayerProgress[]
}

export interface GeoPlayerPrivateView {
  playerId: string
  submittedRound: number | null
  spectator: boolean
}

export function isGeoPublicState(value: unknown): value is GeoPublicState {
  if (!value || typeof value !== 'object') return false
  const state = value as Partial<GeoPublicState>
  return (
    state.schemaVersion === 1 &&
    typeof state.phase === 'string' &&
    typeof state.roundIndex === 'number' &&
    typeof state.totalQuestions === 'number' &&
    Array.isArray(state.leaderboard)
  )
}
