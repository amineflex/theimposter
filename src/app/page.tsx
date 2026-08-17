import Link from 'next/link'
import { GameLogo } from '@/components/party/game-logo'
import { PartyButton } from '@/components/party/party-button'
import { ShapeRow, Shape } from '@/components/party/decor'
import { SoundToggle } from '@/components/layout/sound-toggle'
import { JoinCodeCard } from '@/features/lobby/join-code-card'
import { t } from '@/i18n'

/**
 * Accueil : pas de landing page. Le logo, deux gros boutons, et on joue.
 */
export default function HomePage() {
  return (
    <main className="flex flex-1 flex-col justify-center py-8">
      <div className="relative flex flex-col items-center">
        <span aria-hidden className="absolute -top-2 left-2 -rotate-12">
          <Shape shape="star" tone="yellow" size={34} />
        </span>
        <span aria-hidden className="absolute right-1 top-6 rotate-12">
          <Shape shape="dot" tone="blue" size={22} />
        </span>

        <GameLogo />

        <p className="mt-5 whitespace-pre-line text-center font-display text-lg font-extrabold uppercase leading-tight text-ink">
          {t('app.tagline')}
        </p>
      </div>

      <nav className="mt-9 flex flex-col gap-4" aria-label="Modes de jeu">
        <PartyButton asChild variant="yellow" size="xl" block>
          <Link href="/local">{t('home.localGame')}</Link>
        </PartyButton>

        <PartyButton asChild variant="red" size="xl" block>
          <Link href="/online">{t('home.onlineGame')}</Link>
        </PartyButton>
      </nav>

      <div className="mt-7">
        <JoinCodeCard />
      </div>

      <div className="mt-7 flex flex-col items-center gap-3">
        <PartyButton asChild variant="ghost" size="sm">
          <Link href="/regles">{t('home.howToPlay')}</Link>
        </PartyButton>
        <SoundToggle />
      </div>

      <ShapeRow className="mt-8" />

      <footer className="mt-4 flex flex-col items-center gap-1 text-center text-xs font-bold uppercase tracking-wide text-ink-soft">
        <span>3 à 12 joueurs · jouable hors connexion en local</span>
        <a
          href="https://amineflex.is-a.dev"
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-capsule border-2 border-ink bg-paper px-3 py-1 font-display text-ink shadow-toy transition-transform duration-tap hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring"
        >
          by amineflex
        </a>
      </footer>
    </main>
  )
}
