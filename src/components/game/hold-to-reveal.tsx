'use client'

import * as React from 'react'
import { motion } from 'framer-motion'
import { t } from '@/i18n'
import { cn } from '@/lib/utils'
import { Shape } from '@/components/party/decor'

export interface HoldToRevealProps {
  /** Durée d'appui requise, en millisecondes. */
  duration?: number
  onRevealed: () => void
  label?: string
  className?: string
}

/**
 * Grosse carte jaune « maintiens pour voir ».
 *
 * L'appui maintenu évite les révélations accidentelles quand le téléphone
 * circule. Le clavier est supporté (Espace / Entrée maintenus). La jauge de
 * progression est un aplat qui monte, sans lueur ni dégradé.
 */
export function HoldToReveal({ duration = 700, onRevealed, label, className }: HoldToRevealProps) {
  const [progress, setProgress] = React.useState(0)
  const [holding, setHolding] = React.useState(false)
  const frame = React.useRef<number | null>(null)
  const start = React.useRef(0)
  const done = React.useRef(false)

  const stop = React.useCallback(() => {
    if (frame.current !== null) cancelAnimationFrame(frame.current)
    frame.current = null
    setHolding(false)
    setProgress(0)
  }, [])

  const begin = React.useCallback(() => {
    if (done.current) return
    setHolding(true)
    start.current = performance.now()
    const step = (now: number) => {
      const ratio = Math.min(1, (now - start.current) / duration)
      setProgress(ratio)
      if (ratio >= 1) {
        done.current = true
        stop()
        onRevealed()
        return
      }
      frame.current = requestAnimationFrame(step)
    }
    frame.current = requestAnimationFrame(step)
  }, [duration, onRevealed, stop])

  React.useEffect(() => stop, [stop])

  return (
    <motion.button
      type="button"
      animate={holding ? { scale: [1, 1.03, 1.01] } : { scale: 1 }}
      transition={{ duration: 0.24 }}
      className={cn(
        'no-select relative flex h-52 w-full flex-col items-center justify-center gap-3 overflow-hidden rounded-blob border-5 border-ink bg-yellow text-center shadow-toy-lg transition-colors duration-fast',
        holding && 'bg-orange',
        className,
      )}
      onPointerDown={begin}
      onPointerUp={stop}
      onPointerLeave={stop}
      onPointerCancel={stop}
      onContextMenu={(event) => event.preventDefault()}
      onKeyDown={(event) => {
        if ((event.key === ' ' || event.key === 'Enter') && !event.repeat) begin()
      }}
      onKeyUp={stop}
      onBlur={stop}
    >
      {/* Jauge : aplat plein qui monte depuis le bas. */}
      <span
        aria-hidden
        className="absolute inset-x-0 bottom-0 bg-red/85 transition-none"
        style={{ height: `${progress * 100}%` }}
      />

      <span aria-hidden className="absolute -left-2 -top-2 rotate-12">
        <Shape shape="star" tone="paper" size={26} />
      </span>
      <span aria-hidden className="absolute -bottom-2 -right-2 -rotate-12">
        <Shape shape="dot" tone="blue" size={22} />
      </span>

      <span className="relative font-display text-2xl font-extrabold uppercase leading-tight text-ink">
        {holding ? t('reveal.holding') : (label ?? t('reveal.hold'))}
      </span>
      <span className="relative font-display text-sm font-bold uppercase text-ink/70">
        {holding ? '…' : '👆'}
      </span>
    </motion.button>
  )
}
