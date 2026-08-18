'use client'

import * as React from 'react'
import { toast } from 'sonner'
import { PartyButton } from '@/flexgames/ui/party-button'
import { PartyCard } from '@/flexgames/ui/party-card'
import { StickerBadge } from '@/flexgames/ui/sticker-badge'
import { GameBanner } from '@/flexgames/ui/game-banner'
import { Countdown } from '@/flexgames/ui/countdown'
import { VoteCard } from '@/flexgames/ui/vote-card'
import { MyWordReminder } from './my-word-reminder'
import { DescriptionHistory, useDescriptionEntries } from '@/games/the-imposter/components/description-board'
import { HostControls } from './host-controls'
import { describeError } from '@/flexgames/core/api/client'
import { useImposterActions } from '../../hooks/use-imposter-action'
import { useCountdown } from '@/flexgames/ui/use-countdown'
import { useSound } from '@/flexgames/audio/use-sound'
import { buildPlayerViews, playersInGame, type ImposterRoom } from '@/games/the-imposter/hooks/use-imposter-room'
import { t } from '@/i18n'

/**
 * Vote secret. L'UI n'affiche jamais les choix des autres : seulement le
 * compteur « x / y joueurs ont voté », alimenté par `game_player_status`.
 */
export function VotingView({ room }: { room: ImposterRoom }) {
  const { play } = useSound()
  const actions = useImposterActions()
  const [selected, setSelected] = React.useState<string | null>(null)
  const [submitting, setSubmitting] = React.useState(false)
  const game = room.game
  const remaining = useCountdown(game?.phase_ends_at, game?.is_paused)

  const players = playersInGame(buildPlayerViews(room.players, room.statuses, room.me), room.statuses)
  const entries = useDescriptionEntries(room)
  const alive = players.filter((player) => player.isAlive)
  const votedCount = alive.filter((player) => player.hasVoted).length
  const me = players.find((player) => player.isYou)
  const iHaveVoted = me?.hasVoted ?? false
  const canVote = Boolean(me?.isAlive) && !iHaveVoted

  const runoffCandidates = game?.runoff_candidates ?? null
  const candidates = alive.filter(
    (player) => !runoffCandidates || runoffCandidates.includes(player.id),
  )

  if (!game) return null

  const submit = async () => {
    if (!selected) return
    setSubmitting(true)
    try {
      play('vote')
      await actions.vote(selected)
      toast.success(t('vote.done'))
      await room.refresh({ silent: true })
    } catch (error) {
      toast.error(describeError(error, t('error.network')))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-5">
      <GameBanner
        title={t('vote.title')}
        tone="red"
        chip={`${t('common.round')} ${game.round}`}
        subtitle={runoffCandidates ? t('vote.runoffBody') : t('vote.instruction')}
        aside={
          <Countdown
            remaining={remaining}
            total={game.settings.voteDuration === 0 ? null : game.settings.voteDuration}
          />
        }
      />

      {runoffCandidates && <StickerBadge tone="orange" tilt>{t('vote.runoff')}</StickerBadge>}

      <MyWordReminder room={room} />

      {/* Historique complet : on relit ce que chacun a écrit avant de voter. */}
      <DescriptionHistory entries={entries} currentRound={game.round} mode="all" />

      <p
        className="text-center font-display text-lg font-extrabold uppercase text-ink"
        aria-live="polite"
      >
        {t('vote.progress', { count: votedCount, total: alive.length })}
      </p>

      {!me?.isAlive ? (
        <PartyCard tone="paper" padding="lg" className="text-center">
          <p className="text-sm font-bold text-ink-soft">{t('vote.eliminatedSpectator')}</p>
        </PartyCard>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-2.5">
            {candidates.map((player, index) => (
              <VoteCard
                key={player.id}
                name={player.name}
                avatarKey={player.avatarKey}
                index={index}
                selected={selected === player.id}
                disabled={!canVote || player.isYou}
                onSelect={() => setSelected(player.id)}
              />
            ))}
          </div>

          {canVote ? (
            <PartyButton
              variant="red"
              size="xl"
              block
              disabled={!selected}
              loading={submitting}
              onClick={submit}
            >
              {t('vote.confirm')}
            </PartyButton>
          ) : (
            <p className="text-center font-display text-base font-extrabold uppercase text-ink-soft">
              {t('vote.waiting')}
            </p>
          )}
        </>
      )}

      <HostControls room={room} />
    </div>
  )
}
