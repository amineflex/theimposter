import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getCatalogGames, getGameBySlug } from '@/flexgames/game-registry'
import { isPlayable } from '@/flexgames/core/game-definition'
import { GameThemeStyle } from '@/flexgames/ui/game-theme'

export function generateStaticParams() {
  return getCatalogGames()
    .filter((game) => game.manifest.supportedModes.local)
    .map((game) => ({ slug: game.manifest.slug }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const game = getGameBySlug(slug)
  return {
    title: game ? `${game.manifest.name} · partie locale` : 'Partie locale',
    description: game
      ? `Jouez à ${game.manifest.name} à plusieurs sur un seul téléphone. Fonctionne hors connexion.`
      : undefined,
  }
}

/** Partie locale : un seul appareil, passé de main en main. */
export default async function LocalPlayPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const game = getGameBySlug(slug)
  if (!game || !isPlayable(game) || !game.ui.LocalScreen) notFound()

  const LocalScreen = game.ui.LocalScreen
  return (
    <GameThemeStyle theme={game.manifest.theme}>
      <LocalScreen />
    </GameThemeStyle>
  )
}
