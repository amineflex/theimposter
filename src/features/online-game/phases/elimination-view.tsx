'use client'

import * as React from 'react'
import { PlayerAvatar } from '@/components/game/player-avatar'
import { CountIn, ResultBurst } from '@/components/party/result-burst'
import { StickerBadge } from '@/components/party/sticker-badge'
import { HostControls } from './host-controls'
import { useSound } from '@/hooks/use-sound'
import { buildPlayerViews, type RoomViewModel } from '../room-context'
import { t } from '@/i18n'

/**
 * Élimination : petit décompte 3·2·1 pour le suspense, puis l'annonce avec
 * formes géométriques qui surgissent.
 */
export function EliminationView({ room }: { room: RoomViewModel }) {
  const { play } = useSound()
  const [counted, setCounted] = React.useState(false)
  const game = room.game
  const players = buildPlayerViews(room.players, room.statuses, room.me)

  React.useEffect(() => {
    if (counted) play('eliminate')
  }, [counted, play])

  if (!game) return null

  const eliminatedId = game.last_vote?.eliminatedId ?? null
  const eliminated = players.find((player) => player.id === eliminatedId)

  if (!counted) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4">
        <p className="font-display text-lg font-extrabold uppercase text-ink-soft">
          {t('vote.votesIn')}
        </p>
        <CountIn onDone={() => setCounted(true)} />
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 text-center">
      {eliminated ? (
        <ResultBurst>
          <PlayerAvatar avatarKey={eliminated.avatarKey} name={eliminated.name} size="xl" dimmed />
          <p className="toy-title mt-3 text-4xl uppercase text-red">{eliminated.name}</p>
          <p className="toy-title-ink mt-1 text-3xl uppercase">est éliminé !</p>
          {eliminated.revealedRole && (
            <p className="mt-4 rounded-capsule border-3 border-ink bg-paper px-4 py-1.5 font-display text-base font-extrabold uppercase text-ink shadow-toy">
              {t(`role.${eliminated.revealedRole}`)}
            </p>
          )}
          {eliminated.isYou && (
            <StickerBadge tone="cream" className="mt-3">
              {t('vote.eliminatedSpectator')}
            </StickerBadge>
          )}
        </ResultBurst>
      ) : (
        <p className="toy-title-ink text-3xl uppercase">{t('vote.noElimination')}</p>
      )}

      <HostControls room={room} />
    </div>
  )
}
