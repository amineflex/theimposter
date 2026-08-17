import {
  RATE_LIMITS,
  admin,
  enforceRateLimit,
  handle,
  jsonOk,
  parseBody,
  requireGameMembership,
  requireUserId,
  touchRoom,
} from '@/lib/api/http'
import { advancePhase } from '@/lib/game/service'
import { advancePhaseSchema } from '@/lib/validations/schemas'

/**
 * POST /api/game/advance — fait avancer la machine d'état.
 *
 * L'autorisation est calculée côté serveur : minuteur écoulé, phase
 * d'affichage automatique, orateur courant qui a terminé, ou hôte qui force.
 * Un client ne peut donc pas provoquer une transition arbitraire.
 */
export async function POST(request: Request) {
  return handle(async () => {
    const userId = await requireUserId()
    await enforceRateLimit(userId, RATE_LIMITS.advance)
    const input = await parseBody(request, advancePhaseSchema)
    const { game, player } = await requireGameMembership(input.gameId, userId)

    const state = await advancePhase(admin(), input.gameId, {
      roomPlayerId: player.id,
      isHost: player.is_host,
      force: input.force === true,
    })
    await touchRoom(game.room_id)
    return jsonOk({ phase: state.phase, round: state.round })
  })
}
