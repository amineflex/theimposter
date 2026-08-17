'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'

/**
 * Décorations géométriques en aplats : étoiles, ronds, triangles, losanges.
 * Aucun gradient, aucun flou. Purement décoratif (`aria-hidden`).
 */
export type DecorShape = 'star' | 'dot' | 'triangle' | 'diamond' | 'burst' | 'wave'

const TONE: Record<string, string> = {
  yellow: 'hsl(var(--yellow))',
  red: 'hsl(var(--red))',
  blue: 'hsl(var(--blue))',
  green: 'hsl(var(--green))',
  pink: 'hsl(var(--pink))',
  orange: 'hsl(var(--orange))',
  purple: 'hsl(var(--purple))',
  ink: 'hsl(var(--ink))',
  paper: 'hsl(var(--paper))',
  cream: 'hsl(var(--cream-deep))',
}

export function Shape({
  shape,
  tone = 'yellow',
  size = 28,
  outlined = true,
  className,
  rotate = 0,
}: {
  shape: DecorShape
  tone?: keyof typeof TONE
  size?: number
  outlined?: boolean
  className?: string
  rotate?: number
}) {
  const fill = TONE[tone] ?? TONE.yellow
  const stroke = outlined ? 'hsl(var(--ink))' : 'none'

  return (
    <svg
      aria-hidden
      width={size}
      height={size}
      viewBox="0 0 32 32"
      className={cn('shrink-0', className)}
      style={{ transform: rotate ? `rotate(${rotate}deg)` : undefined }}
    >
      {shape === 'star' && (
        <path
          d="M16 2l4 9.5 10.5 1-7.8 7 2.3 10.3L16 24.5 6.9 29.8 9.2 19.5 1.5 12.5l10.5-1z"
          fill={fill}
          stroke={stroke}
          strokeWidth="2.4"
          strokeLinejoin="round"
        />
      )}
      {shape === 'dot' && <circle cx="16" cy="16" r="13" fill={fill} stroke={stroke} strokeWidth="2.4" />}
      {shape === 'triangle' && (
        <path
          d="M16 3l13 25H3z"
          fill={fill}
          stroke={stroke}
          strokeWidth="2.4"
          strokeLinejoin="round"
        />
      )}
      {shape === 'diamond' && (
        <path
          d="M16 2l14 14-14 14L2 16z"
          fill={fill}
          stroke={stroke}
          strokeWidth="2.4"
          strokeLinejoin="round"
        />
      )}
      {shape === 'burst' && (
        <path
          d="M16 1l3.2 6.4L26 5l-1.6 7 6.6 1.6-5.4 4.6 4 6-7-1.2L21 30l-5-5-5 5 .4-7-7 1.2 4-6L3 13.6 9.6 12 8 5l6.8 2.4z"
          fill={fill}
          stroke={stroke}
          strokeWidth="2.2"
          strokeLinejoin="round"
        />
      )}
      {shape === 'wave' && (
        <path
          d="M2 20c4-8 8-8 12 0s8 8 12 0"
          fill="none"
          stroke={fill}
          strokeWidth="5"
          strokeLinecap="round"
        />
      )}
    </svg>
  )
}

/**
 * Bandeau décoratif de formes, aligné horizontalement.
 * Utilisé sous les titres et en pied d'écran (accueil, résultats).
 */
export function ShapeRow({
  className,
  shapes = [
    { shape: 'dot', tone: 'red' },
    { shape: 'triangle', tone: 'blue' },
    { shape: 'star', tone: 'yellow' },
    { shape: 'diamond', tone: 'green' },
    { shape: 'dot', tone: 'pink' },
  ],
  size = 22,
}: {
  className?: string
  shapes?: { shape: DecorShape; tone: keyof typeof TONE }[]
  size?: number
}) {
  return (
    <div aria-hidden className={cn('flex items-center justify-center gap-3', className)}>
      {shapes.map((entry, index) => (
        <Shape
          key={index}
          shape={entry.shape}
          tone={entry.tone}
          size={size}
          rotate={index % 2 === 0 ? -8 : 8}
        />
      ))}
    </div>
  )
}

/**
 * Formes dispersées en fond d'écran, en aplats et sans flou.
 * Positionnées de façon fixe et déterministe pour rester stables au rendu.
 */
export function ScatteredShapes({ className }: { className?: string }) {
  const items: { shape: DecorShape; tone: keyof typeof TONE; className: string; size: number; rotate: number }[] =
    [
      { shape: 'star', tone: 'yellow', className: 'left-[6%] top-[8%]', size: 30, rotate: -12 },
      { shape: 'dot', tone: 'blue', className: 'right-[9%] top-[16%]', size: 20, rotate: 0 },
      { shape: 'triangle', tone: 'red', className: 'right-[14%] bottom-[24%]', size: 24, rotate: 14 },
      { shape: 'diamond', tone: 'green', className: 'left-[10%] bottom-[14%]', size: 22, rotate: -6 },
      { shape: 'star', tone: 'pink', className: 'left-[16%] top-[44%]', size: 18, rotate: 18 },
      { shape: 'dot', tone: 'orange', className: 'right-[6%] top-[62%]', size: 16, rotate: 0 },
    ]

  return (
    <div aria-hidden className={cn('pointer-events-none fixed inset-0 -z-10 overflow-hidden', className)}>
      {items.map((item, index) => (
        <span key={index} className={cn('absolute opacity-70', item.className)}>
          <Shape shape={item.shape} tone={item.tone} size={item.size} rotate={item.rotate} />
        </span>
      ))}
    </div>
  )
}
