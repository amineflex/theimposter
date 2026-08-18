import rawCountries from 'world-countries'
import type { GeoDifficulty, GeoRegion } from '../types'

export interface GeoCountry {
  code: string
  numericId: string
  name: string
  capital: string
  region: Exclude<GeoRegion, 'world'>
  difficulty: GeoDifficulty
  aliases: string[]
  capitalAliases: string[]
}

const EASY = new Set([
  'AR', 'AU', 'BE', 'BR', 'CA', 'CH', 'CN', 'DE', 'DK', 'EG', 'ES', 'FI', 'FR', 'GB', 'GR',
  'IE', 'IN', 'IS', 'IT', 'JP', 'KR', 'MA', 'MX', 'NL', 'NO', 'NZ', 'PL', 'PT', 'RU', 'SE',
  'TR', 'US', 'ZA',
])

const NORMAL = new Set([
  'AE', 'AT', 'BD', 'BG', 'BO', 'CL', 'CO', 'CR', 'CU', 'CZ', 'DO', 'DZ', 'EC', 'EE', 'ET',
  'GH', 'GT', 'HR', 'HU', 'ID', 'PS', 'IQ', 'IR', 'JM', 'JO', 'KE', 'KH', 'KZ', 'LB', 'LK',
  'LT', 'LU', 'LV', 'MC', 'MG', 'MN', 'MY', 'NG', 'NP', 'PA', 'PE', 'PH', 'PK', 'RO', 'RS',
  'SA', 'SG', 'SI', 'SK', 'SN', 'TH', 'TN', 'UA', 'UY', 'VA', 'VE', 'VN',
])

const CAPITAL_OVERRIDES: Record<string, string> = {
  AL: 'Tirana', BE: 'Bruxelles', BY: 'Minsk', CZ: 'Prague', EE: 'Tallinn', GR: 'Athènes',
  IE: 'Dublin', IS: 'Reykjavik', LV: 'Riga', LT: 'Vilnius', MK: 'Skopje', ME: 'Podgorica',
  NL: 'Amsterdam', PL: 'Varsovie', PT: 'Lisbonne', RO: 'Bucarest', RU: 'Moscou',
  PS: 'Jérusalem', SE: 'Stockholm', TR: 'Ankara', UA: 'Kyiv', US: 'Washington', VA: 'Cité du Vatican',
}

const COUNTRY_ALIASES: Record<string, string[]> = {
  CD: ['Congo-Kinshasa', 'RDC', 'République démocratique du Congo'],
  CG: ['Congo-Brazzaville', 'République du Congo'],
  CI: ["Côte d'Ivoire", 'Cote d Ivoire'],
  CZ: ['Tchéquie', 'République tchèque'],
  GB: ['Royaume-Uni', 'Grande-Bretagne', 'Angleterre'],
  KR: ['Corée du Sud'], KP: ['Corée du Nord'], LA: ['Laos'], MD: ['Moldavie'],
  MK: ['Macédoine du Nord'], MM: ['Birmanie', 'Myanmar'], NL: ['Pays-Bas', 'Hollande'],
  PS: ['Palestine'], RU: ['Russie'], SZ: ['Eswatini', 'Swaziland'],
  US: ['États-Unis', 'Etats-Unis', 'USA', 'United States'], VA: ['Vatican', 'Cité du Vatican'],
}

const CAPITAL_ALIASES: Record<string, string[]> = {
  BE: ['Brussels'], CI: ['Yamoussoukro'], CZ: ['Praha'], GR: ['Athens'],
  RU: ['Moscow'], UA: ['Kiev'], US: ['Washington DC', 'Washington D.C.'], VA: ['Vatican'],
}

function mapRegion(region: string): Exclude<GeoRegion, 'world'> | null {
  if (region === 'Europe') return 'europe'
  if (region === 'Africa') return 'africa'
  if (region === 'Asia') return 'asia'
  if (region === 'Americas') return 'americas'
  if (region === 'Oceania') return 'oceania'
  return null
}

function uniqueAnswers(values: string[]): string[] {
  const seen = new Set<string>()
  return values.filter((value) => {
    const key = value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[.]/g, '').replace(/[^a-z0-9]+/g, ' ').trim()
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

export const COUNTRIES: GeoCountry[] = rawCountries.flatMap((country) => {
  const region = mapRegion(country.region)
  // Le fond Natural Earth 1:50m contient tous ces États sauf Tuvalu. On écarte
  // ce seul cas afin qu'aucune question cartographique ne rende une forme vide.
  const included =
    (country.unMember || country.cca2 === 'VA' || country.cca2 === 'PS') &&
    country.cca2 !== 'IL' &&
    country.cca2 !== 'TV'
  const capital = country.capital[0]
  if (!included || !region || !capital || !country.ccn3) return []

  const name = country.translations.fra?.common ?? country.name.common
  const difficulty: GeoDifficulty = EASY.has(country.cca2)
    ? 'easy'
    : NORMAL.has(country.cca2)
      ? 'normal'
      : 'hard'
  return [{
    code: country.cca2.toLowerCase(),
    numericId: country.ccn3,
    name,
    capital: CAPITAL_OVERRIDES[country.cca2] ?? capital,
    region,
    difficulty,
    aliases: uniqueAnswers([name, country.name.common, ...(COUNTRY_ALIASES[country.cca2] ?? [])]),
    capitalAliases: uniqueAnswers([
      CAPITAL_OVERRIDES[country.cca2] ?? capital,
      capital,
      ...(CAPITAL_ALIASES[country.cca2] ?? []),
    ]),
  }]
}).sort((a, b) => a.name.localeCompare(b.name, 'fr'))

export function countriesFor(difficulty: GeoDifficulty, region: GeoRegion): GeoCountry[] {
  const allowedDifficulties: GeoDifficulty[] =
    difficulty === 'easy' ? ['easy'] : difficulty === 'normal' ? ['easy', 'normal'] : ['easy', 'normal', 'hard']
  return COUNTRIES.filter((country) =>
    allowedDifficulties.includes(country.difficulty) && (region === 'world' || country.region === region),
  )
}
