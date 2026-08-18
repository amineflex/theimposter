import type { SupabaseClient } from '@supabase/supabase-js'
import {
  customWordSet,
  selectWordEntry,
  toWordSet,
  type ImpostorWordEntry,
  type WordPairEntry,
} from '@/games/the-imposter/engine/word-selection'
import type { GameSettings, WordSet } from '@/games/the-imposter/engine/types'

interface WordRow {
  id: string
  slug: string
  difficulty: 'easy' | 'medium' | 'hard'
  accepted_answers: string[]
  categories: { name: string } | null
  pack_links: { packs: { slug: string } | null }[]
}

interface ImpostorRow extends WordRow {
  word: string
  hint: string
}

interface PairRow extends WordRow {
  civilian_word: string
  undercover_word: string
}

const IMPOSTOR_SELECT = `
  id, slug, word, hint, difficulty, accepted_answers,
  categories ( name ),
  pack_links:pack_impostor_words ( packs ( slug ) )
`

const PAIR_SELECT = `
  id, slug, civilian_word, undercover_word, difficulty, accepted_answers,
  categories ( name ),
  pack_links:pack_word_pairs ( packs ( slug ) )
`

function packsOf(row: WordRow): string[] {
  return row.pack_links.map((link) => link.packs?.slug).filter((slug): slug is string => Boolean(slug))
}

/**
 * Résout le contenu lexical d'une partie.
 *
 * Priorité : mot personnalisé de l'hôte > catalogue filtré (packs, difficulté)
 * en évitant les entrées récemment jouées. La sélection dégrade
 * progressivement ses filtres si le pool devient trop petit (cf.
 * `selectWordEntry`), et n'échoue que si le catalogue est vide.
 */
export async function resolveWordSet(
  admin: SupabaseClient,
  settings: GameSettings,
  options: { excludeIds?: string[] } = {},
): Promise<WordSet> {
  if (settings.customWord) {
    return customWordSet(settings.mode, settings.customWord)
  }

  const excludeIds = options.excludeIds ?? []

  if (settings.mode === 'impostor') {
    const { data, error } = await admin.from('impostor_words').select(IMPOSTOR_SELECT).eq('is_active', true)
    if (error) throw error
    const entries: ImpostorWordEntry[] = ((data ?? []) as unknown as ImpostorRow[]).map((row) => ({
      id: row.id,
      word: row.word,
      hint: row.hint,
      category: row.categories?.name ?? 'Divers',
      difficulty: row.difficulty,
      packs: packsOf(row),
      acceptedAnswers: row.accepted_answers,
    }))
    if (entries.length === 0) {
      throw new Error("La base de mots est vide : exécutez le seed Supabase (supabase/seed.sql).")
    }
    const { entry } = selectWordEntry(entries, {
      difficulty: settings.difficulty,
      packs: settings.packs,
      excludeIds,
    })
    return toWordSet(entry, 'impostor')
  }

  const { data, error } = await admin.from('word_pairs').select(PAIR_SELECT).eq('is_active', true)
  if (error) throw error
  const entries: WordPairEntry[] = ((data ?? []) as unknown as PairRow[]).map((row) => ({
    id: row.id,
    civilianWord: row.civilian_word,
    undercoverWord: row.undercover_word,
    category: row.categories?.name ?? 'Divers',
    difficulty: row.difficulty,
    packs: packsOf(row),
    acceptedAnswers: row.accepted_answers,
  }))
  if (entries.length === 0) {
    throw new Error("La base de mots est vide : exécutez le seed Supabase (supabase/seed.sql).")
  }
  const { entry } = selectWordEntry(entries, {
    difficulty: settings.difficulty,
    packs: settings.packs,
    excludeIds,
  })
  return toWordSet(entry, 'undercover')
}

/** Mots déjà utilisés par les parties précédentes de cette room. */
export async function recentWordIdsForRoom(
  admin: SupabaseClient,
  roomId: string,
  limit = 20,
): Promise<string[]> {
  const { data } = await admin
    .from('games')
    .select('word_source_id')
    .eq('room_id', roomId)
    .not('word_source_id', 'is', null)
    .order('started_at', { ascending: false })
    .limit(limit)
  return ((data ?? []) as { word_source_id: string | null }[])
    .map((row) => row.word_source_id)
    .filter((id): id is string => Boolean(id))
}
