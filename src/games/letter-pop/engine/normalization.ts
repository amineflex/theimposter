import { CATEGORY_BY_ID } from '../data/categories'
import type { LetterPopCategoryId, LetterPopLetter } from '../types'

const INITIAL_ARTICLE = /^(?:le|la|les|l|the|a|an)\s+/
const PERSON_CONNECTORS = new Set(['de', 'du', 'des', 'van', 'von', 'da', 'di'])

export function normalizeLetterPopText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[’'`´-]/g, ' ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function normalizeForCategory(value: string, categoryId: LetterPopCategoryId): string {
  const normalized = normalizeLetterPopText(value)
  return CATEGORY_BY_ID[categoryId].letterRule === 'title'
    ? normalized.replace(INITIAL_ARTICLE, '')
    : normalized
}

function singularizeWord(value: string): string {
  if (value.length > 4 && value.endsWith('s') && !value.endsWith('ss')) return value.slice(0, -1)
  return value
}

export function duplicateComparisonKey(value: string, categoryId: LetterPopCategoryId): string {
  const normalized = normalizeForCategory(value, categoryId)
  if (!['animal', 'job', 'object', 'food', 'sport', 'clothing'].includes(categoryId)) return normalized
  const parts = normalized.split(' ')
  if (parts.length === 1) return singularizeWord(normalized)
  return [...parts.slice(0, -1), singularizeWord(parts.at(-1) ?? '')].join(' ')
}

export function answerMatchesLetter(
  value: string,
  letter: LetterPopLetter,
  categoryId: LetterPopCategoryId,
): boolean {
  const normalized = normalizeForCategory(value, categoryId)
  if (!normalized) return false
  const expected = letter.toLowerCase()
  if (CATEGORY_BY_ID[categoryId].letterRule !== 'person') return normalized.startsWith(expected)
  return normalized.split(' ').some((part) => part.length > 1 && !PERSON_CONNECTORS.has(part) && part.startsWith(expected))
}

export function areLetterPopAnswersComplete(
  categories: readonly LetterPopCategoryId[],
  answers: Partial<Record<LetterPopCategoryId, string>>,
): boolean {
  return categories.every((categoryId) => Boolean(answers[categoryId]?.trim()))
}
