import { describe, expect, it } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Player } from '@/flexgames/core/types'
import { createGeoState, openGeoQuestion } from '../engine/state-machine'
import { submitGeoAnswer } from '../server/service'
import type { GeoPrivateState, GeoStoredAnswer } from '../types'

function players(count: number): Player[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `p${index + 1}`, roomId: 'room', nickname: `J${index + 1}`, avatarId: `a${index + 1}`,
    isHost: index === 0, connected: true, joinedAt: '2026-01-01T00:00:00Z',
  }))
}

function memoryDb(initialState: GeoPrivateState) {
  let state = initialState
  let version = 1
  const answers: (GeoStoredAnswer & { session_id: string; round_index: number })[] = []

  class Query {
    filters: Record<string, unknown> = {}
    constructor(private table: string) {}
    select() { return this }
    eq(key: string, value: unknown) { this.filters[key] = value; return this }
    async maybeSingle() {
      if (this.table === 'geo_sessions') return { data: { session_id: 'session', room_id: 'room', state, version }, error: null }
      return { data: null, error: null }
    }
    async insert(value: Record<string, unknown>) {
      const duplicate = answers.some((answer) => answer.session_id === value.session_id && answer.round_index === value.round_index && answer.room_player_id === value.room_player_id)
      if (duplicate) return { error: { code: '23505' } }
      answers.push(value as unknown as typeof answers[number])
      return { error: null }
    }
    then(resolve: (value: { data: unknown[]; error: null }) => unknown) {
      const data = answers.filter((answer) => Object.entries(this.filters).every(([key, value]) => answer[key as keyof typeof answer] === value))
      return Promise.resolve(resolve({ data, error: null }))
    }
  }

  const db = {
    from(table: string) { return new Query(table) },
    async rpc(_name: string, input: { p_expected_version: number; p_private_state: GeoPrivateState }) {
      if (input.p_expected_version !== version) return { data: false, error: null }
      state = input.p_private_state
      version += 1
      return { data: true, error: null }
    },
  } as unknown as SupabaseClient

  return { db, get state() { return state }, answers }
}

describe('service GeoRush en mémoire', () => {
  it('attribue le score côté serveur, refuse le doublon et ferme quand tous ont répondu', async () => {
    const initial = openGeoQuestion(createGeoState(players(2), { questionCount: 10, durationSeconds: 10, difficulty: 'easy', region: 'world' }, 'integration', 0), 1_000)
    const memory = memoryDb(initial)
    const correct = initial.questions[0]?.correctAnswer ?? ''

    expect(await submitGeoAnswer(memory.db, 'session', 'p1', { roundIndex: 0, answer: correct }, 2_000)).toEqual({ accepted: true, duplicate: false })
    expect(memory.answers[0]?.score).toBeGreaterThan(350)
    expect(await submitGeoAnswer(memory.db, 'session', 'p1', { roundIndex: 0, answer: correct }, 2_100)).toEqual({ accepted: false, duplicate: true })
    expect(memory.answers).toHaveLength(1)

    await submitGeoAnswer(memory.db, 'session', 'p2', { roundIndex: 0, answer: 'réponse fausse' }, 2_500)
    expect(memory.state.phase).toBe('reveal')
    expect(memory.state.leaderboard[0]?.id).toBe('p1')
  })

  it('refuse une réponse reçue après la deadline officielle', async () => {
    const initial = openGeoQuestion(createGeoState(players(2), { questionCount: 10, durationSeconds: 10, difficulty: 'easy', region: 'world' }, 'late', 0), 1_000)
    const memory = memoryDb(initial)
    await expect(submitGeoAnswer(memory.db, 'session', 'p1', { roundIndex: 0, answer: 'x' }, 11_001)).rejects.toMatchObject({ code: 'time_up' })
    expect(memory.answers).toHaveLength(0)
    expect(memory.state.phase).toBe('reveal')
  })

  it('supporte les bornes de 2 et 12 participants', () => {
    for (const count of [2, 12]) {
      const state = createGeoState(players(count), { questionCount: 10, durationSeconds: 10, difficulty: 'easy', region: 'world' }, `players-${count}`, 0)
      expect(state.totalPlayers).toBe(count)
      expect(state.players).toHaveLength(count)
    }
  })
})
