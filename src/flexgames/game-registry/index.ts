import { GAMES } from '@/games'
import { GameRegistry } from './registry'

/**
 * Instance partagée du registry, construite à partir de l'inventaire des jeux.
 *
 * C'est le seul endroit où la plateforme touche `@/games` : le catalogue est
 * une donnée d'assemblage, pas une dépendance du core.
 */
export const registry = new GameRegistry(GAMES)

export const getGame = (id: string) => registry.get(id)
export const getGameBySlug = (slug: string) => registry.getBySlug(slug)
export const requireGame = (id: string) => registry.require(id)
export const getCatalogGames = () => registry.catalog()
export const getAvailableGames = () => registry.available()
export const isGameSupported = (id: string) => registry.isSupported(id)
export const gameSupportsMode = (id: string, mode: 'local' | 'online') =>
  registry.supportsMode(id, mode)

export { GameRegistry, UnknownGameError, DuplicateGameError, validateManifest } from './registry'
