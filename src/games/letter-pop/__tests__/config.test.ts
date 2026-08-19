import { describe, expect, it } from 'vitest'
import { DEFAULT_LETTER_POP_CONFIG } from '../client'
import { letterPopConfigSchema } from '../validations'

describe('configuration LetterPop', () => {
  it('accepte les options officielles et refuse les valeurs hors lobby', () => {
    expect(letterPopConfigSchema.safeParse(DEFAULT_LETTER_POP_CONFIG).success).toBe(true)
    expect(letterPopConfigSchema.safeParse({ ...DEFAULT_LETTER_POP_CONFIG, roundCount: 4 }).success).toBe(false)
    expect(letterPopConfigSchema.safeParse({ ...DEFAULT_LETTER_POP_CONFIG, durationSeconds: 20 }).success).toBe(false)
    expect(letterPopConfigSchema.safeParse({ ...DEFAULT_LETTER_POP_CONFIG, categoryCount: 9 }).success).toBe(false)
  })

  it('exige exactement le bon nombre de catégories en custom', () => {
    expect(letterPopConfigSchema.safeParse({ ...DEFAULT_LETTER_POP_CONFIG, preset: 'custom' }).success).toBe(true)
    expect(letterPopConfigSchema.safeParse({ ...DEFAULT_LETTER_POP_CONFIG, preset: 'custom', customCategories: ['animal'] }).success).toBe(false)
  })
})
