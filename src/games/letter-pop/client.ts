import type { GameClientModule } from '@/flexgames/core/game-definition'
import { invalid, valid } from '@/flexgames/core/types'
import type { LetterPopConfig } from './types'
import { letterPopConfigSchema } from './validations'

export const DEFAULT_LETTER_POP_CONFIG: LetterPopConfig = {
  roundCount: 5,
  durationSeconds: 60,
  categoryCount: 6,
  preset: 'mix',
  difficulty: 'normal',
  customLetter: null,
  customCategories: ['first-name', 'country', 'city', 'animal', 'job', 'object'],
}

export const client: GameClientModule = {
  defaultConfig: () => DEFAULT_LETTER_POP_CONFIG,
  validateConfig(config, playerCount) {
    const parsed = letterPopConfigSchema.safeParse(config)
    if (!parsed.success) return invalid(parsed.error.issues[0]?.message ?? 'Réglages LetterPop invalides.', 'invalid_config')
    if (playerCount < 2 || playerCount > 12) return invalid('LetterPop! se joue de 2 à 12 joueurs.', 'invalid_players')
    return valid
  },
}
