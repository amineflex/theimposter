import { describe, expect, it } from 'vitest'
import { COUNTRIES } from '../data/countries'
import { mergeCountryCatalog, type GeoCountryOverrideRow } from '../server/country-catalog'

function override(values: Partial<GeoCountryOverrideRow> & Pick<GeoCountryOverrideRow, 'code'>): GeoCountryOverrideRow {
  return {
    name: null,
    capital: null,
    difficulty: null,
    aliases: null,
    capital_aliases: null,
    is_active: true,
    updated_at: '2026-08-18T12:00:00.000Z',
    ...values,
  }
}

describe('catalogue administrable GeoRush', () => {
  it('fusionne les champs modifiables sans toucher à la géométrie', () => {
    const belgium = COUNTRIES.find((country) => country.code === 'be')!
    const managed = mergeCountryCatalog([
      override({
        code: 'be',
        name: 'Belgique test',
        capital: 'Capitale test',
        difficulty: 'hard',
        aliases: ['Belgique test', 'BE test'],
        capital_aliases: ['Capitale test', 'CT'],
      }),
    ], [belgium])[0]!

    expect(managed).toMatchObject({
      code: 'be',
      numericId: belgium.numericId,
      region: belgium.region,
      name: 'Belgique test',
      capital: 'Capitale test',
      difficulty: 'hard',
      aliases: ['Belgique test', 'BE test'],
      capitalAliases: ['Capitale test', 'CT'],
      isActive: true,
      customized: true,
    })
  })

  it('conserve les valeurs intégrées sans surcharge et expose la désactivation', () => {
    const france = COUNTRIES.find((country) => country.code === 'fr')!
    const managed = mergeCountryCatalog([override({ code: 'fr', is_active: false })], [france])[0]!

    expect(managed.name).toBe(france.name)
    expect(managed.capital).toBe(france.capital)
    expect(managed.isActive).toBe(false)
    expect(managed.customized).toBe(true)
  })

  it('ignore les surcharges dont le code ne correspond à aucune carte', () => {
    expect(mergeCountryCatalog([override({ code: 'zz', name: 'Inconnu' })], [])).toEqual([])
  })
})
