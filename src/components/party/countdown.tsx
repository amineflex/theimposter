'use client'

import * as React from 'react'
import { motion } from 'framer-motion'
import { Infinity as InfinityIcon } from 'lucide-react'
import { useSound } from '@/hooks/use-sound'
import { cn, formatSeconds } from '@/lib/utils'
import { t } from '@/i18n'

export interface CountdownProps {
  /** Secondes restantes. `null` = pas de minuteur. */
  remaining: number | null
  /** Durée totale, pour la jauge. */
  total?: number | null
  size?: 'md' | 'lg'
  className?: string
  /** Seuil d'alerte (secondes). */
  warnAt?: number
}

/**
 * Minuteur : gros jeton en aplat, contour d'encre, ombre dure. La couronne se
 * vide au fil du temps, le jeton passe au rouge et tremble dans les dernières
 * secondes (avec un bip, désactivable par le réglage global du son).
 */
export function Countdown({ remaining, total, size = 'md', className, warnAt = 5 }: CountdownProps) {
  useTickSound(remaining, warnAt)

  const px = size === 'lg' ? 124 : 76
  const stroke = size === 'lg' ? 9 : 7
  const radius = (px - stroke) / 2 - 3
  const circumference = 2 * Math.PI * radius

  if (remaining === null) {
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1.5 rounded-capsule border-3 border-ink bg-paper px-3 py-1.5 font-display text-sm font-extrabold text-ink shadow-toy',
          className,
        )}
        aria-label={t('common.unlimited')}
      >
        <InfinityIcon className="h-4 w-4" aria-hidden />
        {t('common.unlimited')}
      </span>
    )
  }

  const ratio = total && total > 0 ? Math.max(0, Math.min(1, remaining / total)) : 0
  const warning = remaining <= warnAt && remaining > 0

  return (
    <motion.div
      className={cn('relative inline-flex items-center justify-center', className)}
      style={{ width: px, height: px }}
      animate={warning ? { rotate: [0, -3, 3, -2, 0] } : { rotate: 0 }}
      transition={{ duration: 0.3, repeat: warning ? Infinity : 0, repeatDelay: 0.7 }}
      role="timer"
      aria-live="off"
      aria-label={`${remaining} ${t('common.seconds')}`}
    >
      {/* Ombre dure du jeton */}
      <span
        aria-hidden
        className="absolute inset-0 translate-y-1.5 rounded-full bg-ink"
        style={{ width: px, height: px }}
      />
      <svg className="absolute -rotate-90" width={px} height={px} aria-hidden>
        <circle
          cx={px / 2}
          cy={px / 2}
          r={radius}
          fill={warning ? 'var(--color-red)' : 'var(--color-paper)'}
          stroke="var(--color-ink)"
          strokeWidth="3"
        />
        <circle
          cx={px / 2}
          cy={px / 2}
          r={radius}
          fill="none"
          stroke={warning ? 'var(--color-yellow)' : 'var(--color-blue)'}
          strokeWidth={stroke}
          strokeLinecap="butt"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - ratio)}
          className="transition-[stroke-dashoffset] duration-1000 ease-linear"
        />
      </svg>
      <span
        className={cn(
          'relative font-display font-extrabold tabular-nums',
          size === 'lg' ? 'text-4xl' : 'text-xl',
          warning ? 'text-paper' : 'text-ink',
        )}
      >
        {formatSeconds(remaining)}
      </span>
    </motion.div>
  )
}

/** Bip discret sur chacune des dernières secondes. */
function useTickSound(remaining: number | null, warnAt: number) {
  const { play } = useSound()
  const lastPlayed = React.useRef<number | null>(null)

  React.useEffect(() => {
    if (remaining === null || remaining <= 0 || remaining > warnAt) {
      lastPlayed.current = null
      return
    }
    if (lastPlayed.current === remaining) return
    lastPlayed.current = remaining
    play('tick')
  }, [remaining, warnAt, play])
}
