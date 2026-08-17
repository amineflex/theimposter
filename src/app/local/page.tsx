import type { Metadata } from 'next'
import { LocalGameScreen } from '@/features/local-game/local-game-screen'

export const metadata: Metadata = {
  title: 'Partie locale',
  description:
    'Jouez à The Imposter à plusieurs sur un seul téléphone. Fonctionne entièrement hors connexion.',
}

export default function LocalPage() {
  return <LocalGameScreen />
}
