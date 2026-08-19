import type { Player } from '@/flexgames/core/types'
import {
  CLASSIC_CATEGORY_POOL,
  LETTER_POOLS,
  LETTER_POP_CATEGORIES,
  POP_CATEGORY_POOL,
} from '../data/categories'
import type {
  LetterPopCategoryId,
  LetterPopConfig,
  LetterPopEvaluatedAnswer,
  LetterPopLeaderboardEntry,
  LetterPopPendingDecision,
  LetterPopPlayer,
  LetterPopPrivateState,
  LetterPopPublicState,
  LetterPopRevealEntry,
  LetterPopRoundPlan,
} from '../types'
import { duplicateComparisonKey } from './normalization'

export const ROUND_INTRO_MS = 2_200
export const FINAL_COUNTDOWN_MS = 10_000
export const REVEAL_MS = 2_500
export const ROUND_RESULTS_MS = 3_500
export const MID_LEADERBOARD_MS = 4_000

function at(now: number, delay: number): string {
  return new Date(now + delay).toISOString()
}

function seededRandom(seed: string): () => number {
  let value = 2166136261
  for (const character of seed) value = Math.imul(value ^ character.charCodeAt(0), 16777619)
  return () => {
    value += 0x6d2b79f5
    let next = value
    next = Math.imul(next ^ (next >>> 15), next | 1)
    next ^= next + Math.imul(next ^ (next >>> 7), next | 61)
    return ((next ^ (next >>> 14)) >>> 0) / 4294967296
  }
}

function shuffle<T>(values: readonly T[], random: () => number): T[] {
  const result = [...values]
  for (let index = result.length - 1; index > 0; index -= 1) {
    const target = Math.floor(random() * (index + 1))
    ;[result[index], result[target]] = [result[target] as T, result[index] as T]
  }
  return result
}

function mixCategories(count: number, random: () => number): LetterPopCategoryId[] {
  const families = ['classic', 'culture', 'daily'] as const
  const buckets = Object.fromEntries(families.map((family) => [
    family,
    shuffle(LETTER_POP_CATEGORIES.filter((category) => category.family === family).map((category) => category.id), random),
  ])) as Record<(typeof families)[number], LetterPopCategoryId[]>
  const result: LetterPopCategoryId[] = []
  while (result.length < count) {
    for (const family of shuffle(families, random)) {
      const next = buckets[family].shift()
      if (next) result.push(next)
      if (result.length === count) break
    }
  }
  return result
}

export function createRoundPlans(config: LetterPopConfig, seed: string): LetterPopRoundPlan[] {
  const random = seededRandom(seed)
  const letters = config.customLetter
    ? Array.from({ length: config.roundCount }, () => config.customLetter!)
    : shuffle(LETTER_POOLS[config.difficulty], random).slice(0, config.roundCount)
  return letters.map((letter) => {
    if (config.preset === 'custom') return { letter, categories: [...config.customCategories] }
    const pool = config.preset === 'classic' ? CLASSIC_CATEGORY_POOL : POP_CATEGORY_POOL
    const categories = config.preset === 'mix'
      ? mixCategories(config.categoryCount, random)
      : shuffle(pool, random).slice(0, config.categoryCount)
    return { letter, categories }
  })
}

export function rankLetterPopPlayers(players: readonly LetterPopPlayer[]): LetterPopLeaderboardEntry[] {
  const sorted = [...players].sort((left, right) =>
    right.score - left.score || right.uniqueCount - left.uniqueCount || left.name.localeCompare(right.name, 'fr'),
  )
  const ranked: LetterPopLeaderboardEntry[] = []
  for (const [index, player] of sorted.entries()) {
    const previous = ranked[index - 1]
    const rank = previous && previous.score === player.score && previous.uniqueCount === player.uniqueCount
      ? previous.rank
      : index + 1
    ranked.push({ ...player, rank })
  }
  return ranked
}

export function createLetterPopState(
  players: readonly Player[],
  config: LetterPopConfig,
  seed: string,
  now: number,
): LetterPopPrivateState {
  return {
    schemaVersion: 1,
    phase: 'round_intro',
    config,
    roundIndex: 0,
    rounds: createRoundPlans(config, seed),
    phaseStartedAt: new Date(now).toISOString(),
    phaseEndsAt: at(now, ROUND_INTRO_MS),
    triggeredByPlayerId: null,
    validationPrepared: false,
    validationTotal: 0,
    validationResolved: 0,
    pending: [],
    revealIndex: 0,
    roundResults: [],
    players: players.map((player, index) => ({
      id: player.id,
      name: player.nickname,
      avatarId: player.avatarId,
      isHost: player.isHost,
      score: 0,
      uniqueCount: 0,
      previousRank: index + 1,
      roundScore: 0,
    })),
    midLeaderboardShown: false,
    winnerIds: [],
  }
}

export function openLetterPopAnswering(state: LetterPopPrivateState, now: number): LetterPopPrivateState {
  return {
    ...state,
    phase: 'answering',
    phaseStartedAt: new Date(now).toISOString(),
    phaseEndsAt: at(now, state.config.durationSeconds * 1000),
    triggeredByPlayerId: null,
    validationPrepared: false,
    validationTotal: 0,
    validationResolved: 0,
    pending: [],
    revealIndex: 0,
    roundResults: [],
  }
}

export function startFinalCountdown(
  state: LetterPopPrivateState,
  playerId: string,
  now: number,
): LetterPopPrivateState {
  return {
    ...state,
    phase: 'final_countdown',
    phaseStartedAt: new Date(now).toISOString(),
    phaseEndsAt: at(now, FINAL_COUNTDOWN_MS),
    triggeredByPlayerId: playerId,
  }
}

export function beginLetterPopValidation(state: LetterPopPrivateState, now: number): LetterPopPrivateState {
  return {
    ...state,
    phase: 'validation',
    phaseStartedAt: new Date(now).toISOString(),
    phaseEndsAt: new Date(now).toISOString(),
    validationPrepared: false,
    validationTotal: 0,
    validationResolved: 0,
    pending: [],
  }
}

export function preparedLetterPopValidation(
  state: LetterPopPrivateState,
  results: LetterPopPrivateState['roundResults'],
  pending: LetterPopPendingDecision[],
  now: number,
): LetterPopPrivateState {
  return {
    ...state,
    phase: 'validation',
    phaseStartedAt: new Date(now).toISOString(),
    phaseEndsAt: null,
    validationPrepared: true,
    validationTotal: pending.length,
    validationResolved: 0,
    pending,
    roundResults: results,
  }
}

function updateEvaluatedAnswer(
  state: LetterPopPrivateState,
  pending: LetterPopPendingDecision,
  valid: boolean,
): LetterPopPrivateState['roundResults'] {
  return state.roundResults.map((result) => {
    if (result.playerId !== pending.playerId) return result
    const current = result.answers[pending.categoryId]
    if (!current) return result
    const next: LetterPopEvaluatedAnswer = {
      ...current,
      valid,
      canonical: valid ? current.canonical ?? current.original : current.canonical,
      comparisonKey: valid
        ? current.comparisonKey ?? duplicateComparisonKey(current.original, current.categoryId)
        : current.comparisonKey,
    }
    return { ...result, answers: { ...result.answers, [pending.categoryId]: next } }
  })
}

export function resolveLetterPopDecision(
  state: LetterPopPrivateState,
  pendingId: string,
  valid: boolean,
  now: number,
): LetterPopPrivateState {
  const current = state.pending[0]
  if (!current || current.id !== pendingId) return state
  const next = {
    ...state,
    roundResults: updateEvaluatedAnswer(state, current, valid),
    pending: state.pending.slice(1),
    validationResolved: state.validationResolved + 1,
  }
  return next.pending.length === 0 ? scoreLetterPopRound(next, now) : next
}

export function updateLetterPopVote(
  state: LetterPopPrivateState,
  pendingId: string,
  counts: { total: number; valid: number; invalid: number },
  votersTotal: number,
  now: number,
): LetterPopPrivateState {
  const current = state.pending[0]
  if (!current || current.id !== pendingId) return state
  if (counts.valid > votersTotal / 2) return resolveLetterPopDecision(state, pendingId, true, now)
  if (counts.invalid >= Math.ceil(votersTotal / 2) || counts.total >= votersTotal) {
    return resolveLetterPopDecision(state, pendingId, counts.valid > counts.invalid, now)
  }
  return {
    ...state,
    pending: [{ ...current, voteCount: counts.total, validVotes: counts.valid, invalidVotes: counts.invalid }, ...state.pending.slice(1)],
  }
}

export function scoreLetterPopRound(state: LetterPopPrivateState, now: number): LetterPopPrivateState {
  const plans = state.rounds[state.roundIndex]
  if (!plans) return state
  const groupSizes = new Map<string, number>()
  for (const categoryId of plans.categories) {
    for (const result of state.roundResults) {
      const answer = result.answers[categoryId]
      if (!answer?.valid || !answer.comparisonKey) continue
      const key = `${categoryId}:${answer.comparisonKey}`
      groupSizes.set(key, (groupSizes.get(key) ?? 0) + 1)
    }
  }

  const results = state.roundResults.map((result) => {
    let score = 0
    let uniqueCount = 0
    const answers = { ...result.answers }
    for (const categoryId of plans.categories) {
      const answer = answers[categoryId]
      if (!answer?.valid || !answer.comparisonKey) continue
      const unique = groupSizes.get(`${categoryId}:${answer.comparisonKey}`) === 1
      const points = unique ? 100 : 50
      answers[categoryId] = { ...answer, points }
      score += points
      if (unique) uniqueCount += 1
    }
    return { ...result, answers, score, uniqueCount }
  })

  const oldRanks = new Map(rankLetterPopPlayers(state.players).map((player) => [player.id, player.rank]))
  const byPlayer = new Map(results.map((result) => [result.playerId, result]))
  const players = state.players.map((player) => {
    const result = byPlayer.get(player.id)
    return {
      ...player,
      score: player.score + (result?.score ?? 0),
      uniqueCount: player.uniqueCount + (result?.uniqueCount ?? 0),
      roundScore: result?.score ?? 0,
      previousRank: oldRanks.get(player.id) ?? player.previousRank,
    }
  })
  return {
    ...state,
    phase: 'reveal',
    phaseStartedAt: new Date(now).toISOString(),
    phaseEndsAt: at(now, REVEAL_MS),
    pending: [],
    revealIndex: 0,
    roundResults: results,
    players,
  }
}

function winners(players: readonly LetterPopPlayer[]): string[] {
  const ranked = rankLetterPopPlayers(players)
  const first = ranked[0]
  return first ? ranked.filter((player) => player.score === first.score && player.uniqueCount === first.uniqueCount).map((player) => player.id) : []
}

function nextRoundIntro(state: LetterPopPrivateState, now: number): LetterPopPrivateState {
  return {
    ...state,
    phase: 'round_intro',
    roundIndex: state.roundIndex + 1,
    phaseStartedAt: new Date(now).toISOString(),
    phaseEndsAt: at(now, ROUND_INTRO_MS),
    triggeredByPlayerId: null,
    validationPrepared: false,
    validationTotal: 0,
    validationResolved: 0,
    pending: [],
    revealIndex: 0,
    roundResults: [],
    players: state.players.map((player) => ({ ...player, roundScore: 0 })),
  }
}

export function advanceLetterPopState(state: LetterPopPrivateState, now: number): LetterPopPrivateState {
  switch (state.phase) {
    case 'round_intro':
      return openLetterPopAnswering(state, now)
    case 'answering':
    case 'final_countdown':
      return beginLetterPopValidation(state, now)
    case 'validation':
      return state
    case 'reveal': {
      const categories = state.rounds[state.roundIndex]?.categories ?? []
      if (state.revealIndex + 1 < categories.length) {
        return { ...state, revealIndex: state.revealIndex + 1, phaseStartedAt: new Date(now).toISOString(), phaseEndsAt: at(now, REVEAL_MS) }
      }
      return { ...state, phase: 'round_results', phaseStartedAt: new Date(now).toISOString(), phaseEndsAt: at(now, ROUND_RESULTS_MS) }
    }
    case 'round_results': {
      const completed = state.roundIndex + 1
      if (completed >= state.rounds.length) {
        return { ...state, phase: 'results', phaseStartedAt: new Date(now).toISOString(), phaseEndsAt: null, winnerIds: winners(state.players) }
      }
      if (!state.midLeaderboardShown && completed === Math.ceil(state.rounds.length / 2)) {
        return { ...state, phase: 'mid_leaderboard', midLeaderboardShown: true, phaseStartedAt: new Date(now).toISOString(), phaseEndsAt: at(now, MID_LEADERBOARD_MS) }
      }
      return nextRoundIntro(state, now)
    }
    case 'mid_leaderboard':
      return nextRoundIntro(state, now)
    case 'results':
      return state
  }
}

function revealEntries(state: LetterPopPrivateState, categoryId: LetterPopCategoryId): LetterPopRevealEntry[] {
  const playerById = new Map(state.players.map((player) => [player.id, player]))
  return state.roundResults.map((result) => {
    const player = playerById.get(result.playerId)
    const answer = result.answers[categoryId]
    const points = answer?.points ?? 0
    return {
      playerId: result.playerId,
      name: player?.name ?? 'Joueur',
      avatarId: player?.avatarId ?? 'fox',
      answer: answer?.original ?? '',
      points,
      verdict: points === 100 ? 'unique' : points === 50 ? 'duplicate' : 'invalid',
    }
  })
}

export function toPublicLetterPopState(state: LetterPopPrivateState): LetterPopPublicState {
  const round = state.rounds[state.roundIndex] ?? state.rounds[0]
  if (!round) throw new Error('Manche LetterPop introuvable.')
  const currentPending = state.pending[0]
  const triggered = state.players.find((player) => player.id === state.triggeredByPlayerId)
  const revealCategory = state.phase === 'reveal' ? round.categories[state.revealIndex] : undefined
  return {
    schemaVersion: 1,
    phase: state.phase,
    config: state.config,
    roundIndex: state.roundIndex,
    totalRounds: state.rounds.length,
    letter: round.letter,
    categories: round.categories,
    phaseStartedAt: state.phaseStartedAt,
    phaseEndsAt: state.phaseEndsAt,
    triggeredBy: triggered ? { id: triggered.id, name: triggered.name } : null,
    validation: {
      prepared: state.validationPrepared,
      total: state.validationTotal,
      resolved: state.validationResolved,
      pending: state.pending.length,
      mode: currentPending?.mode ?? null,
      votesCast: currentPending?.voteCount ?? 0,
      votersTotal: currentPending?.mode === 'vote' ? Math.max(0, state.players.length - 1) : 0,
    },
    reveal: revealCategory ? { categoryId: revealCategory, entries: revealEntries(state, revealCategory) } : null,
    leaderboard: rankLetterPopPlayers(state.players),
    winnerIds: state.winnerIds,
  }
}
