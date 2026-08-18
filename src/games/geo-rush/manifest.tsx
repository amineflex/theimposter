import type { GameManifest } from '@/flexgames/core/game-definition'
import { GeoRushIcon } from './components/game-icon'
import { GeoRushLogo } from './components/game-logo'

export const manifest: GameManifest = {
  id: 'geo-rush',
  slug: 'geo-rush',
  name: 'GeoRush',
  shortDescription: 'Géographie • Rapidité',
  description: 'Repère les pays, reconnais les drapeaux et trouve les capitales avant les autres.',
  icon: GeoRushIcon,
  logo: GeoRushLogo,
  theme: { primary: 'var(--color-blue)', secondary: 'var(--color-green)', accent: 'var(--color-yellow)' },
  minPlayers: 2,
  maxPlayers: 12,
  supportedModes: { local: false, online: true },
  status: 'available',
  tags: ['géographie', 'quiz', 'rapidité'],
  howToPlay: (
    <div className="space-y-2 text-sm font-bold text-ink">
      <p>🌍 Réponds aux questions de cartes, drapeaux, capitales et silhouettes.</p>
      <p>⚡ Une bonne réponse rapide rapporte jusqu’à 1 000 points.</p>
      <p>🔥 Enchaîne les bonnes réponses pour gagner un bonus de série.</p>
      <p>🏆 Le classement apparaît toutes les 5 questions, puis place au podium final.</p>
    </div>
  ),
}
