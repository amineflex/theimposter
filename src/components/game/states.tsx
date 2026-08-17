'use client'

import { motion } from 'framer-motion'
import { PartyButton } from '@/components/party/party-button'
import { PartyCard } from '@/components/party/party-card'
import { Shape } from '@/components/party/decor'
import { t } from '@/i18n'
import { cn } from '@/lib/utils'

/**
 * Chargement : trois pastilles qui rebondissent. Pas de spinner d'application
 * web, pas de squelette gris.
 */
export function LoadingState({ label, className }: { label?: string; className?: string }) {
  return (
    <div
      className={cn('flex flex-col items-center justify-center gap-4 py-12', className)}
      role="status"
      aria-live="polite"
    >
      <div className="flex items-end gap-2" aria-hidden>
        {['bg-red', 'bg-yellow', 'bg-blue'].map((tone, index) => (
          <motion.span
            key={tone}
            className={cn('h-5 w-5 rounded-full border-3 border-ink', tone)}
            animate={{ y: [0, -12, 0] }}
            transition={{
              duration: 0.6,
              repeat: Infinity,
              delay: index * 0.12,
              ease: 'easeOut',
            }}
          />
        ))}
      </div>
      <p className="font-display text-base font-extrabold uppercase text-ink">
        {label ?? t('common.loading')}
      </p>
    </div>
  )
}

/** Reconnexion : message rassurant et explicite. */
export function ReconnectingState({ className }: { className?: string }) {
  return (
    <PartyCard tone="yellow" tilt="left" className={cn('text-center', className)}>
      <p className="font-display text-2xl font-extrabold uppercase leading-tight text-ink">
        📡 Oups !
      </p>
      <p className="mt-1 font-display text-base font-bold uppercase text-ink">
        {t('lobby.reconnecting')}
      </p>
    </PartyCard>
  )
}

export function ErrorState({
  title,
  message,
  onRetry,
  className,
}: {
  title?: string
  message: string
  onRetry?: () => void
  className?: string
}) {
  return (
    <PartyCard
      tone="paper"
      padding="lg"
      className={cn('flex flex-col items-center gap-3 text-center', className)}
      role="alert"
    >
      <span aria-hidden className="rotate-6">
        <Shape shape="burst" tone="red" size={44} />
      </span>
      <p className="font-display text-2xl font-extrabold uppercase leading-tight text-ink">
        {title ?? t('error.title')}
      </p>
      <p className="max-w-sm text-sm font-bold text-ink-soft">{message}</p>
      {onRetry && (
        <PartyButton variant="red" size="sm" onClick={onRetry}>
          {t('common.retry')}
        </PartyButton>
      )}
    </PartyCard>
  )
}

export function EmptyState({
  title,
  message,
  action,
  className,
}: {
  title: string
  message?: string
  action?: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center gap-2 rounded-blob border-3 border-dashed border-ink bg-paper px-4 py-8 text-center',
        className,
      )}
    >
      <span aria-hidden className="-rotate-6">
        <Shape shape="dot" tone="cream" size={38} />
      </span>
      <p className="font-display text-lg font-extrabold uppercase text-ink">{title}</p>
      {message && <p className="max-w-sm text-sm font-bold text-ink-soft">{message}</p>}
      {action}
    </div>
  )
}
