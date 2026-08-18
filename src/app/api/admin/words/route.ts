import { z } from 'zod'
import { ApiError, admin, handle, jsonOk, parseBody, requireAdminUser } from '@/flexgames/core/api/http'
import { slugify } from '@/games/the-imposter/data/slug'
import { adminImpostorWordSchema, adminWordPairSchema } from '@/games/the-imposter/validations'

const createSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('impostor'), data: adminImpostorWordSchema }),
  z.object({ kind: z.literal('pair'), data: adminWordPairSchema }),
])

const updateSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('impostor'), id: z.string().uuid(), data: adminImpostorWordSchema.partial() }),
  z.object({ kind: z.literal('pair'), id: z.string().uuid(), data: adminWordPairSchema.partial() }),
])

const deleteSchema = z.object({
  kind: z.enum(['impostor', 'pair']),
  id: z.string().uuid(),
})

/** GET /api/admin/words  ·  liste paginée avec filtres. */
export async function GET(request: Request) {
  return handle(async () => {
    await requireAdminUser()
    const params = new URL(request.url).searchParams
    const kind = params.get('kind') === 'impostor' ? 'impostor' : 'pair'
    const search = params.get('search')?.trim() ?? ''
    const difficulty = params.get('difficulty')
    const pack = params.get('pack')
    const activeOnly = params.get('active') === 'true'
    const page = Math.max(0, Number(params.get('page') ?? 0))
    const pageSize = Math.min(100, Math.max(10, Number(params.get('pageSize') ?? 25)))

    const db = admin()
    const table = kind === 'impostor' ? 'impostor_words' : 'word_pairs'
    const linkTable = kind === 'impostor' ? 'pack_impostor_words' : 'pack_word_pairs'
    const select =
      kind === 'impostor'
        ? `id, slug, word, hint, difficulty, accepted_answers, is_active, updated_at, categories ( id, name ), pack_links:${linkTable} ( packs ( slug, name ) )`
        : `id, slug, civilian_word, undercover_word, difficulty, accepted_answers, is_active, updated_at, categories ( id, name ), pack_links:${linkTable} ( packs ( slug, name ) )`

    let query = db.from(table).select(select, { count: 'exact' })
    if (search) {
      query =
        kind === 'impostor'
          ? query.or(`word.ilike.%${search}%,hint.ilike.%${search}%`)
          : query.or(`civilian_word.ilike.%${search}%,undercover_word.ilike.%${search}%`)
    }
    if (difficulty && ['easy', 'medium', 'hard'].includes(difficulty)) {
      query = query.eq('difficulty', difficulty)
    }
    if (activeOnly) query = query.eq('is_active', true)

    const { data, count, error } = await query
      .order('updated_at', { ascending: false })
      .range(page * pageSize, page * pageSize + pageSize - 1)
    if (error) throw error

    type Row = { pack_links?: { packs: { slug: string } | null }[] }
    const rows = (data ?? []) as Row[]
    const filtered = pack
      ? rows.filter((row) => (row.pack_links ?? []).some((link) => link.packs?.slug === pack))
      : rows

    return jsonOk({ items: filtered, total: count ?? filtered.length, page, pageSize })
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
      const slug = slugify(input.data.word)
      const { data, error } = await db
        .from('impostor_words')
        .insert({
          slug,
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
      await db.from('pack_impostor_words').insert(packIds.map((packId) => ({ pack_id: packId, word_id: id })))
      return jsonOk({ id })
    }

    const slug = `${slugify(input.data.civilianWord)}--${slugify(input.data.undercoverWord)}`
    const { data, error } = await db
      .from('word_pairs')
      .insert({
        slug,
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
    await db.from('pack_word_pairs').insert(packIds.map((packId) => ({ pack_id: packId, pair_id: id })))
    return jsonOk({ id })
  })
}

/** PATCH /api/admin/words  ·  modifie une entrée (y compris activer/désactiver). */
export async function PATCH(request: Request) {
  return handle(async () => {
    await requireAdminUser()
    const input = await parseBody(request, updateSchema)
    const db = admin()

    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (input.data.difficulty) patch.difficulty = input.data.difficulty
    if (input.data.acceptedAnswers) patch.accepted_answers = input.data.acceptedAnswers
    if (typeof input.data.isActive === 'boolean') patch.is_active = input.data.isActive
    if (input.data.category) patch.category_id = await ensureCategory(input.data.category)

    if (input.kind === 'impostor') {
      if (input.data.word) patch.word = input.data.word
      if (input.data.hint) patch.hint = input.data.hint
      const { error } = await db.from('impostor_words').update(patch).eq('id', input.id)
      if (error) throw mapWordError(error)
      if (input.data.packs) {
        const packIds = await resolvePacks(input.data.packs)
        await db.from('pack_impostor_words').delete().eq('word_id', input.id)
        await db
          .from('pack_impostor_words')
          .insert(packIds.map((packId) => ({ pack_id: packId, word_id: input.id })))
      }
      return jsonOk({})
    }

    if (input.data.civilianWord) patch.civilian_word = input.data.civilianWord
    if (input.data.undercoverWord) patch.undercover_word = input.data.undercoverWord
    const { error } = await db.from('word_pairs').update(patch).eq('id', input.id)
    if (error) throw mapWordError(error)
    if (input.data.packs) {
      const packIds = await resolvePacks(input.data.packs)
      await db.from('pack_word_pairs').delete().eq('pair_id', input.id)
      await db
        .from('pack_word_pairs')
        .insert(packIds.map((packId) => ({ pack_id: packId, pair_id: input.id })))
    }
    return jsonOk({})
  })
}

/** DELETE /api/admin/words  ·  supprime une entrée. */
export async function DELETE(request: Request) {
  return handle(async () => {
    await requireAdminUser()
    const input = await parseBody(request, deleteSchema)
    const table = input.kind === 'impostor' ? 'impostor_words' : 'word_pairs'
    const { error } = await admin().from(table).delete().eq('id', input.id)
    if (error) throw error
    return jsonOk({})
  })
}

async function ensureCategory(name: string): Promise<string> {
  const db = admin()
  const slug = slugify(name)
  const { data: existing } = await db.from('categories').select('id').eq('slug', slug).maybeSingle()
  if (existing) return (existing as { id: string }).id
  const { data, error } = await db.from('categories').insert({ slug, name }).select('id').single()
  if (error) throw error
  return (data as { id: string }).id
}

async function resolvePacks(slugs: string[]): Promise<string[]> {
  const { data, error } = await admin().from('packs').select('id, slug').in('slug', slugs)
  if (error) throw error
  const rows = (data ?? []) as { id: string; slug: string }[]
  if (rows.length !== slugs.length) {
    throw new ApiError('Un des packs sélectionnés est inconnu.', 422, 'unknown_pack')
  }
  return rows.map((row) => row.id)
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
