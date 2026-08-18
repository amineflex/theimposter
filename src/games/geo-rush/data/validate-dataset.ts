import worldData from 'world-atlas/countries-50m.json'
import { normalizeGeoAnswer } from '../engine/scoring'
import { COUNTRIES } from './countries'

const REGIONS = new Set(['europe', 'africa', 'asia', 'americas', 'oceania'])
const DIFFICULTIES = new Set(['easy', 'normal', 'hard'])
const geometryIds = new Set(worldData.objects.countries.geometries.map((geometry) => String(geometry.id).padStart(3, '0')))

export function validateGeoDataset(): string[] {
  const errors: string[] = []
  const countryCodes = new Set<string>()
  for (const country of COUNTRIES) {
    const label = country.code || country.name || 'pays inconnu'
    if (!country.code || country.code.length !== 2) errors.push(`${label}: code ISO manquant ou invalide`)
    if (countryCodes.has(country.code)) errors.push(`${label}: pays dupliqué`)
    countryCodes.add(country.code)
    if (!country.name.trim()) errors.push(`${label}: nom français manquant`)
    if (!country.capital.trim()) errors.push(`${label}: capitale vide`)
    if (!REGIONS.has(country.region)) errors.push(`${label}: continent invalide`)
    if (!DIFFICULTIES.has(country.difficulty)) errors.push(`${label}: difficulté invalide`)
    if (!geometryIds.has(country.numericId)) errors.push(`${label}: géométrie introuvable`)

    for (const [kind, answers] of [['pays', country.aliases], ['capitale', country.capitalAliases]] as const) {
      const normalized = answers.map(normalizeGeoAnswer)
      if (new Set(normalized).size !== normalized.length) errors.push(`${label}: réponses ${kind} acceptées dupliquées`)
    }
  }
  return errors
}
