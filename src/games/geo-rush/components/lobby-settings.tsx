'use client'

import type { LobbySettingsProps, LobbySummaryProps } from '@/flexgames/core/game-definition'
import { StickerBadge } from '@/flexgames/ui/sticker-badge'
import { cn } from '@/lib/utils'
import { geoConfigSchema } from '../validations'
import type { GeoConfig } from '../types'

const DIFFICULTY = { easy: 'Facile', normal: 'Normal', hard: 'Difficile' } as const
const REGION = { world: 'Monde entier', europe: 'Europe', africa: 'Afrique', asia: 'Asie', americas: 'Amériques', oceania: 'Océanie' } as const

function Choice<T extends string | number>({ label, values, value, onChange, format = String }: { label: string; values: readonly T[]; value: T; onChange: (value: T) => void; format?: (value: T) => string }) {
  return (
    <fieldset>
      <legend className="mb-2 font-display text-xs font-extrabold uppercase tracking-widest text-ink-soft">{label}</legend>
      <div className="flex flex-wrap gap-2">
        {values.map((item) => <button key={item} type="button" onClick={() => onChange(item)} className={cn('min-h-11 flex-1 rounded-blob border-3 border-ink px-3 py-2 font-display text-sm font-extrabold text-ink shadow-toy toy-press', item === value ? 'bg-yellow' : 'bg-paper')}>{format(item)}</button>)}
      </div>
    </fieldset>
  )
}

export function LobbySettings({ config, onChange }: LobbySettingsProps) {
  const parsed = geoConfigSchema.safeParse(config)
  if (!parsed.success) return null
  const settings = parsed.data
  const update = <K extends keyof GeoConfig>(key: K, value: GeoConfig[K]) => onChange({ ...settings, [key]: value })
  return (
    <div className="space-y-5">
      <div className="rounded-blob border-3 border-ink bg-green px-4 py-3 text-center text-ink shadow-toy">
        <p className="font-display text-lg font-extrabold uppercase">🎲 Mix complet</p>
        <p className="text-xs font-bold">Cartes, capitales, drapeaux et silhouettes sont équilibrés automatiquement.</p>
      </div>
      <Choice label="Nombre de questions" values={[10, 15, 30] as const} value={settings.questionCount} onChange={(value) => update('questionCount', value)} format={(value) => `${value}`} />
      <Choice label="Temps par question" values={[10, 15, 20] as const} value={settings.durationSeconds} onChange={(value) => update('durationSeconds', value)} format={(value) => `${value} s`} />
      <Choice label="Difficulté" values={['easy', 'normal', 'hard'] as const} value={settings.difficulty} onChange={(value) => update('difficulty', value)} format={(value) => DIFFICULTY[value]} />
      <label className="block font-display text-xs font-extrabold uppercase tracking-widest text-ink-soft">
        Région
        <select className="mt-2 min-h-12 w-full rounded-blob border-3 border-ink bg-paper px-3 text-base font-bold text-ink shadow-toy" value={settings.region} onChange={(event) => update('region', event.target.value as GeoConfig['region'])}>
          {Object.entries(REGION).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </label>
    </div>
  )
}

export function LobbySummary({ config }: LobbySummaryProps) {
  const parsed = geoConfigSchema.safeParse(config)
  if (!parsed.success) return null
  const settings = parsed.data
  return (
    <div className="flex flex-wrap gap-2">
      <StickerBadge tone="blue">{settings.questionCount} questions</StickerBadge>
      <StickerBadge tone="yellow">{settings.durationSeconds} s</StickerBadge>
      <StickerBadge tone="green">{DIFFICULTY[settings.difficulty]}</StickerBadge>
      <StickerBadge tone="cream">{REGION[settings.region]}</StickerBadge>
    </div>
  )
}
