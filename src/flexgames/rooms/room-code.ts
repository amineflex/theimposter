/**
 * Codes de room : 6 caractères, sans caractères visuellement ambigus
 * (0/O, 1/I/L, 5/S, 2/Z, 8/B) pour éviter les erreurs de saisie orale.
 */
export const ROOM_CODE_ALPHABET = 'ACDEFGHJKMNPQRTUVWXY34679'
export const ROOM_CODE_LENGTH = 6

export function generateRoomCode(random: () => number = Math.random): string {
  let code = ''
  for (let i = 0; i < ROOM_CODE_LENGTH; i++) {
    code += ROOM_CODE_ALPHABET[Math.floor(random() * ROOM_CODE_ALPHABET.length)]
  }
  return code
}

/** Normalise une saisie utilisateur : majuscules, sans espaces ni tirets. */
export function normalizeRoomCode(input: string): string {
  return input
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, ROOM_CODE_LENGTH)
}

export function isValidRoomCode(input: string): boolean {
  const normalized = normalizeRoomCode(input)
  if (normalized.length !== ROOM_CODE_LENGTH) return false
  return /^[A-Z0-9]{6}$/.test(normalized)
}
