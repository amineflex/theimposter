import type { GameDefinition, GameManifest, PlayableGame } from '@/flexgames/core/game-definition'
import { isPlayable } from '@/flexgames/core/game-definition'
import type { GameId } from '@/flexgames/core/types'

/**
 * Registry FlexGames : source de vérité unique du catalogue.
 *
 * Tout le reste de la plateforme (catalogue, routes, salon, écran de partie)
 * part d'ici. Ajouter un jeu = ajouter une entrée dans `src/games/index.ts`.
 */

export class DuplicateGameError extends Error {
  constructor(id: GameId) {
    super(`Deux jeux partagent l'identifiant « ${id} ».`)
    this.name = 'DuplicateGameError'
  }
}

export class UnknownGameError extends Error {
  constructor(id: string) {
    super(`Jeu inconnu : « ${id} ».`)
    this.name = 'UnknownGameError'
  }
}

/** Vérifie qu'un manifest est exploitable. Échoue tôt plutôt qu'à l'affichage. */
export function validateManifest(manifest: GameManifest): void {
  const fail = (message: string): never => {
    throw new Error(`Manifest « ${manifest.id || '?'} » invalide : ${message}`)
  }
  if (!/^[a-z0-9-]+$/.test(manifest.id)) fail("l'id doit être en kebab-case.")
  if (!/^[a-z0-9-]+$/.test(manifest.slug)) fail('le slug doit être en kebab-case.')
  if (!manifest.name.trim()) fail('le nom est vide.')
  if (!manifest.shortDescription.trim()) fail('la description courte est vide.')
  if (manifest.minPlayers < 1) fail('minPlayers doit valoir au moins 1.')
  if (manifest.maxPlayers < manifest.minPlayers) fail('maxPlayers < minPlayers.')
  if (!manifest.supportedModes.local && !manifest.supportedModes.online) {
    fail('aucun mode de jeu supporté.')
  }
}

export class GameRegistry {
  private readonly byId = new Map<GameId, GameDefinition>()
  private readonly bySlug = new Map<string, GameDefinition>()

  constructor(games: readonly GameDefinition[] = []) {
    for (const game of games) this.register(game)
  }

  register(game: GameDefinition): void {
    validateManifest(game.manifest)
    const { id, slug, status } = game.manifest
    if (this.byId.has(id)) throw new DuplicateGameError(id)
    if (this.bySlug.has(slug)) throw new Error(`Deux jeux partagent le slug « ${slug} ».`)
    if (status === 'available' && !game.ui) {
      throw new Error(`Le jeu « ${id} » est marqué disponible mais ne fournit pas d'UI.`)
    }
    this.byId.set(id, game)
    this.bySlug.set(slug, game)
  }

  /** Tous les jeux, y compris « bientôt » et désactivés (ordre d'enregistrement). */
  all(): GameDefinition[] {
    return [...this.byId.values()]
  }

  /** Catalogue affichable : tout sauf les jeux désactivés. */
  catalog(): GameDefinition[] {
    return this.all().filter((game) => game.manifest.status !== 'disabled')
  }

  /** Jeux réellement jouables aujourd'hui. */
  available(): PlayableGame[] {
    return this.all().filter(isPlayable)
  }

  get(id: string): GameDefinition | null {
    return this.byId.get(id) ?? null
  }

  getBySlug(slug: string): GameDefinition | null {
    return this.bySlug.get(slug) ?? null
  }

  /** Variante stricte, pour les chemins où l'absence est un bug. */
  require(id: string): GameDefinition {
    const game = this.get(id)
    if (!game) throw new UnknownGameError(id)
    return game
  }

  /** Le jeu existe-t-il et peut-il être lancé ? */
  isSupported(id: string): boolean {
    const game = this.get(id)
    return game != null && isPlayable(game)
  }

  supportsMode(id: string, mode: 'local' | 'online'): boolean {
    const game = this.get(id)
    return game != null && isPlayable(game) && game.manifest.supportedModes[mode]
  }
}
