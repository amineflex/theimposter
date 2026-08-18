import type { SupabaseClient } from '@supabase/supabase-js'
import { ConcurrentUpdateError, NotFoundError } from '@/flexgames/core/errors'
import type { RoomPlayerRow } from '@/flexgames/core/db'
import { phaseDuration } from '@/games/the-imposter/engine/engine'
import type { EnginePlayer, GameState, WordSet } from '@/games/the-imposter/engine/types'
import type {
  GamePlayerRow,
  GamePlayerStatusRow,
  GameRow,
  VoteRow,
} from '@/games/the-imposter/types/db'

/**
 * Traduction base de données <-> `GameState` du moteur.
 *
 * Le moteur reste pur : il ne connaît que `GameState`. Ces fonctions chargent
 * l'état complet (y compris les données secrètes, avec la clé service_role) et
 * réécrivent le résultat d'une transition. La version optimiste (`version`)
 * garantit qu'une seule transition concurrente est appliquée.
 */

export interface LoadedGame {
  state: GameState
  row: GameRow
  /** Joueurs de la room, indexés par id de `room_players`. */
  roomPlayers: Map<string, RoomPlayerRow>
}

export class GameNotFoundError extends NotFoundError {
  constructor() {
    super('Partie introuvable.', 'game_not_found')
    this.name = 'GameNotFoundError'
  }
}

export { ConcurrentUpdateError }

export async function loadGame(admin: SupabaseClient, gameId: string): Promise<LoadedGame> {
  const [gameResult, playersResult, statusResult] = await Promise.all([
    admin.from('games').select('*').eq('id', gameId).maybeSingle(),
    admin.from('game_players').select('*').eq('game_id', gameId),
    admin.from('game_player_status').select('*').eq('game_id', gameId),
  ])

  const row = gameResult.data as GameRow | null
  if (!row) throw new GameNotFoundError()

  const gamePlayers = (playersResult.data ?? []) as GamePlayerRow[]
  const statuses = (statusResult.data ?? []) as GamePlayerStatusRow[]

  const roomPlayersResult = await admin.from('room_players').select('*').eq('room_id', row.room_id)
  const roomPlayers = new Map<string, RoomPlayerRow>(
    ((roomPlayersResult.data ?? []) as RoomPlayerRow[]).map((p) => [p.id, p]),
  )

  // Votes du scrutin courant uniquement : le moteur ne raisonne que sur celui-ci.
  const votesResult = await admin
    .from('votes')
    .select('*')
    .eq('game_id', gameId)
    .eq('round', row.round)
    .eq('runoff', row.runoff_count)
  const votes = (votesResult.data ?? []) as VoteRow[]

  const statusById = new Map(statuses.map((s) => [s.room_player_id, s]))

  const players: EnginePlayer[] = gamePlayers
    .map((gp): EnginePlayer => {
      const status = statusById.get(gp.room_player_id)
      return {
        id: gp.room_player_id,
        name: roomPlayers.get(gp.room_player_id)?.name ?? 'Joueur',
        role: gp.role,
        word: gp.word,
        hint: gp.hint,
        isAlive: status?.is_alive ?? true,
        eliminatedRound: status?.eliminated_round ?? null,
        roleRevealed: status?.revealed_role != null,
        hasSeenRole: status?.has_seen_role ?? gp.has_seen_role,
      }
    })
    // Ordre stable : celui de `base_order`, pour un affichage déterministe.
    .sort((a, b) => row.base_order.indexOf(a.id) - row.base_order.indexOf(b.id))

  const words: WordSet = {
    civilianWord: row.civilian_word,
    undercoverWord: row.undercover_word,
    impostorHint: row.impostor_hint,
    acceptedAnswers: row.accepted_answers,
    sourceId: row.word_source_id,
    category: row.word_category,
    difficulty: row.word_difficulty,
  }

  const state: GameState = {
    mode: row.mode,
    settings: row.settings,
    phase: row.phase,
    round: row.round,
    descriptionPass: row.description_pass,
    players,
    words,
    baseOrder: row.base_order,
    speakingOrder: row.speaking_order,
    currentSpeakerIndex: row.current_speaker_index,
    votes: votes.map((v) => ({ voterId: v.voter_id, targetId: v.target_id })),
    lastVote: row.last_vote,
    runoffCandidates: row.runoff_candidates,
    runoffCount: row.runoff_count,
    emptyVoteStreak: row.empty_vote_streak,
    pendingMrWhiteId: row.pending_mr_white_id,
    lastMrWhiteGuess: row.last_mr_white_guess,
    eliminations: row.eliminations,
    winner: row.winner,
    firstSpeakerOffset: row.first_speaker_offset,
  }

  return { state, row, roomPlayers }
}

/**
 * Écrit l'état résultant d'une transition.
 * @throws ConcurrentUpdateError si un autre client a déjà avancé la partie.
 */
export async function saveGame(
  admin: SupabaseClient,
  gameId: string,
  expectedVersion: number,
  state: GameState,
): Promise<void> {
  const finished = state.phase === 'results'
  const duration = phaseDuration(state)
  const phaseEndsAt =
    finished || duration <= 0 ? null : new Date(Date.now() + duration * 1000).toISOString()

  const { data, error } = await admin
    .from('games')
    .update({
      phase: state.phase,
      round: state.round,
      description_pass: state.descriptionPass,
      speaking_order: state.speakingOrder,
      current_speaker_index: state.currentSpeakerIndex,
      base_order: state.baseOrder,
      first_speaker_offset: state.firstSpeakerOffset,
      runoff_candidates: state.runoffCandidates,
      runoff_count: state.runoffCount,
      empty_vote_streak: state.emptyVoteStreak,
      pending_mr_white_id: state.pendingMrWhiteId,
      last_vote: state.lastVote,
      last_mr_white_guess: state.lastMrWhiteGuess,
      eliminations: state.eliminations,
      winner: state.winner,
      abandoned: finished && state.winner === null,
      phase_ends_at: phaseEndsAt,
      settings: state.settings,
      version: expectedVersion + 1,
      finished_at: finished ? new Date().toISOString() : null,
    })
    .eq('id', gameId)
    .eq('version', expectedVersion)
    .select('id')

  if (error) throw error
  if (!data || data.length === 0) throw new ConcurrentUpdateError()

  await syncPlayerStatus(admin, gameId, state)
  await publishPhaseEvent(admin, gameId, expectedVersion + 1, state)

}

/**
 * Écrit le signal public de changement de phase.
 *
 * `games` n'étant pas lisible par le client pendant la partie, c'est cette
 * table  ·  sans aucune donnée sensible  ·  qui déclenche la resynchronisation des
 * clients via Realtime.
 */
async function publishPhaseEvent(
  admin: SupabaseClient,
  gameId: string,
  version: number,
  state: GameState,
): Promise<void> {
  const { data } = await admin.from('games').select('room_id').eq('id', gameId).maybeSingle()
  const roomId = (data as { room_id: string } | null)?.room_id
  if (!roomId) return

  const { error } = await admin.from('game_phase_events').upsert(
    {
      game_id: gameId,
      room_id: roomId,
      phase: state.phase,
      round: state.round,
      version,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'game_id' },
  )
  if (error) console.error('[realtime] signal de phase non publié', error)
}

/** Met à jour l'état public de chaque joueur (diffusé en Realtime). */
export async function syncPlayerStatus(
  admin: SupabaseClient,
  gameId: string,
  state: GameState,
): Promise<void> {
  const votedIds = new Set(state.votes.map((v) => v.voterId))
  const rows = state.players.map((player) => ({
    game_id: gameId,
    room_player_id: player.id,
    is_alive: player.isAlive,
    eliminated_round: player.eliminatedRound,
    revealed_role: player.roleRevealed ? player.role : null,
    has_seen_role: player.hasSeenRole,
    has_voted: votedIds.has(player.id),
  }))
  const { error } = await admin
    .from('game_player_status')
    .upsert(rows, { onConflict: 'game_id,room_player_id' })
  if (error) throw error

  const seenRows = state.players.filter((p) => p.hasSeenRole).map((p) => p.id)
  if (seenRows.length > 0) {
    await admin
      .from('game_players')
      .update({ has_seen_role: true })
      .eq('game_id', gameId)
      .in('room_player_id', seenRows)
  }
}

/** Le minuteur de la phase courante est-il écoulé ? */
export function isPhaseExpired(row: GameRow): boolean {
  if (row.is_paused) return false
  if (!row.phase_ends_at) return false
  return new Date(row.phase_ends_at).getTime() <= Date.now()
}
