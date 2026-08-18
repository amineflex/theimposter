import type { GameDefinition } from '@/flexgames/core/game-definition'
import { client } from './client'
import { GameScreen } from './components/game-screen'
import { LobbySettings, LobbySummary } from './components/lobby-settings'
import { manifest } from './manifest'
import { AdminCountries } from './admin/countries-panel'

export const geoRush: GameDefinition = {
  manifest,
  client,
  admin: { label: 'Pays', Panel: AdminCountries },
  ui: { GameScreen, LobbySettings, LobbySummary },
}

export { manifest }
