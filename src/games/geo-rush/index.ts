import type { GameDefinition } from '@/flexgames/core/game-definition'
import { client } from './client'
import { GameScreen } from './components/game-screen'
import { LobbySettings, LobbySummary } from './components/lobby-settings'
import { manifest } from './manifest'

export const geoRush: GameDefinition = {
  manifest,
  client,
  ui: { GameScreen, LobbySettings, LobbySummary },
}

export { manifest }
