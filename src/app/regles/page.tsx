import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { PartyButton } from '@/components/party/party-button'
import { PartyCard } from '@/components/party/party-card'
import { StickerBadge } from '@/components/party/sticker-badge'
import { GameBanner } from '@/components/party/game-banner'
import { ShapeRow } from '@/components/party/decor'
import { t } from '@/i18n'

export const metadata: Metadata = {
  title: 'Comment jouer',
  description:
    'Règles de The Imposter : mode Imposteur, mode Undercover, rôles, votes et conditions de victoire.',
}

export default function RulesPage() {
  return (
    <main className="flex flex-1 flex-col py-6">
      <PartyButton asChild variant="ghost" size="sm" className="mb-4 self-start">
        <Link href="/">
          <ArrowLeft className="h-4 w-4" aria-hidden />
          {t('common.back')}
        </Link>
      </PartyButton>

      <GameBanner
        title={t('rules.title')}
        tone="ink"
        subtitle="3 à 12 joueurs · une partie dure 5 à 15 minutes."
      />

      <div className="mt-6 space-y-6">
        {/* Mode Imposteur */}
        <PartyCard tone="paper" padding="lg" tilt="left">
          <StickerBadge tone="red" tilt className="absolute -top-3 left-4">
            {t('mode.impostor')}
          </StickerBadge>
          <h2 className="mt-2 font-display text-2xl font-extrabold uppercase text-ink">
            {t('rules.impostor.title')}
          </h2>
          <ol className="mt-3 space-y-2">
            {(['1', '2', '3', '4', '5'] as const).map((step) => (
              <li key={step} className="flex gap-3 text-sm font-bold text-ink">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-capsule border-3 border-ink bg-yellow font-display text-xs font-extrabold text-ink">
                  {step}
                </span>
                <span className="pt-0.5">{t(`rules.impostor.${step}`)}</span>
              </li>
            ))}
          </ol>
          <div className="mt-4 grid grid-cols-2 gap-2 text-center">
            <div className="rounded-blob border-3 border-ink bg-green px-3 py-2">
              <p className="font-display text-xs font-extrabold uppercase text-ink/70">
                {t('role.civilian')}
              </p>
              <p className="font-display text-lg font-extrabold uppercase text-ink">Girafe</p>
            </div>
            <div className="rounded-blob border-3 border-ink bg-red px-3 py-2">
              <p className="font-display text-xs font-extrabold uppercase text-paper/80">
                {t('role.impostor')}
              </p>
              <p className="font-display text-lg font-extrabold uppercase text-paper">Animal</p>
            </div>
          </div>
        </PartyCard>

        {/* Mode Undercover */}
        <PartyCard tone="paper" padding="lg" tilt="right">
          <StickerBadge tone="blue" tilt className="absolute -top-3 left-4">
            {t('mode.undercover')}
          </StickerBadge>
          <h2 className="mt-2 font-display text-2xl font-extrabold uppercase text-ink">
            {t('rules.undercover.title')}
          </h2>
          <ol className="mt-3 space-y-2">
            {(['1', '2', '3', '4', '5', '6'] as const).map((step) => (
              <li key={step} className="flex gap-3 text-sm font-bold text-ink">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-capsule border-3 border-ink bg-blue font-display text-xs font-extrabold text-paper">
                  {step}
                </span>
                <span className="pt-0.5">{t(`rules.undercover.${step}`)}</span>
              </li>
            ))}
          </ol>
          <div className="mt-4 grid gap-2 text-center sm:grid-cols-3">
            <div className="rounded-blob border-3 border-ink bg-green px-3 py-2">
              <p className="font-display text-xs font-extrabold uppercase text-ink/70">
                {t('role.civilian')}
              </p>
              <p className="font-display text-base font-extrabold uppercase text-ink">Coca-Cola</p>
            </div>
            <div className="rounded-blob border-3 border-ink bg-blue px-3 py-2">
              <p className="font-display text-xs font-extrabold uppercase text-paper/80">
                {t('role.undercover')}
              </p>
              <p className="font-display text-base font-extrabold uppercase text-paper">Pepsi</p>
            </div>
            <div className="rounded-blob border-3 border-ink bg-cream-deep px-3 py-2">
              <p className="font-display text-xs font-extrabold uppercase text-ink/70">
                {t('role.mr_white')}
              </p>
              <p className="font-display text-base font-extrabold uppercase text-ink">Aucun mot</p>
            </div>
          </div>
        </PartyCard>

        {/* Victoire */}
        <PartyCard tone="yellow" padding="lg">
          <h2 className="font-display text-2xl font-extrabold uppercase text-ink">
            {t('rules.win.title')}
          </h2>
          <ul className="mt-3 space-y-2 text-sm font-bold text-ink">
            <li>🛡️ {t('rules.win.civilians')}</li>
            <li>😈 {t('rules.win.intruders')}</li>
            <li>👻 {t('rules.win.mrWhite')}</li>
          </ul>
        </PartyCard>

        {/* Conseils */}
        <PartyCard tone="cream" padding="lg">
          <h2 className="font-display text-xl font-extrabold uppercase text-ink">
            {t('rules.tips.title')}
          </h2>
          <ul className="mt-2 space-y-2 text-sm font-bold text-ink-soft">
            {(['1', '2', '3'] as const).map((tip) => (
              <li key={tip}>• {t(`rules.tips.${tip}`)}</li>
            ))}
          </ul>
        </PartyCard>
      </div>

      <ShapeRow className="mt-7" />

      <div className="mt-5 flex flex-col gap-3">
        <PartyButton asChild variant="yellow" size="lg" block>
          <Link href="/local">{t('home.localGame')}</Link>
        </PartyButton>
        <PartyButton asChild variant="red" size="lg" block>
          <Link href="/online">{t('home.onlineGame')}</Link>
        </PartyButton>
      </div>
    </main>
  )
}
