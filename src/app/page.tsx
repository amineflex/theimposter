import { FlexLogo } from '@/flexgames/ui/flex-logo'
import { GameCard } from '@/flexgames/ui/game-card'
import { ShapeRow, Shape } from '@/flexgames/ui/decor'
import { SoundToggle } from '@/flexgames/audio/sound-toggle'
import { getCatalogGames } from '@/flexgames/game-registry'
import { t } from '@/i18n'

/**
 * Accueil FlexGames : le logo et le catalogue. On choisit un jeu, puis sa page
 * regroupe toutes les actions disponibles.
 */
export default function HomePage() {
  const games = getCatalogGames()

  return (
    <main className="flex flex-1 flex-col py-8">
      <div className="relative flex flex-col items-center">
        <span aria-hidden className="absolute -top-2 left-2 -rotate-12">
          <Shape shape="star" tone="yellow" size={34} />
        </span>
        <span aria-hidden className="absolute right-1 top-6 rotate-12">
          <Shape shape="dot" tone="blue" size={22} />
        </span>

        <FlexLogo />

        <p className="mt-5 whitespace-pre-line text-center font-display text-lg font-extrabold uppercase leading-tight text-ink">
          {t('app.tagline')}
        </p>
      </div>

      <section className="mt-9">
        <h2 className="toy-title-ink mb-1 text-2xl uppercase">{t('catalog.title')}</h2>
        <p className="mb-4 text-xs font-bold text-ink-soft">{t('catalog.subtitle')}</p>

        <ul className="grid grid-cols-1 gap-4 min-[420px]:grid-cols-2">
          {games.map((game, index) => (
            <li key={game.manifest.id}>
              <GameCard gameId={game.manifest.id} index={index} />
            </li>
          ))}
        </ul>
      </section>

      <div className="mt-7 flex justify-center">
        <SoundToggle />
      </div>

      <ShapeRow className="mt-8" />

      <footer className="mt-4 flex flex-col items-center gap-1 text-center text-xs font-bold uppercase tracking-wide text-ink-soft">
        <span>Jouable à plusieurs sur un téléphone · ou chacun sur le sien</span>
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
