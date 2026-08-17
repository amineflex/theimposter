'use client'

import * as React from 'react'
import { ChevronDown, Sparkles } from 'lucide-react'
import { PartyButton } from '@/components/party/party-button'
import { PartyCard } from '@/components/party/party-card'
import { StickerBadge } from '@/components/party/sticker-badge'
import { ModePicker } from './mode-picker'
import { PACKS } from '@/data/packs'
import { t } from '@/i18n'
import { cn } from '@/lib/utils'
import {
  MAX_IMPOSTORS,
  MAX_MR_WHITE,
  MAX_UNDERCOVER,
  maxIntrudersFor,
  recommendedComposition,
  validateSettings,
} from '@/lib/game-engine/roles'
import {
  DESCRIPTION_ROUNDS_OPTIONS,
  DIFFICULTIES,
  MAX_PLAYERS,
  MIN_PLAYERS,
  TIMER_OPTIONS,
  type Difficulty,
  type GameMode,
  type GameSettings,
} from '@/lib/game-engine/types'

export interface SettingsPanelProps {
  settings: GameSettings
  onChange: (settings: GameSettings) => void
  playerCount: number
  maxPlayers?: number
  onMaxPlayersChange?: (value: number) => void
  disabled?: boolean
  /** Autorise la saisie d'un mot personnalisé (hôte uniquement). */
  allowCustomWord?: boolean
  /** Masque le choix du mode (déjà présenté ailleurs sur l'écran). */
  hideMode?: boolean
}

/**
 * Réglages d'une partie : l'essentiel visible sous forme de gros sélecteurs
 * tactiles, le reste replié. Les valeurs recommandées sont appliquées d'un geste.
 */
export function SettingsPanel({
  settings,
  onChange,
  playerCount,
  maxPlayers,
  onMaxPlayersChange,
  disabled,
  allowCustomWord = true,
  hideMode = false,
}: SettingsPanelProps) {
  const [advancedOpen, setAdvancedOpen] = React.useState(false)
  const referenceCount = Math.max(playerCount, MIN_PLAYERS)
  const validation = validateSettings(settings, referenceCount)
  const recommended = recommendedComposition(settings.mode, referenceCount)
  const maxIntruders = maxIntrudersFor(referenceCount)

  const update = (patch: Partial<GameSettings>) => onChange({ ...settings, ...patch })

  const switchMode = (mode: GameMode) => {
    const composition = recommendedComposition(mode, referenceCount)
    update({
      mode,
      impostorCount: composition.impostors,
      undercoverCount: composition.undercover,
      mrWhiteCount: composition.mrWhite,
      customWord: null,
    })
  }

  const applyRecommended = () =>
    update({
      impostorCount: recommended.impostors,
      undercoverCount: recommended.undercover,
      mrWhiteCount: recommended.mrWhite,
    })

  const togglePack = (slug: string) => {
    const packs = settings.packs.includes(slug)
      ? settings.packs.filter((entry) => entry !== slug)
      : [...settings.packs, slug]
    update({ packs })
  }

  const civilians =
    referenceCount - settings.impostorCount - settings.undercoverCount - settings.mrWhiteCount

  return (
    <div className="space-y-6">
      {!hideMode && <ModePicker value={settings.mode} onChange={switchMode} disabled={disabled} />}

      {/* Composition */}
      <PartyCard tone="cream" padding="md">
        <div className="mb-3 flex items-center justify-between gap-2">
          <p className="font-display text-base font-extrabold uppercase text-ink">
            {t('lobby.composition')}
          </p>
          <PartyButton
            type="button"
            variant="paper"
            size="sm"
            onClick={applyRecommended}
            disabled={disabled}
          >
            <Sparkles className="h-4 w-4" aria-hidden />
            {t('common.recommended')}
          </PartyButton>
        </div>

        <fieldset disabled={disabled} className="space-y-2.5">
          {settings.mode === 'impostor' ? (
            <RowStepper
              label={t('create.impostors')}
              value={settings.impostorCount}
              min={1}
              max={Math.min(MAX_IMPOSTORS, maxIntruders)}
              onChange={(impostorCount) => update({ impostorCount })}
              disabled={disabled}
            />
          ) : (
            <>
              <RowStepper
                label={t('create.undercovers')}
                value={settings.undercoverCount}
                min={settings.mrWhiteCount > 0 ? 0 : 1}
                max={Math.min(MAX_UNDERCOVER, maxIntruders - settings.mrWhiteCount)}
                onChange={(undercoverCount) => update({ undercoverCount })}
                disabled={disabled}
              />
              <RowStepper
                label={t('create.mrWhites')}
                value={settings.mrWhiteCount}
                min={settings.undercoverCount > 0 ? 0 : 1}
                max={Math.min(MAX_MR_WHITE, maxIntruders - settings.undercoverCount)}
                onChange={(mrWhiteCount) => update({ mrWhiteCount })}
                disabled={disabled}
              />
            </>
          )}
        </fieldset>

        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <StickerBadge tone="green" size="sm">
            {civilians} civils
          </StickerBadge>
          <StickerBadge tone="paper" size="sm">
            max {maxIntruders} spécial(aux)
          </StickerBadge>
        </div>
        {!validation.ok && (
          <p className="mt-2 text-xs font-extrabold text-red" role="alert">
            {validation.errors[0]}
          </p>
        )}
      </PartyCard>

      {/* Difficulté */}
      <fieldset disabled={disabled}>
        <legend className="mb-2 font-display text-base font-extrabold uppercase text-ink">
          {t('create.difficulty')}
        </legend>
        <div className="grid grid-cols-4 gap-2">
          {(['all', ...DIFFICULTIES] as const).map((value) => (
            <ChoiceChip
              key={value}
              selected={settings.difficulty === value}
              onClick={() => update({ difficulty: value as Difficulty | 'all' })}
            >
              {t(`difficulty.${value}`)}
            </ChoiceChip>
          ))}
        </div>
      </fieldset>

      {/* Réglages avancés */}
      <div>
        <button
          type="button"
          onClick={() => setAdvancedOpen((open) => !open)}
          aria-expanded={advancedOpen}
          className="toy-press flex min-h-12 w-full items-center justify-between rounded-blob border-3 border-ink bg-paper px-4 font-display text-sm font-extrabold uppercase text-ink shadow-toy"
        >
          {t('common.advanced')}
          <ChevronDown
            className={cn('h-5 w-5 transition-transform duration-fast', advancedOpen && 'rotate-180')}
            aria-hidden
          />
        </button>

        {advancedOpen && (
          <div className="mt-3 space-y-5 rounded-blob border-3 border-ink bg-cream-deep p-4">
            {/* Packs */}
            <fieldset disabled={disabled}>
              <legend className="mb-2 font-display text-sm font-extrabold uppercase text-ink">
                {t('create.packs')}
              </legend>
              <div className="flex flex-wrap gap-2">
                <ChoiceChip
                  selected={settings.packs.length === 0}
                  onClick={() => update({ packs: [] })}
                  rounded
                >
                  {t('create.allPacks')}
                </ChoiceChip>
                {PACKS.map((pack) => (
                  <ChoiceChip
                    key={pack.slug}
                    selected={settings.packs.includes(pack.slug)}
                    onClick={() => togglePack(pack.slug)}
                    rounded
                  >
                    <span aria-hidden>{pack.emoji}</span> {pack.name}
                  </ChoiceChip>
                ))}
              </div>
            </fieldset>

            {/* Tours de description */}
            <fieldset disabled={disabled}>
              <legend className="mb-2 font-display text-sm font-extrabold uppercase text-ink">
                {t('create.descriptionRounds')}
              </legend>
              <div className="grid grid-cols-4 gap-2">
                {DESCRIPTION_ROUNDS_OPTIONS.map((option) => (
                  <ChoiceChip
                    key={String(option)}
                    selected={settings.descriptionRounds === option}
                    onClick={() => update({ descriptionRounds: option })}
                  >
                    {option === 'free' ? 'Libre' : `${option}`}
                  </ChoiceChip>
                ))}
              </div>
            </fieldset>

            <TimerField
              label={t('create.speakDuration')}
              value={settings.speakDuration}
              onChange={(speakDuration) => update({ speakDuration })}
            />
            <TimerField
              label={t('create.voteDuration')}
              value={settings.voteDuration}
              onChange={(voteDuration) => update({ voteDuration })}
            />

            {/* Révélation du rôle */}
            <ToggleRow
              id="reveal-role"
              label={t('create.revealRole')}
              checked={settings.revealRoleOnElimination}
              onChange={(revealRoleOnElimination) => update({ revealRoleOnElimination })}
              disabled={disabled}
            />

            {/* Joueurs maximum */}
            {onMaxPlayersChange && typeof maxPlayers === 'number' && (
              <RowStepper
                label={t('create.maxPlayers')}
                value={maxPlayers}
                min={Math.max(MIN_PLAYERS, playerCount)}
                max={MAX_PLAYERS}
                onChange={onMaxPlayersChange}
                disabled={disabled}
              />
            )}

            {allowCustomWord && (
              <CustomWordField settings={settings} onChange={onChange} disabled={disabled} />
            )}
          </div>
        )}
      </div>
    </div>
  )
}

/** Pastille de choix : aplat + contour, état sélectionné très lisible. */
function ChoiceChip({
  children,
  selected,
  onClick,
  rounded,
}: {
  children: React.ReactNode
  selected: boolean
  onClick: () => void
  rounded?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        'toy-press min-h-11 border-3 border-ink px-3 font-display text-xs font-extrabold uppercase text-ink shadow-toy',
        rounded ? 'rounded-capsule' : 'rounded-md',
        selected ? 'bg-yellow' : 'bg-paper',
      )}
    >
      {children}
    </button>
  )
}

function TimerField({
  label,
  value,
  onChange,
}: {
  label: string
  value: number
  onChange: (value: (typeof TIMER_OPTIONS)[number]) => void
}) {
  return (
    <fieldset>
      <legend className="mb-2 font-display text-sm font-extrabold uppercase text-ink">{label}</legend>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
        {TIMER_OPTIONS.map((option) => (
          <ChoiceChip key={option} selected={value === option} onClick={() => onChange(option)}>
            {option === 0 ? '∞' : `${option}s`}
          </ChoiceChip>
        ))}
      </div>
    </fieldset>
  )
}

/** Ligne « libellé — − n + » compacte, pour les réglages secondaires. */
function RowStepper({
  label,
  value,
  min,
  max,
  onChange,
  disabled,
}: {
  label: string
  value: number
  min: number
  max: number
  onChange: (value: number) => void
  disabled?: boolean
}) {
  const safeMax = Math.max(min, max)
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-sm font-bold text-ink">{label}</span>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onChange(Math.max(min, value - 1))}
          disabled={disabled || value <= min}
          aria-label={`Diminuer : ${label}`}
          className="toy-press flex h-11 w-11 items-center justify-center rounded-md border-3 border-ink bg-paper font-display text-xl font-extrabold text-ink shadow-toy disabled:pointer-events-none disabled:opacity-40"
        >
          −
        </button>
        <span className="w-8 text-center font-display text-2xl font-extrabold tabular-nums text-ink">
          {value}
        </span>
        <button
          type="button"
          onClick={() => onChange(Math.min(safeMax, value + 1))}
          disabled={disabled || value >= safeMax}
          aria-label={`Augmenter : ${label}`}
          className="toy-press flex h-11 w-11 items-center justify-center rounded-md border-3 border-ink bg-paper font-display text-xl font-extrabold text-ink shadow-toy disabled:pointer-events-none disabled:opacity-40"
        >
          +
        </button>
      </div>
    </div>
  )
}

/** Interrupteur maison : pastille qui coulisse, contour d'encre. */
function ToggleRow({
  id,
  label,
  checked,
  onChange,
  disabled,
}: {
  id: string
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <label htmlFor={id} className="text-sm font-bold text-ink">
        {label}
      </label>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative h-9 w-16 shrink-0 rounded-capsule border-3 border-ink shadow-toy transition-colors duration-fast',
          checked ? 'bg-green' : 'bg-paper',
        )}
      >
        <span
          className={cn(
            'absolute top-0.5 h-6 w-6 rounded-full border-3 border-ink bg-paper transition-all duration-fast',
            checked ? 'left-8' : 'left-0.5',
          )}
        />
      </button>
    </div>
  )
}

function CustomWordField({
  settings,
  onChange,
  disabled,
}: {
  settings: GameSettings
  onChange: (settings: GameSettings) => void
  disabled?: boolean
}) {
  const enabled = settings.customWord !== null
  const inputClass =
    'h-12 w-full rounded-md border-3 border-ink bg-paper px-3 text-base font-bold text-ink shadow-toy placeholder:text-ink/35 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background'

  return (
    <div className="space-y-3 rounded-blob border-3 border-ink bg-paper p-3">
      <ToggleRow
        id="custom-word-toggle"
        label={t('create.customWord')}
        checked={enabled}
        disabled={disabled}
        onChange={(checked) =>
          onChange({
            ...settings,
            customWord: checked ? { word: '', hint: '', undercoverWord: '' } : null,
          })
        }
      />
      <p className="text-xs font-bold text-ink-soft">{t('create.customWordHint')}</p>

      {enabled && settings.customWord && (
        <div className="space-y-2">
          <input
            value={settings.customWord.word}
            onChange={(event) =>
              onChange({
                ...settings,
                customWord: { ...settings.customWord!, word: event.target.value },
              })
            }
            placeholder={settings.mode === 'impostor' ? 'Mot secret' : 'Mot des civils'}
            aria-label={settings.mode === 'impostor' ? 'Mot secret' : 'Mot des civils'}
            maxLength={40}
            className={inputClass}
          />
          {settings.mode === 'impostor' ? (
            <input
              value={settings.customWord.hint ?? ''}
              onChange={(event) =>
                onChange({
                  ...settings,
                  customWord: { ...settings.customWord!, hint: event.target.value },
                })
              }
              placeholder="Indice pour l'imposteur"
              aria-label="Indice pour l'imposteur"
              maxLength={40}
              className={inputClass}
            />
          ) : (
            <input
              value={settings.customWord.undercoverWord ?? ''}
              onChange={(event) =>
                onChange({
                  ...settings,
                  customWord: { ...settings.customWord!, undercoverWord: event.target.value },
                })
              }
              placeholder="Mot de l'undercover"
              aria-label="Mot de l'undercover"
              maxLength={40}
              className={inputClass}
            />
          )}
          <StickerBadge tone="cream" size="sm">
            non conservé après la partie
          </StickerBadge>
        </div>
      )}
    </div>
  )
}
