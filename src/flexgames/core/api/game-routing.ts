import 'server-only'
import { ApiError } from '@/flexgames/core/errors'
import { getGameServer } from '@/games/server'
import { getGame } from '@/flexgames/game-registry'
import type { GameServerModule } from '@/flexgames/core/game-server'
import type { GameManifest } from '@/flexgames/core/game-definition'

/**
 * Résolution du jeu d'une room, côté serveur.
 *
 * Le seul endroit où une route apprend « quel jeu » : elle obtient un module et
 * un manifest, jamais du code spécifique. Ajouter un jeu ne modifie aucune route.
 */
export function requireGameModule(gameId: string): {
  module: GameServerModule
  manifest: GameManifest
} {
  const server = getGameServer(gameId)
  const game = getGame(gameId)
  if (!server || !game) {
    throw new ApiError("Ce jeu n'est pas disponible.", 404, 'unknown_game')
  }
  return { module: server, manifest: game.manifest }
}
