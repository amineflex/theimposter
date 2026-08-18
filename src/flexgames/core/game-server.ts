import type { SupabaseClient } from '@supabase/supabase-js'
import type { GameId, Player, PlayerId, Room, RoomId } from './types'

/**
 * Frontière serveur entre la plateforme et un jeu.
 *
 * La plateforme sait ouvrir une session, transmettre une action et clore une
 * partie ; elle ne sait rien de ce que l'action signifie. Le jeu reçoit une
 * charge utile JSON qu'il valide lui-même (Zod) avant de la traiter.
 *
 * Ce module n'est jamais importé par du code client : il utilise la clé
 * `service_role`. Son inventaire vit dans `src/games/server.ts`, importé
 * uniquement depuis les route handlers.
 */

export interface GameServerContext {
  /** Client Supabase avec la clé service_role. Jamais exposé au navigateur. */
  db: SupabaseClient
  room: Room
  /** Joueur à l'origine de l'appel (membre de la room, déjà authentifié). */
  actor: Player
  /** Identité Supabase de l'appelant, pour les écritures qui la tracent. */
  actorUserId: string
  players: Player[]
  sessionId: string
}

/** Quota anti-abus d'une action, appliqué par la plateforme avant l'appel. */
export interface GameActionSpec {
  limit: number
  windowSeconds: number
}

export interface GameServerModule {
  gameId: GameId

  /**
   * Démarre une partie : crée les données propres au jeu pour cette session.
   * La ligne `game_sessions` est déjà créée par la plateforme.
   */
  startSession(context: {
    db: SupabaseClient
    room: Room
    players: Player[]
    sessionId: string
    config: unknown
  }): Promise<void>

  /** Traite une action de jeu. Le retour est renvoyé tel quel au client. */
  handleAction(
    context: GameServerContext,
    action: { type: string; payload: unknown },
  ): Promise<unknown>

  /** État privé d'un joueur (rôle, mot secret, main de cartes…). */
  getPrivateState?(context: {
    db: SupabaseClient
    sessionId: string
    playerId: PlayerId
    userId: string
  }): Promise<unknown>

  /** Réglages par défaut d'une nouvelle room pour ce jeu. */
  defaultConfig(): unknown

  /** Valide les réglages choisis dans le salon. Lève une erreur si invalides. */
  validateConfig(config: unknown, playerCount: number): void

  /** Déclaration des actions supportées (quotas). Optionnel. */
  actions?: Record<string, GameActionSpec>

  /**
   * Un joueur quitte la room pendant une partie.
   * Au jeu de décider ce que cela signifie (élimination, abandon, rien).
   */
  onPlayerLeft?(context: {
    db: SupabaseClient
    roomId: RoomId
    sessionId: string
    playerId: PlayerId
  }): Promise<void>
}
