import {
  admin,
  handle,
  jsonOk,
  parseBody,
  requireGameMembership,
  requireUserId,
  touchRoom,
} from '@/lib/api/http'
import { mrWhiteGuess } from '@/lib/game/service'
import { mrWhiteGuessSchema } from '@/lib/validations/schemas'

/**
 * POST /api/game/mr-white — dernière chance de Mr. White.
 *
 * La comparaison est faite côté serveur (normalisation casse/accents/ponctuation
 * + liste de réponses acceptées) : le mot des civils n'est jamais envoyé au
 * client avant la fin de la partie.
 */
export async function POST(request: Request) {
  return handle(async () => {
    const userId = await requireUserId()
    const input = await parseBody(request, mrWhiteGuessSchema)
    const { game, player } = await requireGameMembership(input.gameId, userId)

    const state = await mrWhiteGuess(admin(), input.gameId, player.id, input.guess)
    await touchRoom(game.room_id)
    return jsonOk({
      correct: state.lastMrWhiteGuess?.correct ?? false,
      phase: state.phase,
      winner: state.winner,
    })
  })
}
