'use client'

import { toast } from 'sonner'
import { GameBanner } from '@/components/party/game-banner'
import { Countdown } from '@/components/party/countdown'
import { PlayerAvatar } from '@/components/game/player-avatar'
import { MrWhiteGuessForm } from '@/features/game/mr-white-guess-form'
import { HostControls } from './host-controls'
import { api, describeError } from '@/lib/api/client'
import { useCountdown } from '@/hooks/use-countdown'
import { useSound } from '@/hooks/use-sound'
import { buildPlayerViews, type RoomViewModel } from '../room-context'
import { t } from '@/i18n'

/**
 * Dernière chance de Mr. White.
 *
 * Seul le joueur concerné voit le formulaire ; la vérification du mot est faite
 * côté serveur (le mot des civils n'est jamais transmis au client à ce stade).
 */
export function MrWhiteView({ room }: { room: RoomViewModel }) {
  const { play } = useSound()
  const game = room.game
  const remaining = useCountdown(game?.phase_ends_at, game?.is_paused)
  const players = buildPlayerViews(room.players, room.statuses, room.me)
  const pending = players.find((player) => player.id === game?.pending_mr_white_id)
  const isMe = pending?.isYou ?? false

  if (!game) return null

  if (!isMe) {
    return (
      <div className="flex flex-1 flex-col gap-5">
        <GameBanner
          title={t('phase.mr_white_guess')}
          tone="blue"
          aside={<Countdown remaining={remaining} />}
        />
        <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
          {pending && (
            <PlayerAvatar avatarKey={pending.avatarKey} name={pending.name} size="xl" />
          )}
          <p className="font-display text-2xl font-extrabold uppercase text-ink">
            {t('mrWhite.waiting')}
          </p>
          <p className="font-display text-base font-extrabold uppercase text-ink-soft">
            {pending?.name}
          </p>
        </div>
        <HostControls room={room} />
      </div>
    )
  }

  return (
    <MrWhiteGuessForm
      playerName={pending?.name ?? 'Mr. White'}
      onSubmit={async (guess) => {
        try {
          const result = await api.post<{ correct: boolean }>('/api/game/mr-white', {
            gameId: game.id,
            guess,
          })
          play(result.correct ? 'win' : 'lose')
          await room.refresh({ silent: true })
          return result.correct
        } catch (error) {
          toast.error(describeError(error, t('error.network')))
          return false
        }
      }}
    />
  )
}
