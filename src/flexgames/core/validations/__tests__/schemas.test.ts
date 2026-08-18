import { describe, expect, it } from 'vitest'
import {
  chatMessageSchema,
  createRoomSchema,
  joinRoomSchema,
  playerNameSchema,
  roomCodeSchema,
} from '../schemas'

describe('playerNameSchema', () => {
  it('accepte les pseudos valides, Unicode inclus', () => {
    for (const name of ['Ana', 'Rayan', 'Élodie', '花子', 'Jean-Luc', 'x_æ-12']) {
      expect(playerNameSchema.safeParse(name).success, name).toBe(true)
    }
  })

  it('refuse trop court, trop long, ou sans lettre ni chiffre', () => {
    expect(playerNameSchema.safeParse('a').success).toBe(false)
    expect(playerNameSchema.safeParse('a'.repeat(21)).success).toBe(false)
    expect(playerNameSchema.safeParse('   ').success).toBe(false)
    expect(playerNameSchema.safeParse('!!!').success).toBe(false)
  })

  it('supprime les espaces autour', () => {
    expect(playerNameSchema.parse('  Sarah  ')).toBe('Sarah')
  })
})
describe('roomCodeSchema', () => {
  it('normalise en majuscules et retire les séparateurs', () => {
    expect(roomCodeSchema.parse('k7pm-4x')).toBe('K7PM4X')
    expect(roomCodeSchema.parse(' k7pm4x ')).toBe('K7PM4X')
  })

  it('refuse une longueur incorrecte', () => {
    expect(roomCodeSchema.safeParse('ABC').success).toBe(false)
    expect(roomCodeSchema.safeParse('ABCDEFG').success).toBe(false)
  })
})

describe('createRoomSchema', () => {
  it("borne le nombre de joueurs et vérifie l'identifiant de jeu", () => {
    const payload = {
      gameId: 'the-imposter',
      playerName: 'Hôte',
      visibility: 'private' as const,
      config: { anything: true },
      maxPlayers: 8,
    }
    expect(createRoomSchema.safeParse(payload).success).toBe(true)
    expect(createRoomSchema.safeParse({ ...payload, maxPlayers: 2 }).success).toBe(true)
    expect(createRoomSchema.safeParse({ ...payload, maxPlayers: 1 }).success).toBe(false)
    expect(createRoomSchema.safeParse({ ...payload, gameId: 'Nope!' }).success).toBe(false)
  })
})

describe('joinRoomSchema', () => {
  it('normalise le code et valide le pseudo', () => {
    const result = joinRoomSchema.parse({ code: 'k7pm4x', playerName: ' Rayan ' })
    expect(result).toEqual({ code: 'K7PM4X', playerName: 'Rayan' })
  })
})

describe('chatMessageSchema', () => {
  it('refuse un message vide ou trop long', () => {
    const base = { roomId: '00000000-0000-4000-8000-000000000000', kind: 'text' as const }
    expect(chatMessageSchema.safeParse({ ...base, body: '   ' }).success).toBe(false)
    expect(chatMessageSchema.safeParse({ ...base, body: 'a'.repeat(201) }).success).toBe(false)
    expect(chatMessageSchema.safeParse({ ...base, body: 'Salut' }).success).toBe(true)
  })
})
