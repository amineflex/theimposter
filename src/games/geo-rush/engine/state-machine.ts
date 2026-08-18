import type { Player } from '@/flexgames/core/types'
import type {
  GeoConfig, GeoLeaderboardEntry, GeoPrivateState, GeoPublicQuestion, GeoPublicState, GeoRoundResult, GeoStoredAnswer,
} from '../types'
import type { GeoCountry } from '../data/countries'
import { generateQuestions } from './questions'

export const COUNTDOWN_MS = 3_000
export const REVEAL_MS = 4_500
export const LEADERBOARD_MS = 5_000

function at(now: number, delay: number): string {
  return new Date(now + delay).toISOString()
}

export function createGeoState(
  players: Player[],
  config: GeoConfig,
  seed: string,
  now: number,
  countries?: readonly GeoCountry[],
): GeoPrivateState {
  const participants = players.map((player, index) => ({
    id: player.id,
    name: player.nickname,
    avatarId: player.avatarId,
    score: 0,
    streak: 0,
    previousRank: index + 1,
  }))
  return {
    schemaVersion: 1,
    phase: 'countdown',
    config,
    roundIndex: 0,
    totalQuestions: config.questionCount,
    phaseStartedAt: new Date(now).toISOString(),
    phaseEndsAt: at(now, COUNTDOWN_MS),
    questions: generateQuestions(config, seed, countries),
    responseCount: 0,
    totalPlayers: players.length,
    reveal: null,
    leaderboard: rankPlayers(participants),
    players: participants,
    winnerId: null,
  }
}

export function rankPlayers(players: GeoPrivateState['players']): GeoLeaderboardEntry[] {
  return [...players]
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name, 'fr'))
    .map((player, index) => ({ ...player, rank: index + 1 }))
}

export function openGeoQuestion(state: GeoPrivateState, now: number, roundIndex = state.roundIndex): GeoPrivateState {
  return {
    ...state,
    phase: 'question',
    roundIndex,
    phaseStartedAt: new Date(now).toISOString(),
    phaseEndsAt: at(now, state.config.durationSeconds * 1000),
    responseCount: 0,
    reveal: null,
  }
}

export function closeGeoQuestion(state: GeoPrivateState, answers: GeoStoredAnswer[], now: number): GeoPrivateState {
  const byPlayer = new Map(answers.map((answer) => [answer.room_player_id, answer]))
  const oldRanks = new Map(state.leaderboard.map((entry) => [entry.id, entry.rank]))
  const players = state.players.map((player) => {
    const answer = byPlayer.get(player.id)
    return {
      ...player,
      score: player.score + (answer?.score ?? 0),
      streak: answer?.streak ?? 0,
      previousRank: oldRanks.get(player.id) ?? player.previousRank,
    }
  })
  const results: GeoRoundResult[] = players.map((player) => {
    const answer = byPlayer.get(player.id)
    return {
      id: player.id,
      name: player.name,
      avatarId: player.avatarId,
      correct: answer?.is_correct ?? false,
      score: answer?.score ?? 0,
      totalScore: player.score,
      responseMs: answer?.response_ms ?? state.config.durationSeconds * 1000,
      streak: player.streak,
    }
  })
  const question = state.questions[state.roundIndex]
  if (!question) throw new Error('Question introuvable.')
  return {
    ...state,
    phase: 'reveal',
    phaseStartedAt: new Date(now).toISOString(),
    phaseEndsAt: at(now, REVEAL_MS),
    responseCount: answers.length,
    players,
    reveal: { correctAnswer: question.correctAnswer, results },
    leaderboard: rankPlayers(players),
  }
}

export function advanceGeoAfterReveal(state: GeoPrivateState, now: number): GeoPrivateState {
  const completed = state.roundIndex + 1
  if (completed >= state.totalQuestions) {
    return { ...state, phase: 'results', phaseStartedAt: new Date(now).toISOString(), phaseEndsAt: null, winnerId: state.leaderboard[0]?.id ?? null }
  }
  if (completed % 5 === 0) {
    return { ...state, phase: 'leaderboard', phaseStartedAt: new Date(now).toISOString(), phaseEndsAt: at(now, LEADERBOARD_MS) }
  }
  return openGeoQuestion(state, now, state.roundIndex + 1)
}

export function publicQuestion(state: GeoPrivateState): GeoPublicQuestion | null {
  if (state.phase === 'countdown' || state.phase === 'results') return null
  const question = state.questions[state.roundIndex]
  if (!question) return null
  const { correctAnswer: _correctAnswer, acceptedAnswers: _acceptedAnswers, countryKey: _countryKey, ...publicValue } = question
  return publicValue
}

export function toPublicGeoState(state: GeoPrivateState): GeoPublicState {
  const { questions: _questions, players: _players, ...publicState } = state
  return { ...publicState, question: publicQuestion(state) }
}
