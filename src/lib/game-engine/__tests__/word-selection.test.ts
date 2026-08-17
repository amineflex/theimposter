import { describe, expect, it } from 'vitest'
import { customWordSet, selectWordEntry, toWordSet, type WordPairEntry } from '../word-selection'

const PAIRS: WordPairEntry[] = [
  { id: '1', civilianWord: 'Lion', undercoverWord: 'Tigre', category: 'Animaux', difficulty: 'easy', packs: ['animaux'] },
  { id: '2', civilianWord: 'Plage', undercoverWord: 'Piscine', category: 'Monde', difficulty: 'medium', packs: ['monde'] },
  { id: '3', civilianWord: 'Netflix', undercoverWord: 'YouTube', category: 'Films', difficulty: 'hard', packs: ['films'] },
]

describe('selectWordEntry', () => {
  it('respecte le filtre de pack et de difficulté', () => {
    const { entry } = selectWordEntry(PAIRS, { difficulty: 'easy', packs: ['animaux'], excludeIds: [] })
    expect(entry.id).toBe('1')
  })

  it('évite les entrées récemment jouées', () => {
    const { entry, relaxed } = selectWordEntry(PAIRS, { difficulty: 'all', packs: [], excludeIds: ['1', '2'] })
    expect(entry.id).toBe('3')
    expect(relaxed).toBe(false)
  })

  it('relâche l\'anti-répétition quand le pool est épuisé', () => {
    const { entry, relaxed } = selectWordEntry(PAIRS, {
      difficulty: 'easy',
      packs: ['animaux'],
      excludeIds: ['1'],
    })
    expect(entry.id).toBe('1')
    expect(relaxed).toBe(true)
  })

  it('relâche la difficulté avant le pack', () => {
    const { entry } = selectWordEntry(PAIRS, { difficulty: 'easy', packs: ['films'], excludeIds: [] })
    expect(entry.id).toBe('3')
  })

  it('lève une erreur seulement si le catalogue est vide', () => {
    expect(() => selectWordEntry([], { difficulty: 'all', packs: [], excludeIds: [] })).toThrow(/Aucun mot/)
  })
})

describe('toWordSet', () => {
  it('mappe une paire pour le mode undercover', () => {
    const set = toWordSet(PAIRS[0] as WordPairEntry, 'undercover')
    expect(set).toMatchObject({ civilianWord: 'Lion', undercoverWord: 'Tigre', impostorHint: null })
  })

  it('mappe une entrée pour le mode imposteur', () => {
    const set = toWordSet(
      { id: 'w1', word: 'Girafe', hint: 'Animal', category: 'Animaux', difficulty: 'easy', packs: ['animaux'] },
      'impostor',
    )
    expect(set).toMatchObject({ civilianWord: 'Girafe', undercoverWord: null, impostorHint: 'Animal' })
  })
})

describe('customWordSet', () => {
  it('nettoie les entrées personnalisées', () => {
    expect(customWordSet('impostor', { word: '  Girafe ', hint: ' Animal ' })).toMatchObject({
      civilianWord: 'Girafe',
      impostorHint: 'Animal',
      undercoverWord: null,
      sourceId: null,
    })
    expect(customWordSet('undercover', { word: 'Lion', undercoverWord: 'Tigre' })).toMatchObject({
      civilianWord: 'Lion',
      undercoverWord: 'Tigre',
      impostorHint: null,
    })
  })
})
