import {
  handle,
  jsonOk,
  parseBody,
  requireGameMembership,
  requireUserId,
  admin,
} from '@/lib/api/http'
import { advanceIfExpired } from '@/lib/game/service'
import { gameActionSchema } from '@/lib/validations/schemas'

/**
 * POST /api/game/tick  ·  applique un minuteur écoulé.
 *
 * Appelé par les clients quand ils constatent que `phase_ends_at` est dépassé.
 * Le serveur revérifie l'échéance : un client qui appelle trop tôt n'obtient
 * aucun effet, et le verrou optimiste évite les doubles avances quand plusieurs
 * clients appellent au même instant.
 */
export async function POST(request: Request) {
  return handle(async () => {
    const userId = await requireUserId()
    const { gameId } = await parseBody(request, gameActionSchema)
    await requireGameMembership(gameId, userId)

    const state = await advanceIfExpired(admin(), gameId)
    return jsonOk({ advanced: state !== null, phase: state?.phase ?? null })
  })
}
