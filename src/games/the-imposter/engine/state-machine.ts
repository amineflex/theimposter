import type { Phase } from './types'
import { GameRuleError } from '@/flexgames/core/errors'

/**
 * Transitions autorisées de la machine d'état.
 * Toute transition absente de cette table est rejetée par le moteur : un client
 * ne peut donc jamais forcer une phase interdite, même en forgeant une requête.
 */
export const ALLOWED_TRANSITIONS: Record<Phase, readonly Phase[]> = {
  lobby: ['role_assignment'],
  role_assignment: ['role_reveal'],
  role_reveal: ['discussion', 'results'],
  discussion: ['discussion', 'voting', 'results'],
  voting: ['vote_result', 'results'],
  vote_result: ['elimination', 'voting'], // 'voting' = vote de barrage
  elimination: ['mr_white_guess', 'next_round', 'game_over'],
  mr_white_guess: ['next_round', 'game_over'],
  next_round: ['discussion'],
  game_over: ['results'],
  results: ['lobby', 'role_assignment'], // rematch
}

export function canTransition(from: Phase, to: Phase): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to)
}

export class IllegalTransitionError extends GameRuleError {
  constructor(
    public readonly from: Phase,
    public readonly to: Phase,
  ) {
    super("Cette action n'est plus possible à cette étape.", 'phase')
    this.name = 'IllegalTransitionError'
  }
}

export function assertTransition(from: Phase, to: Phase): void {
  if (!canTransition(from, to)) throw new IllegalTransitionError(from, to)
}

/** Phases pendant lesquelles la partie est en cours (ni lobby, ni terminée). */
export function isActivePhase(phase: Phase): boolean {
  return phase !== 'lobby' && phase !== 'results'
}

/** Phases où le joueur éliminé devient spectateur et voit tout. */
export function isSpectatorRevealPhase(phase: Phase): boolean {
  return phase === 'results'
}
