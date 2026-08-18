'use client'

import * as React from 'react'
import { toast } from 'sonner'
import { PartyButton } from '@/flexgames/ui/party-button'
import { PartyCard } from '@/flexgames/ui/party-card'
import { StickerBadge } from '@/flexgames/ui/sticker-badge'
import { GameBanner } from '@/flexgames/ui/game-banner'
import { Countdown } from '@/flexgames/ui/countdown'
import { PlayerBubble } from '@/flexgames/ui/player-bubble'
import { RoleRevealCard } from '@/games/the-imposter/components/role-reveal-card'
import { HoldToReveal } from '@/flexgames/ui/hold-to-reveal'
import { LoadingState } from '@/flexgames/ui/states'
import { describeError } from '@/flexgames/core/api/client'
import { useImposterActions } from '../../hooks/use-imposter-action'
import { useCountdown } from '@/flexgames/ui/use-countdown'
import { useSound } from '@/flexgames/audio/use-sound'
import { buildPlayerViews, playersInGame, type ImposterRoom } from '@/games/the-imposter/hooks/use-imposter-room'
import { HostControls } from './host-controls'
import { t } from '@/i18n'

/**
 * Révélation en ligne : le rôle n'est jamais affiché à l'ouverture de la page.
 * Il faut un appui maintenu, et la carte se remasque à la demande.
 */
export function RoleRevealView({ room }: { room: ImposterRoom }) {
  const { play } = useSound()
  const actions = useImposterActions()
  const [revealed, setRevealed] = React.useState(false)
  const [confirming, setConfirming] = React.useState(false)
  const remaining = useCountdown(room.game?.phase_ends_at, room.game?.is_paused)

  const players = playersInGame(buildPlayerViews(room.players, room.statuses, room.me), room.statuses)
  const seen = players.filter((player) => player.hasSeenRole).length
  const myRole = room.myRole

  const confirm = async () => {
    if (!room.game) return
    setConfirming(true)
    try {
      await actions.reveal()
      await room.refresh({ silent: true })
    } catch (error) {
      toast.error(describeError(error, t('error.network')))
    } finally {
      setConfirming(false)
    }
  }

  if (!room.game) return <LoadingState />

  if (myRole?.spectator || !myRole?.role) {
    return (
      <div className="space-y-5">
        <GameBanner
          title={t('phase.role_reveal')}
          tone="yellow"
          subtitle={t('role.spectator')}
          aside={<Countdown remaining={remaining} />}
        />
        <PartyCard tone="paper" padding="lg" className="text-center">
          <p className="text-sm font-bold text-ink-soft">Vous suivez cette partie en spectateur.</p>
        </PartyCard>
      </div>
    )
  }

  const iAmReady = room.statuses.find((status) => status.room_player_id === myRole.playerId)?.has_seen_role

  return (
    <div className="flex flex-1 flex-col gap-5">
      <GameBanner
        title={t('phase.role_reveal')}
        tone="yellow"
        chip={t('reveal.seen', { count: seen, total: players.length })}
        aside={<Countdown remaining={remaining} />}
      />

      <div className="flex flex-1 flex-col items-center justify-center gap-4">
        {!revealed ? (
          <>
            <p className="text-center text-sm font-bold text-ink-soft">{t('reveal.dontLook')}</p>
            <HoldToReveal
              onRevealed={() => {
                play('reveal')
                setRevealed(true)
              }}
            />
          </>
        ) : (
          <>
            <RoleRevealCard role={myRole.role} word={myRole.word} hint={myRole.hint} />
            {iAmReady ? (
              <StickerBadge tone="green">{t('reveal.waiting')}</StickerBadge>
            ) : (
              <PartyButton variant="green" size="xl" block loading={confirming} onClick={confirm}>
                {t('reveal.doneNext')}
              </PartyButton>
            )}
            <PartyButton variant="ghost" size="sm" onClick={() => setRevealed(false)}>
              Masquer ma carte
            </PartyButton>
          </>
        )}
      </div>

      <ul className="grid grid-cols-4 gap-2">
        {players.map((player, index) => (
          <li key={player.id}>
            <PlayerBubble
              name={player.name}
              avatarKey={player.avatarKey}
              isHost={player.isHost}
              isYou={player.isYou}
              hasSeenRole={player.hasSeenRole}
              index={index}
            />
          </li>
        ))}
      </ul>

      <HostControls room={room} />
    </div>
  )
}
