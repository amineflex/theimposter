import {
  ApiError,
  RATE_LIMITS,
  admin,
  enforceRateLimit,
  fetchRoomByCode,
  handle,
  jsonOk,
  parseBody,
  requireUserId,
  touchRoom,
} from '@/flexgames/core/api/http'
import { pickAvatarKey } from '@/flexgames/players/avatars'
import { joinRoomSchema } from '@/flexgames/core/validations/schemas'
import type { RoomPlayerRow } from '@/flexgames/core/db'

/** POST /api/room/join  ·  rejoint une room via son code. */
export async function POST(request: Request) {
  return handle(async () => {
    const userId = await requireUserId()
    await enforceRateLimit(userId, RATE_LIMITS.joinRoom)
    const input = await parseBody(request, joinRoomSchema)

    const db = admin()
    const room = await fetchRoomByCode(input.code)

    if (room.status === 'expired' || new Date(room.expires_at).getTime() < Date.now()) {
      throw new ApiError('Cette partie a expiré.', 410, 'room_expired')
    }
    if (room.status === 'cancelled') {
      throw new ApiError('Cette partie a été annulée.', 410, 'room_cancelled')
    }

    const { data: existingRows } = await db.from('room_players').select('*').eq('room_id', room.id)
    const existing = (existingRows ?? []) as RoomPlayerRow[]

    // Reconnexion : le joueur revient avec la même session.
    const mine = existing.find((p) => p.user_id === userId)
    if (mine) {
      await db
        .from('room_players')
        .update({ is_present: true, last_seen_at: new Date().toISOString(), name: input.playerName })
        .eq('id', mine.id)
      await touchRoom(room.id)
      return jsonOk({ roomId: room.id, code: room.code, playerId: mine.id, reconnected: true })
    }

    if (room.status === 'in_game' || room.status === 'finished') {
      throw new ApiError('La partie a déjà commencé.', 409, 'already_started')
    }

    const present = existing.filter((p) => p.is_present)
    if (present.length >= room.max_players) {
      throw new ApiError('Cette partie est complète.', 409, 'room_full')
    }

    const nameTaken = present.some(
      (p) => p.name.localeCompare(input.playerName, 'fr', { sensitivity: 'base' }) === 0,
    )
    if (nameTaken) {
      throw new ApiError('Ce pseudo est déjà utilisé dans cette partie.', 409, 'name_taken')
    }

    const { data: inserted, error } = await db
      .from('room_players')
      .insert({
        room_id: room.id,
        user_id: userId,
        name: input.playerName,
        avatar_key: pickAvatarKey(present.map((p) => p.avatar_key)),
        is_host: false,
      })
      .select('id')
      .single()

    if (error) {
      if (error.code === '23505') {
        throw new ApiError('Ce pseudo est déjà utilisé dans cette partie.', 409, 'name_taken')
      }
      throw error
    }

    await touchRoom(room.id)
    return jsonOk({
      roomId: room.id,
      code: room.code,
      playerId: (inserted as { id: string }).id,
      reconnected: false,
    })
  })
}
