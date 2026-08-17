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
import { castVoteAction } from '@/lib/game/service'
import { voteSchema } from '@/lib/validations/schemas'

/**
 * POST /api/game/vote — enregistre un vote secret.
 *
 * Le vote n'est jamais renvoyé aux autres joueurs : la RLS de `votes` limite la
 * lecture à sa propre ligne jusqu'à la fin de la partie, et l'UI n'affiche que
 * le compteur « x / y joueurs ont voté ».
 */
export async function POST(request: Request) {
  return handle(async () => {
    const userId = await requireUserId()
    await enforceRateLimit(userId, RATE_LIMITS.vote)
    const input = await parseBody(request, voteSchema)
    const { game, player } = await requireGameMembership(input.gameId, userId)

    await castVoteAction(admin(), input.gameId, player.id, input.targetId, userId)
    await touchRoom(game.room_id)
    return jsonOk({})
  })
}
