'use client'

import * as React from 'react'
import { toast } from 'sonner'
import { PartyButton } from '@/components/party/party-button'
import { GameBanner } from '@/components/party/game-banner'
import { Countdown } from '@/components/party/countdown'
import { DiscussionBoard } from '@/features/game/discussion-board'
import { ChatPanel } from '../chat-panel'
import { HostControls } from './host-controls'
import { MyWordReminder } from './my-word-reminder'
import { api, ApiClientError } from '@/lib/api/client'
import { useCountdown } from '@/hooks/use-countdown'
import { useSound } from '@/hooks/use-sound'
import { buildPlayerViews, playersInGame, type RoomViewModel } from '../room-context'
import { t } from '@/i18n'

/** Phase de descriptions : chacun parle à son tour. */
export function DiscussionView({ room }: { room: RoomViewModel }) {
  const { play } = useSound()
  const [submitting, setSubmitting] = React.useState(false)
  const game = room.game
  const remaining = useCountdown(game?.phase_ends_at, game?.is_paused)

  const players = playersInGame(buildPlayerViews(room.players, room.statuses, room.me), room.statuses)
  const currentSpeakerId =
    game && game.current_speaker_index >= 0
      ? (game.speaking_order[game.current_speaker_index] ?? null)
      : null
  const isMyTurn = currentSpeakerId !== null && currentSpeakerId === room.me?.id

  // Petit signal sonore au changement d'orateur.
  React.useEffect(() => {
    if (currentSpeakerId) play('turn')
  }, [currentSpeakerId, play])

  if (!game) return null

  const done = async () => {
    setSubmitting(true)
    try {
      await api.post('/api/game/advance', { gameId: game.id })
      await room.refresh({ silent: true })
    } catch (error) {
      toast.error(error instanceof ApiClientError ? error.message : t('error.network'))
    } finally {
      setSubmitting(false)
    }
  }

  const totalDuration = game.settings.speakDuration === 0 ? null : game.settings.speakDuration
  const speaker = players.find((player) => player.id === currentSpeakerId)

  return (
    <div className="space-y-5">
      <GameBanner
        title={
          speaker ? t('discussion.turnOf', { name: speaker.name }) : t('phase.discussion')
        }
        tone="blue"
        chip={`${t('common.round')} ${game.round}`}
        subtitle={isMyTurn ? t('discussion.yourTurn') : t('discussion.instruction')}
        aside={
          <Countdown
            remaining={remaining}
            total={
              game.settings.descriptionRounds === 'free' && totalDuration
                ? totalDuration * players.filter((player) => player.isAlive).length
                : totalDuration
            }
          />
        }
      />

      <MyWordReminder room={room} />

      <DiscussionBoard
        players={players.map((player) => ({
          id: player.id,
          name: player.name,
          avatarKey: player.avatarKey,
          isAlive: player.isAlive,
          revealedRole: player.revealedRole,
        }))}
        speakingOrder={game.speaking_order}
        currentSpeakerId={currentSpeakerId}
        descriptionPass={game.description_pass}
        totalPasses={game.settings.descriptionRounds}
      />

      {isMyTurn && (
        <PartyButton variant="yellow" size="xl" block loading={submitting} onClick={done}>
          {t('discussion.done')}
        </PartyButton>
      )}

      <ChatPanel room={room} />
      <HostControls room={room} />
    </div>
  )
}
