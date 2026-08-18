import type { SupabaseClient } from '@supabase/supabase-js'
import { COUNTRIES, type GeoCountry } from '../data/countries'

export interface GeoCountryOverrideRow {
  code: string
  name: string | null
  capital: string | null
  difficulty: GeoCountry['difficulty'] | null
  aliases: string[] | null
  capital_aliases: string[] | null
  is_active: boolean
  updated_at: string
}

export interface ManagedGeoCountry extends GeoCountry {
  isActive: boolean
  customized: boolean
  updatedAt: string | null
}

function uniqueAnswers(values: string[]): string[] {
  const seen = new Set<string>()
  return values.filter((value) => {
    const key = value.normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[.]/g, '')
      .replace(/[^a-z0-9]+/g, ' ')
      .trim()
    if (!key || seen.has(key)) return false
    seen.add(key)
    return true
  })
}

/** Fusionne les données cartographiques fixes avec les champs éditables du panel. */
export function mergeCountryCatalog(
  overrides: readonly GeoCountryOverrideRow[],
  countries: readonly GeoCountry[] = COUNTRIES,
): ManagedGeoCountry[] {
  const byCode = new Map(overrides.map((row) => [row.code.toLowerCase(), row]))
  return countries.map((country) => {
    const override = byCode.get(country.code)
    const name = override?.name ?? country.name
    const capital = override?.capital ?? country.capital
    return {
      ...country,
      name,
      capital,
      difficulty: override?.difficulty ?? country.difficulty,
      aliases: uniqueAnswers([name, ...(override?.aliases ?? country.aliases)]),
      capitalAliases: uniqueAnswers([capital, ...(override?.capital_aliases ?? country.capitalAliases)]),
      isActive: override?.is_active ?? true,
      customized: override != null,
      updatedAt: override?.updated_at ?? null,
    }
  })
}

export async function loadCountryOverrides(db: SupabaseClient): Promise<GeoCountryOverrideRow[]> {
  const { data, error } = await db
    .from('geo_country_overrides')
    .select('code, name, capital, difficulty, aliases, capital_aliases, is_active, updated_at')
  if (error && (error.code === '42P01' || error.code === 'PGRST205')) return []
  if (error) throw error
  return (data ?? []) as GeoCountryOverrideRow[]
}

/** Catalogue réellement utilisé pour générer une nouvelle partie. */
export async function loadPlayableCountries(db: SupabaseClient): Promise<GeoCountry[]> {
  return mergeCountryCatalog(await loadCountryOverrides(db))
    .filter((country) => country.isActive)
    .map(({ isActive: _isActive, customized: _customized, updatedAt: _updatedAt, ...country }) => country)
}
