'use client'

import * as React from 'react'
import { motion } from 'framer-motion'
import { Shape, type DecorShape } from './decor'
import { cn } from '@/lib/utils'

const CONFETTI = [
  'bg-yellow',
  'bg-red',
  'bg-blue',
  'bg-green',
  'bg-pink',
  'bg-orange',
  'bg-purple',
] as const

/**
 * Confettis géométriques en aplats (carrés et ronds à contour d'encre).
 * Purement décoratif : `aria-hidden`, non interactif, neutralisé par
 * `prefers-reduced-motion`.
 */
export function Confetti({ count = 26, className }: { count?: number; className?: string }) {
  // Positions figées au premier rendu : pas de re-tirage à chaque re-render.
  const pieces = React.useMemo(
    () =>
      Array.from({ length: count }, (_, index) => ({
        left: (index * 89) % 100,
        delay: (index % 7) * 0.16,
        duration: 2 + ((index * 11) % 9) / 10,
        color: CONFETTI[index % CONFETTI.length] as string,
        round: index % 3 === 0,
        size: 9 + ((index * 5) % 7),
      })),
    [count],
  )

  return (
    <div aria-hidden className={cn('pointer-events-none fixed inset-0 z-30 overflow-hidden', className)}>
      {pieces.map((piece, index) => (
        <span
          key={index}
          className={cn(
            'absolute top-0 border-2 border-ink motion-safe:animate-confetti-fall',
            piece.color,
            piece.round ? 'rounded-full' : 'rounded-sm',
          )}
          style={{
            left: `${piece.left}%`,
            width: piece.size,
            height: piece.size,
            animationDelay: `${piece.delay}s`,
            animationDuration: `${piece.duration}s`,
          }}
        />
      ))}
    </div>
  )
}

const BURST_SHAPES: { shape: DecorShape; tone: 'yellow' | 'red' | 'blue' | 'green' | 'pink'; className: string }[] = [
  { shape: 'star', tone: 'yellow', className: '-left-1 -top-3' },
  { shape: 'triangle', tone: 'blue', className: 'right-0 -top-4' },
  { shape: 'dot', tone: 'red', className: '-left-4 top-1/2' },
  { shape: 'diamond', tone: 'green', className: '-right-4 top-1/3' },
  { shape: 'star', tone: 'pink', className: 'left-1/4 -bottom-4' },
  { shape: 'dot', tone: 'yellow', className: 'right-1/4 -bottom-3' },
]

/**
 * Annonce entourée de formes géométriques qui surgissent (élimination,
 * victoire). Aucun flash, aucun néon : uniquement des aplats qui « pop ».
 */
export function ResultBurst({
  children,
  className,
  shapes = true,
}: {
  children: React.ReactNode
  className?: string
  shapes?: boolean
}) {
  return (
    <div className={cn('relative flex w-full flex-col items-center justify-center', className)}>
      {shapes &&
        BURST_SHAPES.map((entry, index) => (
          <motion.span
            key={index}
            aria-hidden
            initial={{ scale: 0, rotate: -30 }}
            animate={{ scale: 1, rotate: index % 2 === 0 ? -12 : 12 }}
            transition={{
              delay: 0.1 + index * 0.05,
              type: 'spring',
              stiffness: 600,
              damping: 14,
            }}
            className={cn('absolute z-10', entry.className)}
          >
            <Shape shape={entry.shape} tone={entry.tone} size={index % 2 === 0 ? 30 : 22} />
          </motion.span>
        ))}

      <motion.div
        initial={{ scale: 0.8, opacity: 0, rotate: -2 }}
        animate={{ scale: 1, opacity: 1, rotate: 0 }}
        transition={{ type: 'spring', stiffness: 520, damping: 16 }}
        className="flex w-full flex-col items-center"
      >
        {children}
      </motion.div>
    </div>
  )
}

/**
 * Décompte 3 · 2 · 1 avant une annonce : chiffres énormes qui « poppent ».
 * Appelle `onDone` à la fin (utilisé pour enchaîner sur le résultat).
 */
export function CountIn({
  from = 3,
  onDone,
  className,
}: {
  from?: number
  onDone?: () => void
  className?: string
}) {
  const [value, setValue] = React.useState(from)
  const done = React.useRef(false)

  React.useEffect(() => {
    if (value <= 0) {
      if (!done.current) {
        done.current = true
        onDone?.()
      }
      return
    }
    const timeout = setTimeout(() => setValue((current) => current - 1), 620)
    return () => clearTimeout(timeout)
  }, [value, onDone])

  if (value <= 0) return null

  return (
    <div className={cn('flex flex-col items-center justify-center', className)} aria-live="polite">
      <motion.span
        key={value}
        initial={{ scale: 0.4, opacity: 0, rotate: -8 }}
        animate={{ scale: 1, opacity: 1, rotate: 0 }}
        exit={{ scale: 1.4, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 620, damping: 15 }}
        className="toy-title text-7xl text-yellow"
      >
        {value}
      </motion.span>
    </div>
  )
}
