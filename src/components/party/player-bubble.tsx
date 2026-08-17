'use client'

import { motion } from 'framer-motion'
import { Check, Crown, Skull } from 'lucide-react'
import { PlayerAvatar } from '@/components/game/player-avatar'
import { StickerBadge } from './sticker-badge'
import { RoleBadge } from '@/components/game/role-badge'
import { cn } from '@/lib/utils'
import { t } from '@/i18n'
import type { Role } from '@/lib/game-engine/types'

/** Couleurs de bulle attribuées par position : chaque joueur a sa teinte. */
const BUBBLE_TONES = ['bg-yellow', 'bg-blue', 'bg-red', 'bg-green', 'bg-pink', 'bg-orange', 'bg-purple'] as const

export function bubbleTone(index: number): string {
  return BUBBLE_TONES[index % BUBBLE_TONES.length] as string
}

export interface PlayerBubbleProps {
  name: string
  avatarKey: string
  isHost?: boolean
  isYou?: boolean
  isAlive?: boolean
  isSpeaking?: boolean
  hasVoted?: boolean
  hasSeenRole?: boolean
  revealedRole?: Role | null
  voteCount?: number
  index?: number
  size?: 'md' | 'lg'
  className?: string
}

/**
 * Joueur en bulle : carte colorée, avatar, pseudo, pastilles d'état.
 * Entrée en « pop » quand un joueur rejoint la partie.
 */
export function PlayerBubble({
  name,
  avatarKey,
  isHost,
  isYou,
  isAlive = true,
  isSpeaking,
  hasVoted,
  hasSeenRole,
  revealedRole,
  voteCount,
  index = 0,
  size = 'md',
  className,
}: PlayerBubbleProps) {
  const tone = bubbleTone(index)
  const tilt = index % 2 === 0 ? 'tilt-left-sm' : 'tilt-right-sm'

  return (
    <motion.div
      layout
      initial={{ scale: 0.7, opacity: 0, y: 12 }}
      animate={{ scale: 1, opacity: 1, y: 0 }}
      transition={{
        delay: Math.min(index * 0.05, 0.3),
        type: 'spring',
        stiffness: 520,
        damping: 17,
      }}
      className={cn('flex flex-col items-center', className)}
    >
      <div
        className={cn(
          'relative flex w-full flex-col items-center gap-1 rounded-blob border-3 border-ink px-2 pb-2 pt-3 shadow-toy-md',
          tone,
          tilt,
          !isAlive && 'bg-cream-deep',
          isSpeaking && 'ring-4 ring-ink ring-offset-2 ring-offset-background',
        )}
      >
        <PlayerAvatar
          avatarKey={avatarKey}
          name={name}
          size={size === 'lg' ? 'xl' : 'lg'}
          dimmed={!isAlive}
        />

        <p
          className={cn(
            'max-w-full truncate font-display text-sm font-extrabold uppercase text-ink',
            !isAlive && 'text-ink-soft line-through',
          )}
        >
          {name}
        </p>

        {isHost && (
          <span
            className="absolute -right-2 -top-3 rotate-12 rounded-capsule border-3 border-ink bg-paper px-1.5 py-0.5 shadow-toy"
            aria-label={t('common.host')}
          >
            <Crown className="h-3.5 w-3.5 text-ink" aria-hidden />
          </span>
        )}
        {!isAlive && (
          <span
            className="absolute -bottom-2 -right-2 rounded-capsule border-3 border-ink bg-ink p-1 shadow-toy"
            aria-hidden
          >
            <Skull className="h-3.5 w-3.5 text-paper" aria-hidden />
          </span>
        )}
        {hasVoted && isAlive && (
          <span
            className="absolute -bottom-2 -left-2 rounded-capsule border-3 border-ink bg-green p-1 shadow-toy"
            aria-hidden
          >
            <Check className="h-3.5 w-3.5 text-ink" aria-hidden />
          </span>
        )}
      </div>

      <div className="mt-2 flex flex-wrap items-center justify-center gap-1">
        {isYou && (
          <StickerBadge tone="ink" size="sm">
            {t('common.you')}
          </StickerBadge>
        )}
        {hasSeenRole && isAlive && !revealedRole && (
          <StickerBadge tone="green" size="sm">
            prêt
          </StickerBadge>
        )}
        {revealedRole && <RoleBadge role={revealedRole} />}
        {typeof voteCount === 'number' && voteCount > 0 && (
          <StickerBadge tone="red" size="sm">
            {voteCount} voix
          </StickerBadge>
        )}
      </div>
    </motion.div>
  )
}

/** Version en ligne (listes denses : ordre de parole, récapitulatifs). */
export function PlayerChip({
  name,
  avatarKey,
  isAlive = true,
  isHost,
  isYou,
  trailing,
  leading,
  highlighted,
  className,
}: {
  name: string
  avatarKey: string
  isAlive?: boolean
  isHost?: boolean
  isYou?: boolean
  trailing?: React.ReactNode
  leading?: React.ReactNode
  highlighted?: boolean
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex items-center gap-2.5 rounded-capsule border-3 border-ink bg-paper px-2.5 py-1.5 shadow-toy',
        highlighted && 'bg-yellow',
        !isAlive && 'bg-cream-deep opacity-70',
        className,
      )}
    >
      {leading}
      <PlayerAvatar avatarKey={avatarKey} name={name} size="sm" />
      <span
        className={cn(
          'min-w-0 flex-1 truncate font-display text-sm font-extrabold text-ink',
          !isAlive && 'line-through',
        )}
      >
        {name}
        {isHost && <Crown className="ml-1 inline h-3.5 w-3.5" aria-label={t('common.host')} />}
        {isYou && <span className="ml-1 text-xs font-bold opacity-60">({t('common.you')})</span>}
      </span>
      {trailing}
    </div>
  )
}
