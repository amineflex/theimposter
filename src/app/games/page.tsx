import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { PartyButton } from '@/flexgames/ui/party-button'
import { GameCard } from '@/flexgames/ui/game-card'
import { getCatalogGames } from '@/flexgames/game-registry'
import { t } from '@/i18n'

export const metadata: Metadata = {
  title: 'Tous les jeux',
  description: 'Le catalogue FlexGames : des mini-jeux de soirée à jouer entre amis.',
}

/** Catalogue complet. Chaque carte vient du manifest de son jeu. */
export default function GamesPage() {
  const games = getCatalogGames()

  return (
    <main className="flex flex-1 flex-col py-6">
      <PartyButton asChild variant="ghost" size="sm" className="mb-4 self-start">
        <Link href="/">
          <ArrowLeft className="h-4 w-4" aria-hidden />
          {t('common.back')}
        </Link>
      </PartyButton>

      <h1 className="toy-title-ink mb-1 text-3xl uppercase">{t('catalog.allGames')}</h1>
      <p className="mb-5 text-xs font-bold text-ink-soft">{t('catalog.subtitle')}</p>

      <ul className="grid grid-cols-1 gap-4 min-[420px]:grid-cols-2 sm:grid-cols-3">
        {games.map((game, index) => (
          <li key={game.manifest.id}>
            <GameCard gameId={game.manifest.id} index={index} />
          </li>
        ))}
      </ul>
    </main>
  )
}
