import { z } from 'zod'
import { DIFFICULTIES, GAME_MODES, TIMER_OPTIONS, type TimerOption } from './engine/types'
import { MAX_IMPOSTORS, MAX_MR_WHITE, MAX_UNDERCOVER } from './engine/roles'
import { PACK_SLUGS } from './data/packs'

/**
 * Schémas propres à The Imposter : réglages de partie et actions de jeu.
 *
 * Ils sont validés côté serveur avant tout traitement ; la plateforme, elle, ne
 * connaît la configuration d'une room que comme un objet opaque.
 */

/** Durée de minuteur : uniquement les valeurs proposées par l'UI (0 = illimité). */
const timerSchema = z
  .number()
  .int()
  .refine(
    (value): value is TimerOption => (TIMER_OPTIONS as readonly number[]).includes(value),
    'Durée de minuteur invalide.',
  )

export const customWordSchema = z
  .object({
    word: z.string().trim().min(2).max(40),
    hint: z.string().trim().min(2).max(40).nullish(),
    undercoverWord: z.string().trim().min(2).max(40).nullish(),
  })
  .nullable()

export const gameSettingsSchema = z
  .object({
    mode: z.enum(GAME_MODES),
    impostorCount: z.number().int().min(0).max(MAX_IMPOSTORS),
    undercoverCount: z.number().int().min(0).max(MAX_UNDERCOVER),
    mrWhiteCount: z.number().int().min(0).max(MAX_MR_WHITE),
    descriptionRounds: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal('free')]),
    speakDuration: timerSchema,
    voteDuration: timerSchema,
    revealRoleOnElimination: z.boolean(),
    difficulty: z.union([z.enum(DIFFICULTIES), z.literal('all')]),
    packs: z.array(z.enum(PACK_SLUGS as [string, ...string[]])).max(PACK_SLUGS.length),
    customWord: customWordSchema,
  })
  .superRefine((settings, ctx) => {
    if (settings.mode === 'impostor') {
      if (settings.impostorCount < 1) {
        ctx.addIssue({ code: 'custom', message: 'Il faut au moins 1 imposteur.', path: ['impostorCount'] })
      }
      if (settings.undercoverCount > 0 || settings.mrWhiteCount > 0) {
        ctx.addIssue({
          code: 'custom',
          message: 'Undercover et Mr. White ne sont pas disponibles en mode Imposteur.',
          path: ['undercoverCount'],
        })
      }
    } else {
      if (settings.impostorCount > 0) {
        ctx.addIssue({
          code: 'custom',
          message: "L'Imposteur n'est pas disponible en mode Undercover.",
          path: ['impostorCount'],
        })
      }
      if (settings.undercoverCount + settings.mrWhiteCount < 1) {
        ctx.addIssue({
          code: 'custom',
          message: 'Il faut au moins 1 Undercover ou 1 Mr. White.',
          path: ['undercoverCount'],
        })
      }
    }

    const custom = settings.customWord
    if (custom) {
      if (settings.mode === 'impostor' && !custom.hint) {
        ctx.addIssue({
          code: 'custom',
          message: "Un indice est requis pour un mot personnalisé en mode Imposteur.",
          path: ['customWord', 'hint'],
        })
      }
      if (settings.mode === 'undercover' && !custom.undercoverWord) {
        ctx.addIssue({
          code: 'custom',
          message: 'Un second mot est requis pour un mot personnalisé en mode Undercover.',
          path: ['customWord', 'undercoverWord'],
        })
      }
      if (
        settings.mode === 'undercover' &&
        custom.undercoverWord &&
        custom.undercoverWord.toLowerCase() === custom.word.toLowerCase()
      ) {
        ctx.addIssue({
          code: 'custom',
          message: 'Les deux mots doivent être différents.',
          path: ['customWord', 'undercoverWord'],
        })
      }
    }
  })


export const gameActionSchema = z.object({
  gameId: z.string().uuid(),
})

export const voteSchema = z.object({
  gameId: z.string().uuid(),
  targetId: z.string().uuid(),
})

/** Description écrite : courte, une phrase suffit. */
export const describeSchema = z.object({
  gameId: z.string().uuid(),
  body: z
    .string()
    .trim()
    .min(1, 'Écrivez votre description.')
    .max(120, 'Description trop longue (120 caractères max).'),
})

export const mrWhiteGuessSchema = z.object({
  gameId: z.string().uuid(),
  guess: z.string().trim().min(1, 'Entrez un mot.').max(60),
})

export const advancePhaseSchema = z.object({
  gameId: z.string().uuid(),
  /** L'hôte force le passage à l'étape suivante. */
  force: z.boolean().optional(),
})

export const pauseSchema = z.object({
  gameId: z.string().uuid(),
  paused: z.boolean(),
})


/* --- Administration de la base de mots ------------------------------------ */

export const adminImpostorWordSchema = z.object({
  word: z.string().trim().min(2).max(60),
  hint: z.string().trim().min(2).max(60),
  category: z.string().trim().min(2).max(40),
  difficulty: z.enum(DIFFICULTIES),
  packs: z.array(z.string().trim().min(1)).min(1, 'Sélectionnez au moins un pack.'),
  acceptedAnswers: z.array(z.string().trim().min(1).max(60)).max(10).default([]),
  isActive: z.boolean().default(true),
})

export const adminWordPairSchema = z.object({
  civilianWord: z.string().trim().min(2).max(60),
  undercoverWord: z.string().trim().min(2).max(60),
  category: z.string().trim().min(2).max(40),
  difficulty: z.enum(DIFFICULTIES),
  packs: z.array(z.string().trim().min(1)).min(1, 'Sélectionnez au moins un pack.'),
  acceptedAnswers: z.array(z.string().trim().min(1).max(60)).max(10).default([]),
  isActive: z.boolean().default(true),
})

export const adminWordUpdateSchema = z.object({
  id: z.string().uuid(),
  kind: z.enum(['impostor', 'pair']),
  patch: z.record(z.string(), z.unknown()),
})
