import { z } from 'zod'
import { ROOM_CODE_LENGTH } from '@/flexgames/rooms/room-code'

/**
 * Schémas communs à la plateforme.
 *
 * La configuration d'un jeu n'est pas décrite ici : elle traverse la plateforme
 * comme un objet opaque (`z.unknown()`) et n'est validée que par le module du
 * jeu concerné, côté serveur, avant d'être écrite.
 */

/** Pseudo : 2 à 20 caractères, Unicode accepté, pas uniquement des espaces. */
export const playerNameSchema = z
  .string()
  .trim()
  .min(2, 'Le pseudo doit contenir au moins 2 caractères.')
  .max(20, 'Le pseudo ne peut pas dépasser 20 caractères.')
  .refine((value) => /\p{L}|\p{N}/u.test(value), 'Le pseudo doit contenir au moins une lettre.')

export const roomCodeSchema = z
  .string()
  .trim()
  .transform((value) => value.toUpperCase().replace(/[^A-Z0-9]/g, ''))
  .refine((value) => value.length === ROOM_CODE_LENGTH, 'Le code doit contenir 6 caractères.')

/** Identifiant de jeu du registry (kebab-case). */
export const gameIdSchema = z
  .string()
  .trim()
  .regex(/^[a-z0-9-]{2,40}$/, 'Identifiant de jeu invalide.')

export const createRoomSchema = z.object({
  gameId: gameIdSchema,
  playerName: playerNameSchema,
  visibility: z.enum(['private', 'public']),
  /** Réglages du jeu : validés par le module du jeu, pas ici. */
  config: z.unknown(),
  maxPlayers: z.number().int().min(2).max(64),
})

export const joinRoomSchema = z.object({
  code: roomCodeSchema,
  playerName: playerNameSchema,
})

export const roomActionSchema = z.object({
  roomId: z.string().uuid(),
})

export const startGameSchema = z.object({
  roomId: z.string().uuid(),
  /** Options libres transmises au module du jeu (ex. anti-répétition). */
  options: z.record(z.string(), z.unknown()).optional(),
})

export const updateSettingsSchema = z.object({
  roomId: z.string().uuid(),
  config: z.unknown(),
  visibility: z.enum(['private', 'public']).optional(),
  maxPlayers: z.number().int().min(2).max(64).optional(),
})

export const kickPlayerSchema = z.object({
  roomId: z.string().uuid(),
  playerId: z.string().uuid(),
})

/** Action de jeu : la plateforme route, le jeu valide `payload`. */
export const gameActionEnvelopeSchema = z.object({
  sessionId: z.string().uuid(),
  type: z.string().trim().min(1).max(40),
  payload: z.unknown(),
})

export const chatMessageSchema = z.object({
  roomId: z.string().uuid(),
  kind: z.enum(['text', 'reaction']),
  body: z.string().trim().min(1, 'Message vide.').max(200, 'Message trop long (200 caractères max).'),
})

export const reportSchema = z.object({
  roomId: z.string().uuid().nullish(),
  reason: z.string().trim().min(3).max(80),
  details: z.string().trim().max(500).nullish(),
})

/* ---------------------------------------------------------------------------
 * Admin
 * ------------------------------------------------------------------------- */

export const adminReportUpdateSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(['open', 'reviewed', 'dismissed']),
})

export const adminSettingSchema = z.object({
  key: z.string().trim().min(1).max(60),
  value: z.unknown(),
})

export type CreateRoomInput = z.infer<typeof createRoomSchema>
export type JoinRoomInput = z.infer<typeof joinRoomSchema>
export type UpdateSettingsInput = z.infer<typeof updateSettingsSchema>
export type ChatMessageInput = z.infer<typeof chatMessageSchema>
export type GameActionEnvelope = z.infer<typeof gameActionEnvelopeSchema>
