import { describe, expect, it } from 'vitest'
import {
  generateRoomCode,
  isValidRoomCode,
  normalizeRoomCode,
  ROOM_CODE_ALPHABET,
  ROOM_CODE_LENGTH,
} from '../room-code'
import { AVATAR_KEYS, pickAvatarKey } from '@/flexgames/players/avatars'

describe('codes de room', () => {
  it('génère 6 caractères de l\'alphabet autorisé', () => {
    for (let i = 0; i < 200; i++) {
      const code = generateRoomCode()
      expect(code).toHaveLength(ROOM_CODE_LENGTH)
      for (const char of code) expect(ROOM_CODE_ALPHABET).toContain(char)
      expect(isValidRoomCode(code)).toBe(true)
    }
  })

  it("exclut les caractères visuellement ambigus", () => {
    for (const char of ['0', 'O', '1', 'I', 'L', 'S', '5', 'Z', '2', 'B', '8']) {
      expect(ROOM_CODE_ALPHABET).not.toContain(char)
    }
  })

  it('normalise les saisies utilisateur', () => {
    expect(normalizeRoomCode('k7pm-4x')).toBe('K7PM4X')
    expect(normalizeRoomCode(' k7 pm 4x ')).toBe('K7PM4X')
    expect(normalizeRoomCode('K7PM4XZZZ')).toBe('K7PM4X')
  })

  it('rejette les codes invalides', () => {
    expect(isValidRoomCode('ABC')).toBe(false)
    expect(isValidRoomCode('')).toBe(false)
    expect(isValidRoomCode('!!!!!!')).toBe(false)
  })
})

describe('avatars', () => {
  it('évite les doublons tant qu\'il reste des avatars libres', () => {
    const taken: string[] = []
    for (let i = 0; i < 12; i++) {
      const key = pickAvatarKey(taken)
      expect(taken).not.toContain(key)
      taken.push(key)
    }
  })

  it('retombe sur un tirage aléatoire quand tout est pris', () => {
    const key = pickAvatarKey(AVATAR_KEYS)
    expect(AVATAR_KEYS).toContain(key)
  })

  it('propose au moins 16 avatars distincts', () => {
    expect(new Set(AVATAR_KEYS).size).toBeGreaterThanOrEqual(16)
  })
})
