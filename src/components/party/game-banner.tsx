'use client'

import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { StickerBadge } from './sticker-badge'

export type BannerTone = 'yellow' | 'red' | 'blue' | 'green' | 'pink' | 'orange' | 'purple' | 'ink'

const TONE_TEXT: Record<BannerTone, string> = {
  yellow: 'text-yellow',
  red: 'text-red',
  blue: 'text-blue',
  green: 'text-green',
  pink: 'text-pink',
  orange: 'text-orange',
  purple: 'text-purple',
  ink: 'text-ink',
}

export interface GameBannerProps {
  /** Titre de phase, court et expressif (souvent sur deux lignes). */
  title: string
  subtitle?: string
  tone?: BannerTone
  /** Pastille au-dessus du titre (manche, tour…). */
  chip?: string
  /** Élément aligné à droite (minuteur). */
  aside?: React.ReactNode
  className?: string
}

/**
 * Bandeau de phase : le titre est un objet graphique (massif, contour d'encre,
 * légèrement incliné, entrée courte et rebondie).
 */
export function GameBanner({ title, subtitle, tone = 'ink', chip, aside, className }: GameBannerProps) {
  return (
    <header className={cn('flex items-start justify-between gap-3', className)}>
      <div className="min-w-0">
        {chip && (
          <StickerBadge tone={tone === 'yellow' ? 'blue' : 'yellow'} tilt className="mb-2">
            {chip}
          </StickerBadge>
        )}
        <motion.h1
          key={title}
          initial={{ y: -12, opacity: 0, rotate: 0, scale: 0.94 }}
          animate={{ y: 0, opacity: 1, rotate: -1.5, scale: 1 }}
          transition={{ type: 'spring', stiffness: 520, damping: 16 }}
          className={cn(
            'text-balance text-[2rem] uppercase leading-[0.9] sm:text-4xl',
            // Titre en encre : pas de contour (il serait invisible sur lui-même).
            tone === 'ink' ? 'toy-title-ink' : 'toy-title',
            TONE_TEXT[tone],
          )}
        >
          {title}
        </motion.h1>
        {subtitle && (
          <p className="mt-2.5 text-sm font-bold text-ink-soft">{subtitle}</p>
        )}
      </div>
      {aside}
    </header>
  )
}
