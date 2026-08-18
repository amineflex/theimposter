'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { ArrowRight, Users, Wifi } from 'lucide-react'
import { StickerBadge } from './sticker-badge'
import { getGame } from '@/flexgames/game-registry'
import { t } from '@/i18n'
import { cn } from '@/lib/utils'

/**
 * Carte de jeu du catalogue, dans l'esprit « chaîne » du menu Wii : une tuile
 * cadrée, un pictogramme au centre, un libellé sous le trait.
 *
 * Tout vient du manifest : ajouter un jeu ajoute sa carte, sans toucher ce
 * fichier. Un jeu « bientôt » rend la même tuile, grisée et non cliquable.
 */
export function GameCard({ gameId, index = 0 }: { gameId: string; index?: number }) {
  // Le jeu est relu depuis le registry : un manifest contient des composants,
  // qui ne traversent pas la frontière serveur → client.
  const game = getGame(gameId)
  if (!game) return null
  const { manifest } = game
  const comingSoon = manifest.status !== 'available'
  const Icon = manifest.icon

  const tile = (
    <>
      {/* Écran de la chaîne */}
      <div
        className={cn(
          'relative flex aspect-4/3 items-center justify-center border-b-3 border-ink',
          comingSoon ? 'bg-cream' : 'bg-paper',
        )}
        style={comingSoon ? undefined : { backgroundColor: 'var(--game-tile, transparent)' }}
      >
        {Icon ? (
          <Icon className={cn('h-20 w-20', comingSoon && 'opacity-35')} />
        ) : (
          <span className="font-display text-4xl font-extrabold uppercase text-ink/30">
            {manifest.name.slice(0, 2)}
          </span>
        )}

        {comingSoon && (
          <span className="absolute bottom-2 right-2">
            <StickerBadge tone="cream" size="sm">
              {t('catalog.comingSoon')}
            </StickerBadge>
          </span>
        )}
        {!comingSoon && manifest.supportedModes.online && !manifest.supportedModes.local && (
          <span className="absolute right-2 top-2">
            <StickerBadge tone="blue" size="sm"><Wifi className="mr-1 inline h-3 w-3" aria-hidden />Online</StickerBadge>
          </span>
        )}
      </div>

      {/* Étiquette */}
      <div className="flex flex-1 flex-col gap-1 px-3 py-2.5">
        <p className="font-display text-lg font-extrabold uppercase leading-none text-ink">
          {manifest.name}
        </p>
        <p className="line-clamp-2 text-xs font-bold leading-tight text-ink-soft">
          {manifest.shortDescription}
        </p>

        <div className="mt-auto flex items-center justify-between gap-2 pt-2">
          <span className="flex items-center gap-1 font-display text-xs font-extrabold uppercase text-ink">
            <Users className="h-3.5 w-3.5" aria-hidden />
            {t('catalog.playersRange', { min: manifest.minPlayers, max: manifest.maxPlayers })}
          </span>
          {!comingSoon && (
            <span className="flex items-center gap-1 font-display text-xs font-extrabold uppercase text-red">
              {t('catalog.play')}
              <ArrowRight className="h-3.5 w-3.5" aria-hidden />
            </span>
          )}
        </div>
      </div>
    </>
  )

  const shell = cn(
    'flex h-full flex-col overflow-hidden rounded-blob border-3 border-ink shadow-toy-md',
    comingSoon ? 'bg-cream opacity-80' : 'bg-paper',
  )

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.06, 0.35), ease: 'easeOut' }}
      className="h-full"
      style={{ ['--game-tile' as string]: manifest.theme.secondary }}
    >
      {comingSoon ? (
        <div className={shell} aria-disabled>
          {tile}
        </div>
      ) : (
        <Link
          href={`/games/${manifest.slug}`}
          className={cn(
            shell,
            'toy-press focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
          )}
        >
          {tile}
        </Link>
      )}
    </motion.div>
  )
}
