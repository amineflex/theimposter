'use client'

import * as React from 'react'
import { toast } from 'sonner'
import { PartyButton } from '@/components/party/party-button'
import { GameBanner } from '@/components/party/game-banner'
import { Countdown } from '@/components/party/countdown'
import { DiscussionBoard } from '@/features/game/discussion-board'
import { PartyCard } from '@/components/party/party-card'
import {
  DescriptionHistory,
  DescriptionInput,
  useDescriptionEntries,
} from '../description-board'
import { HostControls } from './host-controls'
import { MyWordReminder } from './my-word-reminder'
import { api, describeError } from '@/lib/api/client'
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
  const entries = useDescriptionEntries(room)
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
      toast.error(describeError(error, t('error.network')))
    } finally {
      setSubmitting(false)
    }
  }

  const totalDuration = game.settings.speakDuration === 0 ? null : game.settings.speakDuration
  const speaker = players.find((player) => player.id === currentSpeakerId)

  const freeDiscussion = game.settings.descriptionRounds === 'free'
  const me = room.me
  // Une seule description par joueur et par passe : côté serveur comme ici.
  const alreadyWritten =
    me != null &&
    room.descriptions.some(
      (entry) =>
        entry.room_player_id === me.id &&
        entry.round === game.round &&
        entry.pass === game.description_pass,
    )
  const amAlive = players.find((player) => player.id === me?.id)?.isAlive ?? false
  const canWrite = amAlive && !game.is_paused && !alreadyWritten && (freeDiscussion || isMyTurn)

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

      {/* Saisie écrite : c'est ici que l'on donne son indice, pas dans le chat. */}
      {canWrite ? (
        <PartyCard tone="cream" padding="md" tilt="left">
          <DescriptionInput room={room} />
          {isMyTurn && !freeDiscussion && (
            <PartyButton
              variant="ghost"
              size="sm"
              block
              className="mt-3"
              loading={submitting}
              onClick={done}
            >
              {t('discussion.skip')}
            </PartyButton>
          )}
        </PartyCard>
      ) : (
        amAlive && (
          <PartyCard tone="paper" padding="md" className="text-center">
            <p className="text-sm font-bold text-ink-soft">
              {alreadyWritten
                ? freeDiscussion
                  ? t('describe.freeMode')
                  : t('describe.sent')
                : speaker
                  ? t('describe.waiting', { name: speaker.name })
                  : t('discussion.instruction')}
            </p>
          </PartyCard>
        )
      )}

      <DescriptionHistory entries={entries} currentRound={game.round} mode="current" />

      <HostControls room={room} />
    </div>
  )
}
