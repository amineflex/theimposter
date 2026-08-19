import { describe, expect, it } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Player } from '@/flexgames/core/types'
import { DEFAULT_LETTER_POP_CONFIG } from '../client'
import { createLetterPopState, openLetterPopAnswering, toPublicLetterPopState } from '../engine/state-machine'
import { letterPopServer } from '../server/module'
import {
  advanceLetterPopIfExpired,
  adjudicateLetterPopAnswer,
  finishLetterPopAnswers,
  saveLetterPopSnapshot,
  voteLetterPopAnswer,
} from '../server/service'
import type {
  LetterPopAnswerRow,
  LetterPopEvaluatedAnswer,
  LetterPopPlayerPrivateView,
  LetterPopPrivateState,
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

function answeringState(count = 2): LetterPopPrivateState {
  const state = openLetterPopAnswering(
    createLetterPopState(players(count), DEFAULT_LETTER_POP_CONFIG, `service-${count}`, 0),
    0,
  )
  return {
    ...state,
    rounds: [{ letter: 'C', categories: ['animal'] }, ...state.rounds.slice(1)],
  }
}

function memoryDb(initialState: LetterPopPrivateState) {
  let state = initialState
  let version = 1
  let publicState = toPublicLetterPopState(initialState)
  const answers: LetterPopAnswerRow[] = []
  const votes: Array<{ session_id: string; round_index: number; pending_id: string; voter_id: string; decision: boolean }> = []

  function matches(row: Record<string, unknown>, filters: Record<string, unknown>) {
    return Object.entries(filters).every(([key, value]) => row[key] === value)
  }

  function saveAnswer(playerId: string, roundIndex: number, snapshot: LetterPopAnswerRow['answers'], locked: boolean) {
    const existing = answers.find((row) => row.room_player_id === playerId && row.round_index === roundIndex)
    const timestamp = new Date().toISOString()
    if (existing) {
      if (existing.locked_at && !locked) return false
      existing.answers = snapshot
      existing.updated_at = timestamp
      if (locked) existing.locked_at = timestamp
      return true
    }
    answers.push({
      session_id: 'session',
      round_index: roundIndex,
      room_player_id: playerId,
      answers: snapshot,
      evaluations: {},
      locked_at: locked ? timestamp : null,
      updated_at: timestamp,
    })
    return true
  }

  class Query {
    private filters: Record<string, unknown> = {}
    constructor(private readonly table: string) {}
    select() { return this }
    eq(key: string, value: unknown) { this.filters[key] = value; return this }
    async maybeSingle() {
      if (this.table === 'letter_pop_sessions') {
        return { data: { session_id: 'session', room_id: 'room', state, version }, error: null }
      }
      const rows = this.table === 'letter_pop_answers' ? answers : votes
      return { data: rows.find((row) => matches(row as unknown as Record<string, unknown>, this.filters)) ?? null, error: null }
    }
    async insert(value: Record<string, unknown>) {
      if (this.table !== 'letter_pop_votes') return { error: null }
      const duplicate = votes.some((vote) => vote.session_id === value.session_id
        && vote.round_index === value.round_index
        && vote.pending_id === value.pending_id
        && vote.voter_id === value.voter_id)
      if (duplicate) return { error: { code: '23505' } }
      votes.push(value as typeof votes[number])
      return { error: null }
    }
    async upsert(values: Array<Record<string, unknown>>) {
      for (const value of values) {
        saveAnswer(String(value.room_player_id), Number(value.round_index), value.answers as LetterPopAnswerRow['answers'], true)
        const row = answers.find((candidate) => candidate.room_player_id === value.room_player_id && candidate.round_index === value.round_index)
        if (row) row.evaluations = value.evaluations as LetterPopAnswerRow['evaluations']
      }
      return { error: null }
    }
    then(resolve: (value: { data: unknown[]; error: null }) => unknown) {
      const rows = this.table === 'letter_pop_answers' ? answers : votes
      const data = rows.filter((row) => matches(row as unknown as Record<string, unknown>, this.filters))
      return Promise.resolve(resolve({ data, error: null }))
    }
  }

  const db = {
    from(table: string) { return new Query(table) },
    async rpc(name: string, input: Record<string, unknown>) {
      if (name === 'letter_pop_commit_state') {
        if (input.p_expected_version !== version) return { data: false, error: null }
        state = input.p_private_state as LetterPopPrivateState
        publicState = input.p_public_state as typeof publicState
        version += 1
        return { data: true, error: null }
      }
      if (name === 'letter_pop_save_answers') {
        const open = ['answering', 'final_countdown'].includes(state.phase)
          && input.p_round_index === state.roundIndex
        const saved = open && saveAnswer(
          String(input.p_player_id),
          Number(input.p_round_index),
          input.p_answers as LetterPopAnswerRow['answers'],
          false,
        )
        return { data: saved, error: null }
      }
      if (name === 'letter_pop_trigger_finish') {
        const accepted = input.p_expected_version === version
          && state.phase === 'answering'
          && input.p_round_index === state.roundIndex
        if (!accepted) return { data: false, error: null }
        state = input.p_private_state as LetterPopPrivateState
        publicState = input.p_public_state as typeof publicState
        saveAnswer(
          String(input.p_player_id),
          Number(input.p_round_index),
          input.p_answers as LetterPopAnswerRow['answers'],
          true,
        )
        version += 1
        return { data: true, error: null }
      }
      return { data: null, error: new Error(`RPC inconnue : ${name}`) }
    },
  } as unknown as SupabaseClient

  return {
    db,
    answers,
    votes,
    get state() { return state },
    get publicState() { return publicState },
  }
}

describe('service LetterPop en mémoire', () => {
  it('n’accepte qu’un seul premier finisher et verrouille uniquement ses réponses', async () => {
    const memory = memoryDb(answeringState())
    const [first, second] = await Promise.all([
      finishLetterPopAnswers(memory.db, 'session', 'p1', { roundIndex: 0, answers: { animal: 'Chat' } }, 1_000),
      finishLetterPopAnswers(memory.db, 'session', 'p2', { roundIndex: 0, answers: { animal: 'Chien' } }, 1_000),
    ])

    expect([first.accepted, second.accepted].filter(Boolean)).toHaveLength(1)
    expect(memory.state.phase).toBe('final_countdown')
    expect(memory.state.phaseEndsAt).toBe(new Date(11_000).toISOString())
    const winner = memory.state.triggeredByPlayerId
    const other = winner === 'p1' ? 'p2' : 'p1'
    expect(memory.answers.find((row) => row.room_player_id === winner)?.locked_at).not.toBeNull()
    await expect(saveLetterPopSnapshot(memory.db, 'session', winner!, { roundIndex: 0, answers: { animal: 'Corbeau' } }, 2_000)).rejects.toMatchObject({ code: 'answers_locked' })
    await expect(saveLetterPopSnapshot(memory.db, 'session', other, { roundIndex: 0, answers: { animal: 'Corbeau' } }, 2_000)).resolves.toMatchObject({ saved: true })
  })

  it('verrouille au timer, score une seule fois et garde le snapshot public sans réponses avant la révélation', async () => {
    const memory = memoryDb(answeringState())
    await saveLetterPopSnapshot(memory.db, 'session', 'p1', { roundIndex: 0, answers: { animal: 'Chat' } }, 1_000)
    await saveLetterPopSnapshot(memory.db, 'session', 'p2', { roundIndex: 0, answers: { animal: 'Chats' } }, 1_000)
    expect(JSON.stringify(memory.publicState)).not.toContain('Chat')

    const advanced = await advanceLetterPopIfExpired(memory.db, 'session', 60_000)
    expect(advanced.state.phase).toBe('reveal')
    expect(advanced.state.players.map((player) => player.score)).toEqual([50, 50])
    expect(memory.answers.every((row) => row.locked_at != null)).toBe(true)

    const duplicateTick = await advanceLetterPopIfExpired(memory.db, 'session', 60_000)
    expect(duplicateTick.advanced).toBe(false)
    expect(memory.state.players.map((player) => player.score)).toEqual([50, 50])
  })

  it('rend uniquement les réponses du joueur authentifié après reconnexion', async () => {
    const memory = memoryDb(answeringState())
    await saveLetterPopSnapshot(memory.db, 'session', 'p1', { roundIndex: 0, answers: { animal: 'Chat secret' } }, 1_000)

    const own = await letterPopServer.getPrivateState!({ db: memory.db, sessionId: 'session', playerId: 'p1', userId: 'u1' }) as LetterPopPlayerPrivateView
    const other = await letterPopServer.getPrivateState!({ db: memory.db, sessionId: 'session', playerId: 'p2', userId: 'u2' }) as LetterPopPlayerPrivateView
    expect(own.answers).toEqual({ animal: 'Chat secret' })
    expect(other.answers).toEqual({})
    expect(other).not.toHaveProperty('otherAnswers')
  })

  it('interdit au host de juger sa réponse et laisse l’autre joueur voter', async () => {
    const base = answeringState()
    const unknown: LetterPopEvaluatedAnswer = {
      categoryId: 'animal', original: 'Caracal', status: 'unknown', comparisonKey: 'caracal', valid: null, points: 0,
    }
    const memory = memoryDb({
      ...base,
      phase: 'validation',
      phaseEndsAt: null,
      validationPrepared: true,
      validationTotal: 1,
      pending: [{
        id: '0:p1:animal', playerId: 'p1', playerName: 'Joueur 1', categoryId: 'animal', original: 'Caracal',
        mode: 'vote', voteCount: 0, validVotes: 0, invalidVotes: 0,
      }],
      roundResults: [
        { playerId: 'p1', answers: { animal: unknown }, score: 0, uniqueCount: 0 },
        { playerId: 'p2', answers: { animal: { ...unknown, original: '', status: 'empty', valid: false } }, score: 0, uniqueCount: 0 },
      ],
    })

    await expect(adjudicateLetterPopAnswer(memory.db, 'session', 'p1', { pendingId: '0:p1:animal', valid: true }, 1_000)).rejects.toMatchObject({ code: 'decision_forbidden' })
    await expect(voteLetterPopAnswer(memory.db, 'session', 'p1', { pendingId: '0:p1:animal', valid: true }, 1_000)).rejects.toMatchObject({ code: 'vote_forbidden' })
    await expect(voteLetterPopAnswer(memory.db, 'session', 'p2', { pendingId: '0:p1:animal', valid: true }, 1_000)).resolves.toMatchObject({ accepted: true, pending: 0 })
    expect(memory.state.phase).toBe('reveal')
    expect(memory.state.roundResults[0]?.answers.animal?.valid).toBe(true)
  })
})
