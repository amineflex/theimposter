import type { ComponentType, ReactNode } from 'react'
import type { GameContext, GameId, GameResult, Player, ValidationResult } from './types'

/**
 * Contrat d'un jeu FlexGames.
 *
 * Un jeu est un module autonome : il déclare ce qu'il est (`manifest`), comment
 * il s'affiche (`ui`), ce qu'il fait entendre (`audio`), et  ·  côté serveur
 * uniquement  ·  comment il traite les actions (`GameServerModule`).
 *
 * Règle de dépendance : un jeu importe le core, le core n'importe jamais un jeu.
 * Seuls les fichiers d'inventaire (`src/games/index.ts`, `src/games/server.ts`)
 * connaissent la liste des jeux.
 */

export type GameStatus = 'available' | 'coming-soon' | 'disabled'

/** Palette d'un jeu, projetée en variables CSS `--game-*` par `<GameTheme>`. */
export interface GameTheme {
  primary: string
  secondary: string
  accent?: string
}

export interface GameManifest {
  id: GameId
  /** Segment d'URL : `/games/<slug>`, `/play/<slug>`. */
  slug: string

  name: string
  shortDescription: string
  description?: string

  /** Illustration de la carte du catalogue, fournie par le jeu. */
  icon?: ComponentType<{ className?: string }>
  /** Logo ou titre illustré propre au jeu, affiché sur sa page. */
  logo?: ComponentType<{ className?: string }>
  theme: GameTheme

  minPlayers: number
  maxPlayers: number

  supportedModes: {
    local: boolean
    online: boolean
  }

  status: GameStatus
  tags?: string[]

  /** Encart « comment jouer », affiché sur la page du jeu. Opaque pour le core. */
  howToPlay?: ReactNode
}

/**
 * Moteur d'un jeu : pur, déterministe, sans React, sans réseau, sans DOM.
 *
 * `TState` est l'état complet, secrets compris : il ne quitte jamais le serveur.
 * Ce que chaque joueur a le droit de voir passe par `toPublicState` (visible de
 * tous) et `toPrivateState` (le joueur, et lui seul).
 *
 * Ce contrat est utilisé *à l'intérieur* d'un jeu, avec ses vrais types. La
 * plateforme ne manipule jamais un moteur : elle parle au module serveur du jeu
 * à travers une frontière JSON validée.
 */
export interface GameEngine<TConfig, TState, TAction, TPublic = unknown, TPrivate = unknown> {
  /** Réglages par défaut proposés dans le salon. */
  defaultConfig(): TConfig

  /** Vérifie qu'une configuration est jouable avec ce nombre de joueurs. */
  validateConfig(config: TConfig, playerCount: number): ValidationResult

  createInitialState(players: Player[], config: TConfig, context: GameContext): TState

  /** Refus explicite avant application : le message est affichable tel quel. */
  validateAction?(state: TState, action: TAction, context: GameContext): ValidationResult

  /** Transition pure. Ne mute jamais `state`. */
  applyAction(state: TState, action: TAction, context: GameContext): TState

  isFinished(state: TState): boolean

  getResult(state: TState): GameResult | null

  toPublicState(state: TState): TPublic

  toPrivateState(state: TState, playerId: string): TPrivate
}

/**
 * Écrans d'un jeu.
 *
 * FlexGames n'impose aucune phase : il monte `GameScreen`, et le jeu route ses
 * propres phases à l'intérieur. Les composants lisent la room via les hooks du
 * core (`useRoomContext`) plutôt que de recevoir des props imposées.
 */
export interface LobbySettingsProps {
  /** Configuration en cours d'édition. Le jeu la valide/parse lui-même. */
  config: unknown
  onChange: (config: unknown) => void
  playerCount: number
  maxPlayers: number
}

export interface LobbySummaryProps {
  config: unknown
  playerCount: number
}

export interface GameUI {
  /** Résumé de la configuration, affiché dans le salon générique. */
  LobbySummary?: ComponentType<LobbySummaryProps>
  /** Formulaire de réglages, ouvert depuis le salon générique. */
  LobbySettings?: ComponentType<LobbySettingsProps>
  /** Partie en ligne : le jeu affiche la phase courante. */
  GameScreen: ComponentType
  /** Partie locale sur un seul appareil, si `supportedModes.local`. */
  LocalScreen?: ComponentType
}

/**
 * Logique du jeu utilisable côté navigateur : uniquement du pur et du public.
 *
 * Sert au salon (peut-on lancer ?) et à la création de room (réglages par
 * défaut). Rien de secret ne doit transiter par ici.
 */
export interface GameClientModule {
  defaultConfig(): unknown
  validateConfig(config: unknown, playerCount: number): ValidationResult
  /** Options passées au serveur au lancement (ex. historique local anti-répétition). */
  startOptions?(): Record<string, unknown>
  /** Ajuste la configuration à une nouvelle taille de table (fonction pure). */
  reconcileConfig?(config: unknown, maxPlayers: number): unknown
  /** Appelé après l'enregistrement des réglages (mémorisation locale). */
  onConfigSaved?(config: unknown): void
}

/** Sons déclarés par un jeu, joués via l'AudioManager de la plateforme. */
export type GameSoundName = string

/** Onglet d'administration fourni par un jeu (catalogue de mots, etc.). */
export interface GameAdminPanel {
  label: string
  Panel: ComponentType
}

export interface GameDefinition {
  manifest: GameManifest
  /** Onglet ajouté au dashboard admin, si le jeu a des données à gérer. */
  admin?: GameAdminPanel
  /** Absents pour un jeu `coming-soon` : une carte de catalogue suffit. */
  ui?: GameUI
  client?: GameClientModule
  /** Sons additionnels, en plus des sons communs de la plateforme. */
  sounds?: readonly GameSoundName[]
}

/** Un jeu réellement jouable : ses écrans et sa logique cliente sont présents. */
export interface PlayableGame extends GameDefinition {
  ui: GameUI
  client: GameClientModule
}

export function isPlayable(game: GameDefinition): game is PlayableGame {
  return game.manifest.status === 'available' && game.ui != null && game.client != null
}

export type { GameContext, GameResult, ValidationResult }
