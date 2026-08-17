import { normalizeAnswer, isCorrectGuess } from './mr-white'
import {
  assignRoles,
  compositionFromSettings,
  isIntruder,
  recommendedComposition,
  shuffle,
  validateSettings,
} from './roles'
import { assertTransition } from './state-machine'
import {
  MAX_RUNOFFS,
  eligibleVoters,
  tallyVotes,
  validateVote,
  type TallyResult,
} from './voting'
import { evaluateWinner } from './win'
import type {
  Difficulty,
  EnginePlayer,
  GameMode,
  GameSettings,
  GameState,
  Phase,
  Rng,
  Role,
  WordSet,
} from './types'

export class EngineError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'EngineError'
  }
}

/** Durées (secondes) des phases d'affichage automatique. */
export const VOTE_RESULT_DURATION = 7
export const ELIMINATION_DURATION = 6
export const ROLE_REVEAL_DURATION = 60
export const MR_WHITE_GUESS_DURATION = 45

export function defaultSettings(mode: GameMode, playerCount = 6): GameSettings {
  const composition = recommendedComposition(mode, playerCount)
  return {
    mode,
    impostorCount: composition.impostors,
    undercoverCount: composition.undercover,
    mrWhiteCount: composition.mrWhite,
    descriptionRounds: 2,
    speakDuration: 30,
    voteDuration: 45,
    revealRoleOnElimination: true,
    difficulty: 'all',
    packs: [],
    customWord: null,
  }
}

/** Réaligne les compteurs de rôles sur une nouvelle taille de table. */
export function reconcileSettings(settings: GameSettings, playerCount: number): GameSettings {
  if (validateSettings(settings, playerCount).ok) return settings
  const composition = recommendedComposition(settings.mode, playerCount)
  return {
    ...settings,
    impostorCount: composition.impostors,
    undercoverCount: composition.undercover,
    mrWhiteCount: composition.mrWhite,
  }
}

export interface CreateGameInput {
  players: { id: string; name: string }[]
  settings: GameSettings
  words: WordSet
  /** Nombre de rôles spéciaux récents par joueur (équité du rematch). */
  recentSpecialCounts?: Record<string, number>
  /** Ordre de parole : 'random' (défaut) ou 'as-is' (ordre d'arrivée). */
  order?: 'random' | 'as-is'
  rng?: Rng
}

/**
 * Crée une partie : valide la configuration, attribue les rôles et les mots,
 * fige l'ordre de référence, et positionne la machine d'état sur `role_reveal`.
 */
export function createGame(input: CreateGameInput): GameState {
  const rng = input.rng ?? Math.random
  const validation = validateSettings(input.settings, input.players.length)
  if (!validation.ok) throw new EngineError(validation.errors.join(' '))

  const composition = compositionFromSettings(input.settings, input.players.length)
  const assignments = assignRoles({
    players: input.players,
    composition,
    recentSpecialCounts: input.recentSpecialCounts,
    rng,
  })

  const players: EnginePlayer[] = input.players.map((player) => {
    const role = assignments.find((a) => a.playerId === player.id)?.role ?? 'civilian'
    return {
      id: player.id,
      name: player.name,
      role,
      word: wordForRole(role, input.settings.mode, input.words),
      hint: hintForRole(role, input.settings.mode, input.words),
      isAlive: true,
      eliminatedRound: null,
      roleRevealed: false,
      hasSeenRole: false,
    }
  })

  const baseOrder =
    input.order === 'as-is'
      ? input.players.map((p) => p.id)
      : shuffle(
          input.players.map((p) => p.id),
          rng,
        )

  const state: GameState = {
    mode: input.settings.mode,
    settings: input.settings,
    phase: 'role_assignment',
    round: 1,
    descriptionPass: 1,
    players,
    words: input.words,
    baseOrder,
    speakingOrder: [],
    currentSpeakerIndex: -1,
    votes: [],
    lastVote: null,
    runoffCandidates: null,
    runoffCount: 0,
    emptyVoteStreak: 0,
    pendingMrWhiteId: null,
    lastMrWhiteGuess: null,
    eliminations: [],
    winner: null,
    firstSpeakerOffset: 0,
  }

  return transition(state, 'role_reveal')
}

export function wordForRole(role: Role, mode: GameMode, words: WordSet): string | null {
  if (role === 'civilian') return words.civilianWord
  if (role === 'undercover') return words.undercoverWord ?? words.civilianWord
  // impostor et mr_white ne reçoivent aucun mot.
  return null
}

export function hintForRole(role: Role, mode: GameMode, words: WordSet): string | null {
  if (role === 'impostor' && mode === 'impostor') return words.impostorHint
  return null
}

function transition(state: GameState, to: Phase): GameState {
  assertTransition(state.phase, to)
  return { ...state, phase: to }
}

/* -------------------------------------------------------------------------- */
/* Révélation des rôles                                                       */
/* -------------------------------------------------------------------------- */

export function markRoleSeen(state: GameState, playerId: string): GameState {
  if (state.phase !== 'role_reveal') throw new EngineError("Ce n'est pas la phase de révélation.")
  return {
    ...state,
    players: state.players.map((p) => (p.id === playerId ? { ...p, hasSeenRole: true } : p)),
  }
}

export function allRolesSeen(state: GameState): boolean {
  return state.players.filter((p) => p.isAlive).every((p) => p.hasSeenRole)
}

/* -------------------------------------------------------------------------- */
/* Discussion                                                                 */
/* -------------------------------------------------------------------------- */

/** Ordre de parole du tour : vivants, tournés pour changer de premier orateur. */
export function computeSpeakingOrder(state: GameState): string[] {
  const alive = state.baseOrder.filter((id) => state.players.find((p) => p.id === id)?.isAlive)
  if (alive.length === 0) return []
  const offset = state.firstSpeakerOffset % alive.length
  return [...alive.slice(offset), ...alive.slice(0, offset)]
}

export function beginDiscussion(state: GameState): GameState {
  const order = computeSpeakingOrder(state)
  const free = state.settings.descriptionRounds === 'free'
  const next = transition(state, 'discussion')
  return {
    ...next,
    speakingOrder: order,
    descriptionPass: 1,
    currentSpeakerIndex: free ? -1 : 0,
    votes: [],
    lastVote: null,
    runoffCandidates: null,
    runoffCount: 0,
  }
}

export function currentSpeakerId(state: GameState): string | null {
  if (state.phase !== 'discussion') return null
  if (state.currentSpeakerIndex < 0) return null
  return state.speakingOrder[state.currentSpeakerIndex] ?? null
}

/**
 * Passe la parole. Quand la dernière passe de description est terminée, la
 * partie bascule automatiquement en phase de vote.
 */
export function advanceSpeaker(state: GameState): GameState {
  if (state.phase !== 'discussion') throw new EngineError("La discussion n'est pas en cours.")

  if (state.settings.descriptionRounds === 'free') return openVoting(state)

  const nextIndex = state.currentSpeakerIndex + 1
  if (nextIndex < state.speakingOrder.length) {
    return { ...state, currentSpeakerIndex: nextIndex }
  }

  const totalPasses = state.settings.descriptionRounds
  if (state.descriptionPass < totalPasses) {
    return { ...state, descriptionPass: state.descriptionPass + 1, currentSpeakerIndex: 0 }
  }
  return openVoting(state)
}

/* -------------------------------------------------------------------------- */
/* Vote                                                                       */
/* -------------------------------------------------------------------------- */

export function openVoting(state: GameState): GameState {
  const next = transition(state, 'voting')
  return { ...next, votes: [], currentSpeakerIndex: -1 }
}

export function alivePlayerIds(state: GameState): string[] {
  return state.players.filter((p) => p.isAlive).map((p) => p.id)
}

export function castVote(state: GameState, voterId: string, targetId: string): GameState {
  if (state.phase !== 'voting') throw new EngineError("Le vote n'est pas ouvert.")
  const alive = alivePlayerIds(state)
  const validation = validateVote({
    voterId,
    targetId,
    alivePlayerIds: alive,
    allowedTargets: state.runoffCandidates,
    alreadyVoted: state.votes.some((v) => v.voterId === voterId),
  })
  if (!validation.ok) throw new EngineError(validation.error ?? 'Vote invalide.')
  return { ...state, votes: [...state.votes, { voterId, targetId }] }
}

export function pendingVoterIds(state: GameState): string[] {
  const voters = eligibleVoters(alivePlayerIds(state), state.runoffCandidates)
  return voters.filter((id) => !state.votes.some((v) => v.voterId === id))
}

export function allVotesIn(state: GameState): boolean {
  return pendingVoterIds(state).length === 0
}

/**
 * Ferme le scrutin. En cas d'égalité, un barrage est organisé entre les joueurs
 * à égalité ; au-delà de `MAX_RUNOFFS` barrages consécutifs, le joueur éliminé
 * est tiré au sort parmi eux (garantie de terminaison).
 */
export function closeVoting(state: GameState, rng: Rng = Math.random): GameState {
  if (state.phase !== 'voting') throw new EngineError("Le vote n'est pas ouvert.")
  const result: TallyResult = tallyVotes(state.votes)
  const next = transition(state, 'vote_result')

  // Personne n'a voté (tous AFK) : on saute l'élimination et on passe au tour suivant.
  if (result.leaders.length === 0) {
    return {
      ...next,
      lastVote: { votes: state.votes, tally: result.tally, eliminatedId: null, tie: false, resolvedByChance: false },
      runoffCandidates: null,
    }
  }

  if (result.leaders.length > 1) {
    if (state.runoffCount < MAX_RUNOFFS) {
      return {
        ...next,
        lastVote: {
          votes: state.votes,
          tally: result.tally,
          eliminatedId: null,
          tie: true,
          resolvedByChance: false,
        },
        runoffCandidates: result.leaders,
      }
    }
    const picked = result.leaders[Math.floor(rng() * result.leaders.length)] as string
    return {
      ...next,
      lastVote: {
        votes: state.votes,
        tally: result.tally,
        eliminatedId: picked,
        tie: true,
        resolvedByChance: true,
      },
      runoffCandidates: null,
    }
  }

  return {
    ...next,
    lastVote: {
      votes: state.votes,
      tally: result.tally,
      eliminatedId: result.leaders[0] as string,
      tie: false,
      resolvedByChance: false,
    },
    runoffCandidates: null,
  }
}

/** Après l'affichage du résultat : barrage, ou application de l'élimination. */
export function applyVoteResult(state: GameState): GameState {
  if (state.phase !== 'vote_result') throw new EngineError("Aucun résultat de vote à appliquer.")
  const lastVote = state.lastVote
  if (!lastVote) throw new EngineError('Résultat de vote manquant.')

  if (lastVote.tie && !lastVote.eliminatedId) {
    const next = transition(state, 'voting')
    return { ...next, votes: [], runoffCount: state.runoffCount + 1 }
  }

  const next = transition(state, 'elimination')
  if (!lastVote.eliminatedId) {
    // Aucun vote exprimé (table AFK) : pas d'élimination, mais on compte.
    return { ...next, emptyVoteStreak: state.emptyVoteStreak + 1 }
  }

  const eliminatedId = lastVote.eliminatedId
  const eliminated = state.players.find((p) => p.id === eliminatedId)
  if (!eliminated) throw new EngineError('Joueur éliminé introuvable.')

  const players = state.players.map((p) =>
    p.id === eliminatedId
      ? {
          ...p,
          isAlive: false,
          eliminatedRound: state.round,
          roleRevealed: state.settings.revealRoleOnElimination,
        }
      : p,
  )

  return {
    ...next,
    players,
    emptyVoteStreak: 0,
    eliminations: [
      ...state.eliminations,
      {
        round: state.round,
        playerId: eliminatedId,
        role: eliminated.role,
        votes: lastVote.votes,
        tally: lastVote.tally,
      },
    ],
    pendingMrWhiteId: eliminated.role === 'mr_white' ? eliminatedId : null,
  }
}

/**
 * Suite de l'élimination : dernière chance de Mr. White, fin de partie, ou
 * tour suivant.
 */
export function resolveElimination(state: GameState): GameState {
  if (state.phase !== 'elimination') throw new EngineError('Aucune élimination à résoudre.')

  // Personne ne vote plus depuis plusieurs tours : on arrête la partie.
  if (state.emptyVoteStreak >= MAX_EMPTY_VOTES) return endGame(state, null)

  if (state.pendingMrWhiteId) {
    return transition(state, 'mr_white_guess')
  }

  const winner = evaluateWinner(state.mode, state.players)
  if (winner) return endGame(state, winner)

  return startNextRound(state)
}

export function submitMrWhiteGuess(state: GameState, playerId: string, guess: string): GameState {
  if (state.phase !== 'mr_white_guess') throw new EngineError("Ce n'est pas la phase de devinette.")
  if (state.pendingMrWhiteId !== playerId) throw new EngineError("Vous n'êtes pas concerné.")

  const correct = isCorrectGuess(guess, state.words.civilianWord, state.words.acceptedAnswers)
  const withGuess: GameState = {
    ...state,
    pendingMrWhiteId: null,
    lastMrWhiteGuess: { playerId, guess: normalizeAnswer(guess), correct },
    players: state.players.map((p) => (p.id === playerId ? { ...p, roleRevealed: true } : p)),
  }

  if (correct) return endGame(withGuess, 'mr_white')

  const winner = evaluateWinner(withGuess.mode, withGuess.players)
  if (winner) return endGame(withGuess, winner)
  return startNextRound(withGuess)
}

/** Mr. White n'a pas répondu à temps : la partie continue. */
export function skipMrWhiteGuess(state: GameState): GameState {
  if (state.phase !== 'mr_white_guess') throw new EngineError("Ce n'est pas la phase de devinette.")
  const skipped: GameState = { ...state, pendingMrWhiteId: null }
  const winner = evaluateWinner(skipped.mode, skipped.players)
  if (winner) return endGame(skipped, winner)
  return startNextRound(skipped)
}

export function startNextRound(state: GameState): GameState {
  const next = transition(state, 'next_round')
  const advanced: GameState = {
    ...next,
    round: state.round + 1,
    firstSpeakerOffset: state.firstSpeakerOffset + 1,
    votes: [],
    lastVote: null,
    runoffCandidates: null,
    runoffCount: 0,
    emptyVoteStreak: state.emptyVoteStreak,
  }
  return beginDiscussion(advanced)
}

/**
 * Nombre de scrutins consécutifs sans aucun vote avant abandon automatique de
 * la partie (`winner: null`).
 */
export const MAX_EMPTY_VOTES = 2

/** `winner: null` = partie abandonnée (table AFK), aucun camp vainqueur. */
function endGame(state: GameState, winner: Winner | null): GameState {
  const over = transition({ ...state, winner }, 'game_over')
  const revealed: GameState = {
    ...over,
    players: over.players.map((p) => ({ ...p, roleRevealed: true })),
  }
  return transition(revealed, 'results')
}

type Winner = NonNullable<GameState['winner']>

/* -------------------------------------------------------------------------- */
/* Helpers de lecture (utilisés par l'UI et par le backend)                   */
/* -------------------------------------------------------------------------- */

export function aliveCount(state: GameState): number {
  return state.players.filter((p) => p.isAlive).length
}

export function intruderCount(state: GameState, aliveOnly = true): number {
  return state.players.filter((p) => isIntruder(p.role) && (!aliveOnly || p.isAlive)).length
}

/** Durée en secondes de la phase courante (0 = illimité / pas de timer). */
export function phaseDuration(state: GameState): number {
  switch (state.phase) {
    case 'role_reveal':
      return ROLE_REVEAL_DURATION
    case 'discussion':
      if (state.settings.speakDuration === 0) return 0
      return state.settings.descriptionRounds === 'free'
        ? state.settings.speakDuration * Math.max(1, aliveCount(state))
        : state.settings.speakDuration
    case 'voting':
      return state.settings.voteDuration
    case 'vote_result':
      return VOTE_RESULT_DURATION
    case 'elimination':
      return ELIMINATION_DURATION
    case 'mr_white_guess':
      return MR_WHITE_GUESS_DURATION
    default:
      return 0
  }
}

/**
 * Fait avancer automatiquement une phase dont le minuteur est écoulé (AFK).
 * Retourne `null` si la phase courante ne peut pas être avancée sans action.
 */
export function autoAdvance(state: GameState, rng: Rng = Math.random): GameState | null {
  switch (state.phase) {
    case 'role_reveal':
      return beginDiscussion(state)
    case 'discussion':
      return advanceSpeaker(state)
    case 'voting':
      return closeVoting(state, rng)
    case 'vote_result':
      return applyVoteResult(state)
    case 'elimination':
      return resolveElimination(state)
    case 'mr_white_guess':
      return skipMrWhiteGuess(state)
    default:
      return null
  }
}

/**
 * Retire un joueur d'une partie en cours (déconnexion définitive / exclusion).
 * Le joueur est traité comme éliminé sans vote ; la fin de partie est évaluée.
 */
export function removePlayer(state: GameState, playerId: string): GameState {
  const player = state.players.find((p) => p.id === playerId)
  if (!player || !player.isAlive) return state

  const players = state.players.map((p) =>
    p.id === playerId ? { ...p, isAlive: false, eliminatedRound: state.round } : p,
  )
  const withoutPlayer: GameState = {
    ...state,
    players,
    votes: state.votes.filter((v) => v.voterId !== playerId && v.targetId !== playerId),
    speakingOrder: state.speakingOrder.filter((id) => id !== playerId),
    runoffCandidates: state.runoffCandidates?.filter((id) => id !== playerId) ?? null,
    pendingMrWhiteId: state.pendingMrWhiteId === playerId ? null : state.pendingMrWhiteId,
  }

  const winner = evaluateWinner(withoutPlayer.mode, withoutPlayer.players)
  if (winner && withoutPlayer.phase !== 'results') {
    return {
      ...withoutPlayer,
      phase: 'results',
      winner,
      players: withoutPlayer.players.map((p) => ({ ...p, roleRevealed: true })),
    }
  }

  // Le joueur qui parlait vient de partir : on recale l'index de parole.
  if (withoutPlayer.phase === 'discussion' && withoutPlayer.currentSpeakerIndex >= withoutPlayer.speakingOrder.length) {
    return { ...withoutPlayer, currentSpeakerIndex: Math.max(0, withoutPlayer.speakingOrder.length - 1) }
  }
  return withoutPlayer
}

export type { Difficulty, GameState, GameSettings, WordSet }
