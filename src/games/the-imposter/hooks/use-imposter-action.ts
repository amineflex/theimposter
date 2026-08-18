'use client'

import { useGameAction } from '@/flexgames/session/use-game-action'

/**
 * Actions de The Imposter, nommées et typées.
 *
 * Elles transitent toutes par l'unique route `/api/game/action` de la
 * plateforme, qui les remet au module serveur du jeu.
 */
export function useImposterActions() {
  const { send, pending } = useGameAction()

  return {
    pending,
    reveal: () => send({ type: 'reveal' }),
    advance: (force = false) => send({ type: 'advance', force }),
    tick: () => send<{ result: { advanced: boolean } }>({ type: 'tick' }),
    vote: (targetId: string) => send({ type: 'vote', targetId }),
    describe: (body: string) => send({ type: 'describe', body }),
    guess: (guess: string) =>
      send<{ result: { correct: boolean } }>({ type: 'mr-white-guess', guess }),
    pause: (paused: boolean) => send({ type: 'pause', paused }),
  }
}
