import { shuffle } from './roles'
import type { Difficulty, GameMode, Rng, WordSet } from './types'

/** Entrée brute pour le mode Imposteur. */
export interface ImpostorWordEntry {
  id: string
  word: string
  hint: string
  category: string
  difficulty: Difficulty
  packs: string[]
  acceptedAnswers?: string[]
}

/** Entrée brute pour le mode Undercover. */
export interface WordPairEntry {
  id: string
  civilianWord: string
  undercoverWord: string
  category: string
  difficulty: Difficulty
  packs: string[]
  acceptedAnswers?: string[]
}

export type WordEntry = ImpostorWordEntry | WordPairEntry

export interface SelectionFilters {
  difficulty: Difficulty | 'all'
  /** Slugs de packs. Vide = tous. */
  packs: string[]
  /** Ids des entrées récemment jouées, à éviter. */
  excludeIds: string[]
}

export interface SelectionResult<T extends WordEntry> {
  entry: T
  /** true si le filtre d'anti-répétition a dû être relâché. */
  relaxed: boolean
}

/**
 * Sélectionne une entrée en respectant les filtres, avec dégradation
 * progressive : d'abord filtres + anti-répétition, puis filtres seuls, puis
 * pack seul, puis n'importe quelle entrée. Lève une erreur seulement si le
 * catalogue est totalement vide.
 */
export function selectWordEntry<T extends WordEntry>(
  entries: readonly T[],
  filters: SelectionFilters,
  rng: Rng = Math.random,
): SelectionResult<T> {
  if (entries.length === 0) throw new Error('Aucun mot disponible.')

  const matchesPack = (entry: T) =>
    filters.packs.length === 0 || entry.packs.some((p) => filters.packs.includes(p))
  const matchesDifficulty = (entry: T) =>
    filters.difficulty === 'all' || entry.difficulty === filters.difficulty
  const notRecent = (entry: T) => !filters.excludeIds.includes(entry.id)

  const tiers: { pool: T[]; relaxed: boolean }[] = [
    { pool: entries.filter((e) => matchesPack(e) && matchesDifficulty(e) && notRecent(e)), relaxed: false },
    { pool: entries.filter((e) => matchesPack(e) && matchesDifficulty(e)), relaxed: true },
    { pool: entries.filter((e) => matchesPack(e) && notRecent(e)), relaxed: true },
    { pool: entries.filter(matchesPack), relaxed: true },
    { pool: entries.filter(notRecent), relaxed: true },
    { pool: entries.slice(), relaxed: true },
  ]

  for (const tier of tiers) {
    if (tier.pool.length > 0) {
      const picked = shuffle(tier.pool, rng)[0] as T
      return { entry: picked, relaxed: tier.relaxed }
    }
  }
  throw new Error('Aucun mot disponible.')
}

export function toWordSet(entry: WordEntry, mode: GameMode): WordSet {
  if (mode === 'impostor') {
    const impostorEntry = entry as ImpostorWordEntry
    return {
      civilianWord: impostorEntry.word,
      undercoverWord: null,
      impostorHint: impostorEntry.hint,
      acceptedAnswers: impostorEntry.acceptedAnswers ?? [],
      sourceId: impostorEntry.id,
      category: impostorEntry.category,
      difficulty: impostorEntry.difficulty,
    }
  }
  const pair = entry as WordPairEntry
  return {
    civilianWord: pair.civilianWord,
    undercoverWord: pair.undercoverWord,
    impostorHint: null,
    acceptedAnswers: pair.acceptedAnswers ?? [],
    sourceId: pair.id,
    category: pair.category,
    difficulty: pair.difficulty,
  }
}

/** Construit un WordSet à partir d'un mot personnalisé fourni par l'hôte. */
export function customWordSet(
  mode: GameMode,
  custom: { word: string; hint?: string | null; undercoverWord?: string | null },
): WordSet {
  return {
    civilianWord: custom.word.trim(),
    undercoverWord: mode === 'undercover' ? (custom.undercoverWord?.trim() ?? null) : null,
    impostorHint: mode === 'impostor' ? (custom.hint?.trim() ?? null) : null,
    acceptedAnswers: [],
    sourceId: null,
    category: null,
    difficulty: null,
  }
}
