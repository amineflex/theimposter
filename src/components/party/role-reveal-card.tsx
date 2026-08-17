'use client'

import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { t } from '@/i18n'
import { Shape } from './decor'
import type { Role } from '@/lib/game-engine/types'

export interface RoleRevealCardProps {
  role: Role
  word: string | null
  hint: string | null
  className?: string
}

/**
 * Identité visuelle de chaque rôle.
 *
 * ⚠️ Ces couleurs n'apparaissent que sur SA PROPRE carte, jamais dans une liste
 * publique : elles ne permettent donc pas de deviner le rôle d'un autre joueur.
 */
const ROLE_STYLE: Record<
  Role,
  { card: string; chip: string; label: string; corner: 'star' | 'dot' | 'triangle' | 'diamond' }
> = {
  civilian: {
    card: 'bg-green text-ink',
    chip: 'bg-paper text-ink',
    label: 'role.civilian',
    corner: 'dot',
  },
  impostor: {
    card: 'bg-red text-paper',
    chip: 'bg-yellow text-ink',
    label: 'role.impostor',
    corner: 'star',
  },
  undercover: {
    card: 'bg-blue text-paper',
    chip: 'bg-yellow text-ink',
    label: 'role.undercover',
    corner: 'diamond',
  },
  mr_white: {
    card: 'bg-paper text-ink',
    chip: 'bg-blue text-paper',
    label: 'role.mr_white',
    corner: 'triangle',
  },
}

/**
 * Carte de rôle : gros flip, aplat de couleur, mot énorme.
 * Texte non sélectionnable pour éviter les fuites par copier-coller.
 */
export function RoleRevealCard({ role, word, hint, className }: RoleRevealCardProps) {
  const style = ROLE_STYLE[role]

  return (
    <motion.div
      initial={{ rotateY: 180, scale: 0.86, opacity: 0 }}
      animate={{ rotateY: 0, scale: 1, opacity: 1 }}
      transition={{ duration: 0.42, ease: [0.34, 1.45, 0.64, 1] }}
      style={{ transformPerspective: 1200 }}
      className={cn(
        'no-select relative w-full rounded-blob border-4 border-ink px-5 py-8 text-center shadow-toy-lg',
        style.card,
        className,
      )}
    >
      {/* Coins décoratifs en aplats */}
      <span aria-hidden className="absolute -left-3 -top-3 rotate-12">
        <Shape shape={style.corner} tone="yellow" size={30} />
      </span>
      <span aria-hidden className="absolute -bottom-3 -right-3 -rotate-12">
        <Shape shape={style.corner} tone="blue" size={26} />
      </span>

      <span
        className={cn(
          'inline-block rounded-capsule border-3 border-ink px-4 py-1 font-display text-lg font-extrabold uppercase tracking-widest shadow-toy',
          style.chip,
        )}
      >
        {t(style.label as 'role.civilian')}
        {role !== 'civilian' && '!'}
      </span>

      {role === 'civilian' || role === 'undercover' ? (
        <div className="mt-7">
          <p className="font-display text-sm font-extrabold uppercase tracking-widest opacity-80">
            {t('role.civilian.word')}
          </p>
          <p className="mt-1 break-words font-display text-[2.6rem] font-extrabold uppercase leading-none sm:text-5xl">
            {word}
          </p>
        </div>
      ) : role === 'impostor' ? (
        <div className="mt-7">
          <p className="font-display text-xl font-extrabold uppercase leading-tight">
            {t('role.impostor.noWord')}
          </p>
          <p className="mt-5 font-display text-sm font-extrabold uppercase tracking-widest opacity-80">
            {t('role.impostor.hint')}
          </p>
          <p className="mt-1 break-words font-display text-[2.6rem] font-extrabold uppercase leading-none sm:text-5xl">
            {hint}
          </p>
        </div>
      ) : (
        <div className="mt-7">
          <p className="font-display text-3xl font-extrabold uppercase leading-tight">
            {t('role.mr_white.noWord')}
          </p>
          <p className="mt-3 font-display text-lg font-extrabold uppercase text-ink-soft">
            {t('role.mr_white.observe')}
          </p>
        </div>
      )}
    </motion.div>
  )
}
