import 'server-only'
import type { GameServerModule } from '@/flexgames/core/game-server'
import { imposterServer } from './the-imposter/server/module'
import { geoRushServer } from './geo-rush/server/module'
import { letterPopServer } from './letter-pop/server/module'

/**
 * Inventaire SERVEUR des jeux.
 *
 * Séparé de `src/games/index.ts` : ce fichier tire du code qui utilise la clé
 * `service_role`. Il n'est importé que par les route handlers, jamais par un
 * composant client (`server-only` le garantit à la compilation).
 */
const MODULES: readonly GameServerModule[] = [imposterServer, geoRushServer, letterPopServer]

const BY_ID = new Map(MODULES.map((module) => [module.gameId, module]))

export function getGameServer(gameId: string): GameServerModule | null {
  return BY_ID.get(gameId) ?? null
}
