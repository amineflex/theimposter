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
} from '@/games/the-imposter/engine/engine'
import { validateSettings } from '@/games/the-imposter/engine/roles'
import type { GameSettings, GameState } from '@/games/the-imposter/engine/types'
import { ApiError, touchRoom, trackEvent } from '@/flexgames/core/api/http'
import {
  ConcurrentUpdateError,
  isPhaseExpired,
  loadGame,
  saveGame,
  syncPlayerStatus,
} from './persistence'
import { containsSecret } from './description-guard'
import { finishSession } from '@/flexgames/session/session-service'
import { recentWordIdsForRoom, resolveWordSet } from './word-repository'
import type { GameRow } from '../types/db'
import type { Player } from '@/flexgames/core/types'

/**
 * Logique de partie côté serveur. C'est la seule autorité du mode en ligne :
 * chaque action recharge l'état depuis la base, applique le moteur, puis écrit
 * le résultat avec un verrou optimiste.
 */

export interface StartGameInput {
  sessionId: string
  roomId: string
  settings: GameSettings
  players: Player[]
  excludeWordIds?: string[]
  order?: 'random' | 'as-is'
}

/**
 * Installe une partie The Imposter pour une session FlexGames.
 *
 * Appelé par le module serveur du jeu : la plateforme a déjà vérifié l'hôte,
 * l'effectif et créé la session. Ici, on ne fait que du jeu.
 */
export async function startGame(admin: SupabaseClient, input: StartGameInput): Promise<{ gameId: string }> {
  const { sessionId, roomId, settings, players } = input

  const validation = validateSettings(settings, players.length)
  if (!validation.ok) throw new ApiError(validation.errors.join(' '), 422, 'invalid_settings')

  const roomRecent = await recentWordIdsForRoom(admin, roomId)
  const words = await resolveWordSet(admin, settings, {
    excludeIds: [...roomRecent, ...(input.excludeWordIds ?? [])],
  })

  const { data: playerRows } = await admin
    .from('room_players')
    .select('id, user_id, recent_special_count')
    .in('id', players.map((player) => player.id))
  const roomPlayers = (playerRows ?? []) as {
    id: string
    user_id: string
    recent_special_count: number
  }[]

  const state = createGame({
    players: players.map((player) => ({ id: player.id, name: player.nickname })),
    settings,
    words,
    recentSpecialCounts: Object.fromEntries(
      roomPlayers.map((player) => [player.id, player.recent_special_count]),
    ),
    order: input.order ?? 'random',
  })

  const duration = phaseDuration(state)
  const { data: inserted, error: insertError } = await admin
    .from('games')
    .insert({
      session_id: sessionId,
      room_id: roomId,
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
    state.players.map((player) => ({
      game_id: gameId,
      room_player_id: player.id,
      user_id: roomPlayers.find((p) => p.id === player.id)?.user_id,
      role: player.role,
      word: player.word,
      hint: player.hint,
    })),
  )
  if (playersError) throw playersError

  await syncPlayerStatus(admin, gameId, state)

  // Équité du rematch : +1 pour ceux qui ont eu un rôle spécial, décrément pour
  // les autres, afin que l'historique ne s'accumule pas.
  await Promise.all(
    state.players.map((player) => {
      const current = roomPlayers.find((p) => p.id === player.id)?.recent_special_count ?? 0
      const next =
        player.role !== 'civilian' ? Math.min(current + 1, 3) : Math.max(current - 1, 0)
      return admin.from('room_players').update({ recent_special_count: next }).eq('id', player.id)
    }),
  )

  await trackEvent({
    event: 'imposter_game_started',
    roomId,
    gameKey: 'the-imposter',
    sessionId,
    playerCount: players.length,
    meta: {
      mode: state.mode,
      packs: settings.packs.length > 0 ? settings.packs : ['tous'],
      difficulty: settings.difficulty,
    },
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

/**
 * Enregistre la description écrite d'un joueur, puis passe la parole.
 *
 * Règles appliquées côté serveur :
 *  - la phase doit être la discussion, et la partie ne doit pas être en pause ;
 *  - en tours de description, seul l'orateur courant peut écrire ; en discussion
 *   libre, tout joueur vivant peut écrire une fois par passe ;
 *  - un joueur ne peut pas écrire SON PROPRE MOT (protection contre la fuite
 *    involontaire) ;
 *  - l'index unique en base empêche le double envoi.
 */
export async function submitDescription(
  admin: SupabaseClient,
  gameId: string,
  roomPlayerId: string,
  body: string,
): Promise<GameState> {
  const { state, row } = await loadGame(admin, gameId)

  if (state.phase !== 'discussion') {
    throw new ApiError("Ce n'est pas la phase de description.", 409, 'phase')
  }
  if (row.is_paused) throw new ApiError('La partie est en pause.', 409, 'paused')

  const author = state.players.find((player) => player.id === roomPlayerId)
  if (!author?.isAlive) {
    throw new ApiError('Les joueurs éliminés ne décrivent plus.', 403, 'eliminated')
  }

  const freeDiscussion = state.settings.descriptionRounds === 'free'
  if (!freeDiscussion && state.speakingOrder[state.currentSpeakerIndex] !== roomPlayerId) {
    throw new ApiError("Ce n'est pas votre tour de parole.", 409, 'not_your_turn')
  }

  // Le joueur ne doit pas écrire son propre mot (ni l'indice de l'imposteur).
  const secret = author.word ?? author.hint
  if (secret && containsSecret(body, secret)) {
    throw new ApiError('Vous ne pouvez pas écrire votre propre mot !', 422, 'word_leak')
  }

  const { error } = await admin.from('game_descriptions').insert({
    game_id: gameId,
    room_player_id: roomPlayerId,
    round: state.round,
    pass: state.descriptionPass,
    body,
  })
  if (error) {
    if (error.code === '23505') {
      throw new ApiError('Vous avez déjà décrit votre mot pour ce tour.', 409, 'already_described')
    }
    throw error
  }

  await touchRoom(row.room_id)

  /*
   * Tours de description : la parole passe au joueur suivant.
   * Discussion libre : on n'avance que lorsque tout le monde a écrit.
   */
  if (!freeDiscussion) {
    const next = advanceSpeaker(state)
    try {
      await saveGame(admin, gameId, row.version, next)
    } catch (saveError) {
      // Un minuteur a déjà fait avancer la partie : la description est conservée.
      if (!(saveError instanceof ConcurrentUpdateError)) throw saveError
    }
    return next
  }

  const alive = state.players.filter((player) => player.isAlive).map((player) => player.id)
  const { data: written } = await admin
    .from('game_descriptions')
    .select('room_player_id')
    .eq('game_id', gameId)
    .eq('round', state.round)
    .eq('pass', state.descriptionPass)
  const authors = new Set(
    ((written ?? []) as { room_player_id: string }[]).map((entry) => entry.room_player_id),
  )
  if (alive.every((id) => authors.has(id))) {
    const next = advanceSpeaker(state)
    try {
      await saveGame(admin, gameId, row.version, next)
    } catch (saveError) {
      if (!(saveError instanceof ConcurrentUpdateError)) throw saveError
    }
    return next
  }

  return state
}

/**
 * Le mot secret apparaît-il dans la description ?
 * Comparaison normalisée (casse, accents, ponctuation) sur les mots entiers,
 * pour ne pas rejeter « poissonnerie » quand le mot est « poisson »… tout en
 * bloquant « c'est un Poisson ! ».
 */
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

/**
 * Clôture de partie : referme la session FlexGames et enregistre les agrégats.
 * C'est le jeu qui décide QUAND une partie est finie ; la plateforme range.
 */
async function finalizeGame(admin: SupabaseClient, gameId: string, state: GameState): Promise<void> {
  const { data } = await admin
    .from('games')
    .select('room_id, session_id, started_at, finished_at')
    .eq('id', gameId)
    .maybeSingle()
  const row = data as Pick<GameRow, 'room_id' | 'session_id' | 'started_at' | 'finished_at'> | null
  if (!row) return

  const duration = row.finished_at
    ? Math.round((new Date(row.finished_at).getTime() - new Date(row.started_at).getTime()) / 1000)
    : null

  await finishSession(admin, row.session_id, {
    status: state.winner === null ? 'abandoned' : 'finished',
    winner: state.winner,
  })

  await trackEvent({
    event: 'imposter_game_finished',
    roomId: row.room_id,
    gameKey: 'the-imposter',
    sessionId: row.session_id,
    playerCount: state.players.length,
    durationSeconds: duration,
    winner: state.winner,
    meta: {
      mode: state.mode,
      packs: state.settings.packs.length > 0 ? state.settings.packs : ['tous'],
      difficulty: state.settings.difficulty,
    },
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
