'use client'

import type { LobbySettingsProps, LobbySummaryProps } from '@/flexgames/core/game-definition'
import { StickerBadge } from '@/flexgames/ui/sticker-badge'
import { SettingsPanel } from './settings-panel'
import { gameSettingsSchema } from '../validations'
import { compositionFromSettings } from '../engine/roles'
import { t } from '@/i18n'

/**
 * Adaptateurs entre le salon générique et les réglages de The Imposter.
 *
 * La plateforme transmet la configuration comme un objet opaque : on la parse
 * ici, une fois, avec le schéma du jeu. C'est la seule frontière de typage.
 */
export function LobbySettings({ config, onChange, playerCount, maxPlayers }: LobbySettingsProps) {
  const parsed = gameSettingsSchema.safeParse(config)
  if (!parsed.success) return null
  return (
    <SettingsPanel
      settings={parsed.data}
      onChange={onChange}
      playerCount={playerCount}
      maxPlayers={maxPlayers}
    />
  )
}

export function LobbySummary({ config, playerCount }: LobbySummaryProps) {
  const parsed = gameSettingsSchema.safeParse(config)
  if (!parsed.success) return null
  const settings = parsed.data
  const composition = compositionFromSettings(settings, playerCount)

  return (
    <>
      <div className="mb-2 flex flex-wrap items-center gap-1.5">
        <StickerBadge tone={settings.mode === 'impostor' ? 'red' : 'blue'}>
          {t(`mode.${settings.mode}`)}
        </StickerBadge>
        <StickerBadge tone="cream" size="sm">
          {t(`difficulty.${settings.difficulty}`)}
        </StickerBadge>
      </div>
      <p className="font-display text-xs font-extrabold uppercase tracking-widest text-ink-soft">
        {t('lobby.composition')}
      </p>
      <p className="mt-1 text-sm font-bold text-ink">
        {settings.mode === 'impostor'
          ? `${composition.civilians} civils · ${composition.impostors} imposteur(s)`
          : `${composition.civilians} civils · ${composition.undercover} undercover · ${composition.mrWhite} Mr. White`}
      </p>
    </>
  )
}
