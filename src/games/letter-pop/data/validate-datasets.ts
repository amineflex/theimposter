import { LETTER_POP_CATEGORY_IDS } from '../types'
import { normalizeForCategory } from '../engine/normalization'
import { LETTER_POP_DATASETS } from './datasets'

export function validateLetterPopDatasets(): string[] {
  const errors: string[] = []
  const ids = new Set<string>()
  for (const categoryId of LETTER_POP_CATEGORY_IDS) {
    const canonicalKeys = new Set<string>()
    const identityOwners = new Map<string, string>()
    for (const entry of LETTER_POP_DATASETS[categoryId]) {
      if (ids.has(entry.id)) errors.push(`ID dupliqué : ${entry.id}`)
      ids.add(entry.id)
      if (entry.categoryId !== categoryId) errors.push(`${entry.id}: catégorie invalide`)
      if (!entry.canonical.trim()) errors.push(`${entry.id}: canonical vide`)
      if (!['easy', 'normal', 'hard'].includes(entry.difficulty)) errors.push(`${entry.id}: difficulté invalide`)
      const canonical = normalizeForCategory(entry.canonical, categoryId)
      if (!canonical) errors.push(`${entry.id}: aucune lettre exploitable`)
      if (canonicalKeys.has(canonical)) errors.push(`${categoryId}: collision canonical « ${canonical} »`)
      canonicalKeys.add(canonical)
      const aliases = entry.aliases.map((alias) => normalizeForCategory(alias, categoryId))
      if (aliases.some((alias) => !alias)) errors.push(`${entry.id}: alias vide`)
      if (new Set(aliases).size !== aliases.length) errors.push(`${entry.id}: alias dupliqué`)
      for (const identity of [canonical, ...aliases]) {
        const owner = identityOwners.get(identity)
        if (owner && owner !== entry.id) errors.push(`${categoryId}: identité « ${identity} » partagée par ${owner} et ${entry.id}`)
        identityOwners.set(identity, entry.id)
      }
    }
  }
  return errors
}
