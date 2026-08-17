import { z } from 'zod'
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
} from '@/lib/api/http'
import { startGame } from '@/lib/game/service'

const startSchema = z.object({
  roomId: z.string().uuid(),
  /**
   * Entrées de mots récemment jouées côté client (anti-répétition sans compte).
   * Le mode local mémorise des slugs et le mode en ligne des UUID : on accepte
   * les deux, ces valeurs ne servent qu'à filtrer un tirage.
   */
  excludeWordIds: z.array(z.string().max(80)).max(60).optional(),
  order: z.enum(['random', 'as-is']).optional(),
})

/** POST /api/room/start  ·  l'hôte lance la partie. */
export async function POST(request: Request) {
  return handle(async () => {
    const userId = await requireUserId()
    const input = await parseBody(request, startSchema)
    const room = await fetchRoom(input.roomId)
    await requireHost(input.roomId, userId)

    if (room.status === 'in_game') {
      throw new ApiError('La partie est déjà lancée.', 409, 'already_started')
    }
    if (room.status !== 'lobby' && room.status !== 'finished') {
      throw new ApiError("Cette partie n'est plus disponible.", 409, 'room_unavailable')
    }

    const { gameId } = await startGame(admin(), room, {
      excludeWordIds: input.excludeWordIds,
      order: input.order,
    })
    await touchRoom(input.roomId)
    return jsonOk({ gameId })
  })
}
