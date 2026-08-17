'use client'

import { motion } from 'framer-motion'
import { PlayerAvatar } from './player-avatar'
import { cn } from '@/lib/utils'

export interface VoteCardProps {
  name: string
  avatarKey: string
  selected?: boolean
  disabled?: boolean
  onSelect?: () => void
  index?: number
}

/**
 * Tuile de vote : grosse cible tactile en aplat. Sélectionnée, elle monte,
 * pivote légèrement et son contour s'épaissit — l'état ne dépend jamais
 * uniquement de la couleur (le mot « choisi » est écrit).
 */
export function VoteCard({ name, avatarKey, selected, disabled, onSelect, index = 0 }: VoteCardProps) {
  return (
    <motion.button
      type="button"
      initial={{ scale: 0.85, opacity: 0 }}
      animate={{
        scale: 1,
        opacity: 1,
        y: selected ? -6 : 0,
        rotate: selected ? (index % 2 === 0 ? -2.5 : 2.5) : 0,
      }}
      transition={{
        delay: Math.min(index * 0.04, 0.24),
        type: 'spring',
        stiffness: 560,
        damping: 18,
      }}
      whileTap={disabled ? undefined : { y: 3 }}
      onClick={onSelect}
      disabled={disabled}
      aria-pressed={selected}
      // Nom accessible explicite : sans lui, le lecteur d'écran annoncerait
      // « Avatar de Sarah Sarah ».
      aria-label={`Voter contre ${name}`}
      className={cn(
        'flex min-h-[118px] flex-col items-center justify-center gap-1.5 rounded-blob border-3 border-ink p-2 text-center shadow-toy-md transition-colors duration-fast',
        selected ? 'border-5 bg-yellow shadow-toy-lg' : 'bg-paper',
        disabled && 'cursor-not-allowed opacity-45',
      )}
    >
      <PlayerAvatar avatarKey={avatarKey} name={name} size="lg" />
      <span className="w-full truncate font-display text-sm font-extrabold uppercase text-ink">
        {name}
      </span>
      {selected && (
        <span className="font-display text-[0.7rem] font-extrabold uppercase tracking-widest text-ink">
          choisi
        </span>
      )}
    </motion.button>
  )
}
