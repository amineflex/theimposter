'use client'

import * as React from 'react'
import { ErrorState } from '@/flexgames/ui/states'
import { GameThemeStyle } from '@/flexgames/ui/game-theme'
import { CreateRoomForm } from './create-room-form'
import { JoinSection } from './join-section'
import { isOnlineConfigured } from '@/flexgames/core/supabase/client'
import { useOnlineStatus } from '@/flexgames/realtime/use-online-status'
import { isPlayable } from '@/flexgames/core/game-definition'
import { getGame } from '@/flexgames/game-registry'
import { t } from '@/i18n'
import { cn } from '@/lib/utils'

/**
 * Écran « jouer en ligne » d'un jeu : créer une room, ou en rejoindre une.
 * Identique pour tous les jeux ; seuls les réglages injectés changent.
 */
export function PlayOnlineScreen({ gameId }: { gameId: string }) {
  const online = useOnlineStatus()
  const [tab, setTab] = React.useState<'create' | 'join'>('create')

  // Le jeu est relu ici : un manifest porte des composants, qui ne traversent
  // pas la frontière serveur → client.
  const game = getGame(gameId)
  if (!game || !isPlayable(game)) {
    return <ErrorState title={t('error.title')} message={t('error.gameUnavailable')} />
  }

  if (!isOnlineConfigured()) {
    return <ErrorState title={t('error.title')} message={t('error.notConfigured')} />
  }
  if (!online) {
    return (
      <ErrorState
        title={t('offline.title')}
        message={`${t('offline.onlineUnavailable')} ${t('offline.body')}`}
      />
    )
  }

  return (
    <GameThemeStyle theme={game.manifest.theme}>
      <div className="space-y-6">
        {/* Onglets en capsules, façon manette de jeu */}
        <div role="tablist" aria-label="Partie en ligne" className="flex gap-2">
          {(['create', 'join'] as const).map((value) => (
            <button
              key={value}
              role="tab"
              aria-selected={tab === value}
              onClick={() => setTab(value)}
              className={cn(
                'toy-press min-h-12 flex-1 rounded-capsule border-3 border-ink font-display text-base font-extrabold uppercase text-ink shadow-toy',
                tab === value ? 'bg-yellow' : 'bg-paper',
              )}
            >
              {value === 'create' ? t('create.title') : t('join.title')}
            </button>
          ))}
        </div>

        {tab === 'create' ? (
          <CreateRoomForm game={game} />
        ) : (
          <JoinSection gameId={game.manifest.id} />
        )}
      </div>
    </GameThemeStyle>
  )
}
