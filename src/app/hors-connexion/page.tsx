import type { Metadata } from 'next'
import Link from 'next/link'
import { WifiOff } from 'lucide-react'
import { PartyButton } from '@/components/party/party-button'
import { PartyCard } from '@/components/party/party-card'
import { StickerBadge } from '@/components/party/sticker-badge'
import { t } from '@/i18n'

export const metadata: Metadata = {
  title: 'Hors connexion',
  robots: { index: false },
}

/** Page de repli servie par le service worker quand le réseau est absent. */
export default function OfflinePage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-5 py-10 text-center">
      <span className="rounded-blob border-3 border-ink bg-yellow p-4 shadow-toy-md" aria-hidden>
        <WifiOff className="h-10 w-10 text-ink" />
      </span>
      <h1 className="toy-title-ink text-3xl uppercase">{t('offline.title')}</h1>
      <p className="text-balance font-display text-base font-extrabold uppercase text-ink-soft">
        {t('offline.body')}
      </p>

      <ul className="w-full space-y-2 text-left">
        <li>
          <PartyCard tone="paper" padding="sm" className="flex items-center justify-between gap-2">
            <span className="font-display text-sm font-extrabold uppercase text-ink">Mode local</span>
            <StickerBadge tone="green" size="sm">
              disponible
            </StickerBadge>
          </PartyCard>
        </li>
        <li>
          <PartyCard tone="paper" padding="sm" className="flex items-center justify-between gap-2">
            <span className="font-display text-sm font-extrabold uppercase text-ink">Mode en ligne</span>
            <StickerBadge tone="cream" size="sm">
              indisponible
            </StickerBadge>
          </PartyCard>
        </li>
        <li>
          <PartyCard tone="paper" padding="sm" className="flex items-center justify-between gap-2">
            <span className="font-display text-sm font-extrabold uppercase text-ink">Administration</span>
            <StickerBadge tone="cream" size="sm">
              indisponible
            </StickerBadge>
          </PartyCard>
        </li>
      </ul>

      <PartyButton asChild variant="yellow" size="xl" block>
        <Link href="/local">{t('home.localGame')}</Link>
      </PartyButton>
    </main>
  )
}
