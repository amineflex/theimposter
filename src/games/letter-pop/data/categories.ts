import type { LetterPopCategoryId, LetterPopDifficulty, LetterPopLetter } from '../types'

export interface LetterPopCategoryDefinition {
  id: LetterPopCategoryId
  label: string
  emoji: string
  family: 'classic' | 'culture' | 'daily'
  letterRule: 'first' | 'title' | 'person'
}

export const LETTER_POP_CATEGORIES: readonly LetterPopCategoryDefinition[] = [
  { id: 'first-name', label: 'Prénom', emoji: '👋', family: 'classic', letterRule: 'first' },
  { id: 'country', label: 'Pays', emoji: '🌍', family: 'classic', letterRule: 'first' },
  { id: 'city', label: 'Ville', emoji: '🏙️', family: 'classic', letterRule: 'first' },
  { id: 'animal', label: 'Animal', emoji: '🐾', family: 'classic', letterRule: 'first' },
  { id: 'job', label: 'Métier', emoji: '🧰', family: 'classic', letterRule: 'first' },
  { id: 'object', label: 'Objet', emoji: '📦', family: 'daily', letterRule: 'first' },
  { id: 'food', label: 'Nourriture', emoji: '🍽️', family: 'daily', letterRule: 'first' },
  { id: 'brand', label: 'Marque', emoji: '🏷️', family: 'culture', letterRule: 'title' },
  { id: 'entertainment', label: 'Film / Série / Jeu vidéo', emoji: '🎮', family: 'culture', letterRule: 'title' },
  { id: 'celebrity', label: 'Célébrité', emoji: '⭐', family: 'culture', letterRule: 'person' },
  { id: 'sport', label: 'Sport', emoji: '🏅', family: 'daily', letterRule: 'first' },
  { id: 'clothing', label: 'Vêtement', emoji: '👕', family: 'daily', letterRule: 'first' },
]

export const CATEGORY_BY_ID = Object.fromEntries(
  LETTER_POP_CATEGORIES.map((category) => [category.id, category]),
) as Record<LetterPopCategoryId, LetterPopCategoryDefinition>

export const CLASSIC_CATEGORY_POOL: readonly LetterPopCategoryId[] = [
  'first-name', 'country', 'city', 'animal', 'job', 'object', 'food', 'clothing',
]
export const POP_CATEGORY_POOL: readonly LetterPopCategoryId[] = [
  'celebrity', 'entertainment', 'brand', 'sport', 'food', 'clothing', 'first-name', 'object',
]

export const LETTER_POOLS: Record<LetterPopDifficulty, readonly LetterPopLetter[]> = {
  easy: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'L', 'M', 'P', 'R', 'S', 'T'],
  normal: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'L', 'M', 'N', 'O', 'P', 'R', 'S', 'T', 'V'],
  hard: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V'],
}

export function categoryLabel(id: LetterPopCategoryId): string {
  return CATEGORY_BY_ID[id].label
}
