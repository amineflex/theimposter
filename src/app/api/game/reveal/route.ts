import {
  admin,
  handle,
  jsonOk,
  parseBody,
  requireGameMembership,
  requireUserId,
  touchRoom,
} from '@/lib/api/http'
import { markRoleRevealed } from '@/lib/game/service'
import { gameActionSchema } from '@/lib/validations/schemas'

/** POST /api/game/reveal — le joueur confirme avoir vu sa carte de rôle. */
export async function POST(request: Request) {
  return handle(async () => {
    const userId = await requireUserId()
    const { gameId } = await parseBody(request, gameActionSchema)
    const { game, player } = await requireGameMembership(gameId, userId)

    const state = await markRoleRevealed(admin(), gameId, player.id)
    await touchRoom(game.room_id)
    return jsonOk({ phase: state.phase })
  })
}
