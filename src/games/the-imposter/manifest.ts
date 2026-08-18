import type { GameManifest } from '@/flexgames/core/game-definition'
import { MAX_PLAYERS, MIN_PLAYERS } from './engine/types'
import { ImposterIcon } from './components/game-icon'
import { GameLogo } from './components/game-logo'

/**
 * Carte d'identité de The Imposter dans le catalogue FlexGames.
 * Tout ce que la plateforme sait de ce jeu tient ici.
 */
export const manifest: GameManifest = {
  id: 'the-imposter',
  slug: 'the-imposter',

  name: 'The Imposter',
  shortDescription: 'Un mot pour tous, sauf pour lui. Démasquez-le.',
  description:
    "Tout le monde partage le même mot secret… sauf un joueur. Décrivez sans jamais " +
    'le prononcer, écoutez les autres, et votez pour éliminer le menteur avant qu\'il ne gagne.',

  icon: ImposterIcon,
  logo: GameLogo,
  theme: {
    primary: 'var(--color-red)',
    secondary: 'var(--color-yellow)',
    accent: 'var(--color-blue)',
  },

  minPlayers: MIN_PLAYERS,
  maxPlayers: MAX_PLAYERS,

  supportedModes: { local: true, online: true },
  status: 'available',
  tags: ['bluff', 'discussion', 'vote'],
}
