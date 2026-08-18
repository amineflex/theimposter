import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

/**
 * Pastille autocollante : aplat, contour d'encre, légèrement inclinée.
 * Remplace les badges neutres d'interface classique.
 */
const stickerVariants = cva(
  'inline-flex items-center gap-1 rounded-capsule border-2 border-ink px-2.5 py-0.5 font-display font-extrabold uppercase leading-tight tracking-wide',
  {
    variants: {
      tone: {
        yellow: 'bg-yellow text-ink',
        red: 'bg-red text-paper',
        blue: 'bg-blue text-paper',
        green: 'bg-green text-ink',
        pink: 'bg-pink text-ink',
        orange: 'bg-orange text-ink',
        purple: 'bg-purple text-paper',
        paper: 'bg-paper text-ink',
        cream: 'bg-cream-deep text-ink',
        ink: 'bg-ink text-paper',
      },
      size: {
        sm: 'px-2 text-[0.68rem]',
        md: 'text-xs',
        lg: 'px-3 py-1 text-sm',
      },
      shadow: { true: 'shadow-toy' },
      tilt: { true: '-rotate-2' },
    },
    defaultVariants: { tone: 'yellow', size: 'md', shadow: true },
  },
)

export interface StickerBadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof stickerVariants> {}

export function StickerBadge({ className, tone, tilt, size, shadow, ...props }: StickerBadgeProps) {
  return <span className={cn(stickerVariants({ tone, tilt, size, shadow }), className)} {...props} />
}

export { stickerVariants }
