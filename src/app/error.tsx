'use client'

import Link from 'next/link'
import { AlertTriangle } from 'lucide-react'
import { PartyButton } from '@/flexgames/ui/party-button'
import { t } from '@/i18n'

/** Frontière d'erreur globale : message compréhensible, jamais de trace brute. */
export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-5 py-10 text-center">
      <span className="rounded-blob border-3 border-ink bg-red p-4 shadow-toy-md" aria-hidden>
        <AlertTriangle className="h-10 w-10 text-paper" />
      </span>
      <h1 className="toy-title-ink text-3xl uppercase">{t('error.title')}</h1>
      <p className="text-balance text-sm font-bold text-ink-soft">
        Une erreur inattendue est survenue. Vous pouvez réessayer ou revenir à l&apos;accueil.
      </p>
      <div className="flex w-full flex-col gap-2">
        <PartyButton variant="red" size="lg" block onClick={reset}>
          {t('common.retry')}
        </PartyButton>
        <PartyButton asChild variant="paper" size="lg" block>
          <Link href="/">{t('common.backHome')}</Link>
        </PartyButton>
      </div>
    </main>
  )
}
