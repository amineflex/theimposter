'use client'

import * as React from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { Dialog, DialogPortal } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

/**
 * Modale de jeu : carte crème à contour d'encre qui surgit du bas sur mobile et
 * au centre sur desktop. S'appuie sur Radix Dialog (piège à focus, fermeture au
 * clavier, aria) avec une apparence entièrement custom  ·  aucun flou, aucun
 * gradient, voile d'encre opaque.
 */
export function PopModal({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  tone = 'blue',
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  children?: React.ReactNode
  footer?: React.ReactNode
  tone?: 'blue' | 'yellow' | 'red' | 'green'
}) {
  const headerTone = {
    blue: 'bg-blue text-paper',
    yellow: 'bg-yellow text-ink',
    red: 'bg-red text-paper',
    green: 'bg-green text-ink',
  }[tone]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPortal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-ink/70 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          className={cn(
            'fixed inset-x-2 bottom-2 z-50 max-h-[92vh] overflow-y-auto rounded-blob border-3 border-ink bg-cream shadow-toy-lg',
            'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom',
            'sm:inset-x-auto sm:bottom-auto sm:left-1/2 sm:top-1/2 sm:w-[min(32rem,calc(100vw-2rem))] sm:-translate-x-1/2 sm:-translate-y-1/2',
          )}
        >
          <div className={cn('flex items-start justify-between gap-3 border-b-3 border-ink px-5 py-3.5', headerTone)}>
            <div className="min-w-0">
              <DialogPrimitive.Title className="font-display text-xl font-extrabold uppercase leading-tight">
                {title}
              </DialogPrimitive.Title>
              {description && (
                <DialogPrimitive.Description className="mt-1 text-sm font-bold opacity-85">
                  {description}
                </DialogPrimitive.Description>
              )}
            </div>
            <DialogPrimitive.Close className="toy-press shrink-0 rounded-capsule border-3 border-ink bg-paper p-1.5 text-ink shadow-toy focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring">
              <X className="h-4 w-4" aria-hidden />
              <span className="sr-only">Fermer</span>
            </DialogPrimitive.Close>
          </div>

          <div className="space-y-4 px-4 py-4">{children}</div>

          {footer && (
            <div className="flex flex-col-reverse gap-2 border-t-3 border-ink px-4 py-3 sm:flex-row sm:justify-end">
              {footer}
            </div>
          )}
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  )
}
