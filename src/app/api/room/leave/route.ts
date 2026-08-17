import {
  admin,
  fetchRoom,
  handle,
  jsonOk,
  parseBody,
  requireRoomMember,
  requireUserId,
  touchRoom,
} from '@/lib/api/http'
import { removePlayerFromActiveGame } from '@/lib/game/service'
import { roomActionSchema } from '@/lib/validations/schemas'
import type { RoomPlayerRow } from '@/types/db'

/**
 * POST /api/room/leave  ·  quitte définitivement une room.
 *
 * Si l'hôte part, un nouvel hôte est désigné automatiquement parmi les joueurs
 * présents : la partie ne meurt pas parce que le créateur ferme son navigateur.
 */
export async function POST(request: Request) {
  return handle(async () => {
    const userId = await requireUserId()
    const { roomId } = await parseBody(request, roomActionSchema)
    const room = await fetchRoom(roomId)
    const player = await requireRoomMember(roomId, userId)

    const db = admin()

    if (room.status === 'lobby') {
      // En lobby, le joueur est retiré de la table.
      await db.from('room_players').delete().eq('id', player.id)
    } else {
      // En partie, on le marque absent et il est éliminé de la partie en cours.
      await db.from('room_players').update({ is_present: false }).eq('id', player.id)
      await removePlayerFromActiveGame(db, roomId, player.id)
    }

    const { data: remainingRows } = await db
      .from('room_players')
      .select('*')
      .eq('room_id', roomId)
      .eq('is_present', true)
      .order('joined_at', { ascending: true })
    const remaining = (remainingRows ?? []) as RoomPlayerRow[]

    if (remaining.length === 0) {
      await db.from('rooms').update({ status: 'cancelled' }).eq('id', roomId)
      return jsonOk({ roomClosed: true })
    }

    let newHostId: string | null = null
    if (player.is_host) {
      const nextHost = remaining[0] as RoomPlayerRow
      await db.from('room_players').update({ is_host: true }).eq('id', nextHost.id)
      await db.from('rooms').update({ host_player_id: nextHost.id }).eq('id', roomId)
      newHostId = nextHost.id
    }

    await touchRoom(roomId)
    return jsonOk({ roomClosed: false, newHostId })
  })
}
