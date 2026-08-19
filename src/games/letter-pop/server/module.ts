import type { GameServerModule } from '@/flexgames/core/game-server'
import { ApiError } from '@/flexgames/core/errors'
import { createLetterPopState, toPublicLetterPopState } from '../engine/state-machine'
import type { LetterPopAnswerRow, LetterPopConfig, LetterPopPlayerPrivateView } from '../types'
import {
  letterPopAdvanceSchema,
  letterPopConfigSchema,
  letterPopDecisionSchema,
  letterPopFinishSchema,
  letterPopSaveSchema,
  letterPopTickSchema,
} from '../validations'
import { DEFAULT_LETTER_POP_CONFIG } from '../client'
import { loadLetterPopSession } from './persistence'
import {
  adjudicateLetterPopAnswer,
  advanceLetterPopIfExpired,
  advanceLetterPopReveal,
  finishLetterPopAnswers,
  saveLetterPopSnapshot,
  voteLetterPopAnswer,
} from './service'

export const letterPopServer: GameServerModule = {
  gameId: 'letter-pop',

  defaultConfig: () => DEFAULT_LETTER_POP_CONFIG,

  validateConfig(config, playerCount) {
    const parsed = letterPopConfigSchema.safeParse(config)
    if (!parsed.success) throw new ApiError(parsed.error.issues[0]?.message ?? 'Réglages LetterPop invalides.', 422)
    if (playerCount < 2 || playerCount > 12) throw new ApiError('LetterPop! se joue de 2 à 12 joueurs.', 422)
  },

  async startSession({ db, room, players, sessionId, config }) {
    const parsed = letterPopConfigSchema.parse(config) as LetterPopConfig
    const state = createLetterPopState(players, parsed, `${sessionId}:${room.id}`, Date.now())
    const { error } = await db.from('letter_pop_sessions').insert({
      session_id: sessionId,
      room_id: room.id,
      state,
      version: 1,
    })
    if (error) throw error
    const { error: publishError } = await db
      .from('game_sessions')
      .update({ state: toPublicLetterPopState(state), version: 1 })
      .eq('id', sessionId)
    if (publishError) throw publishError
  },

  actions: {
    save: { limit: 160, windowSeconds: 60 },
    finish: { limit: 12, windowSeconds: 60 },
    tick: { limit: 240, windowSeconds: 300 },
    adjudicate: { limit: 80, windowSeconds: 300 },
    vote: { limit: 80, windowSeconds: 300 },
    advance: { limit: 80, windowSeconds: 300 },
  },

  async handleAction({ db, actor, sessionId }, action) {
    if (action.type === 'save') {
      return saveLetterPopSnapshot(db, sessionId, actor.id, letterPopSaveSchema.parse(action.payload))
    }
    if (action.type === 'finish') {
      return finishLetterPopAnswers(db, sessionId, actor.id, letterPopFinishSchema.parse(action.payload))
    }
    if (action.type === 'tick') {
      letterPopTickSchema.parse(action.payload ?? {})
      const result = await advanceLetterPopIfExpired(db, sessionId)
      return { advanced: result.advanced, phase: result.state.phase }
    }
    if (action.type === 'adjudicate') {
      return adjudicateLetterPopAnswer(db, sessionId, actor.id, letterPopDecisionSchema.parse(action.payload))
    }
    if (action.type === 'vote') {
      return voteLetterPopAnswer(db, sessionId, actor.id, letterPopDecisionSchema.parse(action.payload))
    }
    if (action.type === 'advance') {
      letterPopAdvanceSchema.parse(action.payload ?? {})
      return advanceLetterPopReveal(db, sessionId, actor.id)
    }
    throw new ApiError('Action LetterPop inconnue.', 400, 'unknown_action')
  },

  async getPrivateState({ db, sessionId, playerId }) {
    const { state } = await loadLetterPopSession(db, sessionId)
    const player = state.players.find((candidate) => candidate.id === playerId)
    const { data, error } = await db
      .from('letter_pop_answers')
      .select('*')
      .eq('session_id', sessionId)
      .eq('round_index', state.roundIndex)
      .eq('room_player_id', playerId)
      .maybeSingle()
    if (error) throw error
    const row = data as LetterPopAnswerRow | null
    const pending = state.pending[0]
    const eligible = Boolean(player && pending && (
      (pending.mode === 'host' && player.isHost && pending.playerId !== playerId)
      || (pending.mode === 'vote' && !player.isHost && pending.playerId !== playerId)
    ))
    let hasVoted = false
    if (eligible && pending?.mode === 'vote') {
      const { data: vote, error: voteError } = await db
        .from('letter_pop_votes')
        .select('voter_id')
        .eq('session_id', sessionId)
        .eq('round_index', state.roundIndex)
        .eq('pending_id', pending.id)
        .eq('voter_id', playerId)
        .maybeSingle()
      if (voteError) throw voteError
      hasVoted = vote != null
    }
    const locked = state.phase === 'answering'
      ? row?.locked_at != null
      : state.phase === 'final_countdown'
        ? state.triggeredByPlayerId === playerId || row?.locked_at != null
        : true
    const round = state.rounds[state.roundIndex]
    const result: LetterPopPlayerPrivateView = {
      playerId,
      roundIndex: state.roundIndex,
      spectator: !player,
      answers: row?.answers ?? {},
      locked,
      savedAt: row?.updated_at ?? null,
      adjudication: eligible && pending && round ? {
        id: pending.id,
        categoryId: pending.categoryId,
        letter: round.letter,
        playerName: pending.playerName,
        answer: pending.original,
        mode: pending.mode,
        voteCount: pending.voteCount,
        votersTotal: pending.mode === 'vote' ? Math.max(0, state.players.length - 1) : 0,
        hasVoted,
      } : null,
    }
    return result
  },
}
