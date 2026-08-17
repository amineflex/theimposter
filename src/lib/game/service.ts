import type { SupabaseClient } from '@supabase/supabase-js'
import {
  advanceSpeaker,
  applyVoteResult,
  autoAdvance,
  beginDiscussion,
  closeVoting,
  createGame,
  markRoleSeen,
  phaseDuration,
  removePlayer,
  resolveElimination,
  skipMrWhiteGuess,
  submitMrWhiteGuess,
  allRolesSeen,
  allVotesIn,
} from '@/lib/game-engine/engine'
import { validateSettings } from '@/lib/game-engine/roles'
import type { GameSettings, GameState } from '@/lib/game-engine/types'
import { ApiError, trackEvent } from '@/lib/api/http'
import {
  ConcurrentUpdateError,
  isPhaseExpired,
  loadGame,
  saveGame,
  syncPlayerStatus,
} from './persistence'
import { recentWordIdsForRoom, resolveWordSet } from './word-repository'
import type { GameRow, RoomPlayerRow, RoomRow } from '@/types/db'

/**
 * Logique de partie côté serveur. C'est la seule autorité du mode en ligne :
 * chaque action recharge l'état depuis la base, applique le moteur, puis écrit
 * le résultat avec un verrou optimiste.
 */

export interface StartGameResult {
  gameId: string
}

/** Lance une partie depuis le lobby. Réservé à l'hôte (vérifié en amont). */
export async function startGame(
  admin: SupabaseClient,
  room: RoomRow,
  options: { excludeWordIds?: string[]; order?: 'random' | 'as-is' } = {},
): Promise<StartGameResult> {
  const { data: playerRows } = await admin
    .from('room_players')
    .select('*')
    .eq('room_id', room.id)
    .eq('is_present', true)
    .order('joined_at', { ascending: true })
  const players = (playerRows ?? []) as RoomPlayerRow[]

  const validation = validateSettings(room.settings, players.length)
  if (!validation.ok) throw new ApiError(validation.errors.join(' '), 422, 'invalid_settings')

  // Une seule partie active par room.
  const { data: activeGame } = await admin
    .from('games')
    .select('id')
    .eq('room_id', room.id)
    .is('finished_at', null)
    .maybeSingle()
  if (activeGame) {
    throw new ApiError('Une partie est déjà en cours dans cette room.', 409, 'game_in_progress')
  }

  const roomRecent = await recentWordIdsForRoom(admin, room.id)
  const words = await resolveWordSet(admin, room.settings, {
    excludeIds: [...roomRecent, ...(options.excludeWordIds ?? [])],
  })

  const state = createGame({
    players: players.map((p) => ({ id: p.id, name: p.name })),
    settings: room.settings,
    words,
    recentSpecialCounts: Object.fromEntries(players.map((p) => [p.id, p.recent_special_count])),
    order: options.order ?? 'random',
  })

  const duration = phaseDuration(state)
  const { data: inserted, error: insertError } = await admin
    .from('games')
    .insert({
      room_id: room.id,
      mode: state.mode,
      settings: state.settings,
      phase: state.phase,
      round: state.round,
      description_pass: state.descriptionPass,
      speaking_order: state.speakingOrder,
      current_speaker_index: state.currentSpeakerIndex,
      base_order: state.baseOrder,
      first_speaker_offset: state.firstSpeakerOffset,
      word_source_id: words.sourceId,
      civilian_word: words.civilianWord,
      undercover_word: words.undercoverWord,
      impostor_hint: words.impostorHint,
      accepted_answers: words.acceptedAnswers,
      word_category: words.category,
      word_difficulty: words.difficulty,
      phase_ends_at: duration > 0 ? new Date(Date.now() + duration * 1000).toISOString() : null,
    })
    .select('id')
    .single()
  if (insertError || !inserted) throw insertError ?? new Error('Création de la partie impossible.')

  const gameId = (inserted as { id: string }).id

  // Rôles et mots secrets : une ligne par joueur, jamais lisible par les autres.
  const { error: playersError } = await admin.from('game_players').insert(
    state.players.map((player) => {
      const roomPlayer = players.find((p) => p.id === player.id)
      return {
        game_id: gameId,
        room_player_id: player.id,
        user_id: roomPlayer?.user_id,
        role: player.role,
        word: player.word,
        hint: player.hint,
      }
    }),
  )
  if (playersError) throw playersError

  await syncPlayerStatus(admin, gameId, state)

  // Équité du rematch : +1 pour ceux qui ont eu un rôle spécial, remise à 0
  // (décrément) pour les autres, afin que l'historique ne s'accumule pas.
  const specialIds = state.players.filter((p) => p.role !== 'civilian').map((p) => p.id)
  const civilianIds = state.players.filter((p) => p.role === 'civilian').map((p) => p.id)
  if (specialIds.length > 0) {
    await Promise.all(
      specialIds.map((id) => {
        const current = players.find((p) => p.id === id)?.recent_special_count ?? 0
        return admin
          .from('room_players')
          .update({ recent_special_count: Math.min(current + 1, 3) })
          .eq('id', id)
      }),
    )
  }
  if (civilianIds.length > 0) {
    await Promise.all(
      civilianIds.map((id) => {
        const current = players.find((p) => p.id === id)?.recent_special_count ?? 0
        return admin
          .from('room_players')
          .update({ recent_special_count: Math.max(current - 1, 0) })
          .eq('id', id)
      }),
    )
  }

  await admin
    .from('rooms')
    .update({ status: 'in_game', last_activity_at: new Date().toISOString() })
    .eq('id', room.id)

  await trackEvent({
    event: 'game_started',
    roomId: room.id,
    gameId,
    mode: state.mode,
    playerCount: players.length,
    packs: room.settings.packs.length > 0 ? room.settings.packs : ['tous'],
    difficulty: room.settings.difficulty,
  })

  return { gameId }
}

/** Le joueur a consulté sa carte de rôle. */
export async function markRoleRevealed(
  admin: SupabaseClient,
  gameId: string,
  roomPlayerId: string,
): Promise<GameState> {
  const { state, row } = await loadGame(admin, gameId)
  if (state.phase !== 'role_reveal') return state

  const next = markRoleSeen(state, roomPlayerId)
  if (allRolesSeen(next)) {
    // Tout le monde a vu son rôle : la discussion démarre immédiatement.
    const discussion = beginDiscussion(next)
    await saveGame(admin, gameId, row.version, discussion)
    return discussion
  }
  // Pas de transition : on met juste à jour l'état public du joueur.
  await syncPlayerStatus(admin, gameId, next)
  return next
}

/** Enregistre un vote, puis ferme le scrutin si tout le monde a voté. */
export async function castVoteAction(
  admin: SupabaseClient,
  gameId: string,
  voterId: string,
  targetId: string,
  userId: string,
): Promise<void> {
  const { state, row } = await loadGame(admin, gameId)
  if (state.phase !== 'voting') {
    throw new ApiError("Le vote n'est pas ouvert.", 409, 'phase')
  }
  if (row.is_paused) throw new ApiError('La partie est en pause.', 409, 'paused')

  const voter = state.players.find((p) => p.id === voterId)
  if (!voter?.isAlive) {
    throw new ApiError('Les joueurs éliminés ne votent pas.', 403, 'eliminated')
  }
  if (voterId === targetId) {
    throw new ApiError('Vous ne pouvez pas voter pour vous-même.', 400, 'self_vote')
  }
  const target = state.players.find((p) => p.id === targetId)
  if (!target?.isAlive) throw new ApiError('Ce joueur ne peut pas être voté.', 400, 'invalid_target')
  if (state.runoffCandidates && !state.runoffCandidates.includes(targetId)) {
    throw new ApiError('Ce joueur ne fait pas partie du vote de barrage.', 400, 'invalid_target')
  }

  // L'index unique (game_id, round, runoff, voter_id) empêche le double vote,
  // y compris si deux requêtes arrivent simultanément.
  const { error } = await admin.from('votes').insert({
    game_id: gameId,
    round: state.round,
    runoff: state.runoffCount,
    voter_id: voterId,
    target_id: targetId,
    user_id: userId,
  })
  if (error) {
    if (error.code === '23505' || error.code === '23P01' || error.code === '23514') {
      throw new ApiError('Vous avez déjà voté.', 409, 'already_voted')
    }
    if (error.code === '23000' || error.message.includes('duplicate key')) {
      throw new ApiError('Vous avez déjà voté.', 409, 'already_voted')
    }
    throw error
  }

  const reloaded = await loadGame(admin, gameId)
  await syncPlayerStatus(admin, gameId, reloaded.state)

  if (allVotesIn(reloaded.state)) {
    try {
      await saveGame(admin, gameId, reloaded.row.version, closeVoting(reloaded.state))
    } catch (closeError) {
      // Un autre client a fermé le scrutin au même instant : sans conséquence.
      if (!(closeError instanceof ConcurrentUpdateError)) throw closeError
    }
  }
}

/**
 * Fait avancer la partie. Autorisé si :
 *  - le minuteur de la phase est écoulé (n'importe quel client peut déclencher),
 *  - ou l'hôte force le passage,
 *  - ou la phase est une phase d'affichage automatique (résultat, élimination),
 *  - ou c'est l'orateur courant qui termine son tour de parole.
 */
export async function advancePhase(
  admin: SupabaseClient,
  gameId: string,
  actor: { roomPlayerId: string; isHost: boolean; force: boolean },
): Promise<GameState> {
  const { state, row } = await loadGame(admin, gameId)
  if (row.is_paused && !actor.force) throw new ApiError('La partie est en pause.', 409, 'paused')
  if (state.phase === 'results') return state

  const expired = isPhaseExpired(row)
  const isDisplayPhase = state.phase === 'vote_result' || state.phase === 'elimination'
  const isCurrentSpeaker =
    state.phase === 'discussion' &&
    state.speakingOrder[state.currentSpeakerIndex] === actor.roomPlayerId

  if (!expired && !isDisplayPhase && !isCurrentSpeaker && !(actor.isHost && actor.force)) {
    throw new ApiError("Ce n'est pas encore le moment de passer à l'étape suivante.", 409, 'too_early')
  }

  const next = nextState(state)
  if (!next) return state

  await saveGame(admin, gameId, row.version, next)
  if (next.phase === 'results') await finalizeGame(admin, gameId, next)
  return next
}

function nextState(state: GameState): GameState | null {
  switch (state.phase) {
    case 'role_reveal':
      return beginDiscussion(state)
    case 'discussion':
      return advanceSpeaker(state)
    case 'voting':
      return closeVoting(state)
    case 'vote_result':
      return applyVoteResult(state)
    case 'elimination':
      return resolveElimination(state)
    case 'mr_white_guess':
      return skipMrWhiteGuess(state)
    default:
      return autoAdvance(state)
  }
}

/** Devinette finale de Mr. White. */
export async function mrWhiteGuess(
  admin: SupabaseClient,
  gameId: string,
  roomPlayerId: string,
  guess: string,
): Promise<GameState> {
  const { state, row } = await loadGame(admin, gameId)
  if (state.phase !== 'mr_white_guess') {
    throw new ApiError("Ce n'est plus le moment de deviner.", 409, 'phase')
  }
  if (state.pendingMrWhiteId !== roomPlayerId) {
    throw new ApiError("Vous n'êtes pas concerné par cette étape.", 403, 'not_mr_white')
  }
  const next = submitMrWhiteGuess(state, roomPlayerId, guess)
  await saveGame(admin, gameId, row.version, next)
  if (next.phase === 'results') await finalizeGame(admin, gameId, next)
  return next
}

/** Retire un joueur d'une partie en cours (départ définitif ou exclusion). */
export async function removePlayerFromActiveGame(
  admin: SupabaseClient,
  roomId: string,
  roomPlayerId: string,
): Promise<void> {
  const { data } = await admin
    .from('games')
    .select('id')
    .eq('room_id', roomId)
    .is('finished_at', null)
    .maybeSingle()
  const gameId = (data as { id: string } | null)?.id
  if (!gameId) return

  const { state, row } = await loadGame(admin, gameId)
  const next = removePlayer(state, roomPlayerId)
  if (next === state) return
  await saveGame(admin, gameId, row.version, next)
  if (next.phase === 'results') await finalizeGame(admin, gameId, next)
}

/** Écrit les statistiques de fin de partie (agrégats anonymes). */
async function finalizeGame(admin: SupabaseClient, gameId: string, state: GameState): Promise<void> {
  const { data } = await admin
    .from('games')
    .select('room_id, started_at, finished_at')
    .eq('id', gameId)
    .maybeSingle()
  const row = data as Pick<GameRow, 'room_id' | 'started_at' | 'finished_at'> | null
  if (!row) return

  const duration = row.finished_at
    ? Math.round((new Date(row.finished_at).getTime() - new Date(row.started_at).getTime()) / 1000)
    : null

  await trackEvent({
    event: 'game_finished',
    roomId: row.room_id,
    gameId,
    mode: state.mode,
    playerCount: state.players.length,
    durationSeconds: duration,
    packs: state.settings.packs.length > 0 ? state.settings.packs : ['tous'],
    difficulty: state.settings.difficulty,
    winner: state.winner,
  })
}

/** Applique le minuteur écoulé sans action de joueur (protection AFK). */
export async function advanceIfExpired(admin: SupabaseClient, gameId: string): Promise<GameState | null> {
  const { state, row } = await loadGame(admin, gameId)
  if (!isPhaseExpired(row) || state.phase === 'results') return null
  const next = nextState(state)
  if (!next) return null
  try {
    await saveGame(admin, gameId, row.version, next)
  } catch (error) {
    if (error instanceof ConcurrentUpdateError) return null
    throw error
  }
  if (next.phase === 'results') await finalizeGame(admin, gameId, next)
  return next
}

/** Vérifie qu'une configuration reste jouable avec le nombre de joueurs actuel. */
export function assertPlayableSettings(settings: GameSettings, playerCount: number): void {
  const validation = validateSettings(settings, playerCount)
  if (!validation.ok) throw new ApiError(validation.errors.join(' '), 422, 'invalid_settings')
}
