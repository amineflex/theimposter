'use client'

import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Bouton physique du jeu : aplat de couleur, contour d'encre, ombre dure
 * dessous. Au doigt il descend de 4 px et son ombre s'écrase (cf. `.toy-press`).
 *
 * Toutes les tailles conservent une cible tactile ≥ 44 px.
 */
const partyButtonVariants = cva(
  'toy-press inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded-blob border-3 border-ink font-display font-extrabold uppercase leading-none tracking-wide disabled:pointer-events-none disabled:border-ink/40 disabled:bg-cream-deep disabled:text-ink/40 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        yellow: 'bg-yellow text-ink shadow-toy-md',
        red: 'bg-red text-paper shadow-toy-md',
        blue: 'bg-blue text-paper shadow-toy-md',
        green: 'bg-green text-ink shadow-toy-md',
        pink: 'bg-pink text-ink shadow-toy-md',
        orange: 'bg-orange text-ink shadow-toy-md',
        purple: 'bg-purple text-paper shadow-toy-md',
        paper: 'bg-paper text-ink shadow-toy-md',
        cream: 'bg-cream-deep text-ink shadow-toy-md',
        ink: 'bg-ink text-paper shadow-toy-md',
        /** Action tertiaire : pas de contour ni d'ombre. */
        ghost:
          'border-transparent bg-transparent text-ink hover:translate-y-0 hover:bg-ink/[0.07] active:translate-y-0',
      },
      size: {
        sm: 'h-11 px-4 text-sm',
        md: 'h-13 px-5 text-base',
        lg: 'h-15 px-6 text-lg',
        xl: 'h-17 px-7 text-2xl',
        icon: 'h-12 w-12 p-0',
      },
      block: { true: 'w-full' },
      tilt: { true: '-rotate-1' },
    },
    defaultVariants: { variant: 'yellow', size: 'md' },
  },
)

export interface PartyButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof partyButtonVariants> {
  asChild?: boolean
  loading?: boolean
}

export const PartyButton = React.forwardRef<HTMLButtonElement, PartyButtonProps>(
  (
    { className, variant, size, block, tilt, asChild = false, loading = false, children, disabled, ...props },
    ref,
  ) => {
    const Comp = asChild ? Slot : 'button'
    return (
      <Comp
        ref={ref}
        className={cn(partyButtonVariants({ variant, size, block, tilt, className }))}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        {...props}
      >
        {loading ? (
          <>
            <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
            <span>{children}</span>
          </>
        ) : (
          children
        )}
      </Comp>
    )
  },
)
PartyButton.displayName = 'PartyButton'

export { partyButtonVariants }
