'use client'

import { cn } from '@/lib/utils'

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
