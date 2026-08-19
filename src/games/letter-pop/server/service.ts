import type { SupabaseClient } from '@supabase/supabase-js'
import { ConcurrentUpdateError, GameRuleError } from '@/flexgames/core/errors'
import { finishSession } from '@/flexgames/session/session-service'
import {
  advanceLetterPopState,
  preparedLetterPopValidation,
  resolveLetterPopDecision,
  scoreLetterPopRound,
  startFinalCountdown,
  updateLetterPopVote,
} from '../engine/state-machine'
import { evaluateLetterPopAnswer } from '../engine/matching'
import { areLetterPopAnswersComplete } from '../engine/normalization'
import type {
  LetterPopCategoryId,
  LetterPopPendingDecision,
  LetterPopPrivateState,
  LetterPopRoundPlayerResult,
} from '../types'
import {
  commitLetterPopState,
  loadLetterPopAnswers,
  loadLetterPopSession,
  persistLetterPopEvaluations,
  saveLetterPopAnswers,
  triggerLetterPopFinish,
} from './persistence'

type AnswerSnapshot = Partial<Record<LetterPopCategoryId, string>>

function currentCategories(state: LetterPopPrivateState): LetterPopCategoryId[] {
  return state.rounds[state.roundIndex]?.categories ?? []
}

function sanitizeAnswers(state: LetterPopPrivateState, answers: AnswerSnapshot): AnswerSnapshot {
  return Object.fromEntries(currentCategories(state).map((categoryId) => [
    categoryId,
    (answers[categoryId] ?? '').trim().slice(0, 80),
  ])) as AnswerSnapshot
}

function participant(state: LetterPopPrivateState, playerId: string) {
  const player = state.players.find((candidate) => candidate.id === playerId)
  if (!player) throw new GameRuleError('Tu observes cette partie en spectateur.', 'spectator')
  return player
}

function answerRowsForState(
  state: LetterPopPrivateState,
  rows: Awaited<ReturnType<typeof loadLetterPopAnswers>>,
): { results: LetterPopRoundPlayerResult[]; pending: LetterPopPendingDecision[]; raw: Map<string, AnswerSnapshot> } {
  const byPlayer = new Map(rows.map((row) => [row.room_player_id, row.answers]))
  const raw = new Map<string, AnswerSnapshot>()
  const pending: LetterPopPendingDecision[] = []
  const round = state.rounds[state.roundIndex]
  if (!round) throw new GameRuleError('Manche introuvable.', 'round_not_found')
  const results = state.players.map((player) => {
    const answers = sanitizeAnswers(state, byPlayer.get(player.id) ?? {})
    raw.set(player.id, answers)
    const evaluations = Object.fromEntries(round.categories.map((categoryId) => {
      const evaluation = evaluateLetterPopAnswer(answers[categoryId] ?? '', categoryId, round.letter)
      if (evaluation.valid === null) {
        pending.push({
          id: `${state.roundIndex}:${player.id}:${categoryId}`,
          playerId: player.id,
          playerName: player.name,
          categoryId,
          original: evaluation.original,
          mode: player.isHost ? 'vote' : 'host',
          voteCount: 0,
          validVotes: 0,
          invalidVotes: 0,
        })
      }
      return [categoryId, evaluation]
    }))
    return { playerId: player.id, answers: evaluations, score: 0, uniqueCount: 0 } as LetterPopRoundPlayerResult
  })
  return { results, pending, raw }
}

async function persistResults(
  db: SupabaseClient,
  sessionId: string,
  state: LetterPopPrivateState,
  raw?: Map<string, AnswerSnapshot>,
) {
  await persistLetterPopEvaluations(db, sessionId, state.roundIndex, state.roundResults.map((result) => ({
    playerId: result.playerId,
    answers: raw?.get(result.playerId)
      ?? Object.fromEntries(Object.entries(result.answers).map(([categoryId, evaluation]) => [categoryId, evaluation?.original ?? ''])) as AnswerSnapshot,
    evaluations: result.answers,
  })))
}

async function prepareValidation(
  db: SupabaseClient,
  sessionId: string,
  state: LetterPopPrivateState,
  now: number,
): Promise<LetterPopPrivateState> {
  const prepared = answerRowsForState(state, await loadLetterPopAnswers(db, sessionId, state.roundIndex))
  let next = preparedLetterPopValidation(state, prepared.results, prepared.pending, now)
  if (prepared.pending.length === 0) next = scoreLetterPopRound(next, now)
  await persistResults(db, sessionId, next, prepared.raw)
  return next
}

export async function saveLetterPopSnapshot(
  db: SupabaseClient,
  sessionId: string,
  playerId: string,
  input: { roundIndex: number; answers: AnswerSnapshot },
  now = Date.now(),
) {
  const row = await loadLetterPopSession(db, sessionId)
  const state = row.state
  participant(state, playerId)
  if (!['answering', 'final_countdown'].includes(state.phase) || state.roundIndex !== input.roundIndex) {
    throw new GameRuleError('Cette manche est déjà verrouillée.', 'round_locked')
  }
  if (state.phaseEndsAt && now >= new Date(state.phaseEndsAt).getTime()) {
    throw new GameRuleError('Temps écoulé.', 'time_up')
  }
  await saveLetterPopAnswers(db, sessionId, state.roundIndex, playerId, sanitizeAnswers(state, input.answers))
  return { saved: true, savedAt: new Date(now).toISOString() }
}

export async function finishLetterPopAnswers(
  db: SupabaseClient,
  sessionId: string,
  playerId: string,
  input: { roundIndex: number; answers: AnswerSnapshot },
  now = Date.now(),
) {
  const row = await loadLetterPopSession(db, sessionId)
  const state = row.state
  participant(state, playerId)
  if (state.phase !== 'answering' || state.roundIndex !== input.roundIndex) {
    return { accepted: false, triggeredByPlayerId: state.triggeredByPlayerId }
  }
  if (state.phaseEndsAt && now >= new Date(state.phaseEndsAt).getTime()) {
    throw new GameRuleError('Temps écoulé.', 'time_up')
  }
  const answers = sanitizeAnswers(state, input.answers)
  if (!areLetterPopAnswersComplete(currentCategories(state), answers)) {
    throw new GameRuleError('Remplis toutes les catégories avant de terminer.', 'incomplete_answers')
  }
  const next = startFinalCountdown(state, playerId, now)
  const accepted = await triggerLetterPopFinish(db, sessionId, row.version, state.roundIndex, playerId, answers, next)
  return { accepted, triggeredByPlayerId: accepted ? playerId : (await loadLetterPopSession(db, sessionId)).state.triggeredByPlayerId }
}

export async function advanceLetterPopIfExpired(db: SupabaseClient, sessionId: string, now = Date.now()) {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const row = await loadLetterPopSession(db, sessionId)
    const state = row.state
    if (state.phase === 'results') return { advanced: false, state }
    let next: LetterPopPrivateState
    if (state.phase === 'validation' && !state.validationPrepared) {
      next = await prepareValidation(db, sessionId, state, now)
    } else {
      if (!state.phaseEndsAt || now < new Date(state.phaseEndsAt).getTime()) return { advanced: false, state }
      next = advanceLetterPopState(state, now)
    }
    try {
      await commitLetterPopState(db, sessionId, row.version, next)
      if (next.phase === 'validation' && !next.validationPrepared) continue
      if (next.phase === 'results') await finishSession(db, sessionId, { winner: next.winnerIds.length === 1 ? next.winnerIds[0] : null })
      return { advanced: true, state: next }
    } catch (error) {
      if (!(error instanceof ConcurrentUpdateError)) throw error
      if (attempt === 7) throw error
    }
  }
  throw new GameRuleError('Synchronisation impossible.', 'sync_conflict')
}

export async function adjudicateLetterPopAnswer(
  db: SupabaseClient,
  sessionId: string,
  actorId: string,
  input: { pendingId: string; valid: boolean },
  now = Date.now(),
) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const row = await loadLetterPopSession(db, sessionId)
    const state = row.state
    const actor = participant(state, actorId)
    const current = state.pending[0]
    if (state.phase !== 'validation' || !current || current.id !== input.pendingId) {
      throw new GameRuleError('Cette réponse a déjà été arbitrée.', 'decision_closed')
    }
    if (!actor.isHost || current.mode !== 'host' || current.playerId === actorId) {
      throw new GameRuleError('Tu ne peux pas arbitrer cette réponse.', 'decision_forbidden')
    }
    const next = resolveLetterPopDecision(state, current.id, input.valid, now)
    try {
      await commitLetterPopState(db, sessionId, row.version, next)
      await persistResults(db, sessionId, next)
      return { accepted: true, pending: next.pending.length }
    } catch (error) {
      if (!(error instanceof ConcurrentUpdateError)) throw error
      if (attempt === 4) throw error
    }
  }
  throw new GameRuleError('Arbitrage déjà traité.', 'decision_closed')
}

async function voteCounts(db: SupabaseClient, sessionId: string, roundIndex: number, pendingId: string) {
  const { data, error } = await db
    .from('letter_pop_votes')
    .select('decision')
    .eq('session_id', sessionId)
    .eq('round_index', roundIndex)
    .eq('pending_id', pendingId)
  if (error) throw error
  const decisions = (data ?? []) as { decision: boolean }[]
  return {
    total: decisions.length,
    valid: decisions.filter((vote) => vote.decision).length,
    invalid: decisions.filter((vote) => !vote.decision).length,
  }
}

export async function voteLetterPopAnswer(
  db: SupabaseClient,
  sessionId: string,
  actorId: string,
  input: { pendingId: string; valid: boolean },
  now = Date.now(),
) {
  let inserted = false
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const row = await loadLetterPopSession(db, sessionId)
    const state = row.state
    const actor = participant(state, actorId)
    const current = state.pending[0]
    if (!current || current.id !== input.pendingId) return { accepted: true, pending: state.pending.length }
    if (state.phase !== 'validation' || current.mode !== 'vote' || actor.isHost || current.playerId === actorId) {
      throw new GameRuleError('Tu ne peux pas voter sur cette réponse.', 'vote_forbidden')
    }
    if (!inserted) {
      const { error } = await db.from('letter_pop_votes').insert({
        session_id: sessionId,
        round_index: state.roundIndex,
        pending_id: current.id,
        voter_id: actorId,
        decision: input.valid,
      })
      if (error && error.code !== '23505') throw error
      inserted = true
    }
    const counts = await voteCounts(db, sessionId, state.roundIndex, current.id)
    const next = updateLetterPopVote(state, current.id, counts, state.players.length - 1, now)
    try {
      await commitLetterPopState(db, sessionId, row.version, next)
      await persistResults(db, sessionId, next)
      return { accepted: true, pending: next.pending.length }
    } catch (error) {
      if (!(error instanceof ConcurrentUpdateError)) throw error
      if (attempt === 4) throw error
    }
  }
  throw new GameRuleError('Vote déjà traité.', 'vote_closed')
}

export async function advanceLetterPopReveal(
  db: SupabaseClient,
  sessionId: string,
  actorId: string,
  now = Date.now(),
) {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const row = await loadLetterPopSession(db, sessionId)
    const actor = participant(row.state, actorId)
    if (!actor.isHost || row.state.phase !== 'reveal') throw new GameRuleError('Action indisponible.', 'advance_forbidden')
    const next = advanceLetterPopState(row.state, now)
    try {
      await commitLetterPopState(db, sessionId, row.version, next)
      return { advanced: true, phase: next.phase }
    } catch (error) {
      if (!(error instanceof ConcurrentUpdateError)) throw error
      if (attempt === 3) throw error
    }
  }
  throw new GameRuleError('La révélation a déjà avancé.', 'conflict')
}
