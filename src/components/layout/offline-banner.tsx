'use client'

import { WifiOff } from 'lucide-react'
import { useOnlineStatus } from '@/hooks/use-online-status'
import { t } from '@/i18n'

/** Bandeau permanent quand le réseau est absent : le mode local reste jouable. */
export function OfflineBanner() {
  const online = useOnlineStatus()
  if (online) return null

  return (
    <div
      className="sticky top-0 z-40 flex items-center justify-center gap-2 border-b-3 border-ink bg-yellow px-4 py-2 text-center font-display text-xs font-extrabold uppercase text-ink"
      role="status"
      aria-live="polite"
    >
      <WifiOff className="h-4 w-4 shrink-0" aria-hidden />
      <span>
        {t('offline.title')}. {t('offline.body')}
      </span>
    </div>
  )
}
