import type { GameManifest } from '@/flexgames/core/game-definition'
import { LetterPopIcon } from './components/game-icon'
import { LetterPopLogo } from './components/game-logo'

export const manifest: GameManifest = {
  id: 'letter-pop',
  slug: 'letter-pop',
  name: 'LetterPop!',
  shortDescription: 'Une lettre. Des catégories. Évite les doublons !',
  description: 'Une lettre. Des catégories. Trouve des réponses valides que personne d’autre n’a !',
  icon: LetterPopIcon,
  logo: LetterPopLogo,
  theme: { primary: 'var(--color-red)', secondary: 'var(--color-blue)', accent: 'var(--color-yellow)' },
  minPlayers: 2,
  maxPlayers: 12,
  supportedModes: { local: false, online: true },
  status: 'available',
  tags: ['party game', 'mots', 'rapidité', 'culture générale'],
  howToPlay: (
    <div className="space-y-2 text-sm font-bold text-ink">
      <p>🔤 Une lettre et 4 à 8 catégories sont communes à tous les joueurs.</p>
      <p>✍️ Remplis tout puis appuie sur « J’ai fini ! » pour lancer les 10 dernières secondes.</p>
      <p>✨ Réponse valide unique : 100 points. Réponse partagée : 50 points.</p>
      <p>⚖️ Les réponses inconnues sont arbitrées rapidement par l’hôte ou par le groupe.</p>
    </div>
  ),
}
