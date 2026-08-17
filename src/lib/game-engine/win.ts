import { isIntruder } from './roles'
import type { EnginePlayer, GameMode, Winner } from './types'

/**
 * CONDITIONS DE VICTOIRE (source unique de vérité, jamais dupliquée dans l'UI).
 *
 * Mode Imposteur
 * --------------
 * - Les joueurs (civils) gagnent dès que tous les imposteurs sont éliminés.
 * - Les imposteurs gagnent par domination : dès que le nombre d'imposteurs
 *   vivants est supérieur ou égal au nombre de civils vivants (ils ne peuvent
 *   plus être votés dehors). Cette condition garantit aussi la terminaison de
 *   la partie : chaque tour élimine un joueur.
 *
 * Mode Undercover
 * ---------------
 * - Les civils gagnent dès que tous les intrus (Undercover + Mr. White) sont
 *   éliminés.
 * - Les intrus gagnent par domination : intrus vivants >= civils vivants.
 *   Le camp affiché est `undercover` (l'équipe des intrus).
 * - Mr. White gagne immédiatement s'il devine le mot des civils au moment de
 *   son élimination (géré dans `engine.ts`, renvoie le vainqueur `mr_white`).
 */
export function evaluateWinner(mode: GameMode, players: EnginePlayer[]): Winner | null {
  const alive = players.filter((p) => p.isAlive)
  const aliveIntruders = alive.filter((p) => isIntruder(p.role))
  const aliveCivilians = alive.filter((p) => !isIntruder(p.role))

  if (aliveIntruders.length === 0) return 'civilians'
  if (aliveCivilians.length === 0) return mode === 'impostor' ? 'impostors' : 'undercover'
  if (aliveIntruders.length >= aliveCivilians.length) {
    return mode === 'impostor' ? 'impostors' : 'undercover'
  }
  return null
}

export function winnerLabelKey(winner: Winner): string {
  switch (winner) {
    case 'civilians':
      return 'result.win.civilians'
    case 'impostors':
      return 'result.win.impostors'
    case 'undercover':
      return 'result.win.undercover'
    case 'mr_white':
      return 'result.win.mrWhite'
  }
}
