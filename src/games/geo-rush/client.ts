import type { GameClientModule } from '@/flexgames/core/game-definition'
import { invalid, valid } from '@/flexgames/core/types'
import { geoConfigSchema } from './validations'
import type { GeoConfig } from './types'

export const DEFAULT_GEO_CONFIG: GeoConfig = { questionCount: 15, durationSeconds: 15, difficulty: 'normal', region: 'world' }

export const client: GameClientModule = {
  defaultConfig: () => DEFAULT_GEO_CONFIG,
  validateConfig(config, playerCount) {
    if (!geoConfigSchema.safeParse(config).success) return invalid('Réglages GeoRush invalides.', 'invalid_config')
    if (playerCount < 2 || playerCount > 12) return invalid('GeoRush se joue de 2 à 12 joueurs.', 'invalid_players')
    return valid
  },
}
