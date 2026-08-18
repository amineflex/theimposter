import type { GameServerModule } from '@/flexgames/core/game-server'
import { ApiError } from '@/flexgames/core/errors'
import { createGeoState, toPublicGeoState } from '../engine/state-machine'
import type { GeoConfig } from '../types'
import { geoConfigSchema, geoSubmitSchema, geoTickSchema } from '../validations'
import { advanceGeoIfExpired, submitGeoAnswer } from './service'

export const DEFAULT_GEO_CONFIG: GeoConfig = {
  questionCount: 15,
  durationSeconds: 15,
  difficulty: 'normal',
  region: 'world',
}

export const geoRushServer: GameServerModule = {
  gameId: 'geo-rush',

  defaultConfig: () => DEFAULT_GEO_CONFIG,

  validateConfig(config, playerCount) {
    const parsed = geoConfigSchema.safeParse(config)
    if (!parsed.success) throw new ApiError(parsed.error.issues[0]?.message ?? 'Réglages invalides.', 422)
    if (playerCount < 2 || playerCount > 12) throw new ApiError('GeoRush se joue de 2 à 12 joueurs.', 422)
  },

  async startSession({ db, room, players, sessionId, config }) {
    const parsed = geoConfigSchema.parse(config)
    const state = createGeoState(players, parsed, `${sessionId}:${room.id}`, Date.now())
    const { error } = await db.from('geo_sessions').insert({
      session_id: sessionId,
      room_id: room.id,
      state,
      version: 1,
    })
    if (error) throw error
    const { error: publishError } = await db
      .from('game_sessions')
      .update({ state: toPublicGeoState(state), version: 1 })
      .eq('id', sessionId)
    if (publishError) throw publishError
  },

  actions: {
    submit: { limit: 40, windowSeconds: 60 },
    tick: { limit: 180, windowSeconds: 300 },
  },

  async handleAction({ db, actor, sessionId }, action) {
    if (action.type === 'submit') {
      return submitGeoAnswer(db, sessionId, actor.id, geoSubmitSchema.parse(action.payload))
    }
    if (action.type === 'tick') {
      geoTickSchema.parse(action.payload ?? {})
      const result = await advanceGeoIfExpired(db, sessionId)
      return { advanced: result.advanced, phase: result.state.phase }
    }
    throw new ApiError('Action GeoRush inconnue.', 400, 'unknown_action')
  },

  async getPrivateState({ db, sessionId, playerId }) {
    const { data: participant } = await db
      .from('geo_sessions')
      .select('state')
      .eq('session_id', sessionId)
      .maybeSingle()
    const state = (participant as { state: { roundIndex?: number; players?: { id: string }[] } } | null)?.state
    const spectator = !state?.players?.some((player) => player.id === playerId)
    const { data: answer } = await db
      .from('geo_answers')
      .select('round_index')
      .eq('session_id', sessionId)
      .eq('room_player_id', playerId)
      .eq('round_index', state?.roundIndex ?? -1)
      .maybeSingle()
    return { playerId, submittedRound: answer?.round_index ?? null, spectator }
  },
}
