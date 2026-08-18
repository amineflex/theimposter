import type { GameDefinition } from '@/flexgames/core/game-definition'
import { manifest } from './manifest'
import { client } from './client'
import { GameScreen } from './components/game-screen'
import { LocalGameScreen } from './local/local-game-screen'
import { LobbySettings, LobbySummary } from './components/lobby-settings'
import { AdminWords } from './admin/words-panel'

/**
 * The Imposter, vu par FlexGames.
 *
 * Tout ce qui suit est le contrat : identité, écrans, logique cliente. Le
 * gameplay (rôles, mots, votes, conditions de victoire) reste à l'intérieur du
 * module et n'est jamais exposé à la plateforme.
 */
export const theImposter: GameDefinition = {
  manifest,
  client,
  admin: { label: 'Mots', Panel: AdminWords },
  ui: {
    GameScreen,
    LocalScreen: LocalGameScreen,
    LobbySettings,
    LobbySummary,
  },
}

export { manifest }
