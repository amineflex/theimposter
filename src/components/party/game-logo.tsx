'use client'

import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'

/**
 * Logo du jeu : « THE » sur un petit ruban, « IMPOSTER! » en lettres massives
 * légèrement décalées, en trois couleurs franches avec contour d'encre.
 *
 * Tout est en HTML/CSS/SVG : aucun gradient, aucune lueur, aucune image.
 */
const LETTERS = [
  { char: 'I', color: 'text-red', rotate: -4, y: 2 },
  { char: 'M', color: 'text-yellow', rotate: 3, y: -2 },
  { char: 'P', color: 'text-blue', rotate: -2, y: 1 },
  { char: 'O', color: 'text-red', rotate: 4, y: -1 },
  { char: 'S', color: 'text-yellow', rotate: -3, y: 2 },
  { char: 'T', color: 'text-blue', rotate: 2, y: -2 },
  { char: 'E', color: 'text-red', rotate: -4, y: 1 },
  { char: 'R', color: 'text-yellow', rotate: 3, y: -1 },
  { char: '!', color: 'text-blue', rotate: 6, y: 0 },
]

export function GameLogo({ className, size = 'lg' }: { className?: string; size?: 'sm' | 'lg' }) {
  const letterSize = size === 'lg' ? 'text-5xl sm:text-6xl' : 'text-3xl'

  return (
    <div className={cn('flex flex-col items-center', className)}>
      <span className="tilt-left relative z-10 -mb-2 inline-block rounded-capsule border-3 border-ink bg-paper px-4 py-0.5 font-display text-base font-extrabold uppercase tracking-[0.32em] text-ink shadow-toy">
        The
      </span>

      {/* Un seul titre accessible ; les lettres colorées sont décoratives. */}
      <h1 className="sr-only">The Imposter</h1>
      <p aria-hidden className="flex items-center justify-center">
        {LETTERS.map((letter, index) => (
          <motion.span
            key={index}
            initial={{ y: -18, opacity: 0, rotate: 0 }}
            animate={{ y: letter.y, opacity: 1, rotate: letter.rotate }}
            transition={{ delay: index * 0.04, type: 'spring', stiffness: 520, damping: 15 }}
            className={cn('toy-title inline-block', letterSize, letter.color)}
          >
            {letter.char}
          </motion.span>
        ))}
      </p>
    </div>
  )
}

/**
 * Marque compacte : un œil-jeton simple et lisible (en-têtes, favicon, 404).
 */
export function GameMark({ size = 56, className }: { size?: number; className?: string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      width={size}
      height={size}
      className={cn('shrink-0', className)}
      role="img"
      aria-label="The Imposter"
    >
      {/* Jeton */}
      <circle cx="32" cy="34" r="26" fill="var(--color-ink)" />
      <circle cx="32" cy="30" r="26" fill="var(--color-yellow)" stroke="var(--color-ink)" strokeWidth="3" />
      {/* Bandeau */}
      <path
        d="M8 28h48c0 4-1 7-2 10H10c-1-3-2-6-2-10z"
        fill="var(--color-red)"
        stroke="var(--color-ink)"
        strokeWidth="3"
        strokeLinejoin="round"
      />
      {/* Yeux */}
      <ellipse cx="23" cy="33" rx="5" ry="4" fill="var(--color-paper)" stroke="var(--color-ink)" strokeWidth="2.5" />
      <circle cx="24" cy="33" r="2" fill="var(--color-ink)" />
      <ellipse cx="41" cy="33" rx="5" ry="4" fill="var(--color-paper)" stroke="var(--color-ink)" strokeWidth="2.5" />
      <circle cx="42" cy="33" r="2" fill="var(--color-ink)" />
      {/* Sourire */}
      <path
        d="M25 45c4 3 10 3 14 0"
        fill="none"
        stroke="var(--color-ink)"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  )
}
