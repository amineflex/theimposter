import type { SupabaseClient } from '@supabase/supabase-js'
import { ConcurrentUpdateError, GameRuleError, NotFoundError } from '@/flexgames/core/errors'
import type {
  LetterPopAnswerRow,
  LetterPopCategoryId,
  LetterPopEvaluatedAnswer,
  LetterPopPrivateState,
} from '../types'
import { toPublicLetterPopState } from '../engine/state-machine'

export interface LetterPopSessionRow {
  session_id: string
  room_id: string
  state: LetterPopPrivateState
  version: number
}

export async function loadLetterPopSession(db: SupabaseClient, sessionId: string): Promise<LetterPopSessionRow> {
  const { data, error } = await db.from('letter_pop_sessions').select('*').eq('session_id', sessionId).maybeSingle()
  if (error) throw error
  if (!data) throw new NotFoundError('Partie LetterPop introuvable.', 'letter_pop_session_not_found')
  return data as LetterPopSessionRow
}

export async function commitLetterPopState(
  db: SupabaseClient,
  sessionId: string,
  expectedVersion: number,
  state: LetterPopPrivateState,
): Promise<number> {
  const { data, error } = await db.rpc('letter_pop_commit_state', {
    p_session_id: sessionId,
    p_expected_version: expectedVersion,
    p_private_state: state,
    p_public_state: toPublicLetterPopState(state),
  })
  if (error) throw error
  if (data !== true) throw new ConcurrentUpdateError()
  return expectedVersion + 1
}

export async function saveLetterPopAnswers(
  db: SupabaseClient,
  sessionId: string,
  roundIndex: number,
  playerId: string,
  answers: Partial<Record<LetterPopCategoryId, string>>,
): Promise<void> {
  const { data, error } = await db.rpc('letter_pop_save_answers', {
    p_session_id: sessionId,
    p_round_index: roundIndex,
    p_player_id: playerId,
    p_answers: answers,
  })
  if (error) throw error
  if (data !== true) throw new GameRuleError('Tes réponses sont déjà verrouillées.', 'answers_locked')
}

export async function triggerLetterPopFinish(
  db: SupabaseClient,
  sessionId: string,
  expectedVersion: number,
  roundIndex: number,
  playerId: string,
  answers: Partial<Record<LetterPopCategoryId, string>>,
  state: LetterPopPrivateState,
): Promise<boolean> {
  const { data, error } = await db.rpc('letter_pop_trigger_finish', {
    p_session_id: sessionId,
    p_expected_version: expectedVersion,
    p_round_index: roundIndex,
    p_player_id: playerId,
    p_answers: answers,
    p_private_state: state,
    p_public_state: toPublicLetterPopState(state),
  })
  if (error) throw error
  return data === true
}

export async function loadLetterPopAnswers(
  db: SupabaseClient,
  sessionId: string,
  roundIndex: number,
): Promise<LetterPopAnswerRow[]> {
  const { data, error } = await db
    .from('letter_pop_answers')
    .select('*')
    .eq('session_id', sessionId)
    .eq('round_index', roundIndex)
  if (error) throw error
  return (data ?? []) as LetterPopAnswerRow[]
}

export async function persistLetterPopEvaluations(
  db: SupabaseClient,
  sessionId: string,
  roundIndex: number,
  rows: Array<{
    playerId: string
    answers: Partial<Record<LetterPopCategoryId, string>>
    evaluations: Partial<Record<LetterPopCategoryId, LetterPopEvaluatedAnswer>>
  }>,
): Promise<void> {
  const { error } = await db.from('letter_pop_answers').upsert(rows.map((row) => ({
    session_id: sessionId,
    round_index: roundIndex,
    room_player_id: row.playerId,
    answers: row.answers,
    evaluations: row.evaluations,
    locked_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  })), { onConflict: 'session_id,round_index,room_player_id' })
  if (error) throw error
}
