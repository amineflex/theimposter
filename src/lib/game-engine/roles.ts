import {
  MAX_PLAYERS,
  MIN_PLAYERS,
  type GameMode,
  type GameSettings,
  type Role,
  type Rng,
} from './types'

/**
 * Métadonnées de rôle. Ajouter un rôle plus tard = ajouter une entrée ici
 * (+ sa règle de victoire dans `win.ts`) sans toucher au reste du moteur.
 */
export interface RoleMeta {
  role: Role
  /** Camp : les civils vs les intrus. */
  team: 'civilians' | 'intruders'
  /** Le rôle reçoit-il un mot ? */
  receivesWord: boolean
  /** Le rôle reçoit-il un indice au lieu du mot ? */
  receivesHint: boolean
  /** Modes dans lesquels ce rôle peut apparaître. */
  modes: GameMode[]
}

export const ROLE_META: Record<Role, RoleMeta> = {
  civilian: {
    role: 'civilian',
    team: 'civilians',
    receivesWord: true,
    receivesHint: false,
    modes: ['impostor', 'undercover'],
  },
  impostor: {
    role: 'impostor',
    team: 'intruders',
    receivesWord: false,
    receivesHint: true,
    modes: ['impostor'],
  },
  undercover: {
    role: 'undercover',
    team: 'intruders',
    receivesWord: true,
    receivesHint: false,
    modes: ['undercover'],
  },
  mr_white: {
    role: 'mr_white',
    team: 'intruders',
    receivesWord: false,
    receivesHint: false,
    modes: ['undercover'],
  },
}

export function isIntruder(role: Role): boolean {
  return ROLE_META[role].team === 'intruders'
}

export const MAX_IMPOSTORS = 2
export const MAX_UNDERCOVER = 3
export const MAX_MR_WHITE = 1

export interface Composition {
  civilians: number
  impostors: number
  undercover: number
  mrWhite: number
}

/**
 * Composition recommandée pour un nombre de joueurs donné.
 *
 * Règle retenue : le nombre d'intrus vise ~1/4 de la table (arrondi au plus
 * proche, borné à 1 minimum et à `floor((n-1)/2)` maximum pour garantir que les
 * civils restent majoritaires au démarrage).
 *
 * - Mode Imposteur : tous les intrus sont des imposteurs.
 * - Mode Undercover : à partir de 5 joueurs, un intrus devient Mr. White ;
 *   les autres sont des Undercover.
 */
export function recommendedComposition(mode: GameMode, playerCount: number): Composition {
  const n = clamp(playerCount, MIN_PLAYERS, MAX_PLAYERS)
  const maxIntruders = maxIntrudersFor(n)
  const intruders = clamp(Math.round(n / 4), 1, maxIntruders)

  if (mode === 'impostor') {
    // Le mode Imposteur reste lisible avec 1 imposteur, 2 sur les grandes tables.
    const impostors = clamp(intruders, 1, Math.min(maxIntruders, MAX_IMPOSTORS))
    return { civilians: n - impostors, impostors, undercover: 0, mrWhite: 0 }
  }

  // Mr. White n'apparaît qu'à partir de 5 joueurs : à 4 il déséquilibre la table.
  const mrWhite = n >= 5 ? 1 : 0
  const undercover = clamp(intruders - mrWhite, 1, Math.max(1, maxIntruders - mrWhite))
  return {
    civilians: n - undercover - mrWhite,
    impostors: 0,
    undercover,
    mrWhite,
  }
}

/**
 * Nombre maximum d'intrus tolérés : les civils doivent être strictement
 * majoritaires au début de la partie, sinon les intrus gagnent immédiatement.
 */
export function maxIntrudersFor(playerCount: number): number {
  return Math.max(1, Math.floor((playerCount - 1) / 2))
}

export interface ValidationResult {
  ok: boolean
  errors: string[]
}

/** Valide une configuration de partie pour un nombre de joueurs donné. */
export function validateSettings(settings: GameSettings, playerCount: number): ValidationResult {
  const errors: string[] = []

  if (playerCount < MIN_PLAYERS) errors.push(`Il faut au moins ${MIN_PLAYERS} joueurs.`)
  if (playerCount > MAX_PLAYERS) errors.push(`Il ne peut pas y avoir plus de ${MAX_PLAYERS} joueurs.`)

  const composition = compositionFromSettings(settings, playerCount)
  const intruders = composition.impostors + composition.undercover + composition.mrWhite

  if (settings.mode === 'impostor') {
    if (settings.impostorCount < 1) errors.push('Il faut au moins 1 imposteur.')
    if (settings.undercoverCount > 0 || settings.mrWhiteCount > 0) {
      errors.push('Les rôles Undercover et Mr. White ne sont pas disponibles en mode Imposteur.')
    }
    if (settings.impostorCount > MAX_IMPOSTORS) errors.push(`Au maximum ${MAX_IMPOSTORS} imposteurs.`)
  } else {
    if (settings.impostorCount > 0) {
      errors.push("Le rôle Imposteur n'est pas disponible en mode Undercover.")
    }
    if (intruders < 1) errors.push('Il faut au moins 1 Undercover ou 1 Mr. White.')
    if (settings.mrWhiteCount > MAX_MR_WHITE) errors.push(`Au maximum ${MAX_MR_WHITE} Mr. White.`)
    if (settings.undercoverCount > MAX_UNDERCOVER) {
      errors.push(`Au maximum ${MAX_UNDERCOVER} Undercover.`)
    }
  }

  if (playerCount >= MIN_PLAYERS && intruders > maxIntrudersFor(playerCount)) {
    errors.push(
      `Trop de rôles spéciaux : ${maxIntrudersFor(playerCount)} maximum pour ${playerCount} joueurs.`,
    )
  }
  if (composition.civilians < 1) errors.push('Il faut au moins 1 civil.')
  if (settings.impostorCount < 0 || settings.undercoverCount < 0 || settings.mrWhiteCount < 0) {
    errors.push('Configuration de rôles invalide.')
  }

  return { ok: errors.length === 0, errors }
}

export function compositionFromSettings(settings: GameSettings, playerCount: number): Composition {
  if (settings.mode === 'impostor') {
    return {
      civilians: playerCount - settings.impostorCount,
      impostors: settings.impostorCount,
      undercover: 0,
      mrWhite: 0,
    }
  }
  return {
    civilians: playerCount - settings.undercoverCount - settings.mrWhiteCount,
    impostors: 0,
    undercover: settings.undercoverCount,
    mrWhite: settings.mrWhiteCount,
  }
}

/** Liste des rôles à distribuer, dans l'ordre canonique. */
export function roleBag(composition: Composition): Role[] {
  const bag: Role[] = []
  for (let i = 0; i < composition.impostors; i++) bag.push('impostor')
  for (let i = 0; i < composition.undercover; i++) bag.push('undercover')
  for (let i = 0; i < composition.mrWhite; i++) bag.push('mr_white')
  for (let i = 0; i < composition.civilians; i++) bag.push('civilian')
  return bag
}

export interface AssignmentInput {
  players: { id: string; name: string }[]
  composition: Composition
  /**
   * Historique récent : pour chaque joueur, nombre de parties consécutives
   * récentes où il a eu un rôle spécial (plus récent en premier).
   */
  recentSpecialCounts?: Record<string, number>
  rng?: Rng
}

export interface Assignment {
  playerId: string
  role: Role
}

/**
 * Attribution des rôles avec équité pondérée.
 *
 * Chaque joueur reçoit un poids `1 / (1 + 1.5 * rôles spéciaux récents)`.
 * Les rôles spéciaux sont tirés sans remise par échantillonnage pondéré : un
 * joueur qui vient d'être imposteur a moins de chances de l'être à nouveau,
 * mais cela reste possible — l'attribution n'est jamais prédictible.
 */
export function assignRoles(input: AssignmentInput): Assignment[] {
  const rng = input.rng ?? Math.random
  const recent = input.recentSpecialCounts ?? {}
  const specials = roleBag(input.composition).filter((r) => r !== 'civilian')

  const pool = input.players.map((p) => ({
    id: p.id,
    weight: 1 / (1 + 1.5 * Math.max(0, recent[p.id] ?? 0)),
  }))

  const assignments = new Map<string, Role>()
  for (const role of shuffle(specials, rng)) {
    const picked = weightedPick(pool, rng)
    if (!picked) break
    assignments.set(picked, role)
    const idx = pool.findIndex((p) => p.id === picked)
    if (idx >= 0) pool.splice(idx, 1)
  }

  return input.players.map((p) => ({
    playerId: p.id,
    role: assignments.get(p.id) ?? 'civilian',
  }))
}

function weightedPick(pool: { id: string; weight: number }[], rng: Rng): string | null {
  if (pool.length === 0) return null
  const total = pool.reduce((sum, p) => sum + p.weight, 0)
  if (total <= 0) return pool[Math.floor(rng() * pool.length)]?.id ?? null
  let target = rng() * total
  for (const p of pool) {
    target -= p.weight
    if (target <= 0) return p.id
  }
  return pool[pool.length - 1]?.id ?? null
}

/** Mélange de Fisher-Yates, non destructif. */
export function shuffle<T>(items: readonly T[], rng: Rng = Math.random): T[] {
  const out = items.slice()
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    const a = out[i] as T
    const b = out[j] as T
    out[i] = b
    out[j] = a
  }
  return out
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}
