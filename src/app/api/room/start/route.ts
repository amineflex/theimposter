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
import { startSession } from '@/flexgames/session/session-service'
import { startGameSchema } from '@/flexgames/core/validations/schemas'

/** POST /api/room/start  ·  l'hôte lance une partie du jeu de la room. */
export async function POST(request: Request) {
  return handle(async () => {
    const userId = await requireUserId()
    const input = await parseBody(request, startGameSchema)
    const room = await fetchRoom(input.roomId)
    await requireHost(input.roomId, userId)

    if (room.status === 'in_game') {
      throw new ApiError('La partie est déjà lancée.', 409, 'already_started')
    }
    if (room.status !== 'lobby' && room.status !== 'finished') {
      throw new ApiError("Cette partie n'est plus disponible.", 409, 'room_unavailable')
    }

    const { module, manifest } = requireGameModule(room.game_id)
    const session = await startSession(
      admin(),
      room,
      module,
      { minPlayers: manifest.minPlayers, maxPlayers: manifest.maxPlayers },
      input.options ?? {},
    )
    await touchRoom(input.roomId)
    return jsonOk({ sessionId: session.id })
  })
}
