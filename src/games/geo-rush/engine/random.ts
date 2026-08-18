/** PRNG Mulberry32 : petit, stable et déterministe pour une seed donnée. */
export function seededRandom(seed: string): () => number {
  let value = 2166136261
  for (let index = 0; index < seed.length; index += 1) {
    value ^= seed.charCodeAt(index)
    value = Math.imul(value, 16777619)
  }
  return () => {
    value += 0x6d2b79f5
    let output = value
    output = Math.imul(output ^ (output >>> 15), output | 1)
    output ^= output + Math.imul(output ^ (output >>> 7), output | 61)
    return ((output ^ (output >>> 14)) >>> 0) / 4294967296
  }
}

export function shuffle<T>(values: readonly T[], random: () => number): T[] {
  const result = [...values]
  for (let index = result.length - 1; index > 0; index -= 1) {
    const other = Math.floor(random() * (index + 1))
    const current = result[index]
    result[index] = result[other] as T
    result[other] = current as T
  }
  return result
}
