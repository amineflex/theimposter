import { describe, expect, it } from 'vitest'
import {
  adminImpostorWordSchema,
  adminWordPairSchema,
  gameSettingsSchema,
  mrWhiteGuessSchema,
  voteSchema,
} from '../validations'
import { defaultSettings } from '../engine/engine'

describe('gameSettingsSchema', () => {
  const base = defaultSettings('undercover', 6)

  it('accepte les réglages par défaut des deux modes', () => {
    expect(gameSettingsSchema.safeParse(defaultSettings('undercover', 6)).success).toBe(true)
    expect(gameSettingsSchema.safeParse(defaultSettings('impostor', 6)).success).toBe(true)
  })

  it('refuse une durée de minuteur hors liste', () => {
    expect(gameSettingsSchema.safeParse({ ...base, speakDuration: 37 }).success).toBe(false)
    expect(gameSettingsSchema.safeParse({ ...base, speakDuration: 0 }).success).toBe(true)
  })

  it('refuse un pack inconnu', () => {
    expect(gameSettingsSchema.safeParse({ ...base, packs: ['inexistant'] }).success).toBe(false)
    expect(gameSettingsSchema.safeParse({ ...base, packs: ['animaux', 'gaming'] }).success).toBe(true)
  })

  it('refuse un mélange de rôles entre les modes', () => {
    expect(
      gameSettingsSchema.safeParse({ ...base, mode: 'impostor', impostorCount: 1, undercoverCount: 1 })
        .success,
    ).toBe(false)
  })

  it('exige un indice pour un mot personnalisé en mode imposteur', () => {
    const impostor = defaultSettings('impostor', 6)
    expect(
      gameSettingsSchema.safeParse({ ...impostor, customWord: { word: 'Girafe' } }).success,
    ).toBe(false)
    expect(
      gameSettingsSchema.safeParse({ ...impostor, customWord: { word: 'Girafe', hint: 'Animal' } })
        .success,
    ).toBe(true)
  })

  it('exige deux mots différents pour un mot personnalisé undercover', () => {
    expect(
      gameSettingsSchema.safeParse({ ...base, customWord: { word: 'Lion', undercoverWord: 'lion' } })
        .success,
    ).toBe(false)
    expect(
      gameSettingsSchema.safeParse({ ...base, customWord: { word: 'Lion', undercoverWord: 'Tigre' } })
        .success,
    ).toBe(true)
  })

  it('refuse un nombre de rôles négatif ou hors bornes', () => {
    expect(gameSettingsSchema.safeParse({ ...base, undercoverCount: -1 }).success).toBe(false)
    expect(gameSettingsSchema.safeParse({ ...base, undercoverCount: 9 }).success).toBe(false)
    expect(gameSettingsSchema.safeParse({ ...base, mrWhiteCount: 2 }).success).toBe(false)
  })
})

describe('voteSchema / mrWhiteGuessSchema', () => {
  it('exige des identifiants UUID', () => {
    expect(voteSchema.safeParse({ gameId: 'nope', targetId: 'nope' }).success).toBe(false)
    expect(
      voteSchema.safeParse({
        gameId: '00000000-0000-4000-8000-000000000000',
        targetId: '00000000-0000-4000-8000-000000000001',
      }).success,
    ).toBe(true)
  })

  it('refuse une devinette vide', () => {
    const gameId = '00000000-0000-4000-8000-000000000000'
    expect(mrWhiteGuessSchema.safeParse({ gameId, guess: '   ' }).success).toBe(false)
    expect(mrWhiteGuessSchema.safeParse({ gameId, guess: 'Pizza' }).success).toBe(true)
  })
})

describe('catalogue administrateur', () => {
  it('valide toutes les données modifiables des deux modes', () => {
    const common = {
      category: 'Technologie',
      difficulty: 'medium' as const,
      packs: ['classique'],
      acceptedAnswers: ['portable'],
      isActive: true,
    }
    expect(adminImpostorWordSchema.safeParse({ ...common, word: 'Téléphone', hint: 'Communication' }).success).toBe(true)
    expect(adminWordPairSchema.safeParse({ ...common, civilianWord: 'Téléphone', undercoverWord: 'Tablette' }).success).toBe(true)
  })

  it('refuse une entrée sans pack ou avec trop de réponses acceptées', () => {
    expect(adminWordPairSchema.safeParse({
      civilianWord: 'Téléphone',
      undercoverWord: 'Tablette',
      category: 'Technologie',
      difficulty: 'medium',
      packs: [],
      acceptedAnswers: [],
      isActive: true,
    }).success).toBe(false)
    expect(adminImpostorWordSchema.safeParse({
      word: 'Téléphone',
      hint: 'Communication',
      category: 'Technologie',
      difficulty: 'medium',
      packs: ['classique'],
      acceptedAnswers: Array.from({ length: 11 }, (_, index) => `réponse ${index}`),
      isActive: true,
    }).success).toBe(false)
  })
})
