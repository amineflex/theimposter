'use client'

import { LoadingState } from '@/flexgames/ui/states'
import { useImposterRoom } from '../hooks/use-imposter-room'
import { useDeadlineTicker } from '@/flexgames/session/use-deadline-ticker'
import { useImposterActions } from '../hooks/use-imposter-action'
import { RoleRevealView } from './phases/role-reveal-view'
import { DiscussionView } from './phases/discussion-view'
import { VotingView } from './phases/voting-view'
import { VoteResultView } from './phases/vote-result-view'
import { EliminationView } from './phases/elimination-view'
import { MrWhiteView } from './phases/mr-white-view'
import { ResultsView } from './phases/results-view'

/**
 * Écran de partie The Imposter : routage des phases.
 *
 * C'est ici que vivent les phases du jeu  ·  la plateforme n'en connaît aucune.
 * Le composant ne décide de rien : il affiche la phase renvoyée par le serveur.
 */
export function GameScreen() {
  const room = useImposterRoom()
  const actions = useImposterActions()
  const game = room.game

  // Minuteur de phase : le serveur revérifie l'échéance avant d'avancer.
  useDeadlineTicker({
    endsAt: game?.phase_ends_at,
    active: Boolean(game && !game.is_paused && !game.finished_at && game.phase !== 'results'),
    onExpired: async () => {
      const { result } = await actions.tick()
      if (result.advanced) await room.refresh({ silent: true })
    },
  })

  if (!game) return <LoadingState />

  if (game.phase === 'results' || game.finished_at) return <ResultsView room={room} />

  switch (game.phase) {
    case 'role_reveal':
      return <RoleRevealView room={room} />
    case 'discussion':
      return <DiscussionView room={room} />
    case 'voting':
      return <VotingView room={room} />
    case 'vote_result':
      return <VoteResultView room={room} />
    case 'elimination':
      return <EliminationView room={room} />
    case 'mr_white_guess':
      return <MrWhiteView room={room} />
    default:
      return <LoadingState />
  }
}
