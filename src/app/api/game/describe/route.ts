import {
  RATE_LIMITS,
  admin,
  enforceRateLimit,
  handle,
  jsonOk,
  parseBody,
  requireGameMembership,
  requireUserId,
} from '@/lib/api/http'
import { submitDescription } from '@/lib/game/service'
import { describeSchema } from '@/lib/validations/schemas'

/**
 * POST /api/game/describe  ·  enregistre la description écrite d'un joueur.
 *
 * Les descriptions sont publiques (c'est le cœur du jeu) : elles restent
 * affichées jusqu'au vote. Le serveur vérifie le tour de parole et refuse une
 * description contenant le mot du joueur.
 */
export async function POST(request: Request) {
  return handle(async () => {
    const userId = await requireUserId()
    await enforceRateLimit(userId, RATE_LIMITS.describe)
    const input = await parseBody(request, describeSchema)
    const { player } = await requireGameMembership(input.gameId, userId)

    const state = await submitDescription(admin(), input.gameId, player.id, input.body)
    return jsonOk({ phase: state.phase, round: state.round })
  })
}
