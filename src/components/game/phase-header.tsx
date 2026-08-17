'use client'

import { GameBanner, type BannerTone } from '@/components/party/game-banner'
import { Countdown } from '@/components/party/countdown'
import { StickerBadge } from '@/components/party/sticker-badge'
import { t, type TranslationKey } from '@/i18n'
import type { Phase } from '@/lib/game-engine/types'

export interface PhaseHeaderProps {
  phase: Phase
  round?: number
  remaining?: number | null
  total?: number | null
  subtitle?: string
  aliveCount?: number
  totalPlayers?: number
  paused?: boolean
  className?: string
}

/** Titre de phase, court et expressif (deux lignes sur mobile). */
const PHASE_TITLE: Partial<Record<Phase, TranslationKey>> = {
  lobby: 'phase.lobby',
  role_reveal: 'phase.role_reveal',
  discussion: 'phase.discussion',
  voting: 'phase.voting',
  vote_result: 'phase.vote_result',
  elimination: 'phase.elimination',
  mr_white_guess: 'phase.mr_white_guess',
  results: 'phase.results',
}

const PHASE_TONE: Partial<Record<Phase, BannerTone>> = {
  role_reveal: 'yellow',
  discussion: 'blue',
  voting: 'red',
  vote_result: 'purple',
  elimination: 'red',
  mr_white_guess: 'blue',
  results: 'green',
}

/** Bandeau de phase : titre, manche, minuteur. */
export function PhaseHeader({
  phase,
  round,
  remaining,
  total,
  subtitle,
  aliveCount,
  totalPlayers,
  paused,
  className,
}: PhaseHeaderProps) {
  const titleKey = PHASE_TITLE[phase]

  return (
    <div className={className}>
      <GameBanner
        title={titleKey ? t(titleKey) : phase}
        tone={PHASE_TONE[phase] ?? 'ink'}
        chip={round ? `${t('common.round')} ${round}` : undefined}
        subtitle={subtitle}
        aside={remaining !== undefined ? <Countdown remaining={remaining} total={total} /> : undefined}
      />
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {paused && <StickerBadge tone="red">{t('lobby.paused')}</StickerBadge>}
        {typeof aliveCount === 'number' && typeof totalPlayers === 'number' && (
          <StickerBadge tone="cream" size="sm">
            {aliveCount} / {totalPlayers} en jeu
          </StickerBadge>
        )}
      </div>
    </div>
  )
}
