import Link from 'next/link'
import { PartyButton } from '@/components/party/party-button'
import { GameMark } from '@/components/party/game-logo'
import { t } from '@/i18n'

export default function NotFound() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-5 py-10 text-center">
      <GameMark size={72} />
      <h1 className="toy-title-ink text-3xl uppercase">Page introuvable</h1>
      <p className="font-display text-base font-extrabold uppercase text-ink-soft">
        Cette page n&apos;existe pas ou la partie a expiré.
      </p>
      <PartyButton asChild variant="yellow" size="lg" block>
        <Link href="/">{t('common.backHome')}</Link>
      </PartyButton>
    </main>
  )
}
