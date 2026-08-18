/**
 * Modèle de domaine FlexGames.
 *
 * Ces types ne décrivent QUE ce qui est commun à tous les mini-jeux : des
 * joueurs réunis dans une room, et des parties successives jouées dans cette
 * room. Aucun concept de gameplay (rôle, mot, score, phase nommée) n'a sa place
 * ici : cela appartient aux modules de `src/games/`.
 */

export type GameId = string
export type RoomId = string
export type PlayerId = string

export type RoomStatus = 'lobby' | 'in_game' | 'finished' | 'cancelled' | 'expired'
export type RoomVisibility = 'private' | 'public'

/** Un groupe de joueurs, et le jeu qu'ils ont choisi. */
export interface Room {
  id: RoomId
  code: string
  /** Jeu sélectionné (identifiant du registry). La room ne sait rien de ses règles. */
  gameId: GameId
  hostPlayerId: PlayerId | null
  status: RoomStatus
  visibility: RoomVisibility
  maxPlayers: number
  createdAt: string
  lastActivityAt: string
  expiresAt: string
}

/** Identité d'un joueur dans une room. Aucune donnée de gameplay. */
export interface Player {
  id: PlayerId
  roomId: RoomId
  nickname: string
  avatarId: string
  isHost: boolean
  connected: boolean
  joinedAt: string
}

export type SessionStatus = 'active' | 'finished' | 'abandoned'

/**
 * Une partie précise, jouée dans une room.
 *
 * Une room peut enchaîner plusieurs sessions (rejouer, ou plus tard changer de
 * jeu sans que personne ne quitte le salon).
 */
export interface GameSession {
  id: string
  roomId: RoomId
  gameId: GameId
  status: SessionStatus
  createdAt: string
  finishedAt: string | null
}

/** Contexte transmis au moteur d'un jeu lors d'une action. */
export interface GameContext {
  /** Joueur à l'origine de l'action, `null` pour une action système (minuteur). */
  actorId: PlayerId | null
  /** Horodatage de référence, injecté pour rendre les moteurs testables. */
  now: number
}

export interface ValidationResult {
  ok: boolean
  /** Message affichable tel quel si `ok` est faux. */
  error?: string
  code?: string
}

export const valid: ValidationResult = { ok: true }
export function invalid(error: string, code?: string): ValidationResult {
  return { ok: false, error, code }
}

/**
 * Résultat d'une partie, volontairement minimal.
 *
 * Un jeu sans score laisse `scores` vide ; un jeu par équipes remplit `teamId`.
 * FlexGames n'en fait rien d'autre que de l'affichage et des statistiques.
 */
export interface GameResult {
  /** Camp/équipe/joueur vainqueur, tel que le jeu le nomme. `null` = sans vainqueur. */
  winner: string | null
  winnerLabel?: string
  scores?: PlayerScore[]
}

export interface PlayerScore {
  playerId: PlayerId
  score: number
  teamId?: string
}
