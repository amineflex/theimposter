'use client'

import type { GameClientModule } from '@/flexgames/core/game-definition'
import { invalid, valid } from '@/flexgames/core/types'
import { gameSettingsSchema } from './validations'
import { validateSettings } from './engine/roles'
import { defaultSettings, reconcileSettings } from './engine/engine'
import { useImposterPreferences } from './preferences'

/**
 * Part cliente de The Imposter : uniquement du pur et du public.
 *
 * Le salon générique s'en sert pour savoir si la partie est lançable et pour
 * transmettre l'historique local anti-répétition. Aucun secret ici.
 */
export const client: GameClientModule = {
  defaultConfig() {
    return useImposterPreferences.getState().lastSettings ?? defaultSettings('undercover', 6)
  },

  validateConfig(config, playerCount) {
    const parsed = gameSettingsSchema.safeParse(config)
    if (!parsed.success) {
      return invalid(parsed.error.issues[0]?.message ?? 'Réglages invalides.', 'invalid_config')
    }
    const result = validateSettings(parsed.data, playerCount)
    return result.ok ? valid : invalid(result.errors[0] ?? 'Réglages invalides.', 'invalid_config')
  },

  /** La composition doit rester atteignable quand la table change de taille. */
  reconcileConfig(config, maxPlayers) {
    const parsed = gameSettingsSchema.safeParse(config)
    return parsed.success ? reconcileSettings(parsed.data, maxPlayers) : config
  },

  /** Anti-répétition sans compte : le client transmet son historique local. */
  startOptions() {
    return { excludeWordIds: useImposterPreferences.getState().wordHistory }
  },

  onConfigSaved(config) {
    const parsed = gameSettingsSchema.safeParse(config)
    if (parsed.success) useImposterPreferences.getState().setLastSettings(parsed.data)
  },
}
