import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { PartyButton } from '@/flexgames/ui/party-button'
import { PlayOnlineScreen } from '@/flexgames/rooms/play-screen'
import { getCatalogGames, getGameBySlug } from '@/flexgames/game-registry'
import { isPlayable } from '@/flexgames/core/game-definition'
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
  return {
    title: game ? `${game.manifest.name} en ligne` : 'Partie en ligne',
    description: game
      ? `Créez une partie de ${game.manifest.name} ou rejoignez vos amis avec un code.`
      : undefined,
  }
}

/** Créer ou rejoindre une partie en ligne du jeu choisi. */
export default async function PlayOnlinePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const game = getGameBySlug(slug)
  if (!game || !isPlayable(game) || !game.manifest.supportedModes.online) notFound()

  return (
    <main className="flex flex-1 flex-col py-6">
      <PartyButton asChild variant="ghost" size="sm" className="mb-4 self-start">
        <Link href={`/games/${game.manifest.slug}`}>
          <ArrowLeft className="h-4 w-4" aria-hidden />
          {t('common.back')}
        </Link>
      </PartyButton>
      <PlayOnlineScreen gameId={game.manifest.id} />
    </main>
  )
}
