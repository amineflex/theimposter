import type { SupabaseClient } from '@supabase/supabase-js'
import { ConcurrentUpdateError, GameRuleError } from '@/flexgames/core/errors'
import { finishSession } from '@/flexgames/session/session-service'
import type { GeoPrivateState, GeoStoredAnswer } from '../types'
import { isAcceptedAnswer, scoreGeoAnswer } from '../engine/scoring'
import { advanceGeoAfterReveal, closeGeoQuestion, openGeoQuestion } from '../engine/state-machine'
import { commitGeoState, loadGeoSession } from './persistence'

async function roundAnswers(db: SupabaseClient, sessionId: string, roundIndex: number): Promise<GeoStoredAnswer[]> {
  const { data, error } = await db
    .from('geo_answers')
    .select('room_player_id, submitted_answer, is_correct, response_ms, score, streak')
    .eq('session_id', sessionId)
    .eq('round_index', roundIndex)
  if (error) throw error
  return (data ?? []) as GeoStoredAnswer[]
}

async function advanceState(db: SupabaseClient, state: GeoPrivateState, sessionId: string, now: number) {
  switch (state.phase) {
    case 'countdown':
      return openGeoQuestion(state, now)
    case 'question':
      return closeGeoQuestion(state, await roundAnswers(db, sessionId, state.roundIndex), now)
    case 'reveal':
      return advanceGeoAfterReveal(state, now)
    case 'leaderboard':
      return openGeoQuestion(state, now, state.roundIndex + 1)
    case 'results':
      return state
  }
}

export async function advanceGeoIfExpired(db: SupabaseClient, sessionId: string, now = Date.now()) {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const row = await loadGeoSession(db, sessionId)
    if (row.state.phase === 'results' || !row.state.phaseEndsAt) return { advanced: false, state: row.state }
    if (now < new Date(row.state.phaseEndsAt).getTime()) return { advanced: false, state: row.state }
    const next = await advanceState(db, row.state, sessionId, now)
    try {
      await commitGeoState(db, sessionId, row.version, next)
      if (next.phase === 'results') {
        await finishSession(db, sessionId, { winner: next.winnerId })
      }
      return { advanced: true, state: next }
    } catch (error) {
      if (!(error instanceof ConcurrentUpdateError)) throw error
      if (attempt === 3) throw error
    }
  }
  throw new GameRuleError('La partie a déjà avancé, réessaie.', 'conflict')
}

async function synchronizeAnswerCount(db: SupabaseClient, sessionId: string, now: number) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const row = await loadGeoSession(db, sessionId)
    if (row.state.phase !== 'question') return row.state
    const answers = await roundAnswers(db, sessionId, row.state.roundIndex)
    const next = answers.length >= row.state.totalPlayers
      ? closeGeoQuestion(row.state, answers, now)
      : { ...row.state, responseCount: answers.length }
    try {
      await commitGeoState(db, sessionId, row.version, next)
      return next
    } catch (error) {
      if (!(error instanceof ConcurrentUpdateError)) throw error
      if (attempt === 4) throw new GameRuleError('Réponse enregistrée, synchronisation en cours.', 'sync_conflict')
    }
  }
  throw new GameRuleError('Synchronisation impossible.', 'sync_conflict')
}

export async function submitGeoAnswer(
  db: SupabaseClient,
  sessionId: string,
  playerId: string,
  input: { roundIndex: number; answer: string },
  now = Date.now(),
) {
  const row = await loadGeoSession(db, sessionId)
  const state = row.state
  if (state.phase !== 'question' || input.roundIndex !== state.roundIndex) {
    throw new GameRuleError('Cette question est déjà terminée.', 'round_closed')
  }
  if (state.phaseEndsAt && now > new Date(state.phaseEndsAt).getTime()) {
    await advanceGeoIfExpired(db, sessionId, now)
    throw new GameRuleError('Temps écoulé.', 'time_up')
  }
  const player = state.players.find((candidate) => candidate.id === playerId)
  if (!player) throw new GameRuleError('Tu observes cette partie en spectateur.', 'spectator')
  const question = state.questions[state.roundIndex]
  if (!question) throw new GameRuleError('Question introuvable.', 'question_not_found')

  const responseMs = Math.max(0, now - new Date(state.phaseStartedAt).getTime())
  const correct = isAcceptedAnswer(input.answer, question.acceptedAnswers)
  const streak = correct ? player.streak + 1 : 0
  const score = correct ? scoreGeoAnswer(responseMs, state.config.durationSeconds, streak) : 0
  const { error } = await db.from('geo_answers').insert({
    session_id: sessionId,
    round_index: state.roundIndex,
    room_player_id: playerId,
    submitted_answer: input.answer,
    is_correct: correct,
    response_ms: responseMs,
    score,
    streak,
  })
  if (error && error.code !== '23505') throw error

  await synchronizeAnswerCount(db, sessionId, now)
  return { accepted: error == null, duplicate: error?.code === '23505' }
}
