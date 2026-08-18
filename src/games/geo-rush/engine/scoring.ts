export function normalizeGeoAnswer(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('fr')
    .replace(/[.]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

export function isAcceptedAnswer(answer: string, accepted: readonly string[]): boolean {
  const normalized = normalizeGeoAnswer(answer)
  return accepted.some((candidate) => normalizeGeoAnswer(candidate) === normalized)
}

export function scoreGeoAnswer(responseMs: number, durationSeconds: number, streak: number): number {
  const durationMs = durationSeconds * 1000
  const remainingRatio = Math.max(0, Math.min(1, (durationMs - responseMs) / durationMs))
  const speedScore = 350 + Math.round(650 * remainingRatio)
  const streakBonus = streak >= 5 ? 150 : streak === 4 ? 100 : streak === 3 ? 50 : 0
  return speedScore + streakBonus
}
