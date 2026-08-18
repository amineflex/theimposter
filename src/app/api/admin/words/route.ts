import { z } from 'zod'
import { ApiError, admin, handle, jsonOk, parseBody, requireAdminUser } from '@/flexgames/core/api/http'
import { slugify } from '@/games/the-imposter/data/slug'
import { adminImpostorWordSchema, adminWordPairSchema } from '@/games/the-imposter/validations'

const kindSchema = z.enum(['impostor', 'pair'])

const createSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('impostor'), data: adminImpostorWordSchema }),
  z.object({ kind: z.literal('pair'), data: adminWordPairSchema }),
])

const singleUpdateSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('impostor'), id: z.string().uuid(), data: adminImpostorWordSchema.partial() }),
  z.object({ kind: z.literal('pair'), id: z.string().uuid(), data: adminWordPairSchema.partial() }),
])

const updateSchema = z.union([
  singleUpdateSchema,
  z.object({
    kind: kindSchema,
    ids: z.array(z.string().uuid()).min(1).max(100),
    data: z.object({ isActive: z.boolean() }),
  }),
])

const deleteSchema = z.object({
  kind: kindSchema,
  id: z.string().uuid().optional(),
  ids: z.array(z.string().uuid()).min(1).max(100).optional(),
}).refine((value) => Boolean(value.id) !== Boolean(value.ids), 'Indiquez un id ou une liste ids.')

/** GET /api/admin/words  ·  métadonnées ou liste paginée avec filtres. */
export async function GET(request: Request) {
  return handle(async () => {
    await requireAdminUser()
    const params = new URL(request.url).searchParams
    if (params.get('metadata') === 'true') return metadata()

    const kind = params.get('kind') === 'impostor' ? 'impostor' : 'pair'
    const search = params.get('search')?.trim() ?? ''
    const difficulty = params.get('difficulty')
    const category = params.get('category')
    const pack = params.get('pack')
    const status = params.get('status')
    const sort = params.get('sort') === 'updated' ? 'updated' : 'alpha'
    const page = Math.max(0, Number.parseInt(params.get('page') ?? '0', 10) || 0)
    const pageSize = Math.min(100, Math.max(10, Number.parseInt(params.get('pageSize') ?? '25', 10) || 25))

    const db = admin()
    const table = kind === 'impostor' ? 'impostor_words' : 'word_pairs'
    const linkTable = kind === 'impostor' ? 'pack_impostor_words' : 'pack_word_pairs'
    const select =
      kind === 'impostor'
        ? `id, slug, word, hint, difficulty, accepted_answers, is_active, updated_at, categories ( id, slug, name ), pack_links:${linkTable} ( packs ( slug, name ) )`
        : `id, slug, civilian_word, undercover_word, difficulty, accepted_answers, is_active, updated_at, categories ( id, slug, name ), pack_links:${linkTable} ( packs ( slug, name ) )`

    let query = db.from(table).select(select, { count: 'exact' })
    if (search) {
      const pattern = `"%${search.replaceAll('\\', '\\\\').replaceAll('"', '\\"')}%"`
      query = kind === 'impostor'
        ? query.or(`word.ilike.${pattern},hint.ilike.${pattern}`)
        : query.or(`civilian_word.ilike.${pattern},undercover_word.ilike.${pattern}`)
    }
    if (difficulty && ['easy', 'medium', 'hard'].includes(difficulty)) query = query.eq('difficulty', difficulty)
    if (status === 'active' || status === 'inactive') query = query.eq('is_active', status === 'active')

    if (category) {
      const categoryId = await idForSlug('categories', category)
      if (!categoryId) return jsonOk({ items: [], total: 0, page, pageSize })
      query = query.eq('category_id', categoryId)
    }

    if (pack) {
      const packId = await idForSlug('packs', pack)
      if (!packId) return jsonOk({ items: [], total: 0, page, pageSize })
      const idColumn = kind === 'impostor' ? 'word_id' : 'pair_id'
      const { data: links, error } = await db.from(linkTable).select(idColumn).eq('pack_id', packId)
      if (error) throw error
      const ids = ((links ?? []) as unknown as Record<string, string>[]).map((row) => row[idColumn])
      if (ids.length === 0) return jsonOk({ items: [], total: 0, page, pageSize })
      query = query.in('id', ids)
    }

    const orderColumn = sort === 'updated' ? 'updated_at' : kind === 'impostor' ? 'word' : 'civilian_word'
    const { data, count, error } = await query
      .order(orderColumn, { ascending: sort !== 'updated' })
      .range(page * pageSize, page * pageSize + pageSize - 1)
    if (error) throw error

    return jsonOk({ items: data ?? [], total: count ?? 0, page, pageSize })
  })
}

/** POST /api/admin/words  ·  crée une entrée. */
export async function POST(request: Request) {
  return handle(async () => {
    await requireAdminUser()
    const input = await parseBody(request, createSchema)
    const db = admin()
    const categoryId = await ensureCategory(input.data.category)
    const packIds = await resolvePacks(input.data.packs)

    if (input.kind === 'impostor') {
      const { data, error } = await db
        .from('impostor_words')
        .insert({
          slug: slugify(input.data.word),
          word: input.data.word,
          hint: input.data.hint,
          category_id: categoryId,
          difficulty: input.data.difficulty,
          accepted_answers: input.data.acceptedAnswers,
          is_active: input.data.isActive,
        })
        .select('id')
        .single()
      if (error) throw mapWordError(error)
      const id = (data as { id: string }).id
      await replacePackLinks('impostor', id, packIds)
      return jsonOk({ id })
    }

    const { data, error } = await db
      .from('word_pairs')
      .insert({
        slug: `${slugify(input.data.civilianWord)}--${slugify(input.data.undercoverWord)}`,
        civilian_word: input.data.civilianWord,
        undercover_word: input.data.undercoverWord,
        category_id: categoryId,
        difficulty: input.data.difficulty,
        accepted_answers: input.data.acceptedAnswers,
        is_active: input.data.isActive,
      })
      .select('id')
      .single()
    if (error) throw mapWordError(error)
    const id = (data as { id: string }).id
    await replacePackLinks('pair', id, packIds)
    return jsonOk({ id })
  })
}

/** PATCH /api/admin/words  ·  modifie une ou plusieurs entrées. */
export async function PATCH(request: Request) {
  return handle(async () => {
    await requireAdminUser()
    const input = await parseBody(request, updateSchema)
    const db = admin()

    if ('ids' in input) {
      const table = input.kind === 'impostor' ? 'impostor_words' : 'word_pairs'
      const { error } = await db
        .from(table)
        .update({ is_active: input.data.isActive, updated_at: new Date().toISOString() })
        .in('id', input.ids)
      if (error) throw mapWordError(error)
      return jsonOk({ updated: input.ids.length })
    }

    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (input.data.difficulty !== undefined) patch.difficulty = input.data.difficulty
    if (input.data.acceptedAnswers !== undefined) patch.accepted_answers = input.data.acceptedAnswers
    if (input.data.isActive !== undefined) patch.is_active = input.data.isActive
    if (input.data.category !== undefined) patch.category_id = await ensureCategory(input.data.category)

    if (input.kind === 'impostor') {
      if (input.data.word !== undefined) patch.word = input.data.word
      if (input.data.hint !== undefined) patch.hint = input.data.hint
      const { error } = await db.from('impostor_words').update(patch).eq('id', input.id)
      if (error) throw mapWordError(error)
      if (input.data.packs !== undefined) {
        await replacePackLinks('impostor', input.id, await resolvePacks(input.data.packs))
      }
      return jsonOk({})
    }

    if (input.data.civilianWord !== undefined) patch.civilian_word = input.data.civilianWord
    if (input.data.undercoverWord !== undefined) patch.undercover_word = input.data.undercoverWord
    const { error } = await db.from('word_pairs').update(patch).eq('id', input.id)
    if (error) throw mapWordError(error)
    if (input.data.packs !== undefined) {
      await replacePackLinks('pair', input.id, await resolvePacks(input.data.packs))
    }
    return jsonOk({})
  })
}

/** DELETE /api/admin/words  ·  supprime une ou plusieurs entrées. */
export async function DELETE(request: Request) {
  return handle(async () => {
    await requireAdminUser()
    const input = await parseBody(request, deleteSchema)
    const table = input.kind === 'impostor' ? 'impostor_words' : 'word_pairs'
    const ids = input.ids ?? [input.id!]
    const { error } = await admin().from(table).delete().in('id', ids)
    if (error) throw error
    return jsonOk({ deleted: ids.length })
  })
}

async function metadata() {
  const db = admin()
  const [categories, packs, impostorTotal, impostorActive, pairTotal, pairActive] = await Promise.all([
    db.from('categories').select('id, slug, name').order('name'),
    db.from('packs').select('id, slug, name, description, emoji, sort_order, is_active').order('sort_order'),
    db.from('impostor_words').select('id', { count: 'exact', head: true }),
    db.from('impostor_words').select('id', { count: 'exact', head: true }).eq('is_active', true),
    db.from('word_pairs').select('id', { count: 'exact', head: true }),
    db.from('word_pairs').select('id', { count: 'exact', head: true }).eq('is_active', true),
  ])
  const error = categories.error ?? packs.error ?? impostorTotal.error ?? impostorActive.error ?? pairTotal.error ?? pairActive.error
  if (error) throw error
  return jsonOk({
    categories: categories.data ?? [],
    packs: packs.data ?? [],
    counts: {
      impostor: { total: impostorTotal.count ?? 0, active: impostorActive.count ?? 0 },
      pair: { total: pairTotal.count ?? 0, active: pairActive.count ?? 0 },
    },
  })
}

async function idForSlug(table: 'categories' | 'packs', slug: string): Promise<string | null> {
  const { data, error } = await admin().from(table).select('id').eq('slug', slug).maybeSingle()
  if (error) throw error
  return (data as { id: string } | null)?.id ?? null
}

async function ensureCategory(name: string): Promise<string> {
  const db = admin()
  const slug = slugify(name)
  const existing = await idForSlug('categories', slug)
  if (existing) return existing
  const { data, error } = await db.from('categories').insert({ slug, name }).select('id').single()
  if (!error) return (data as { id: string }).id
  if (error.code === '23505') {
    const concurrent = await idForSlug('categories', slug)
    if (concurrent) return concurrent
  }
  throw error
}

async function resolvePacks(slugs: string[]): Promise<string[]> {
  const { data, error } = await admin().from('packs').select('id, slug').in('slug', slugs)
  if (error) throw error
  const rows = (data ?? []) as { id: string; slug: string }[]
  if (rows.length !== new Set(slugs).size) {
    throw new ApiError('Un des packs sélectionnés est inconnu.', 422, 'unknown_pack')
  }
  return rows.map((row) => row.id)
}

async function replacePackLinks(kind: 'impostor' | 'pair', id: string, packIds: string[]): Promise<void> {
  const db = admin()
  const table = kind === 'impostor' ? 'pack_impostor_words' : 'pack_word_pairs'
  const idColumn = kind === 'impostor' ? 'word_id' : 'pair_id'
  const { error: deleteError } = await db.from(table).delete().eq(idColumn, id)
  if (deleteError) throw deleteError
  const { error } = await db
    .from(table)
    .insert(packIds.map((packId) => ({ pack_id: packId, [idColumn]: id })))
  if (error) throw error
}

function mapWordError(error: { code?: string; message: string }): Error {
  if (error.code === '23505') return new ApiError('Cette entrée existe déjà.', 409, 'duplicate')
  if (error.code === '23514') {
    return new ApiError(
      "Entrée invalide : l'indice doit différer du mot, et les deux mots d'une paire doivent être distincts.",
      422,
      'check_violation',
    )
  }
  return new ApiError("Impossible d'enregistrer cette entrée.", 400, 'word_error')
}
