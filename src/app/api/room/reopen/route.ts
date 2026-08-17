import {
  ApiError,
  admin,
  handle,
  jsonOk,
  parseBody,
  requireHost,
  requireUserId,
  touchRoom,
} from '@/lib/api/http'
import { roomActionSchema } from '@/lib/validations/schemas'

/**
 * POST /api/room/reopen  ·  ramène une room terminée dans le salon.
 *
 * Permet à l'hôte de modifier les paramètres entre deux parties (les réglages
 * ne sont modifiables qu'en statut `lobby`), puis de relancer.
 */
export async function POST(request: Request) {
  return handle(async () => {
    const userId = await requireUserId()
    const { roomId } = await parseBody(request, roomActionSchema)
    await requireHost(roomId, userId)

    const db = admin()
    const { data: activeGame } = await db
      .from('games')
      .select('id')
      .eq('room_id', roomId)
      .is('finished_at', null)
      .maybeSingle()
    if (activeGame) {
      throw new ApiError('La partie en cours doit être terminée.', 409, 'game_in_progress')
    }

    const { error } = await db.from('rooms').update({ status: 'lobby' }).eq('id', roomId)
    if (error) throw error

    await touchRoom(roomId)
    return jsonOk({})
  })
}
