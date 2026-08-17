/**
 * Types du moteur de jeu.
 *
 * Ce module ne dépend ni de React, ni de Supabase, ni du DOM : il est utilisé
 * à l'identique par le mode local (offline, dans le navigateur) et par les
 * route handlers Next.js qui font autorité pour le mode en ligne.
 */

export const GAME_MODES = ['impostor', 'undercover'] as const
export type GameMode = (typeof GAME_MODES)[number]

export const DIFFICULTIES = ['easy', 'medium', 'hard'] as const
export type Difficulty = (typeof DIFFICULTIES)[number]

/** Rôles. L'union est volontairement ouverte à l'extension (cf. ROLE_META). */
export const ROLES = ['civilian', 'impostor', 'undercover', 'mr_white'] as const
export type Role = (typeof ROLES)[number]

/**
 * Phases du jeu. `role_assignment`, `next_round` et `game_over` sont des phases
 * transitoires : le moteur ne s'y arrête jamais durablement, elles existent
 * pour rendre la machine d'état explicite et traçable.
 */
export const PHASES = [
  'lobby',
  'role_assignment',
  'role_reveal',
  'discussion',
  'voting',
  'vote_result',
  'elimination',
  'mr_white_guess',
  'next_round',
  'game_over',
  'results',
] as const
export type Phase = (typeof PHASES)[number]

/** Camp gagnant. */
export const WINNERS = ['civilians', 'impostors', 'undercover', 'mr_white'] as const
export type Winner = (typeof WINNERS)[number]

export const TIMER_OPTIONS = [15, 30, 45, 60, 90, 0] as const
/** 0 = illimité */
export type TimerOption = (typeof TIMER_OPTIONS)[number]

export const DESCRIPTION_ROUNDS_OPTIONS = [1, 2, 3, 'free'] as const
export type DescriptionRounds = (typeof DESCRIPTION_ROUNDS_OPTIONS)[number]

export const MIN_PLAYERS = 3
export const MAX_PLAYERS = 12

export interface GameSettings {
  mode: GameMode
  /** Mode Imposteur uniquement. */
  impostorCount: number
  /** Mode Undercover uniquement. */
  undercoverCount: number
  /** Mode Undercover uniquement (0 ou 1). */
  mrWhiteCount: number
  descriptionRounds: DescriptionRounds
  /** Durée de parole par joueur, en secondes. 0 = illimité. */
  speakDuration: TimerOption
  /** Durée de la phase de vote, en secondes. 0 = illimité. */
  voteDuration: TimerOption
  /** Révéler le rôle du joueur éliminé immédiatement. */
  revealRoleOnElimination: boolean
  difficulty: Difficulty | 'all'
  /** Slugs des packs sélectionnés. Vide = tous les packs. */
  packs: string[]
  /** Mot personnalisé fourni par l'hôte (prioritaire sur les packs). */
  customWord: CustomWord | null
}

export interface CustomWord {
  /** Mode impostor : le mot secret. Mode undercover : le mot des civils. */
  word: string
  /** Mode impostor : l'indice donné à l'imposteur. */
  hint?: string | null
  /** Mode undercover : le mot de l'undercover. */
  undercoverWord?: string | null
}

/** Contenu lexical d'une manche, résolu avant l'attribution des rôles. */
export interface WordSet {
  /** Mot des civils (mode undercover) ou mot secret (mode imposteur). */
  civilianWord: string
  /** Mot de l'undercover (mode undercover uniquement). */
  undercoverWord: string | null
  /** Indice de l'imposteur (mode imposteur uniquement). */
  impostorHint: string | null
  /** Réponses acceptées pour la devinette de Mr. White (en plus du mot civil). */
  acceptedAnswers: string[]
  /** Identifiant en base de l'entrée utilisée (null si mot personnalisé). */
  sourceId: string | null
  category: string | null
  difficulty: Difficulty | null
}

export interface EnginePlayer {
  id: string
  name: string
  role: Role
  /** Mot attribué. `null` pour l'imposteur et Mr. White. */
  word: string | null
  /** Indice, uniquement pour l'imposteur. */
  hint: string | null
  isAlive: boolean
  /** Numéro du tour lors duquel le joueur a été éliminé. */
  eliminatedRound: number | null
  /** Le rôle a-t-il été publiquement révélé ? */
  roleRevealed: boolean
  /** Le joueur a-t-il consulté sa carte de rôle ? */
  hasSeenRole: boolean
}

export interface VoteRecord {
  voterId: string
  targetId: string
}

export interface EliminationRecord {
  round: number
  playerId: string
  role: Role
  votes: VoteRecord[]
  tally: Record<string, number>
}

export interface GameState {
  mode: GameMode
  settings: GameSettings
  phase: Phase
  /** Tour de jeu courant (1-indexé). Un tour = descriptions + vote. */
  round: number
  /** Passe de description dans le tour courant (1..descriptionRounds). */
  descriptionPass: number
  players: EnginePlayer[]
  words: WordSet
  /** Ordre de référence de tous les joueurs, figé au lancement de la partie. */
  baseOrder: string[]
  /** Ordre de parole (ids des vivants), recalculé à chaque tour. */
  speakingOrder: string[]
  /** Index dans `speakingOrder` du joueur qui parle. -1 = discussion libre. */
  currentSpeakerIndex: number
  votes: VoteRecord[]
  /** Résultat du dernier scrutin fermé (affiché pendant `vote_result`). */
  lastVote: {
    votes: VoteRecord[]
    tally: Record<string, number>
    /** Joueur désigné, `null` en cas d'égalité menant à un barrage. */
    eliminatedId: string | null
    tie: boolean
    /** Désignation tranchée au hasard après le barrage maximum. */
    resolvedByChance: boolean
  } | null
  /** Candidats du vote de barrage en cours (null = vote normal). */
  runoffCandidates: string[] | null
  /** Nombre de barrages consécutifs (anti-boucle infinie). */
  runoffCount: number
  /**
   * Nombre de scrutins consécutifs clos sans aucun vote exprimé (table
   * entièrement AFK). Au-delà de `MAX_EMPTY_VOTES`, la partie est abandonnée :
   * cela garantit la terminaison même si plus personne ne joue.
   */
  emptyVoteStreak: number
  /** Mr. White éliminé en attente de sa devinette. */
  pendingMrWhiteId: string | null
  /** Dernière devinette de Mr. White. */
  lastMrWhiteGuess: { playerId: string; guess: string; correct: boolean } | null
  eliminations: EliminationRecord[]
  winner: Winner | null
  /** Rotation du premier orateur entre les tours. */
  firstSpeakerOffset: number
}

export type Rng = () => number
