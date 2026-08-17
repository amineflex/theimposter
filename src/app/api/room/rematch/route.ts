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

const rematchSchema = z.object({
  roomId: z.string().uuid(),
  /** Entrées de mots récemment jouées côté client (slugs locaux ou UUID). */
  excludeWordIds: z.array(z.string().max(80)).max(60).optional(),
})

/**
 * POST /api/room/rematch — relance une partie avec les joueurs présents.
 *
 * Les mots déjà tirés dans cette room sont évités, et l'attribution des rôles
 * tient compte de `recent_special_count` pour éviter qu'un même joueur enchaîne
 * les rôles spéciaux.
 */
export async function POST(request: Request) {
  return handle(async () => {
    const userId = await requireUserId()
    const input = await parseBody(request, rematchSchema)
    const room = await fetchRoom(input.roomId)
    await requireHost(input.roomId, userId)

    const db = admin()

    const { data: activeGame } = await db
      .from('games')
      .select('id')
      .eq('room_id', room.id)
      .is('finished_at', null)
      .maybeSingle()
    if (activeGame) {
      throw new ApiError('La partie en cours doit être terminée avant de rejouer.', 409, 'game_in_progress')
    }

    // Les joueurs absents ne participent pas au rematch.
    await db.from('room_players').delete().eq('room_id', room.id).eq('is_present', false)
    await db.from('rooms').update({ status: 'lobby' }).eq('id', room.id)

    const refreshed = await fetchRoom(input.roomId)
    const { gameId } = await startGame(db, refreshed, { excludeWordIds: input.excludeWordIds })
    await touchRoom(input.roomId)
    return jsonOk({ gameId })
  })
}
