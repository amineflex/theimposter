import {
  RATE_LIMITS,
  admin,
  enforceRateLimit,
  handle,
  jsonOk,
  parseBody,
  requireSessionMembership,
  requireUserId,
  touchRoom,
} from '@/flexgames/core/api/http'
import { requireGameModule } from '@/flexgames/core/api/game-routing'
import { gameActionEnvelopeSchema } from '@/flexgames/core/validations/schemas'
import { ApiError } from '@/flexgames/core/errors'
import { fetchPresentPlayers, toPlayer, toRoom } from '@/flexgames/session/session-service'

/**
 * POST /api/game/action  ·  point d'entrée UNIQUE des actions de jeu.
 *
 * La plateforme authentifie, vérifie l'appartenance à la room, applique le
 * quota, puis passe la main au module du jeu. Elle n'interprète jamais l'action :
 * ajouter un jeu n'ajoute aucune route.
 */
export async function POST(request: Request) {
  return handle(async () => {
    const userId = await requireUserId()
    const envelope = await parseBody(request, gameActionEnvelopeSchema)
    const { session, room, player } = await requireSessionMembership(envelope.sessionId, userId)

    if (session.status !== 'active') {
      throw new ApiError('Cette partie est terminée.', 409, 'session_finished')
    }

    const { module } = requireGameModule(session.game_id)
    const spec = module.actions?.[envelope.type]
    await enforceRateLimit(
      userId,
      spec
        ? { action: `${session.game_id}:${envelope.type}`, ...spec }
        : RATE_LIMITS.gameAction,
    )

    const db = admin()
    const players = await fetchPresentPlayers(db, room.id)
    const result = await module.handleAction(
      {
        db,
        room: toRoom(room),
        actor: toPlayer(player),
        actorUserId: userId,
        players: players.map(toPlayer),
        sessionId: session.id,
      },
      { type: envelope.type, payload: envelope.payload },
    )

    await touchRoom(room.id)
    return jsonOk({ result })
  })
}
