'use client'

import { create } from 'zustand'
import {
  advanceSpeaker,
  applyVoteResult,
  beginDiscussion,
  castVote,
  closeVoting,
  createGame,
  markRoleSeen,
  resolveElimination,
  skipMrWhiteGuess,
  submitMrWhiteGuess,
  allVotesIn,
} from '@/games/the-imposter/engine/engine'
import type { GameSettings, GameState } from '@/games/the-imposter/engine/types'
import { selectWordEntry, toWordSet, customWordSet } from '@/games/the-imposter/engine/word-selection'
import { IMPOSTOR_WORDS } from '@/games/the-imposter/data/impostor-words'
import { WORD_PAIRS } from '@/games/the-imposter/data/word-pairs'
import { useImposterPreferences } from '@/games/the-imposter/preferences'

/**
 * Mode local (un seul téléphone, hors connexion).
 *
 * Réutilise exactement le même moteur que le mode en ligne ; seule la
 * persistance change : l'état vit en mémoire, volontairement non persisté pour
 * qu'aucun mot ne puisse être retrouvé via l'historique du navigateur ou un
 * rechargement de page.
 */

/** Étape d'interface propre au hot-seat (passage du téléphone). */
export type LocalStep =
  | 'setup'
  | 'handoff' // « Passe le téléphone à X »
  | 'confirm' // « JE SUIS X »
  | 'reveal' // maintenir pour révéler
  | 'revealed' // carte visible
  | 'discussion'
  | 'vote-handoff'
  | 'vote'
  | 'vote-result'
  | 'elimination'
  | 'mr-white'
  | 'results'

export interface LocalGameState {
  step: LocalStep
  players: string[]
  game: GameState | null
  /** Index du joueur concerné par la révélation ou le vote en cours. */
  turnIndex: number
  /**
   * Joueur dont la carte de rôle est autorisée à l'écran.
   *
   * Sécurité : c'est la SEULE source utilisée pour afficher un rôle. Elle est
   * remise à `null` dès que l'appareil change de main, ce qui garantit qu'aucun
   * mot ne peut apparaître pendant la transition (le `turnIndex` avance, lui,
   * vers le joueur suivant).
   */
  revealPlayerId: string | null
  /**
   * Joueur autorisé à voter à l'écran (même principe que `revealPlayerId`) :
   * évite d'afficher le nom du votant suivant pendant une transition.
   */
  votePlayerId: string | null
  error: string | null

  setPlayers: (players: string[]) => void
  start: (settings: GameSettings) => void
  confirmIdentity: () => void
  revealRole: () => void
  hideAndPass: () => void
  nextSpeaker: () => void
  openVoting: () => void
  confirmVoter: () => void
  vote: (targetId: string) => void
  applyVote: () => void
  resolve: () => void
  guessMrWhite: (guess: string) => boolean
  skipGuess: () => void
  rematch: () => void
  reset: () => void
}

function playerIdFor(index: number): string {
  return `local-${index + 1}`
}

export const useLocalGame = create<LocalGameState>()((set, get) => ({
  step: 'setup',
  players: [],
  game: null,
  turnIndex: 0,
  revealPlayerId: null,
  votePlayerId: null,
  error: null,

  setPlayers: (players) => set({ players }),

  start: (settings) => {
    const { players } = get()
    try {
      const words = resolveLocalWords(settings)
      const game = createGame({
        players: players.map((name, index) => ({ id: playerIdFor(index), name })),
        settings,
        words,
      })
      useImposterPreferences.getState().rememberWord(words.sourceId)
      useImposterPreferences.getState().setLastSettings(settings)
      useImposterPreferences.getState().setLocalPlayerNames(players)
      set({ game, step: 'handoff', turnIndex: 0, revealPlayerId: null, votePlayerId: null, error: null })
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Impossible de lancer la partie.' })
    }
  },

  confirmIdentity: () => {
    const { game, turnIndex } = get()
    const player = game?.players[turnIndex]
    if (!player) return
    set({ step: 'reveal', revealPlayerId: player.id })
  },

  revealRole: () => set({ step: 'revealed' }),

  hideAndPass: () => {
    const { game, turnIndex } = get()
    if (!game) return
    const player = game.players[turnIndex]
    if (!player) return
    const marked = markRoleSeen(game, player.id)
    const nextIndex = turnIndex + 1

    // `revealPlayerId: null` en premier : plus aucun rôle n'est affichable
    // pendant l'animation de transition vers le joueur suivant.
    if (nextIndex < marked.players.length) {
      set({ game: marked, turnIndex: nextIndex, step: 'handoff', revealPlayerId: null })
      return
    }
    set({
      game: beginDiscussion(marked),
      step: 'discussion',
      turnIndex: 0,
      revealPlayerId: null,
    })
  },

  nextSpeaker: () => {
    const { game } = get()
    // Garde-fou : le minuteur peut se déclencher juste après un clic manuel qui
    // a déjà changé de phase. On ignore alors l'appel plutôt que de lever.
    if (!game || game.phase !== 'discussion') return
    const next = advanceSpeaker(game)
    if (next.phase === 'voting') {
      set({ game: next, step: 'vote-handoff', turnIndex: 0 })
      return
    }
    set({ game: next })
  },

  openVoting: () => {
    const { game } = get()
    if (!game || game.phase !== 'discussion') return
    // L'hôte local coupe court à la discussion : on enchaîne les passes jusqu'au vote.
    let next = game
    let guard = 0
    while (next.phase === 'discussion' && guard++ < 60) next = advanceSpeaker(next)
    set({ game: next, step: next.phase === 'voting' ? 'vote-handoff' : 'discussion', turnIndex: 0 })
  },

  confirmVoter: () => {
    const { game, turnIndex } = get()
    const voter = game?.players.filter((player) => player.isAlive)[turnIndex]
    if (!voter) return
    set({ step: 'vote', votePlayerId: voter.id })
  },

  vote: (targetId) => {
    const { game, turnIndex } = get()
    if (!game || game.phase !== 'voting') return
    const voters = game.players.filter((p) => p.isAlive)
    const voter = voters[turnIndex]
    if (!voter) return

    try {
      const next = castVote(game, voter.id, targetId)
      if (allVotesIn(next)) {
        set({ game: closeVoting(next), step: 'vote-result', turnIndex: 0, votePlayerId: null })
        return
      }
      set({ game: next, turnIndex: turnIndex + 1, step: 'vote-handoff', votePlayerId: null })
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Vote impossible.' })
    }
  },

  applyVote: () => {
    const { game } = get()
    if (!game || game.phase !== 'vote_result') return
    const next = applyVoteResult(game)
    if (next.phase === 'voting') {
      // Vote de barrage : nouveau tour de votes.
      set({ game: next, step: 'vote-handoff', turnIndex: 0 })
      return
    }
    set({ game: next, step: 'elimination' })
  },

  resolve: () => {
    const { game } = get()
    if (!game || game.phase !== 'elimination') return
    const next = resolveElimination(game)
    if (next.phase === 'mr_white_guess') {
      set({ game: next, step: 'mr-white' })
      return
    }
    if (next.phase === 'results') {
      set({ game: next, step: 'results' })
      return
    }
    set({ game: next, step: 'discussion', turnIndex: 0 })
  },

  guessMrWhite: (guess) => {
    const { game } = get()
    if (!game || !game.pendingMrWhiteId) return false
    const next = submitMrWhiteGuess(game, game.pendingMrWhiteId, guess)
    const correct = next.lastMrWhiteGuess?.correct ?? false
    set({
      game: next,
      step: next.phase === 'results' ? 'results' : 'discussion',
      turnIndex: 0,
    })
    return correct
  },

  skipGuess: () => {
    const { game } = get()
    if (!game || game.phase !== 'mr_white_guess') return
    const next = skipMrWhiteGuess(game)
    set({ game: next, step: next.phase === 'results' ? 'results' : 'discussion', turnIndex: 0 })
  },

  rematch: () => {
    const { game, players } = get()
    if (!game) return
    const recentSpecialCounts = Object.fromEntries(
      game.players.map((player) => [player.id, player.role === 'civilian' ? 0 : 1]),
    )
    try {
      const words = resolveLocalWords(game.settings)
      const next = createGame({
        players: players.map((name, index) => ({ id: playerIdFor(index), name })),
        settings: game.settings,
        words,
        recentSpecialCounts,
      })
      useImposterPreferences.getState().rememberWord(words.sourceId)
      set({ game: next, step: 'handoff', turnIndex: 0, revealPlayerId: null, votePlayerId: null, error: null })
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Impossible de relancer la partie.' })
    }
  },

  reset: () =>
    set({
      step: 'setup',
      game: null,
      turnIndex: 0,
      revealPlayerId: null,
      votePlayerId: null,
      error: null,
    }),
}))

/** Tirage du mot depuis la base embarquée (fonctionne hors connexion). */
function resolveLocalWords(settings: GameSettings) {
  if (settings.customWord) return customWordSet(settings.mode, settings.customWord)

  const excludeIds = useImposterPreferences.getState().wordHistory
  const filters = {
    difficulty: settings.difficulty,
    packs: settings.packs,
    excludeIds,
  }
  if (settings.mode === 'impostor') {
    const { entry } = selectWordEntry(IMPOSTOR_WORDS, filters)
    return toWordSet(entry, 'impostor')
  }
  const { entry } = selectWordEntry(WORD_PAIRS, filters)
  return toWordSet(entry, 'undercover')
}

/**
 * Joueur dont la carte de rôle peut être affichée.
 * Renvoie `null` hors de la fenêtre de révélation : aucun mot ne peut alors
 * apparaître, même pendant une animation de sortie.
 */
export function revealedPlayer(state: LocalGameState) {
  const { game, revealPlayerId } = state
  if (!game || !revealPlayerId) return null
  return game.players.find((player) => player.id === revealPlayerId) ?? null
}

/** Joueur autorisé à voter (null hors de la fenêtre de vote). */
export function votingPlayer(state: LocalGameState) {
  const { game, votePlayerId } = state
  if (!game || !votePlayerId) return null
  return game.players.find((player) => player.id === votePlayerId) ?? null
}

/** Joueur dont c'est le tour (révélation ou vote). */
export function currentTurnPlayer(state: LocalGameState) {
  const { game, turnIndex, step } = state
  if (!game) return null
  if (step === 'vote-handoff' || step === 'vote') {
    return game.players.filter((p) => p.isAlive)[turnIndex] ?? null
  }
  return game.players[turnIndex] ?? null
}
