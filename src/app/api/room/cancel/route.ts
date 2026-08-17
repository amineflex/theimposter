import {
  admin,
  handle,
  jsonOk,
  parseBody,
  requireHost,
  requireUserId,
} from '@/lib/api/http'
import { roomActionSchema } from '@/lib/validations/schemas'

/** POST /api/room/cancel  ·  l'hôte annule la partie et ferme la room. */
export async function POST(request: Request) {
  return handle(async () => {
    const userId = await requireUserId()
    const { roomId } = await parseBody(request, roomActionSchema)
    await requireHost(roomId, userId)

    const db = admin()
    await db
      .from('games')
      .update({ finished_at: new Date().toISOString(), phase: 'results' })
      .eq('room_id', roomId)
      .is('finished_at', null)
    await db
      .from('rooms')
      .update({ status: 'cancelled', last_activity_at: new Date().toISOString() })
      .eq('id', roomId)

    return jsonOk({})
  })
}
