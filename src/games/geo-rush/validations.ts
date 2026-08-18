import { z } from 'zod'
import { GEO_DIFFICULTIES, GEO_DURATIONS, GEO_QUESTION_COUNTS, GEO_REGIONS } from './types'

export const geoConfigSchema = z.object({
  questionCount: z.union(GEO_QUESTION_COUNTS.map((value) => z.literal(value))),
  durationSeconds: z.union(GEO_DURATIONS.map((value) => z.literal(value))),
  difficulty: z.enum(GEO_DIFFICULTIES),
  region: z.enum(GEO_REGIONS),
})

export const geoSubmitSchema = z.object({
  roundIndex: z.number().int().nonnegative(),
  answer: z.string().trim().min(1, 'Choisis ou saisis une réponse.').max(100),
})

export const geoTickSchema = z.object({})
