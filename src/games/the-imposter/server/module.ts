import type { SupabaseClient } from '@supabase/supabase-js'
import { ApiError } from '@/flexgames/core/errors'
import type { GameServerModule } from '@/flexgames/core/game-server'
import { defaultSettings, phaseDuration } from '../engine/engine'
import { validateSettings } from '../engine/roles'
import {
  advanceIfExpired,
  advancePhase,
  castVoteAction,
  markRoleRevealed,
  mrWhiteGuess,
  removePlayerFromActiveGame,
  startGame,
  submitDescription,
} from './service'
import { loadGame } from './persistence'
import {
  advancePhaseSchema,
  describeSchema,
  gameSettingsSchema,
  mrWhiteGuessSchema,
  pauseSchema,
  voteSchema,
} from '../validations'
import type { GamePlayerRow, GameRow } from '../types/db'

/**
 * Frontière serveur de The Imposter.
 *
 * La plateforme ne connaît que ce fichier : elle transmet une action nommée et
 * une charge utile JSON, validée ici par les schémas du jeu. Rien de ce qui
 * suit (rôles, mots, votes) ne remonte au core.
 */

async function gameIdForSession(db: SupabaseClient, sessionId: string): Promise<string> {
  const { data } = await db.from('games').select('id, room_id').eq('session_id', sessionId).maybeSingle()
  const row = data as { id: string; room_id: string } | null
  if (!row) throw new ApiError('Partie introuvable.', 404, 'game_not_found')
  return row.id
}

export const imposterServer: GameServerModule = {
  gameId: 'the-imposter',

  defaultConfig() {
    return defaultSettings('undercover', 6)
  },

  validateConfig(config, playerCount) {
    const parsed = gameSettingsSchema.safeParse(config)
    if (!parsed.success) {
      throw new ApiError(parsed.error.issues[0]?.message ?? 'Réglages invalides.', 422, 'invalid_settings')
    }
    const validation = validateSettings(parsed.data, playerCount)
    if (!validation.ok) throw new ApiError(validation.errors.join(' '), 422, 'invalid_settings')
  },

  async startSession({ db, room, players, sessionId, config }) {
    const settings = gameSettingsSchema.parse(config)
    // `excludeWordIds` est une option de lancement, pas un réglage de partie.
    const raw = config as { excludeWordIds?: unknown; order?: unknown }
    await startGame(db, {
      sessionId,
      roomId: room.id,
      settings,
      players,
      excludeWordIds: Array.isArray(raw.excludeWordIds)
        ? raw.excludeWordIds.filter((id): id is string => typeof id === 'string')
        : undefined,
      order: raw.order === 'as-is' ? 'as-is' : 'random',
    })
  },

  actions: {
    vote: { limit: 60, windowSeconds: 300 },
    describe: { limit: 60, windowSeconds: 300 },
    advance: { limit: 240, windowSeconds: 300 },
  },

  async handleAction(context, action) {
    const { db, actor, actorUserId, sessionId } = context
    const gameId = await gameIdForSession(db, sessionId)

    switch (action.type) {
      case 'reveal': {
        const state = await markRoleRevealed(db, gameId, actor.id)
        return { phase: state.phase }
      }

      case 'advance': {
        const { force } = advancePhaseSchema.parse(action.payload ?? {})
        const state = await advancePhase(db, gameId, {
          roomPlayerId: actor.id,
          isHost: actor.isHost,
          force: force === true,
        })
        return { phase: state.phase, round: state.round }
      }

      case 'tick': {
        const state = await advanceIfExpired(db, gameId)
        return { advanced: state !== null, phase: state?.phase ?? null }
      }

      case 'vote': {
        const { targetId } = voteSchema.parse(action.payload)
        await castVoteAction(db, gameId, actor.id, targetId, actorUserId)
        return {}
      }

      case 'describe': {
        const { body } = describeSchema.parse(action.payload)
        const state = await submitDescription(db, gameId, actor.id, body)
        return { phase: state.phase, round: state.round }
      }

      case 'mr-white-guess': {
        const { guess } = mrWhiteGuessSchema.parse(action.payload)
        const state = await mrWhiteGuess(db, gameId, actor.id, guess)
        return {
          phase: state.phase,
          winner: state.winner,
          correct: state.lastMrWhiteGuess?.correct ?? false,
        }
      }

      case 'pause': {
        if (!actor.isHost) throw new ApiError("Seul l'hôte peut mettre en pause.", 403, 'not_host')
        const { paused } = pauseSchema.parse(action.payload)
        return pauseGame(db, gameId, paused)
      }

      default:
        throw new ApiError('Action inconnue.', 400, 'unknown_action')
    }
  },

  /** Quitter en cours de partie vaut élimination : la partie doit continuer. */
  async onPlayerLeft({ db, roomId, playerId }) {
    await removePlayerFromActiveGame(db, roomId, playerId)
  },

  /**
   * Rôle et mot du joueur appelant  ·  et de lui seul.
   * C'est le seul chemin par lequel un secret quitte le serveur.
   */
  async getPrivateState({ db, sessionId, playerId }) {
    const gameId = await gameIdForSession(db, sessionId)
    const { data: gameData } = await db.from('games').select('*').eq('id', gameId).maybeSingle()
    const game = gameData as GameRow | null
    if (!game) throw new ApiError('Partie introuvable.', 404, 'game_not_found')

    const { data } = await db
      .from('game_players')
      .select('*')
      .eq('game_id', gameId)
      .eq('room_player_id', playerId)
      .maybeSingle()
    const me = data as GamePlayerRow | null

    // Le joueur a rejoint après le lancement : il est spectateur.
    if (!me) return { playerId, role: null, word: null, hint: null, spectator: true }

    return {
      playerId,
      role: me.role,
      word: me.word,
      hint: me.hint,
      hasSeenRole: me.has_seen_role,
      spectator: false,
      // Mr. White doit savoir que c'est à lui de deviner. Le mot des civils, en
      // revanche, n'est jamais envoyé avant la fin.
      isPendingMrWhite: game.pending_mr_white_id === playerId,
    }
  },
}

/** Pause/reprise : à la reprise, le minuteur de la phase repart en entier. */
async function pauseGame(db: SupabaseClient, gameId: string, paused: boolean) {
  const { state, row } = await loadGame(db, gameId)
  const duration = phaseDuration(state)

  const { error } = await db
    .from('games')
    .update({
      is_paused: paused,
      phase_ends_at:
        paused || duration <= 0 ? null : new Date(Date.now() + duration * 1000).toISOString(),
      version: row.version + 1,
    })
    .eq('id', gameId)
    .eq('version', row.version)
  if (error) throw error
  return { paused }
}
