import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, Smartphone, Users, Wifi } from 'lucide-react'
import { PartyButton } from '@/flexgames/ui/party-button'
import { PartyCard } from '@/flexgames/ui/party-card'
import { StickerBadge } from '@/flexgames/ui/sticker-badge'
import { Shape } from '@/flexgames/ui/decor'
import { GameThemeStyle } from '@/flexgames/ui/game-theme'
import { JoinCodeCard } from '@/flexgames/lobby/join-code-card'
import { getCatalogGames, getGameBySlug } from '@/flexgames/game-registry'
import { t } from '@/i18n'

export function generateStaticParams() {
  return getCatalogGames().map((game) => ({ slug: game.manifest.slug }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const game = getGameBySlug(slug)
  if (!game) return { title: 'Jeu introuvable' }
  return {
    title: game.manifest.name,
    description: game.manifest.description ?? game.manifest.shortDescription,
  }
}

/** Page d'un jeu : de quoi il s'agit, et comment y jouer. */
export default async function GamePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const game = getGameBySlug(slug)
  if (!game) notFound()

  const { manifest } = game
  const Icon = manifest.icon
  const Logo = manifest.logo
  const playable = manifest.status === 'available'

  return (
    <GameThemeStyle theme={manifest.theme}>
      <main className="flex w-full flex-1 flex-col py-6">
        <PartyButton asChild variant="ghost" size="sm" className="mb-4 self-start">
          <Link href="/">
            <ArrowLeft className="h-4 w-4" aria-hidden />
            {t('common.backHome')}
          </Link>
        </PartyButton>

        <header className="relative flex flex-col items-center text-center">
          {Logo ? (
            <>
              <span aria-hidden className="absolute left-3 top-2 -rotate-12">
                <Shape shape="star" tone="yellow" size={32} />
              </span>
              <span aria-hidden className="absolute right-4 top-8 rotate-12">
                <Shape shape="dot" tone="blue" size={22} />
              </span>
              <Logo />
            </>
          ) : (
            <div className="flex items-center justify-center gap-4">
              {Icon && (
                <span className="shrink-0 rounded-blob border-3 border-ink bg-paper p-2 shadow-toy-md">
                  <Icon className="h-16 w-16" />
                </span>
              )}
              <h1 className="toy-title-ink text-3xl uppercase leading-none">{manifest.name}</h1>
            </div>
          )}
          <p className="mt-4 max-w-sm text-sm font-bold text-ink-soft">
            {manifest.shortDescription}
          </p>
        </header>

        <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
          <StickerBadge tone="yellow" size="sm">
            <Users className="mr-1 inline h-3.5 w-3.5" aria-hidden />
            {t('catalog.playersRange', { min: manifest.minPlayers, max: manifest.maxPlayers })}
          </StickerBadge>
          {manifest.supportedModes.local && (
            <StickerBadge tone="green" size="sm">
              <Smartphone className="mr-1 inline h-3.5 w-3.5" aria-hidden />
              {t('catalog.localMode')}
            </StickerBadge>
          )}
          {manifest.supportedModes.online && (
            <StickerBadge tone="blue" size="sm">
              <Wifi className="mr-1 inline h-3.5 w-3.5" aria-hidden />
              {t('catalog.onlineMode')}
            </StickerBadge>
          )}
          {!playable && <StickerBadge tone="orange">{t('catalog.comingSoon')}</StickerBadge>}
        </div>

        {manifest.description && (
          <PartyCard tone="yellow" padding="lg" tilt="left" className="mt-6">
            <p className="text-sm font-bold leading-relaxed text-ink">{manifest.description}</p>
          </PartyCard>
        )}

        {manifest.howToPlay && <div className="mt-5">{manifest.howToPlay}</div>}

        {playable && (
          <nav className="mt-8 flex flex-col gap-4" aria-label="Modes de jeu">
            {manifest.supportedModes.local && (
              <PartyButton asChild variant="yellow" size="xl" block>
                <Link href={`/play/${manifest.slug}/local`}>{t('home.localGame')}</Link>
              </PartyButton>
            )}
            {manifest.supportedModes.online && (
              <PartyButton asChild variant="red" size="xl" block>
                <Link href={`/play/${manifest.slug}`}>{t('home.onlineGame')}</Link>
              </PartyButton>
            )}
          </nav>
        )}

        {playable && manifest.supportedModes.online && (
          <div className="mt-8">
            <JoinCodeCard />
          </div>
        )}

        <PartyButton asChild variant="ghost" size="sm" className="mt-5 self-center">
          <Link href="/regles">{t('catalog.howToPlay')}</Link>
        </PartyButton>
      </main>
    </GameThemeStyle>
  )
}
