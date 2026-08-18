import { COUNTRIES, countriesFor, type GeoCountry } from '../data/countries'
import { geometryIndexFor } from '../data/geometry'
import type { GeoConfig, GeoQuestion, GeoQuestionType } from '../types'
import { seededRandom, shuffle } from './random'

export const GEO_QUESTION_TYPES: readonly GeoQuestionType[] = [
  'map-capital', 'map-country', 'flag-country', 'country-capital', 'capital-country', 'silhouette-country',
]

function distractors(country: GeoCountry, source: readonly GeoCountry[], random: () => number): GeoCountry[] {
  const closest = source.filter((candidate) => candidate.code !== country.code && candidate.region === country.region && candidate.difficulty === country.difficulty)
  const nearby = source.filter((candidate) => candidate.code !== country.code && candidate.region === country.region && candidate.difficulty !== country.difficulty)
  const fallback = source.filter((candidate) => candidate.code !== country.code && candidate.region !== country.region)
  return shuffle([...closest, ...nearby, ...fallback], random).slice(0, 3)
}

function makeQuestion(
  country: GeoCountry,
  type: GeoQuestionType,
  index: number,
  source: readonly GeoCountry[],
  random: () => number,
): GeoQuestion {
  const others = distractors(country, source, random)
  const countryChoices = shuffle([country.name, ...others.map((item) => item.name)], random)
  const capitalChoices = shuffle([country.capital, ...others.map((item) => item.capital)], random)
  const base = { id: `geo-${index + 1}-${type}` }
  const geometryIndex = geometryIndexFor(country.numericId)

  switch (type) {
    case 'map-capital':
      return { ...base, type, geometryIndex, countryKey: country.code, prompt: 'Quelle est la capitale du pays coloré ?', answerMode: 'text', correctAnswer: country.capital, acceptedAnswers: country.capitalAliases }
    case 'map-country':
      return { ...base, type, geometryIndex, countryKey: country.code, prompt: 'Quel pays est coloré sur la carte ?', answerMode: 'choices', choices: countryChoices, correctAnswer: country.name, acceptedAnswers: country.aliases }
    case 'flag-country':
      return { ...base, type, countryCode: country.code, countryKey: country.code, prompt: 'À quel pays appartient ce drapeau ?', answerMode: 'choices', choices: countryChoices, correctAnswer: country.name, acceptedAnswers: country.aliases }
    case 'country-capital':
      return { ...base, type, countryKey: country.code, prompt: `Quelle est la capitale de ${country.name} ?`, answerMode: 'choices', choices: capitalChoices, correctAnswer: country.capital, acceptedAnswers: country.capitalAliases }
    case 'capital-country':
      return { ...base, type, countryKey: country.code, prompt: `${country.capital} est la capitale de quel pays ?`, answerMode: 'text', correctAnswer: country.name, acceptedAnswers: country.aliases }
    case 'silhouette-country':
      return { ...base, type, geometryIndex, countryKey: country.code, prompt: 'Quel pays reconnais-tu à sa silhouette ?', answerMode: 'choices', choices: countryChoices, correctAnswer: country.name, acceptedAnswers: country.aliases }
  }
}

export function generateQuestions(
  config: GeoConfig,
  seed: string,
  countries: readonly GeoCountry[] = COUNTRIES,
): GeoQuestion[] {
  const random = seededRandom(seed)
  let source = countriesFor(config.difficulty, config.region, countries)
  // Certaines petites régions ont trop peu de pays faciles pour fabriquer un QCM.
  if (source.length < 4) source = countries.filter((country) => config.region === 'world' || country.region === config.region)
  if (source.length < 4) throw new Error('Pas assez de pays pour cette sélection.')

  const countryPool = shuffle(source, random)
  const typePool = shuffle(GEO_QUESTION_TYPES, random)
  return Array.from({ length: config.questionCount }, (_, index) => {
    const country = countryPool[index % countryPool.length] as GeoCountry
    const type = typePool[index % typePool.length] as GeoQuestionType
    return makeQuestion(country, type, index, source, random)
  })
}
