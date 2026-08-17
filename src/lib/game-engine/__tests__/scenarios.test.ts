import { describe, expect, it } from 'vitest'
import {
  advanceSpeaker,
  applyVoteResult,
  beginDiscussion,
  castVote,
  closeVoting,
  createGame,
  defaultSettings,
  markRoleSeen,
  removePlayer,
  resolveElimination,
  submitMrWhiteGuess,
} from '../engine'
import { recommendedComposition } from '../roles'
import { evaluateWinner } from '../win'
import type { GameSettings, GameState, WordSet } from '../types'

/**
 * Scénarios de bout en bout du moteur : parties complètes, edge cases du cahier
 * des charges, et invariants de sécurité (aucun rôle déductible sans autorisation).
 */

const WORDS: WordSet = {
  civilianWord: 'Pizza',
  undercoverWord: 'Lasagnes',
  impostorHint: null,
  acceptedAnswers: ['pizzas'],
  sourceId: 'pair-pizza',
  category: 'Nourriture',
  difficulty: 'easy',
}

function seededRng(seed = 2024) {
  let state = seed
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296
    return state / 4294967296
  }
}

function startGame(playerCount: number, overrides: Partial<GameSettings> = {}): GameState {
  const composition = recommendedComposition(overrides.mode ?? 'undercover', playerCount)
  const settings: GameSettings = {
    ...defaultSettings(overrides.mode ?? 'undercover', playerCount),
    impostorCount: composition.impostors,
    undercoverCount: composition.undercover,
    mrWhiteCount: composition.mrWhite,
    descriptionRounds: 'free',
    ...overrides,
  }
  return createGame({
    players: Array.from({ length: playerCount }, (_, i) => ({ id: `p${i + 1}`, name: `J${i + 1}` })),
    settings,
    words: WORDS,
    order: 'as-is',
    rng: seededRng(),
  })
}

/** Fait voir son rôle à tout le monde puis ouvre la discussion. */
function reachDiscussion(state: GameState): GameState {
  let next = state
  for (const player of state.players) next = markRoleSeen(next, player.id)
  return beginDiscussion(next)
}

/** Tour complet : tous les vivants votent contre `targetId`, puis résolution. */
function playRoundAgainst(state: GameState, targetId: string, rng = seededRng()): GameState {
  let next = state.phase === 'discussion' ? advanceSpeaker(state) : state
  for (const voter of next.players.filter((p) => p.isAlive)) {
    const target =
      voter.id === targetId
        ? (next.players.find((p) => p.isAlive && p.id !== targetId)?.id as string)
        : targetId
    next = castVote(next, voter.id, target)
  }
  next = closeVoting(next, rng)
  next = applyVoteResult(next)
  if (next.phase === 'elimination') next = resolveElimination(next)
  return next
}

describe('partie complète — mode undercover à 8 joueurs', () => {
  it('se termine par la victoire des civils quand tous les intrus sont votés dehors', () => {
    let state = reachDiscussion(startGame(8))
    const intruders = state.players.filter((p) => p.role !== 'civilian').map((p) => p.id)
    expect(intruders.length).toBeGreaterThanOrEqual(2)

    for (const intruderId of intruders) {
      if (state.phase === 'results') break
      state = playRoundAgainst(state, intruderId)
      // Mr. White éliminé : il rate sa devinette et la partie continue.
      if (state.phase === 'mr_white_guess') {
        state = submitMrWhiteGuess(state, state.pendingMrWhiteId as string, 'Chaussure')
      }
    }

    expect(state.phase).toBe('results')
    expect(state.winner).toBe('civilians')
    expect(state.players.every((p) => p.roleRevealed)).toBe(true)
  })

  it('se termine par la victoire des intrus si les civils se trompent', () => {
    let state = reachDiscussion(startGame(8))
    let guard = 0
    while (state.phase !== 'results' && guard++ < 20) {
      const civilian = state.players.find((p) => p.isAlive && p.role === 'civilian')
      if (!civilian) break
      state = playRoundAgainst(state, civilian.id)
      if (state.phase === 'mr_white_guess') {
        state = submitMrWhiteGuess(state, state.pendingMrWhiteId as string, 'Chaussure')
      }
    }
    expect(state.phase).toBe('results')
    expect(state.winner).toBe('undercover')
  })
})

describe('Mr. White gagne sur sa dernière chance', () => {
  it("l'emporte immédiatement, même si les intrus sont minoritaires", () => {
    let state = reachDiscussion(
      startGame(5, { mode: 'undercover', undercoverCount: 1, mrWhiteCount: 1 }),
    )
    const mrWhite = state.players.find((p) => p.role === 'mr_white')
    expect(mrWhite).toBeDefined()

    state = playRoundAgainst(state, mrWhite!.id)
    expect(state.phase).toBe('mr_white_guess')

    // Réponse acceptée déclarée dans la base ("pizzas" pour "Pizza").
    state = submitMrWhiteGuess(state, mrWhite!.id, 'PIZZAS')
    expect(state.winner).toBe('mr_white')
    expect(state.phase).toBe('results')
  })
})

describe('edge cases du cahier des charges', () => {
  it('le départ du dernier intrus termine la partie', () => {
    const state = reachDiscussion(startGame(4, { undercoverCount: 1, mrWhiteCount: 0 }))
    const intruder = state.players.find((p) => p.role !== 'civilian') as GameState['players'][number]
    const after = removePlayer(state, intruder.id)
    expect(after.phase).toBe('results')
    expect(after.winner).toBe('civilians')
  })

  it('un joueur qui part pendant le vote voit son vote annulé', () => {
    let state = advanceSpeaker(reachDiscussion(startGame(6)))
    expect(state.phase).toBe('voting')
    state = castVote(state, 'p1', 'p2')
    state = castVote(state, 'p3', 'p2')
    const after = removePlayer(state, 'p1')
    expect(after.votes.map((vote) => vote.voterId)).not.toContain('p1')
    expect(after.votes).toHaveLength(1)
  })

  it('un vote pour un joueur déjà éliminé est refusé', () => {
    let state = advanceSpeaker(reachDiscussion(startGame(6)))
    state = {
      ...state,
      players: state.players.map((p) => (p.id === 'p2' ? { ...p, isAlive: false } : p)),
    }
    expect(() => castVote(state, 'p1', 'p2')).toThrow(/invalide/i)
  })

  it('un joueur éliminé ne peut plus voter (spectateur)', () => {
    let state = advanceSpeaker(reachDiscussion(startGame(6)))
    state = {
      ...state,
      players: state.players.map((p) => (p.id === 'p1' ? { ...p, isAlive: false } : p)),
    }
    expect(() => castVote(state, 'p1', 'p3')).toThrow(/vivants/i)
  })

  it('deux votes simultanés du même joueur : le second est rejeté', () => {
    let state = advanceSpeaker(reachDiscussion(startGame(6)))
    state = castVote(state, 'p1', 'p2')
    expect(() => castVote(state, 'p1', 'p3')).toThrow(/déjà voté/i)
    expect(state.votes).toHaveLength(1)
  })

  it('le premier orateur change à chaque tour', () => {
    let state = reachDiscussion(startGame(6))
    const firstSpeakers: string[] = []
    let guard = 0
    while (state.phase !== 'results' && guard++ < 4) {
      firstSpeakers.push(state.speakingOrder[0] as string)
      const target = state.players.find((p) => p.isAlive && p.role === 'civilian')
      if (!target) break
      state = playRoundAgainst(state, target.id)
      if (state.phase === 'mr_white_guess') {
        state = submitMrWhiteGuess(state, state.pendingMrWhiteId as string, 'Chaussure')
      }
      if (state.phase !== 'discussion') break
    }
    expect(new Set(firstSpeakers).size).toBeGreaterThan(1)
  })
})

describe('invariants de sécurité du moteur', () => {
  it('un imposteur ne reçoit jamais le mot des civils', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const state = createGame({
        players: Array.from({ length: 7 }, (_, i) => ({ id: `p${i + 1}`, name: `J${i + 1}` })),
        settings: { ...defaultSettings('impostor', 7), impostorCount: 2 },
        words: { ...WORDS, undercoverWord: null, impostorHint: 'Nourriture' },
        rng: seededRng(seed),
      })
      for (const player of state.players) {
        if (player.role === 'impostor') {
          expect(player.word).toBeNull()
          expect(player.hint).toBe('Nourriture')
        }
        if (player.role === 'civilian') {
          expect(player.word).toBe('Pizza')
          expect(player.hint).toBeNull()
        }
      }
    }
  })

  it('Mr. White ne reçoit ni mot ni indice', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const state = createGame({
        players: Array.from({ length: 6 }, (_, i) => ({ id: `p${i + 1}`, name: `J${i + 1}` })),
        settings: { ...defaultSettings('undercover', 6), undercoverCount: 1, mrWhiteCount: 1 },
        words: WORDS,
        rng: seededRng(seed),
      })
      const mrWhite = state.players.find((p) => p.role === 'mr_white')
      expect(mrWhite?.word).toBeNull()
      expect(mrWhite?.hint).toBeNull()
    }
  })

  it("aucun rôle n'est révélé publiquement avant l'élimination ou la fin", () => {
    const state = reachDiscussion(startGame(6))
    expect(state.players.every((player) => !player.roleRevealed)).toBe(true)
  })

  it('la condition de victoire ne dépend que des joueurs vivants', () => {
    const state = startGame(6)
    const allDeadIntruders = state.players.map((player) =>
      player.role === 'civilian' ? player : { ...player, isAlive: false },
    )
    expect(evaluateWinner('undercover', allDeadIntruders)).toBe('civilians')
  })
})
