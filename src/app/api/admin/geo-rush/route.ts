import { z } from 'zod'
import { ApiError, admin, handle, jsonOk, parseBody, requireAdminUser } from '@/flexgames/core/api/http'
import { COUNTRIES } from '@/games/geo-rush/data/countries'
import {
  loadCountryOverrides,
  mergeCountryCatalog,
} from '@/games/geo-rush/server/country-catalog'

const codeSchema = z.string().length(2).transform((value) => value.toLowerCase())
const answerSchema = z.string().trim().min(1).max(80)
const countryDataSchema = z.object({
  name: z.string().trim().min(1).max(80),
  capital: z.string().trim().min(1).max(80),
  difficulty: z.enum(['easy', 'normal', 'hard']),
  aliases: z.array(answerSchema).max(25),
  capitalAliases: z.array(answerSchema).max(25),
  isActive: z.boolean(),
})
const updateSchema = z.union([
  z.object({ code: codeSchema, data: countryDataSchema }),
  z.object({ codes: z.array(codeSchema).min(1).max(100), data: z.object({ isActive: z.boolean() }) }),
])
const resetSchema = z.object({
  code: codeSchema.optional(),
  codes: z.array(codeSchema).min(1).max(100).optional(),
}).refine((value) => Boolean(value.code) !== Boolean(value.codes), 'Indiquez un code ou une liste de codes.')

/** Liste paginée du catalogue GeoRush fusionné avec ses personnalisations. */
export async function GET(request: Request) {
  return handle(async () => {
    await requireAdminUser()
    const params = new URL(request.url).searchParams
    const search = normalize(params.get('search') ?? '')
    const region = params.get('region')
    const difficulty = params.get('difficulty')
    const status = params.get('status')
    const sort = params.get('sort') === 'updated' ? 'updated' : 'alpha'
    const page = Math.max(0, Number.parseInt(params.get('page') ?? '0', 10) || 0)
    const pageSize = Math.min(100, Math.max(10, Number.parseInt(params.get('pageSize') ?? '50', 10) || 50))

    const catalog = mergeCountryCatalog(await loadCountryOverrides(admin()))
    const counts = {
      total: catalog.length,
      active: catalog.filter((country) => country.isActive).length,
      customized: catalog.filter((country) => country.customized).length,
    }
    let items = catalog.filter((country) => {
      const searchable = normalize([
        country.name,
        country.capital,
        country.code,
        ...country.aliases,
        ...country.capitalAliases,
      ].join(' '))
      return (!search || searchable.includes(search))
        && (!region || region === country.region)
        && (!difficulty || difficulty === country.difficulty)
        && (status !== 'active' || country.isActive)
        && (status !== 'inactive' || !country.isActive)
        && (status !== 'customized' || country.customized)
    })

    items = [...items].sort((a, b) => sort === 'updated'
      ? (b.updatedAt ?? '').localeCompare(a.updatedAt ?? '') || a.name.localeCompare(b.name, 'fr')
      : a.name.localeCompare(b.name, 'fr'))
    const total = items.length
    items = items.slice(page * pageSize, page * pageSize + pageSize)
    return jsonOk({ items, total, page, pageSize, counts })
  })
}

/** Modifie un pays ou active/désactive une sélection. */
export async function PATCH(request: Request) {
  return handle(async () => {
    await requireAdminUser()
    const input = await parseBody(request, updateSchema)
    const db = admin()
    const catalog = mergeCountryCatalog(await loadCountryOverrides(db))
    const byCode = new Map(catalog.map((country) => [country.code, country]))
    const now = new Date().toISOString()

    if ('code' in input) {
      const country = requireCountry(byCode, input.code)
      assertCatalogRemainsPlayable(catalog, new Map([[input.code, {
        name: input.data.name,
        capital: input.data.capital,
        difficulty: input.data.difficulty,
        aliases: unique([input.data.name, ...input.data.aliases]),
        capitalAliases: unique([input.data.capital, ...input.data.capitalAliases]),
        isActive: input.data.isActive,
      }]]))
      const { error } = await db.from('geo_country_overrides').upsert({
        code: country.code,
        name: input.data.name,
        capital: input.data.capital,
        difficulty: input.data.difficulty,
        aliases: unique(input.data.aliases),
        capital_aliases: unique(input.data.capitalAliases),
        is_active: input.data.isActive,
        updated_at: now,
      }, { onConflict: 'code' })
      if (error) throw error
      return jsonOk({ updated: 1 })
    }

    const codes = Array.from(new Set(input.codes))
    assertCatalogRemainsPlayable(catalog, new Map(codes.map((code) => [code, { isActive: input.data.isActive }])))
    const rows = codes.map((code) => {
      const country = requireCountry(byCode, code)
      return {
        code,
        name: country.name,
        capital: country.capital,
        difficulty: country.difficulty,
        aliases: country.aliases,
        capital_aliases: country.capitalAliases,
        is_active: input.data.isActive,
        updated_at: now,
      }
    })
    const { error } = await db.from('geo_country_overrides').upsert(rows, { onConflict: 'code' })
    if (error) throw error
    return jsonOk({ updated: rows.length })
  })
}

/** Supprime les personnalisations et restaure les valeurs du catalogue intégré. */
export async function DELETE(request: Request) {
  return handle(async () => {
    await requireAdminUser()
    const input = await parseBody(request, resetSchema)
    const codes = Array.from(new Set(input.codes ?? [input.code!]))
    const countries = new Map(COUNTRIES.map((country) => [country.code, country]))
    for (const code of codes) requireCountry(countries, code)
    const db = admin()
    const catalog = mergeCountryCatalog(await loadCountryOverrides(db))
    assertCatalogRemainsPlayable(catalog, new Map(codes.map((code) => {
      const country = requireCountry(countries, code)
      return [code, { ...country, isActive: true }]
    })))
    const { error } = await db.from('geo_country_overrides').delete().in('code', codes)
    if (error) throw error
    return jsonOk({ reset: codes.length })
  })
}

function requireCountry<T extends { name: string }>(countries: Map<string, T>, code: string): T {
  const country = countries.get(code)
  if (!country) throw new ApiError('Pays GeoRush inconnu.', 404, 'unknown_country')
  return country
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)))
}

function normalize(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
}

function assertCatalogRemainsPlayable(
  catalog: ManagedCountry[],
  changes: Map<string, Partial<ManagedCountry>>,
): void {
  const active = catalog
    .map((country) => ({ ...country, ...changes.get(country.code) }))
    .filter((country) => country.isActive)

  for (const region of ['europe', 'africa', 'asia', 'americas', 'oceania'] as const) {
    if (active.filter((country) => country.region === region).length < 4) {
      throw new ApiError(`GeoRush doit conserver au moins 4 pays actifs en ${regionLabel(region)}.`, 422, 'catalog_too_small')
    }
  }
  assertUniqueAnswers(active, 'aliases', 'pays')
  assertUniqueAnswers(active, 'capitalAliases', 'capitales')
}

type ManagedCountry = ReturnType<typeof mergeCountryCatalog>[number]

function assertUniqueAnswers(
  countries: ManagedCountry[],
  key: 'aliases' | 'capitalAliases',
  label: string,
): void {
  const owner = new Map<string, string>()
  for (const country of countries) {
    for (const answer of country[key]) {
      const normalized = normalize(answer).replace(/[.]/g, '').replace(/[^a-z0-9]+/g, ' ').trim()
      const other = owner.get(normalized)
      if (other && other !== country.code) {
        throw new ApiError(`La réponse « ${answer} » est déjà utilisée dans les ${label}.`, 422, 'duplicate_answer')
      }
      owner.set(normalized, country.code)
    }
  }
}

function regionLabel(region: ManagedCountry['region']): string {
  return ({ europe: 'Europe', africa: 'Afrique', asia: 'Asie', americas: 'Amériques', oceania: 'Océanie' })[region]
}
