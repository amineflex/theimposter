import { describe, expect, it } from 'vitest'
import type { Player } from '@/flexgames/core/types'
import {
  advanceGeoAfterReveal,
  closeGeoQuestion,
  createGeoState,
  openGeoQuestion,
  rankPlayers,
  toPublicGeoState,
} from '../engine/state-machine'
import type { GeoConfig, GeoStoredAnswer } from '../types'

const config: GeoConfig = { questionCount: 10, durationSeconds: 10, difficulty: 'easy', region: 'world' }
const players: Player[] = Array.from({ length: 3 }, (_, index) => ({
  id: `p${index + 1}`,
  roomId: 'room',
  nickname: `Joueur ${index + 1}`,
  avatarId: `avatar-${index + 1}`,
  isHost: index === 0,
  connected: true,
  joinedAt: '2026-01-01T00:00:00.000Z',
}))

describe('machine à états GeoRush', () => {
  it('crée la même séquence serveur et ne publie aucun corrigé', () => {
    const state = createGeoState(players, config, 'session-seed', 1_000)
    const publicState = toPublicGeoState(openGeoQuestion(state, 4_000))
    expect(state.questions).toHaveLength(10)
    expect(publicState.phase).toBe('question')
    expect(publicState.question).not.toHaveProperty('correctAnswer')
    expect(publicState.question).not.toHaveProperty('acceptedAnswers')
    expect(publicState.question).not.toHaveProperty('countryKey')
    expect(publicState).not.toHaveProperty('players')
    expect(publicState).not.toHaveProperty('questions')
  })

  it('ferme dès que toutes les réponses sont présentes et calcule score, streak et rang', () => {
    const question = openGeoQuestion(createGeoState(players, config, 'round', 0), 3_000)
    const answers: GeoStoredAnswer[] = [
      { room_player_id: 'p1', submitted_answer: 'x', is_correct: true, response_ms: 800, score: 948, streak: 1 },
      { room_player_id: 'p2', submitted_answer: 'x', is_correct: false, response_ms: 1_500, score: 0, streak: 0 },
      { room_player_id: 'p3', submitted_answer: 'x', is_correct: true, response_ms: 2_000, score: 870, streak: 1 },
    ]
    const reveal = closeGeoQuestion(question, answers, 6_000)
    expect(reveal.phase).toBe('reveal')
    expect(reveal.responseCount).toBe(3)
    expect(reveal.leaderboard.map((entry) => entry.id)).toEqual(['p1', 'p3', 'p2'])
    expect(reveal.reveal?.results).not.toContainEqual(expect.objectContaining({ answer: expect.anything() }))
  })

  it('affiche le leaderboard toutes les cinq questions puis désigne le gagnant', () => {
    const base = createGeoState(players, config, 'flow', 0)
    const ranked = rankPlayers(base.players.map((player, index) => ({ ...player, score: [1200, 500, 900][index] ?? 0 })))
    const fifthReveal = { ...base, phase: 'reveal' as const, roundIndex: 4, leaderboard: ranked }
    expect(advanceGeoAfterReveal(fifthReveal, 10_000).phase).toBe('leaderboard')

    const finalReveal = { ...fifthReveal, roundIndex: 9 }
    const result = advanceGeoAfterReveal(finalReveal, 20_000)
    expect(result.phase).toBe('results')
    expect(result.winnerId).toBe('p1')
    expect(result.phaseEndsAt).toBeNull()
  })
})
