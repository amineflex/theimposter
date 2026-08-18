/**
 * Normalisation et validation de la devinette finale de Mr. White.
 *
 * Aucune validation sémantique / IA : uniquement une comparaison normalisée
 * (casse, accents, ponctuation, espaces) contre le mot des civils et la liste
 * de réponses acceptées configurée en base.
 */

/** Retire les accents, la ponctuation et normalise les espaces et la casse. */
export function normalizeAnswer(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // diacritiques
    .toLowerCase()
    .replace(/[’'`]/g, ' ')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ')
}

/**
 * Compare une devinette au mot attendu et aux synonymes explicitement acceptés.
 * Tolère également l'article français en tête ("le lion" ≈ "lion").
 */
export function isCorrectGuess(
  guess: string,
  civilianWord: string,
  acceptedAnswers: readonly string[] = [],
): boolean {
  const candidate = stripArticle(normalizeAnswer(guess))
  if (!candidate) return false
  const targets = [civilianWord, ...acceptedAnswers]
    .filter((t): t is string => typeof t === 'string' && t.length > 0)
    .map((t) => stripArticle(normalizeAnswer(t)))
  return targets.includes(candidate)
}

const ARTICLES = ['le', 'la', 'les', 'un', 'une', 'des', 'l', 'du', 'de la', 'de']

function stripArticle(value: string): string {
  for (const article of ARTICLES) {
    const prefix = `${article} `
    if (value.startsWith(prefix)) return value.slice(prefix.length).trim()
  }
  return value
}
