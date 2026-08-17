'use client'

import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg border-2 border-ink text-sm font-bold transition-colors disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background active:scale-[0.99] [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground shadow-toy hover:bg-primary/90',
        secondary: 'bg-secondary text-secondary-foreground shadow-toy hover:bg-secondary/80',
        outline: 'bg-paper shadow-toy hover:bg-accent hover:text-accent-foreground',
        ghost: 'border-transparent hover:bg-accent hover:text-accent-foreground',
        destructive: 'bg-destructive text-destructive-foreground shadow-toy hover:bg-destructive/90',
        success: 'bg-success text-success-foreground shadow-toy hover:bg-success/90',
        link: 'border-transparent text-primary underline-offset-4 hover:underline',
      },
      size: {
        // Toutes les tailles respectent une cible tactile >= 44px de haut.
        default: 'h-12 px-5 py-3 text-sm',
        sm: 'h-11 rounded-md px-4 text-sm',
        lg: 'h-14 rounded-xl px-6 text-base',
        xl: 'h-16 rounded-xl px-7 text-lg',
        icon: 'h-11 w-11',
      },
      block: {
        true: 'w-full',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
  loading?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, block, asChild = false, loading = false, children, disabled, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button'
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, block, className }))}
        ref={ref}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        {...props}
      >
        {loading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            <span>{children}</span>
          </>
        ) : (
          children
        )}
      </Comp>
    )
  },
)
Button.displayName = 'Button'

export { Button, buttonVariants }
