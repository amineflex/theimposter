import { describe, expect, it } from 'vitest'
import { MIN_PLAYERS } from '../types'
import {
  assignRoles,
  compositionFromSettings,
  maxIntrudersFor,
  recommendedComposition,
  roleBag,
  validateSettings,
} from '../roles'
import { defaultSettings } from '../engine'
import type { GameSettings } from '../types'

function makePlayers(count: number) {
  return Array.from({ length: count }, (_, i) => ({ id: `p${i + 1}`, name: `Joueur ${i + 1}` }))
}

/** RNG déterministe (LCG) pour rendre les tests reproductibles. */
function seededRng(seed = 42) {
  let state = seed
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296
    return state / 4294967296
  }
}

describe('recommendedComposition', () => {
  it('respecte les compositions de référence en mode undercover', () => {
    expect(recommendedComposition('undercover', 3)).toMatchObject({ civilians: 2, undercover: 1, mrWhite: 0 })
    expect(recommendedComposition('undercover', 4)).toMatchObject({ civilians: 3, undercover: 1, mrWhite: 0 })
    expect(recommendedComposition('undercover', 5)).toMatchObject({ civilians: 3, undercover: 1, mrWhite: 1 })
    expect(recommendedComposition('undercover', 8)).toMatchObject({ civilians: 6, undercover: 1, mrWhite: 1 })
    expect(recommendedComposition('undercover', 12)).toMatchObject({ civilians: 9, undercover: 2, mrWhite: 1 })
  })

  it('limite les imposteurs à 2 en mode imposteur', () => {
    expect(recommendedComposition('impostor', 3).impostors).toBe(1)
    expect(recommendedComposition('impostor', 4).impostors).toBe(1)
    expect(recommendedComposition('impostor', 12).impostors).toBe(2)
  })

  it('garde toujours les civils majoritaires', () => {
    for (let n = MIN_PLAYERS; n <= 12; n++) {
      for (const mode of ['impostor', 'undercover'] as const) {
        const c = recommendedComposition(mode, n)
        const intruders = c.impostors + c.undercover + c.mrWhite
        expect(c.civilians + intruders).toBe(n)
        expect(intruders).toBeGreaterThanOrEqual(1)
        expect(intruders).toBeLessThan(c.civilians)
        expect(intruders).toBeLessThanOrEqual(maxIntrudersFor(n))
      }
    }
  })
})

describe('validateSettings', () => {
  const base = (over: Partial<GameSettings> = {}): GameSettings => ({
    ...defaultSettings('undercover', 6),
    ...over,
  })

  it('refuse moins de 3 joueurs et plus de 12', () => {
    expect(validateSettings(base(), 2).ok).toBe(false)
    expect(validateSettings(base(), 13).ok).toBe(false)
    // 3 joueurs : 2 civils + 1 intrus, la partie reste jouable.
    expect(validateSettings(base(recommendedToSettings('undercover', 3)), 3).ok).toBe(true)
  })

  it('accepte une configuration recommandée pour chaque taille', () => {
    for (let n = MIN_PLAYERS; n <= 12; n++) {
      expect(validateSettings(base(recommendedToSettings('undercover', n)), n).ok).toBe(true)
      expect(validateSettings(base(recommendedToSettings('impostor', n)), n).ok).toBe(true)
    }
  })

  it('refuse trop de rôles spéciaux', () => {
    const result = validateSettings(base({ undercoverCount: 3, mrWhiteCount: 1 }), 4)
    expect(result.ok).toBe(false)
    expect(result.errors.join(' ')).toContain('Trop de rôles spéciaux')
  })

  it('refuse zéro imposteur en mode imposteur', () => {
    expect(validateSettings(base({ mode: 'impostor', impostorCount: 0, undercoverCount: 0, mrWhiteCount: 0 }), 6).ok).toBe(
      false,
    )
  })

  it('refuse un mélange de rôles entre les deux modes', () => {
    expect(
      validateSettings(base({ mode: 'impostor', impostorCount: 1, undercoverCount: 1, mrWhiteCount: 0 }), 6).ok,
    ).toBe(false)
    expect(
      validateSettings(base({ mode: 'undercover', impostorCount: 1, undercoverCount: 1, mrWhiteCount: 0 }), 6).ok,
    ).toBe(false)
  })

  function recommendedToSettings(mode: 'impostor' | 'undercover', n: number): Partial<GameSettings> {
    const c = recommendedComposition(mode, n)
    return { mode, impostorCount: c.impostors, undercoverCount: c.undercover, mrWhiteCount: c.mrWhite }
  }
})

describe('assignRoles', () => {
  it('distribue exactement le nombre de rôles demandé', () => {
    const composition = { civilians: 6, impostors: 0, undercover: 1, mrWhite: 1 }
    const assignments = assignRoles({ players: makePlayers(8), composition, rng: seededRng() })
    expect(assignments).toHaveLength(8)
    expect(assignments.filter((a) => a.role === 'undercover')).toHaveLength(1)
    expect(assignments.filter((a) => a.role === 'mr_white')).toHaveLength(1)
    expect(assignments.filter((a) => a.role === 'civilian')).toHaveLength(6)
  })

  it("n'attribue jamais deux rôles au même joueur", () => {
    const composition = { civilians: 8, impostors: 0, undercover: 3, mrWhite: 1 }
    const assignments = assignRoles({ players: makePlayers(12), composition, rng: seededRng(7) })
    expect(new Set(assignments.map((a) => a.playerId)).size).toBe(12)
  })

  it('réduit fortement la probabilité de re-tirer un joueur au rôle récent', () => {
    const composition = { civilians: 5, impostors: 1, undercover: 0, mrWhite: 0 }
    const players = makePlayers(6)
    const rng = seededRng(1234)
    let p1Special = 0
    const iterations = 2000
    for (let i = 0; i < iterations; i++) {
      const assignments = assignRoles({
        players,
        composition,
        recentSpecialCounts: { p1: 2 },
        rng,
      })
      if (assignments.find((a) => a.playerId === 'p1')?.role === 'impostor') p1Special++
    }
    const ratio = p1Special / iterations
    // Poids p1 = 1/4 contre 1 pour les 5 autres => ~4.8% au lieu de 16.7%.
    expect(ratio).toBeGreaterThan(0.01)
    expect(ratio).toBeLessThan(0.1)
  })

  it('reste aléatoire : le rôle spécial ne tombe pas toujours sur le même joueur', () => {
    const composition = { civilians: 5, impostors: 1, undercover: 0, mrWhite: 0 }
    const rng = seededRng(99)
    const winners = new Set<string>()
    for (let i = 0; i < 200; i++) {
      const assignments = assignRoles({ players: makePlayers(6), composition, rng })
      winners.add(assignments.find((a) => a.role === 'impostor')?.playerId ?? '')
    }
    expect(winners.size).toBe(6)
  })
})

describe('roleBag / compositionFromSettings', () => {
  it('produit un sac cohérent', () => {
    const bag = roleBag({ civilians: 2, impostors: 1, undercover: 1, mrWhite: 1 })
    expect(bag).toHaveLength(5)
    expect(bag.filter((r) => r === 'civilian')).toHaveLength(2)
  })

  it('déduit la composition depuis les réglages', () => {
    expect(compositionFromSettings(defaultSettings('impostor', 6), 6).impostors).toBeGreaterThanOrEqual(1)
  })
})
