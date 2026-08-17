'use client'

import * as React from 'react'
import { toast } from 'sonner'
import { PartyButton } from '@/components/party/party-button'
import { PartyCard } from '@/components/party/party-card'
import { StickerBadge } from '@/components/party/sticker-badge'
import { GameBanner } from '@/components/party/game-banner'
import { Countdown } from '@/components/party/countdown'
import { PlayerBubble } from '@/components/party/player-bubble'
import { RoleRevealCard } from '@/components/party/role-reveal-card'
import { HoldToReveal } from '@/components/game/hold-to-reveal'
import { LoadingState } from '@/components/game/states'
import { api, ApiClientError } from '@/lib/api/client'
import { useCountdown } from '@/hooks/use-countdown'
import { useSound } from '@/hooks/use-sound'
import { buildPlayerViews, playersInGame, type RoomViewModel } from '../room-context'
import { HostControls } from './host-controls'
import { t } from '@/i18n'

/**
 * Révélation en ligne : le rôle n'est jamais affiché à l'ouverture de la page.
 * Il faut un appui maintenu, et la carte se remasque à la demande.
 */
export function RoleRevealView({ room }: { room: RoomViewModel }) {
  const { play } = useSound()
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
      await api.post('/api/game/reveal', { gameId: room.game.id })
      await room.refresh({ silent: true })
    } catch (error) {
      toast.error(error instanceof ApiClientError ? error.message : t('error.network'))
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
