import { describe, expect, it } from 'vitest'
import { isCorrectGuess, normalizeAnswer } from '../mr-white'

describe('normalizeAnswer', () => {
  it('normalise casse, accents, espaces et ponctuation', () => {
    expect(normalizeAnswer('  PIZZA ')).toBe('pizza')
    expect(normalizeAnswer('Éléphant')).toBe('elephant')
    expect(normalizeAnswer('Coca-Cola')).toBe('coca cola')
    expect(normalizeAnswer('coca   cola !!')).toBe('coca cola')
    expect(normalizeAnswer("L'avion")).toBe('l avion')
  })
})

describe('isCorrectGuess', () => {
  it('accepte les variantes de casse et d\'accents', () => {
    for (const guess of ['PIZZA', 'Pizza', 'pizza', ' pizza ', 'pîzza'.normalize('NFC')]) {
      expect(isCorrectGuess(guess, 'Pizza')).toBe(true)
    }
  })

  it('accepte les synonymes configurés', () => {
    const accepted = ['telephone', 'smartphone', 'portable']
    expect(isCorrectGuess('Smartphone', 'Téléphone', accepted)).toBe(true)
    expect(isCorrectGuess('PORTABLE', 'Téléphone', accepted)).toBe(true)
    expect(isCorrectGuess('téléphone', 'Téléphone', accepted)).toBe(true)
    expect(isCorrectGuess('tablette', 'Téléphone', accepted)).toBe(false)
  })

  it('tolère un article en tête', () => {
    expect(isCorrectGuess('le lion', 'Lion')).toBe(true)
    expect(isCorrectGuess('La plage', 'Plage')).toBe(true)
    expect(isCorrectGuess("l'avion", 'Avion')).toBe(true)
  })

  it('refuse une réponse vide ou fantaisiste', () => {
    expect(isCorrectGuess('', 'Lion')).toBe(false)
    expect(isCorrectGuess('   ', 'Lion')).toBe(false)
    expect(isCorrectGuess('!!!', 'Lion')).toBe(false)
    expect(isCorrectGuess('tigre', 'Lion')).toBe(false)
  })

  it('ne fait pas de correspondance partielle', () => {
    expect(isCorrectGuess('lio', 'Lion')).toBe(false)
    expect(isCorrectGuess('lions', 'Lion')).toBe(false)
  })
})
