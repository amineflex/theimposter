import { describe, expect, it } from 'vitest'
import { COUNTRIES, countriesFor } from '../data/countries'
import { validateGeoDataset } from '../data/validate-dataset'
import { GEO_QUESTION_TYPES, generateQuestions } from '../engine/questions'
import type { GeoConfig } from '../types'

const CONFIG: GeoConfig = { questionCount: 30, durationSeconds: 15, difficulty: 'easy', region: 'world' }

describe('dataset GeoRush', () => {
  it('ne contient que des pays jouables et des géométries correspondantes', () => {
    expect(COUNTRIES.length).toBeGreaterThan(190)
    expect(validateGeoDataset()).toEqual([])
  })

  it('applique réellement région et difficulté', () => {
    const easyEurope = countriesFor('easy', 'europe')
    expect(easyEurope.length).toBeGreaterThan(10)
    expect(easyEurope.every((country) => country.region === 'europe' && country.difficulty === 'easy')).toBe(true)
    expect(countriesFor('normal', 'africa').some((country) => country.difficulty === 'normal')).toBe(true)
    expect(countriesFor('hard', 'asia').some((country) => country.difficulty === 'hard')).toBe(true)
  })

  it('utilise la Palestine à la place d’Israël', () => {
    expect(COUNTRIES.some((country) => country.code === 'il')).toBe(false)
    expect(COUNTRIES.find((country) => country.code === 'ps')).toMatchObject({ capital: 'Jérusalem', difficulty: 'normal' })
  })

  it('connaît la position réelle de chaque capitale', () => {
    expect(COUNTRIES).toHaveLength(193)
    expect(COUNTRIES.every((country) => country.capitalCoordinates.every(Number.isFinite))).toBe(true)
    expect(COUNTRIES.find((country) => country.code === 'be')?.capitalCoordinates).toEqual([4.34878, 50.85045])
    expect(COUNTRIES.find((country) => country.code === 'ps')?.capitalCoordinates).toEqual([35.2137, 31.7683])
  })
})

describe('génération des questions', () => {
  it('est déterministe avec une seed', () => {
    expect(generateQuestions(CONFIG, 'même-seed')).toEqual(generateQuestions(CONFIG, 'même-seed'))
    expect(generateQuestions(CONFIG, 'même-seed')).not.toEqual(generateQuestions(CONFIG, 'autre-seed'))
  })

  it('respecte 10, 15 et 30 questions', () => {
    for (const questionCount of [10, 15, 30] as const) {
      expect(generateQuestions({ ...CONFIG, questionCount }, 'count')).toHaveLength(questionCount)
    }
  })

  it('équilibre les six types et évite les pays dupliqués tant que le pool suffit', () => {
    const questions = generateQuestions(CONFIG, 'balanced')
    expect(new Set(questions.map((question) => question.type))).toEqual(new Set(GEO_QUESTION_TYPES))
    expect(new Set(questions.map((question) => question.countryKey))).toHaveLength(30)
  })

  it('produit des QCM de quatre choix uniques contenant la bonne réponse', () => {
    const choices = generateQuestions(CONFIG, 'choices').filter((question) => question.answerMode === 'choices')
    expect(choices.length).toBeGreaterThan(0)
    for (const question of choices) {
      expect(question.choices).toHaveLength(4)
      expect(new Set(question.choices)).toHaveLength(4)
      expect(question.choices).toContain(question.correctAnswer)
    }
  })

  it('demande le pays et zoome pour les petites îles isolées difficiles', () => {
    const islands = COUNTRIES.filter((country) => country.preferCountryQuestions)
    const questions = generateQuestions({ ...CONFIG, difficulty: 'hard' }, 'islands', islands)

    expect(islands.some((country) => country.code === 'bs')).toBe(true)
    expect(questions.every((question) => !['map-capital', 'country-capital', 'capital-country'].includes(question.type))).toBe(true)
    expect(questions.filter((question) => question.type === 'map-country').every((question) => question.focused)).toBe(true)
  })
})
