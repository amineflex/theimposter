import { describe, expect, it } from 'vitest'
import type { Player } from '@/flexgames/core/types'
import { DEFAULT_LETTER_POP_CONFIG } from '../client'
import {
  advanceLetterPopState,
  createLetterPopState,
  createRoundPlans,
  openLetterPopAnswering,
  rankLetterPopPlayers,
  resolveLetterPopDecision,
  scoreLetterPopRound,
  startFinalCountdown,
  toPublicLetterPopState,
  updateLetterPopVote,
} from '../engine/state-machine'
import type {
  LetterPopEvaluatedAnswer,
  LetterPopPendingDecision,
  LetterPopPrivateState,
  LetterPopRoundPlayerResult,
} from '../types'

function players(count: number): Player[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `p${index + 1}`,
    roomId: 'room',
    nickname: `Joueur ${index + 1}`,
    avatarId: `avatar-${index + 1}`,
    isHost: index === 0,
    connected: true,
    joinedAt: '2026-01-01T00:00:00.000Z',
  }))
}

function evaluated(original: string, key: string, valid = true): LetterPopEvaluatedAnswer {
  return { categoryId: 'animal', original, status: valid ? 'exact' : 'unknown', canonical: original, comparisonKey: key, valid, points: 0 }
}

function validationState(): LetterPopPrivateState {
  const state = createLetterPopState(players(3), DEFAULT_LETTER_POP_CONFIG, 'score', 0)
  const results: LetterPopRoundPlayerResult[] = [
    { playerId: 'p1', answers: { animal: evaluated('Chat', 'animal-chat') }, score: 0, uniqueCount: 0 },
    { playerId: 'p2', answers: { animal: evaluated('Chats', 'animal-chat') }, score: 0, uniqueCount: 0 },
    { playerId: 'p3', answers: { animal: evaluated('Chien', 'animal-chien') }, score: 0, uniqueCount: 0 },
  ]
  return {
    ...state,
    phase: 'validation',
    phaseEndsAt: null,
    validationPrepared: true,
    rounds: [{ letter: 'C', categories: ['animal'] }, ...state.rounds.slice(1)],
    roundResults: results,
  }
}

describe('plans de manches LetterPop', () => {
  it('est déterministe, respecte les manches et évite les lettres difficiles hors mode hard', () => {
    const first = createRoundPlans(DEFAULT_LETTER_POP_CONFIG, 'seed')
    expect(first).toEqual(createRoundPlans(DEFAULT_LETTER_POP_CONFIG, 'seed'))
    expect(first).toHaveLength(5)
    expect(new Set(first.map((round) => round.letter))).toHaveLength(5)
    expect(first.every((round) => !['W', 'X', 'Y', 'Z'].includes(round.letter))).toBe(true)
    expect(first.every((round) => round.categories.length === 6 && new Set(round.categories).size === 6)).toBe(true)
  })

  it('réutilise la lettre et les catégories choisies en custom', () => {
    const config = { ...DEFAULT_LETTER_POP_CONFIG, preset: 'custom' as const, customLetter: 'M' as const }
    expect(createRoundPlans(config, 'custom').every((round) => round.letter === 'M' && round.categories.join() === config.customCategories.join())).toBe(true)
  })
})

describe('machine à états LetterPop', () => {
  it('supporte 2 et 12 joueurs et ouvre une deadline serveur', () => {
    for (const count of [2, 12]) {
      const state = createLetterPopState(players(count), DEFAULT_LETTER_POP_CONFIG, `p-${count}`, 1_000)
      expect(state.players).toHaveLength(count)
      const answering = openLetterPopAnswering(state, 4_000)
      expect(answering.phase).toBe('answering')
      expect(answering.phaseEndsAt).toBe(new Date(64_000).toISOString())
    }
  })

  it('verrouille le premier joueur et crée exactement dix secondes finales', () => {
    const state = openLetterPopAnswering(createLetterPopState(players(2), DEFAULT_LETTER_POP_CONFIG, 'finish', 0), 2_200)
    const next = startFinalCountdown(state, 'p2', 10_000)
    expect(next.phase).toBe('final_countdown')
    expect(next.triggeredByPlayerId).toBe('p2')
    expect(next.phaseEndsAt).toBe(new Date(20_000).toISOString())
  })

  it('attribue 100 aux uniques, 50 aux doublons et aucun bonus vitesse', () => {
    const scored = scoreLetterPopRound(validationState(), 5_000)
    expect(scored.phase).toBe('reveal')
    expect(scored.players.map((player) => player.roundScore)).toEqual([50, 50, 100])
    expect(scored.players.map((player) => player.uniqueCount)).toEqual([0, 0, 1])
    expect(scored.roundResults[0]?.answers.animal?.points).toBe(50)
    expect(scored.roundResults[2]?.answers.animal?.points).toBe(100)
  })

  it('refuse une égalité de vote sur la réponse de l’hôte', () => {
    const base = validationState()
    const unknown = { ...evaluated('Caracal', 'caracal'), status: 'unknown' as const, valid: null }
    const pending: LetterPopPendingDecision = { id: '0:p1:animal', playerId: 'p1', playerName: 'Joueur 1', categoryId: 'animal', original: 'Caracal', mode: 'vote', voteCount: 0, validVotes: 0, invalidVotes: 0 }
    const state = { ...base, pending: [pending], validationTotal: 1, roundResults: base.roundResults.map((result) => result.playerId === 'p1' ? { ...result, answers: { animal: unknown } } : result) }
    const oneVote = updateLetterPopVote(state, pending.id, { total: 1, valid: 1, invalid: 0 }, 2, 1_000)
    expect(oneVote.phase).toBe('validation')
    const tie = updateLetterPopVote(oneVote, pending.id, { total: 2, valid: 1, invalid: 1 }, 2, 2_000)
    expect(tie.phase).toBe('reveal')
    expect(tie.roundResults[0]?.answers.animal?.valid).toBe(false)
  })

  it('permet à l’hôte de valider une réponse inconnue d’un autre joueur', () => {
    const base = validationState()
    const pending: LetterPopPendingDecision = { id: '0:p2:animal', playerId: 'p2', playerName: 'Joueur 2', categoryId: 'animal', original: 'Caracal', mode: 'host', voteCount: 0, validVotes: 0, invalidVotes: 0 }
    const unknown = { ...evaluated('Caracal', 'caracal'), status: 'unknown' as const, valid: null }
    const state = { ...base, pending: [pending], validationTotal: 1, roundResults: base.roundResults.map((result) => result.playerId === 'p2' ? { ...result, answers: { animal: unknown } } : result) }
    const resolved = resolveLetterPopDecision(state, pending.id, true, 2_000)
    expect(resolved.phase).toBe('reveal')
    expect(resolved.roundResults[1]?.answers.animal?.valid).toBe(true)
  })

  it('affiche le classement au milieu puis applique le tie-break des uniques et la victoire partagée', () => {
    const base = createLetterPopState(players(3), DEFAULT_LETTER_POP_CONFIG, 'ranking', 0)
    const mid = advanceLetterPopState({ ...base, phase: 'round_results', roundIndex: 2 }, 10_000)
    expect(mid.phase).toBe('mid_leaderboard')

    const finalBase = { ...base, phase: 'round_results' as const, roundIndex: 4 }
    const tieBreak = advanceLetterPopState({ ...finalBase, players: finalBase.players.map((player, index) => ({ ...player, score: 500, uniqueCount: [2, 4, 1][index] ?? 0 })) }, 20_000)
    expect(tieBreak.winnerIds).toEqual(['p2'])
    const shared = advanceLetterPopState({ ...finalBase, players: finalBase.players.map((player, index) => ({ ...player, score: index < 2 ? 500 : 100, uniqueCount: index < 2 ? 4 : 1 })) }, 20_000)
    expect(shared.winnerIds).toEqual(['p1', 'p2'])
    expect(rankLetterPopPlayers(shared.players).slice(0, 2).map((player) => player.rank)).toEqual([1, 1])
  })

  it('ne publie jamais les réponses ni les arbitrages avant la révélation', () => {
    const state = validationState()
    state.pending = [{ id: 'secret', playerId: 'p2', playerName: 'Joueur 2', categoryId: 'animal', original: 'Mégalodon secret', mode: 'host', voteCount: 0, validVotes: 0, invalidVotes: 0 }]
    const serialized = JSON.stringify(toPublicLetterPopState(state))
    expect(serialized).not.toContain('Mégalodon secret')
    expect(serialized).not.toContain('roundResults')
    expect(serialized).not.toContain('pendingEvaluations')
    expect(serialized).not.toContain('answerOriginal')
  })
})
