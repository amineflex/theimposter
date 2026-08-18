import { admin, handle, jsonOk } from '@/flexgames/core/api/http'
import type { PublicRoomRow } from '@/flexgames/core/db'

/**
 * GET /api/rooms/public  ·  liste des parties publiques rejoignables.
 *
 * S'appuie sur la vue `public_rooms`, qui n'expose que le code, le jeu et le
 * nombre de joueurs. Aucune donnée de partie. Le paramètre `gameId` filtre sur
 * un jeu précis.
 */
export async function GET(request: Request) {
  return handle(async () => {
    const gameId = new URL(request.url).searchParams.get('gameId')

    let query = admin()
      .from('public_rooms')
      .select('*')
      .order('last_activity_at', { ascending: false })
      .limit(30)
    if (gameId) query = query.eq('game_id', gameId)

    const { data, error } = await query
    if (error) throw error

    const rooms = ((data ?? []) as PublicRoomRow[])
      .filter((room) => room.player_count > 0 && room.player_count < room.max_players)
      .map((room) => ({
        code: room.code,
        gameId: room.game_id,
        playerCount: room.player_count,
        maxPlayers: room.max_players,
        seatsLeft: room.max_players - room.player_count,
      }))

    return jsonOk({ rooms })
  })
}
