import { describe, expect, it } from 'vitest'
import { geoConfigSchema } from '../validations'

describe('configuration GeoRush', () => {
  it('accepte uniquement les choix du lobby', () => {
    expect(geoConfigSchema.safeParse({ questionCount: 10, durationSeconds: 20, difficulty: 'hard', region: 'oceania' }).success).toBe(true)
    expect(geoConfigSchema.safeParse({ questionCount: 20, durationSeconds: 12, difficulty: 'expert', region: 'moon' }).success).toBe(false)
  })
})
