'use client'

import { motion } from 'framer-motion'
import { Shape } from '@/flexgames/ui/decor'
import { cn } from '@/lib/utils'
import { t } from '@/i18n'
import type { GameMode } from '@/games/the-imposter/engine/types'

/**
 * Choix du mode : deux grosses cartes tactiles avec une identité de couleur
 * propre (rouge pour Imposteur, bleu pour Undercover).
 *
 * Ces couleurs sont celles des MENUS uniquement : elles ne sont jamais réemployées
 * pendant la partie et ne révèlent donc aucun rôle.
 */
export function ModePicker({
  value,
  onChange,
  disabled,
  className,
}: {
  value: GameMode
  onChange: (mode: GameMode) => void
  disabled?: boolean
  className?: string
}) {
  const modes: {
    mode: GameMode
    tone: string
    selectedTone: string
    shape: 'star' | 'diamond'
    description: string
  }[] = [
    {
      mode: 'impostor',
      tone: 'bg-paper',
      selectedTone: 'bg-red text-paper',
      shape: 'star',
      description: t('mode.impostor.card'),
    },
    {
      mode: 'undercover',
      tone: 'bg-paper',
      selectedTone: 'bg-blue text-paper',
      shape: 'diamond',
      description: t('mode.undercover.card'),
    },
  ]

  return (
    <fieldset disabled={disabled} className={className}>
      <legend className="mb-3 font-display text-lg font-extrabold uppercase text-ink">
        {t('create.chooseMode')}
      </legend>
      <div className="grid grid-cols-2 gap-3">
        {modes.map((entry, index) => {
          const selected = value === entry.mode
          return (
            <motion.button
              key={entry.mode}
              type="button"
              onClick={() => onChange(entry.mode)}
              aria-pressed={selected}
              whileTap={{ y: 3 }}
              animate={{ rotate: selected ? (index === 0 ? -1.5 : 1.5) : 0, y: selected ? -3 : 0 }}
              transition={{ type: 'spring', stiffness: 560, damping: 18 }}
              className={cn(
                'relative flex min-h-[148px] flex-col items-center justify-center gap-2 rounded-blob border-3 border-ink p-3 text-center shadow-toy-md transition-colors duration-fast',
                selected ? cn(entry.selectedTone, 'border-4 shadow-toy-lg') : entry.tone,
                disabled && 'opacity-60',
              )}
            >
              <span aria-hidden className="absolute -left-2 -top-2 rotate-12">
                <Shape
                  shape={entry.shape}
                  tone={entry.mode === 'impostor' ? 'yellow' : 'green'}
                  size={24}
                />
              </span>
              <span className="font-display text-xl font-extrabold uppercase leading-none">
                {t(`mode.${entry.mode}`)}
              </span>
              <span
                className={cn(
                  'text-xs font-bold leading-snug',
                  selected ? 'opacity-90' : 'text-ink-soft',
                )}
              >
                {entry.description}
              </span>
            </motion.button>
          )
        })}
      </div>
    </fieldset>
  )
}
