'use client'

import * as React from 'react'
import { GameBanner } from '@/flexgames/ui/game-banner'
import { Countdown } from '@/flexgames/ui/countdown'
import { VoteResultBoard } from '@/games/the-imposter/components/vote-result-board'
import { HostControls } from './host-controls'
import { useCountdown } from '@/flexgames/ui/use-countdown'
import { useSound } from '@/flexgames/audio/use-sound'
import { buildPlayerViews, type ImposterRoom } from '@/games/the-imposter/hooks/use-imposter-room'
import { t } from '@/i18n'

/** Résultat du scrutin : les votes deviennent publics ici, jamais avant. */
export function VoteResultView({ room }: { room: ImposterRoom }) {
  const { play } = useSound()
  const game = room.game
  const remaining = useCountdown(game?.phase_ends_at, game?.is_paused)
  const players = buildPlayerViews(room.players, room.statuses, room.me)

  React.useEffect(() => {
    play('vote')
  }, [play])

  if (!game?.last_vote) return null

  return (
    <div className="space-y-5">
      <GameBanner
        title={t('phase.vote_result')}
        tone="purple"
        chip={`${t('common.round')} ${game.round}`}
        aside={<Countdown remaining={remaining} />}
      />
      <VoteResultBoard
        lastVote={game.last_vote}
        players={players.map((player) => ({ id: player.id, name: player.name }))}
      />

      <HostControls room={room} />
    </div>
  )
}
