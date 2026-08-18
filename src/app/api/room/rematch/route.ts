import {
  ApiError,
  admin,
  fetchRoom,
  handle,
  jsonOk,
  parseBody,
  requireHost,
  requireUserId,
  touchRoom,
} from '@/flexgames/core/api/http'
import { requireGameModule } from '@/flexgames/core/api/game-routing'
import { findActiveSession, startSession } from '@/flexgames/session/session-service'
import { startGameSchema } from '@/flexgames/core/validations/schemas'

/**
 * POST /api/room/rematch  ·  relance une partie avec les joueurs présents.
 *
 * Une room enchaîne autant de sessions que voulu : rejouer ne recrée ni la room,
 * ni les joueurs, ni le code d'invitation.
 */
export async function POST(request: Request) {
  return handle(async () => {
    const userId = await requireUserId()
    const input = await parseBody(request, startGameSchema)
    const room = await fetchRoom(input.roomId)
    await requireHost(input.roomId, userId)

    const db = admin()
    if (await findActiveSession(db, room.id)) {
      throw new ApiError('La partie en cours doit être terminée avant de rejouer.', 409, 'session_in_progress')
    }

    // Les joueurs absents ne participent pas au rematch.
    await db.from('room_players').delete().eq('room_id', room.id).eq('is_present', false)
    await db.from('rooms').update({ status: 'lobby' }).eq('id', room.id)

    const refreshed = await fetchRoom(input.roomId)
    const { module, manifest } = requireGameModule(refreshed.game_id)
    const session = await startSession(
      db,
      refreshed,
      module,
      { minPlayers: manifest.minPlayers, maxPlayers: manifest.maxPlayers },
      input.options ?? {},
    )
    await touchRoom(input.roomId)
    return jsonOk({ sessionId: session.id })
  })
}
