import { z } from 'zod'
import {
  LETTER_POP_ALPHABET,
  LETTER_POP_CATEGORY_COUNTS,
  LETTER_POP_CATEGORY_IDS,
  LETTER_POP_DIFFICULTIES,
  LETTER_POP_DURATIONS,
  LETTER_POP_PRESETS,
  LETTER_POP_ROUND_COUNTS,
} from './types'

const categorySchema = z.enum(LETTER_POP_CATEGORY_IDS)

export const letterPopConfigSchema = z.object({
  roundCount: z.union(LETTER_POP_ROUND_COUNTS.map((value) => z.literal(value))),
  durationSeconds: z.union(LETTER_POP_DURATIONS.map((value) => z.literal(value))),
  categoryCount: z.union(LETTER_POP_CATEGORY_COUNTS.map((value) => z.literal(value))),
  preset: z.enum(LETTER_POP_PRESETS),
  difficulty: z.enum(LETTER_POP_DIFFICULTIES),
  customLetter: z.enum(LETTER_POP_ALPHABET as [string, ...string[]]).nullable(),
  customCategories: z.array(categorySchema).min(4).max(8).refine(
    (categories) => new Set(categories).size === categories.length,
    'Une catégorie ne peut être choisie qu’une fois.',
  ),
}).superRefine((config, context) => {
  if (config.preset === 'custom' && config.customCategories.length !== config.categoryCount) {
    context.addIssue({ code: 'custom', path: ['customCategories'], message: 'Choisis exactement le nombre de catégories annoncé.' })
  }
})

export const letterPopAnswersSchema = z.partialRecord(
  categorySchema,
  z.string().max(80, 'Une réponse ne peut pas dépasser 80 caractères.'),
)

export const letterPopSaveSchema = z.object({
  roundIndex: z.number().int().nonnegative(),
  answers: letterPopAnswersSchema,
})

export const letterPopFinishSchema = letterPopSaveSchema
export const letterPopDecisionSchema = z.object({ pendingId: z.string().min(3).max(180), valid: z.boolean() })
export const letterPopTickSchema = z.object({})
export const letterPopAdvanceSchema = z.object({})
