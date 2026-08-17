'use client'

import { motion } from 'framer-motion'
import { Shape } from '@/components/party/decor'
import { cn } from '@/lib/utils'
import { t } from '@/i18n'
import type { GameMode } from '@/lib/game-engine/types'

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
                selected ? cn(entry.selectedTone, 'border-5 shadow-toy-lg') : entry.tone,
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

/**
 * Sélecteur de nombre : deux gros boutons ronds et un chiffre énorme au milieu.
 */
export function BigStepper({
  label,
  value,
  min,
  max,
  onChange,
  disabled,
  className,
}: {
  label: string
  value: number
  min: number
  max: number
  onChange: (value: number) => void
  disabled?: boolean
  className?: string
}) {
  const safeMax = Math.max(min, max)

  return (
    <div className={cn('text-center', className)}>
      <p className="mb-2 font-display text-lg font-extrabold uppercase text-ink">{label}</p>
      <div className="flex items-center justify-center gap-5">
        <StepperButton
          label={`Diminuer : ${label}`}
          disabled={disabled || value <= min}
          onClick={() => onChange(Math.max(min, value - 1))}
        >
          −
        </StepperButton>
        <span
          className="min-w-[3ch] font-display text-6xl font-extrabold tabular-nums text-ink"
          aria-live="polite"
        >
          {value}
        </span>
        <StepperButton
          label={`Augmenter : ${label}`}
          disabled={disabled || value >= safeMax}
          onClick={() => onChange(Math.min(safeMax, value + 1))}
        >
          +
        </StepperButton>
      </div>
    </div>
  )
}

function StepperButton({
  children,
  label,
  onClick,
  disabled,
}: {
  children: React.ReactNode
  label: string
  onClick: () => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="toy-press flex h-14 w-14 items-center justify-center rounded-blob border-3 border-ink bg-yellow font-display text-3xl font-extrabold leading-none text-ink shadow-toy-md disabled:pointer-events-none disabled:opacity-40"
    >
      {children}
    </button>
  )
}
