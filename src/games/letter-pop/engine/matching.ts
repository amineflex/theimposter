import type { LetterPopDatasetEntry } from '../data/datasets'
import { LETTER_POP_DATASETS } from '../data/datasets'
import type {
  LetterPopCategoryId,
  LetterPopEvaluatedAnswer,
  LetterPopLetter,
  LetterPopMatchStatus,
} from '../types'
import {
  answerMatchesLetter,
  duplicateComparisonKey,
  normalizeForCategory,
  normalizeLetterPopText,
} from './normalization'

export interface LetterPopDatasetMatch {
  status: Extract<LetterPopMatchStatus, 'exact' | 'alias' | 'fuzzy' | 'unknown'>
  entityId?: string
  canonical?: string
  confidence?: number
}

export function levenshtein(left: string, right: string): number {
  if (left === right) return 0
  if (!left) return right.length
  if (!right) return left.length
  let previous = Array.from({ length: right.length + 1 }, (_, index) => index)
  for (let row = 1; row <= left.length; row += 1) {
    const current = [row]
    for (let column = 1; column <= right.length; column += 1) {
      current[column] = Math.min(
        (current[column - 1] ?? 0) + 1,
        (previous[column] ?? 0) + 1,
        (previous[column - 1] ?? 0) + (left[row - 1] === right[column - 1] ? 0 : 1),
      )
    }
    previous = current
  }
  return previous[right.length] ?? Math.max(left.length, right.length)
}

function keys(entry: LetterPopDatasetEntry, categoryId: LetterPopCategoryId): string[] {
  return [entry.canonical, ...entry.aliases].map((value) => normalizeForCategory(value, categoryId))
}

function fuzzyLimit(length: number): number {
  if (length >= 9) return 2
  if (length >= 5) return 1
  return 0
}

export function matchAnswerToDataset(
  answer: string,
  categoryId: LetterPopCategoryId,
  dataset: readonly LetterPopDatasetEntry[] = LETTER_POP_DATASETS[categoryId],
): LetterPopDatasetMatch {
  const normalized = normalizeForCategory(answer, categoryId)
  const comparison = duplicateComparisonKey(answer, categoryId)
  if (!normalized) return { status: 'unknown' }

  for (const candidate of dataset) {
    const [canonical, ...aliases] = keys(candidate, categoryId)
    if (normalized === canonical) return { status: 'exact', entityId: candidate.id, canonical: candidate.canonical, confidence: 1 }
    if (aliases.includes(normalized) || duplicateComparisonKey(candidate.canonical, categoryId) === comparison) {
      return { status: 'alias', entityId: candidate.id, canonical: candidate.canonical, confidence: 1 }
    }
  }

  const limit = fuzzyLimit(normalized.length)
  if (limit === 0) return { status: 'unknown' }
  let best: { entry: LetterPopDatasetEntry; distance: number } | null = null
  let tied = false
  for (const candidate of dataset) {
    const distance = Math.min(...keys(candidate, categoryId).map((key) => levenshtein(normalized, key)))
    if (distance > limit) continue
    if (!best || distance < best.distance) {
      best = { entry: candidate, distance }
      tied = false
    } else if (distance === best.distance && candidate.id !== best.entry.id) {
      tied = true
    }
  }
  if (!best || tied) return { status: 'unknown' }
  return {
    status: 'fuzzy',
    entityId: best.entry.id,
    canonical: best.entry.canonical,
    confidence: Number((1 - best.distance / Math.max(normalized.length, 1)).toFixed(3)),
  }
}

export function evaluateLetterPopAnswer(
  original: string,
  categoryId: LetterPopCategoryId,
  letter: LetterPopLetter,
): LetterPopEvaluatedAnswer {
  const trimmed = original.trim()
  if (!trimmed) return { categoryId, original: '', status: 'empty', valid: false, points: 0 }
  if (!answerMatchesLetter(trimmed, letter, categoryId)) {
    return { categoryId, original: trimmed, status: 'wrong-letter', valid: false, points: 0 }
  }
  const match = matchAnswerToDataset(trimmed, categoryId)
  if (match.status === 'unknown') {
    return {
      categoryId,
      original: trimmed,
      status: 'unknown',
      comparisonKey: duplicateComparisonKey(trimmed, categoryId),
      valid: null,
      points: 0,
    }
  }
  return {
    categoryId,
    original: trimmed,
    status: match.status,
    entityId: match.entityId,
    canonical: match.canonical,
    comparisonKey: match.entityId ?? normalizeLetterPopText(match.canonical ?? trimmed),
    confidence: match.confidence,
    valid: true,
    points: 0,
  }
}
