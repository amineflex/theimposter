import type { VoteRecord } from './types'

export interface TallyResult {
  tally: Record<string, number>
  /** Joueurs à égalité en tête. Un seul élément = élimination directe. */
  leaders: string[]
  maxVotes: number
}

/** Compte les votes. Les cibles sans voix n'apparaissent pas dans le tally. */
export function tallyVotes(votes: VoteRecord[]): TallyResult {
  const tally: Record<string, number> = {}
  for (const vote of votes) {
    tally[vote.targetId] = (tally[vote.targetId] ?? 0) + 1
  }
  let maxVotes = 0
  for (const count of Object.values(tally)) {
    if (count > maxVotes) maxVotes = count
  }
  const leaders = Object.entries(tally)
    .filter(([, count]) => count === maxVotes && maxVotes > 0)
    .map(([id]) => id)
    .sort()
  return { tally, leaders, maxVotes }
}

/** Nombre maximum de barrages avant résolution aléatoire (anti-boucle infinie). */
export const MAX_RUNOFFS = 1

export interface VoteValidation {
  ok: boolean
  error?: string
}

export function validateVote(params: {
  voterId: string
  targetId: string
  alivePlayerIds: string[]
  allowedTargets: string[] | null
  alreadyVoted: boolean
}): VoteValidation {
  const { voterId, targetId, alivePlayerIds, allowedTargets, alreadyVoted } = params
  if (!alivePlayerIds.includes(voterId)) {
    return { ok: false, error: 'Seuls les joueurs vivants peuvent voter.' }
  }
  if (alreadyVoted) return { ok: false, error: 'Vous avez déjà voté.' }
  if (voterId === targetId) return { ok: false, error: 'Vous ne pouvez pas voter pour vous-même.' }
  if (!alivePlayerIds.includes(targetId)) {
    return { ok: false, error: 'Cible invalide.' }
  }
  if (allowedTargets && !allowedTargets.includes(targetId)) {
    return { ok: false, error: 'Ce joueur ne fait pas partie du vote de barrage.' }
  }
  return { ok: true }
}

/** Les joueurs autorisés à voter lors d'un barrage sont tous les vivants. */
export function eligibleVoters(alivePlayerIds: string[], runoffCandidates: string[] | null): string[] {
  if (!runoffCandidates) return alivePlayerIds
  // Un candidat au barrage vote aussi, mais pas pour lui-même.
  return alivePlayerIds
}
