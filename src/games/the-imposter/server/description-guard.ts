import { normalizeAnswer } from '@/games/the-imposter/engine/mr-white'

/**
 * Détecte qu'une description contient le mot secret de son auteur.
 *
 * Écrire son mot ruine la partie pour tout le monde : le serveur refuse la
 * description plutôt que de la publier. Module pur (aucune dépendance serveur)
 * afin d'être testable et réutilisable côté client si besoin.
 */
export function containsSecret(body: string, secret: string): boolean {
  const needle = normalizeAnswer(secret)
  if (!needle) return false
  const normalized = normalizeAnswer(body)
  // Mot composé (« coca cola ») : on cherche la séquence complète.
  if (needle.includes(' ')) return normalized.includes(needle)
  return normalized.split(' ').includes(needle)
}
