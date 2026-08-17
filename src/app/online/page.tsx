import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { PartyButton } from '@/components/party/party-button'
import { OnlineHome } from '@/features/online-game/online-home'
import { t } from '@/i18n'

export const metadata: Metadata = {
  title: 'Partie en ligne',
  description: 'Créez une partie de The Imposter ou rejoignez vos amis avec un code.',
}

export default function OnlinePage() {
  return (
    <main className="flex flex-1 flex-col py-6">
      <PartyButton asChild variant="ghost" size="sm" className="mb-4 self-start">
        <Link href="/">
          <ArrowLeft className="h-4 w-4" aria-hidden />
          {t('common.back')}
        </Link>
      </PartyButton>
      <OnlineHome />
    </main>
  )
}
