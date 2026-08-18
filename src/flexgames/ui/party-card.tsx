import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

/**
 * Carte de jeu : aplat, contour d'encre, ombre dure. Aucune transparence,
 * aucun flou. Les variantes de couleur servent à structurer l'information
 * (jamais à décorer au hasard) : 2 à 3 couleurs par écran maximum.
 */
const partyCardVariants = cva('relative rounded-blob border-3 border-ink', {
  variants: {
    tone: {
      paper: 'bg-paper text-ink',
      cream: 'bg-cream-deep text-ink',
      yellow: 'bg-yellow text-ink',
      red: 'bg-red text-paper',
      blue: 'bg-blue text-paper',
      green: 'bg-green text-ink',
      pink: 'bg-pink text-ink',
      orange: 'bg-orange text-ink',
      purple: 'bg-purple text-paper',
      ink: 'bg-ink text-paper',
    },
    padding: {
      none: 'p-0',
      sm: 'p-3',
      md: 'p-4',
      lg: 'p-5',
    },
    shadow: {
      none: 'shadow-none',
      sm: 'shadow-toy',
      md: 'shadow-toy-md',
      lg: 'shadow-toy-lg',
      /** Ombre décalée en diagonale, pour les cartes posées de travers. */
      card: 'shadow-toy-card',
    },
    tilt: {
      none: '',
      left: 'tilt-left-sm',
      right: 'tilt-right-sm',
    },
  },
  defaultVariants: { tone: 'paper', padding: 'md', shadow: 'md', tilt: 'none' },
})

export interface PartyCardProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof partyCardVariants> {}

export const PartyCard = React.forwardRef<HTMLDivElement, PartyCardProps>(
  ({ className, tone, padding, shadow, tilt, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(partyCardVariants({ tone, padding, shadow, tilt }), className)}
      {...props}
    />
  ),
)
PartyCard.displayName = 'PartyCard'

/**
 * Panneau de contenu avec un titre en ruban : sert aux listes et aux réglages.
 * Le ruban dépasse légèrement de la carte pour éviter l'effet « boîte ».
 */
export function GamePanel({
  title,
  action,
  children,
  className,
  tone = 'paper',
  ribbon = 'blue',
}: {
  title?: string
  action?: React.ReactNode
  children: React.ReactNode
  className?: string
  tone?: VariantProps<typeof partyCardVariants>['tone']
  ribbon?: 'blue' | 'yellow' | 'red' | 'green' | 'pink' | 'orange' | 'purple'
}) {
  const ribbonTone = {
    blue: 'bg-blue text-paper',
    yellow: 'bg-yellow text-ink',
    red: 'bg-red text-paper',
    green: 'bg-green text-ink',
    pink: 'bg-pink text-ink',
    orange: 'bg-orange text-ink',
    purple: 'bg-purple text-paper',
  }[ribbon]

  return (
    <div className={cn('relative', title && 'pt-3', className)}>
      {title && (
        <span
          className={cn(
            'absolute -top-0.5 left-4 z-10 -rotate-1 rounded-capsule border-3 border-ink px-3 py-0.5 font-display text-xs font-extrabold uppercase tracking-widest shadow-toy',
            ribbonTone,
          )}
        >
          {title}
        </span>
      )}
      <PartyCard tone={tone} padding="md" className={cn(title && 'pt-6')}>
        {action && <div className="absolute right-3 top-4">{action}</div>}
        {children}
      </PartyCard>
    </div>
  )
}

export { partyCardVariants }
