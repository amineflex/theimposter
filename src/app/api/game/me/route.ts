import {
  ApiError,
  admin,
  handle,
  jsonOk,
  requireGameMembership,
  requireUserId,
} from '@/lib/api/http'
import type { GamePlayerRow } from '@/types/db'

/**
 * GET /api/game/me?gameId=… — renvoie UNIQUEMENT le rôle et le mot de
 * l'appelant.
 *
 * C'est le seul endroit où une information secrète quitte le serveur, et elle
 * est strictement limitée à la ligne du joueur authentifié : aucune requête ne
 * permet de récupérer les rôles des autres avant la fin de la partie.
 */
export async function GET(request: Request) {
  return handle(async () => {
    const userId = await requireUserId()
    const gameId = new URL(request.url).searchParams.get('gameId')
    if (!gameId) throw new ApiError('Partie non précisée.', 400)

    const { game, player } = await requireGameMembership(gameId, userId)

    const { data } = await admin()
      .from('game_players')
      .select('*')
      .eq('game_id', gameId)
      .eq('room_player_id', player.id)
      .maybeSingle()
    const me = data as GamePlayerRow | null
    if (!me) {
      // Le joueur a rejoint après le lancement : il est spectateur.
      return jsonOk({ role: null, word: null, hint: null, spectator: true, playerId: player.id })
    }

    return jsonOk({
      playerId: player.id,
      role: me.role,
      word: me.word,
      hint: me.hint,
      hasSeenRole: me.has_seen_role,
      spectator: false,
      // Mr. White doit savoir que c'est à lui de deviner. Le mot des civils, en
      // revanche, n'est jamais envoyé avant la fin : la vue publique
      // `game_public_state` ne l'expose qu'en phase de résultats.
      isPendingMrWhite: game.pending_mr_white_id === player.id,
    })
  })
}
