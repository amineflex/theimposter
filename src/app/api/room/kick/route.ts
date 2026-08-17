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
import { removePlayerFromActiveGame } from '@/lib/game/service'
import { kickPlayerSchema } from '@/lib/validations/schemas'
import type { RoomPlayerRow } from '@/types/db'

/** POST /api/room/kick — l'hôte exclut un joueur. */
export async function POST(request: Request) {
  return handle(async () => {
    const userId = await requireUserId()
    const input = await parseBody(request, kickPlayerSchema)
    const room = await fetchRoom(input.roomId)
    const host = await requireHost(input.roomId, userId)

    if (host.id === input.playerId) {
      throw new ApiError('Vous ne pouvez pas vous exclure vous-même.', 400, 'self_kick')
    }

    const db = admin()
    const { data } = await db
      .from('room_players')
      .select('*')
      .eq('id', input.playerId)
      .eq('room_id', input.roomId)
      .maybeSingle()
    const target = data as RoomPlayerRow | null
    if (!target) throw new ApiError('Ce joueur ne fait plus partie de la partie.', 404, 'not_found')

    if (room.status === 'lobby') {
      await db.from('room_players').delete().eq('id', target.id)
    } else {
      await db.from('room_players').update({ is_present: false }).eq('id', target.id)
      await removePlayerFromActiveGame(db, input.roomId, target.id)
    }

    await touchRoom(input.roomId)
    return jsonOk({})
  })
}
