import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const migration = readFileSync('supabase/migrations/20250106000000_letter_pop.sql', 'utf8')

describe('sécurité SQL LetterPop', () => {
  it('protège les trois tables privées par RLS et retire leur accès navigateur', () => {
    for (const table of ['letter_pop_sessions', 'letter_pop_answers', 'letter_pop_votes']) {
      expect(migration).toContain(`alter table ${table} enable row level security`)
      expect(migration).toContain(`revoke all on ${table} from anon, authenticated`)
    }
  })

  it('réserve les RPC au service role et verrouille les écritures par phase/version', () => {
    expect(migration.match(/revoke all on function letter_pop_/g)).toHaveLength(3)
    expect(migration.match(/grant execute on function letter_pop_/g)).toHaveLength(3)
    expect(migration).toContain("and (state ->> 'phase') = 'answering'")
    expect(migration).toContain('and version = p_expected_version')
    expect(migration).toContain('where letter_pop_answers.locked_at is null')
  })
})
