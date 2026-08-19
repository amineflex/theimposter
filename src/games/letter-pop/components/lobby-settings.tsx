'use client'

import type { LobbySettingsProps, LobbySummaryProps } from '@/flexgames/core/game-definition'
import { StickerBadge } from '@/flexgames/ui/sticker-badge'
import { cn } from '@/lib/utils'
import { CATEGORY_BY_ID, LETTER_POOLS } from '../data/categories'
import type {
  LetterPopCategoryCount,
  LetterPopCategoryId,
  LetterPopConfig,
  LetterPopLetter,
} from '../types'
import { LETTER_POP_ALPHABET, LETTER_POP_CATEGORY_IDS } from '../types'
import { letterPopConfigSchema } from '../validations'

const PRESETS = {
  classic: ['Classique', 'Les catégories traditionnelles'],
  pop: ['Pop', 'Culture, marques et célébrités'],
  mix: ['Mix', 'Un équilibre différent à chaque manche'],
  custom: ['Custom', 'Choisis exactement tes catégories'],
} as const
const DIFFICULTIES = { easy: 'Facile', normal: 'Normal', hard: 'Difficile' } as const

function Choice<T extends string | number>({ label, values, value, onChange, format = String }: {
  label: string
  values: readonly T[]
  value: T
  onChange: (value: T) => void
  format?: (value: T) => string
}) {
  return (
    <fieldset>
      <legend className="mb-2 font-display text-xs font-extrabold uppercase tracking-widest text-ink-soft">{label}</legend>
      <div className="flex flex-wrap gap-2">
        {values.map((item) => (
          <button key={item} type="button" onClick={() => onChange(item)} className={cn(
            'toy-press min-h-11 flex-1 rounded-blob border-3 border-ink px-3 py-2 font-display text-sm font-extrabold text-ink shadow-toy',
            item === value ? 'bg-yellow' : 'bg-paper',
          )}>{format(item)}</button>
        ))}
      </div>
    </fieldset>
  )
}

export function LobbySettings({ config, onChange }: LobbySettingsProps) {
  const parsed = letterPopConfigSchema.safeParse(config)
  if (!parsed.success) return null
  const settings = parsed.data as LetterPopConfig
  const update = <K extends keyof LetterPopConfig>(key: K, value: LetterPopConfig[K]) => onChange({ ...settings, [key]: value })
  const changeCategoryCount = (count: LetterPopCategoryCount) => {
    const next = [...settings.customCategories.slice(0, count)]
    for (const categoryId of LETTER_POP_CATEGORY_IDS) {
      if (next.length === count) break
      if (!next.includes(categoryId)) next.push(categoryId)
    }
    onChange({ ...settings, categoryCount: count, customCategories: next })
  }
  const chooseCategory = (categoryId: LetterPopCategoryId) => {
    if (settings.customCategories.includes(categoryId)) {
      onChange({
        ...settings,
        customCategories: [...settings.customCategories.filter((selected) => selected !== categoryId), categoryId],
      })
      return
    }
    onChange({ ...settings, customCategories: [...settings.customCategories.slice(0, -1), categoryId] })
  }

  return (
    <div className="space-y-5">
      <fieldset>
        <legend className="mb-2 font-display text-xs font-extrabold uppercase tracking-widest text-ink-soft">Preset</legend>
        <div className="grid grid-cols-2 gap-2">
          {Object.entries(PRESETS).map(([value, [label, description]]) => (
            <button key={value} type="button" onClick={() => update('preset', value as LetterPopConfig['preset'])} className={cn(
              'toy-press rounded-blob border-3 border-ink px-3 py-3 text-left text-ink shadow-toy',
              settings.preset === value ? 'bg-red text-paper' : 'bg-paper',
            )}>
              <span className="block font-display text-sm font-extrabold uppercase">{label}</span>
              <span className="mt-1 block text-[11px] font-bold leading-tight opacity-80">{description}</span>
            </button>
          ))}
        </div>
      </fieldset>
      <Choice label="Nombre de manches" values={[3, 5, 7, 10] as const} value={settings.roundCount} onChange={(value) => update('roundCount', value)} format={(value) => `${value}`} />
      <Choice label="Durée d’une manche" values={[30, 45, 60] as const} value={settings.durationSeconds} onChange={(value) => update('durationSeconds', value)} format={(value) => `${value} s`} />
      <Choice label="Nombre de catégories" values={[4, 5, 6, 7, 8] as const} value={settings.categoryCount} onChange={changeCategoryCount} />
      <Choice label="Difficulté des lettres" values={['easy', 'normal', 'hard'] as const} value={settings.difficulty} onChange={(value) => update('difficulty', value)} format={(value) => DIFFICULTIES[value]} />

      {settings.preset === 'custom' && (
        <fieldset>
          <legend className="mb-2 font-display text-xs font-extrabold uppercase tracking-widest text-ink-soft">Catégories custom · sélectionne puis remplace</legend>
          <div className="grid grid-cols-2 gap-2">
            {LETTER_POP_CATEGORY_IDS.map((categoryId) => {
              const category = CATEGORY_BY_ID[categoryId]
              const selected = settings.customCategories.includes(categoryId)
              return (
                <button key={categoryId} type="button" aria-pressed={selected} onClick={() => chooseCategory(categoryId)} className={cn(
                  'toy-press min-h-12 rounded-blob border-3 border-ink px-2 py-2 text-xs font-extrabold text-ink shadow-toy',
                  selected ? 'bg-green' : 'bg-paper',
                )}>{category.emoji} {category.label}</button>
              )
            })}
          </div>
        </fieldset>
      )}

      <label className="flex items-center justify-between gap-3 rounded-blob border-3 border-ink bg-paper px-4 py-3 font-display text-sm font-extrabold uppercase text-ink shadow-toy">
        Lettre manuelle
        <input type="checkbox" className="h-6 w-6 accent-red" checked={settings.customLetter != null} onChange={(event) => update('customLetter', event.target.checked ? (LETTER_POOLS[settings.difficulty][0] ?? 'A') : null)} />
      </label>
      {settings.customLetter && (
        <label className="block font-display text-xs font-extrabold uppercase tracking-widest text-ink-soft">
          Lettre choisie
          <select value={settings.customLetter} onChange={(event) => update('customLetter', event.target.value as LetterPopLetter)} className="mt-2 min-h-12 w-full rounded-blob border-3 border-ink bg-paper px-3 text-center font-display text-xl font-extrabold text-ink shadow-toy">
            {LETTER_POP_ALPHABET.map((letter) => <option key={letter} value={letter}>{letter}</option>)}
          </select>
        </label>
      )}
    </div>
  )
}

export function LobbySummary({ config }: LobbySummaryProps) {
  const parsed = letterPopConfigSchema.safeParse(config)
  if (!parsed.success) return null
  const settings = parsed.data as LetterPopConfig
  return (
    <div className="flex flex-wrap gap-2">
      <StickerBadge tone="red">{PRESETS[settings.preset][0]}</StickerBadge>
      <StickerBadge tone="yellow">{settings.roundCount} manches</StickerBadge>
      <StickerBadge tone="blue">{settings.durationSeconds} s</StickerBadge>
      <StickerBadge tone="green">{settings.categoryCount} catégories</StickerBadge>
      <StickerBadge tone="cream">{settings.customLetter ?? DIFFICULTIES[settings.difficulty]}</StickerBadge>
    </div>
  )
}
