import { admin, handle, jsonOk } from '@/lib/api/http'
import type { PublicRoomRow } from '@/types/db'

/**
 * GET /api/rooms/public  ·  liste des parties publiques rejoignables.
 *
 * S'appuie sur la vue `public_rooms`, qui n'expose que le code, le mode, le
 * nombre de joueurs, les places restantes et la difficulté. Aucun mot ni rôle.
 */
export async function GET() {
  return handle(async () => {
    const { data, error } = await admin()
      .from('public_rooms')
      .select('*')
      .order('last_activity_at', { ascending: false })
      .limit(30)
    if (error) throw error

    const rooms = ((data ?? []) as PublicRoomRow[])
      .filter((room) => room.player_count > 0 && room.player_count < room.max_players)
      .map((room) => ({
        code: room.code,
        mode: room.mode,
        playerCount: room.player_count,
        maxPlayers: room.max_players,
        seatsLeft: room.max_players - room.player_count,
        difficulty: room.difficulty,
      }))

    return jsonOk({ rooms })
  })
}
