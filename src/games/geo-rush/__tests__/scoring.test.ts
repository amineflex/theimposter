import { describe, expect, it } from 'vitest'
import { isAcceptedAnswer, normalizeGeoAnswer, scoreGeoAnswer } from '../engine/scoring'

describe('réponses GeoRush', () => {
  it('normalise casse, accents, espaces, apostrophes, tirets et ponctuation', () => {
    expect(normalizeGeoAnswer('  ÉTATS—Unis ! ')).toBe('etats unis')
    expect(normalizeGeoAnswer("Côte d’Ivoire")).toBe('cote d ivoire')
    expect(isAcceptedAnswer(' washington d.c. ', ['Washington DC'])).toBe(true)
  })

  it('accepte les alias mais pas une réponse différente', () => {
    expect(isAcceptedAnswer('USA', ['États-Unis', 'USA'])).toBe(true)
    expect(isAcceptedAnswer('Canada', ['États-Unis', 'USA'])).toBe(false)
  })
})

describe('score et série', () => {
  it('récompense fortement la vitesse entre 350 et 1000 points', () => {
    expect(scoreGeoAnswer(0, 10, 1)).toBe(1000)
    expect(scoreGeoAnswer(5_000, 10, 1)).toBe(675)
    expect(scoreGeoAnswer(10_000, 10, 1)).toBe(350)
  })

  it('plafonne le bonus de série à 150 points', () => {
    expect(scoreGeoAnswer(0, 10, 2)).toBe(1000)
    expect(scoreGeoAnswer(0, 10, 3)).toBe(1050)
    expect(scoreGeoAnswer(0, 10, 4)).toBe(1100)
    expect(scoreGeoAnswer(0, 10, 5)).toBe(1150)
    expect(scoreGeoAnswer(0, 10, 99)).toBe(1150)
  })
})
