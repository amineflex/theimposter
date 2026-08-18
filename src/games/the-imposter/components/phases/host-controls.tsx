'use client'

import * as React from 'react'
import { FastForward, Pause, Play } from 'lucide-react'
import { toast } from 'sonner'
import { PartyButton } from '@/flexgames/ui/party-button'
import { describeError } from '@/flexgames/core/api/client'
import { useImposterActions } from '../../hooks/use-imposter-action'
import { t } from '@/i18n'
import type { ImposterRoom } from '@/games/the-imposter/hooks/use-imposter-room'

/**
 * Contrôles réservés à l'hôte : forcer l'étape suivante (joueur AFK) et
 * mettre la partie en pause. Les permissions sont revérifiées côté serveur.
 */
export function HostControls({ room }: { room: ImposterRoom }) {
  const [busy, setBusy] = React.useState(false)
  const isHost = room.me?.is_host ?? false
  const game = room.game
  const actions = useImposterActions()
  if (!isHost || !game) return null

  const call = async (action: () => Promise<unknown>) => {
    setBusy(true)
    try {
      await action()
      await room.refresh({ silent: true })
    } catch (error) {
      toast.error(describeError(error, t('error.network')))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-wrap items-center justify-center gap-2 border-t-3 border-dashed border-ink/25 pt-4">
      <PartyButton
        variant="paper"
        size="sm"
        loading={busy}
        onClick={() => call(() => actions.advance(true))}
      >
        <FastForward className="h-4 w-4" aria-hidden />
        {t('lobby.forceNext')}
      </PartyButton>
      <PartyButton
        variant="ghost"
        size="sm"
        loading={busy}
        onClick={() => call(() => actions.pause(!game.is_paused))}
      >
        {game.is_paused ? (
          <>
            <Play className="h-4 w-4" aria-hidden />
            {t('lobby.resume')}
          </>
        ) : (
          <>
            <Pause className="h-4 w-4" aria-hidden />
            {t('lobby.pause')}
          </>
        )}
      </PartyButton>
    </div>
  )
}
