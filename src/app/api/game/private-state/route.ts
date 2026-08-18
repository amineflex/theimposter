import {
  ApiError,
  admin,
  handle,
  jsonOk,
  requireSessionMembership,
  requireUserId,
} from '@/flexgames/core/api/http'
import { requireGameModule } from '@/flexgames/core/api/game-routing'

/**
 * GET /api/game/private-state?sessionId=…  ·  l'état privé de l'appelant.
 *
 * C'est le seul chemin par lequel une information secrète quitte le serveur, et
 * elle est strictement limitée au joueur authentifié : aucun paramètre ne
 * permet de demander l'état d'un autre joueur.
 */
export async function GET(request: Request) {
  return handle(async () => {
    const userId = await requireUserId()
    const sessionId = new URL(request.url).searchParams.get('sessionId')
    if (!sessionId) throw new ApiError('Partie non précisée.', 400)

    const { session, player } = await requireSessionMembership(sessionId, userId)
    const { module } = requireGameModule(session.game_id)
    if (!module.getPrivateState) return jsonOk({ state: null })

    const state = await module.getPrivateState({
      db: admin(),
      sessionId: session.id,
      playerId: player.id,
      userId,
    })
    return jsonOk({ state })
  })
}
