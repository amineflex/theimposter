import {
  admin,
  handle,
  jsonOk,
  parseBody,
  requireGameMembership,
  requireHost,
  requireUserId,
} from '@/lib/api/http'
import { loadGame } from '@/lib/game/persistence'
import { phaseDuration } from '@/lib/game-engine/engine'
import { pauseSchema } from '@/lib/validations/schemas'

/**
 * POST /api/game/pause — l'hôte met la partie en pause ou la reprend.
 * À la reprise, le minuteur de la phase courante repart pour sa durée pleine.
 */
export async function POST(request: Request) {
  return handle(async () => {
    const userId = await requireUserId()
    const input = await parseBody(request, pauseSchema)
    const { game } = await requireGameMembership(input.gameId, userId)
    await requireHost(game.room_id, userId)

    const db = admin()
    const { state } = await loadGame(db, input.gameId)
    const duration = phaseDuration(state)

    const { error } = await db
      .from('games')
      .update({
        is_paused: input.paused,
        phase_ends_at:
          input.paused || duration <= 0
            ? null
            : new Date(Date.now() + duration * 1000).toISOString(),
        version: game.version + 1,
      })
      .eq('id', input.gameId)
      .eq('version', game.version)
    if (error) throw error

    return jsonOk({ paused: input.paused })
  })
}
