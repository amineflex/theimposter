import { describe, expect, it } from 'vitest'
import { evaluateLetterPopAnswer, matchAnswerToDataset } from '../engine/matching'
import {
  answerMatchesLetter,
  areLetterPopAnswersComplete,
  duplicateComparisonKey,
  normalizeLetterPopText,
} from '../engine/normalization'

describe('normalisation LetterPop', () => {
  it('ignore casse, accents, ponctuation et espaces superflus', () => {
    expect(normalizeLetterPopText('  ÉTATS--Unis  ')).toBe('etats unis')
    expect(answerMatchesLetter('Éléphant', 'E', 'animal')).toBe(true)
  })

  it('gère les articles de titre et tous les composants d’une célébrité', () => {
    expect(answerMatchesLetter('The Witcher', 'W', 'entertainment')).toBe(true)
    expect(answerMatchesLetter('Kylian Mbappé', 'M', 'celebrity')).toBe(true)
    expect(answerMatchesLetter('Lionel Messi', 'M', 'celebrity')).toBe(true)
    expect(answerMatchesLetter('Kylian Mbappé', 'Z', 'celebrity')).toBe(false)
  })

  it('regroupe les pluriels triviaux et protège le bouton J’ai fini', () => {
    expect(duplicateComparisonKey('Chat', 'animal')).toBe(duplicateComparisonKey('Chats', 'animal'))
    expect(areLetterPopAnswersComplete(['animal', 'city'], { animal: 'Chat', city: '  ' })).toBe(false)
    expect(areLetterPopAnswersComplete(['animal', 'city'], { animal: 'Chat', city: 'Caen' })).toBe(true)
  })
})

describe('matching LetterPop', () => {
  it('distingue exact, alias, fuzzy et inconnu', () => {
    expect(matchAnswerToDataset('Bruxelles', 'city')).toMatchObject({ status: 'exact', canonical: 'Bruxelles' })
    expect(matchAnswerToDataset('USA', 'country')).toMatchObject({ status: 'alias', canonical: 'États-Unis' })
    expect(matchAnswerToDataset('Bruxeelles', 'city')).toMatchObject({ status: 'fuzzy', canonical: 'Bruxelles' })
    expect(matchAnswerToDataset('Brxllzzz', 'city')).toEqual({ status: 'unknown' })
  })

  it('refuse les fautes ambiguës sur les mots courts', () => {
    expect(matchAnswerToDataset('Lyn', 'city').status).toBe('unknown')
  })

  it('applique la lettre avant le dataset et envoie l’inconnu à arbitrer', () => {
    expect(evaluateLetterPopAnswer('Mouton', 'animal', 'M')).toMatchObject({ status: 'exact', valid: true })
    expect(evaluateLetterPopAnswer('Mouton', 'animal', 'A')).toMatchObject({ status: 'wrong-letter', valid: false })
    expect(evaluateLetterPopAnswer('Mégalodon', 'animal', 'M')).toMatchObject({ status: 'unknown', valid: null })
    expect(evaluateLetterPopAnswer('   ', 'animal', 'M')).toMatchObject({ status: 'empty', valid: false })
  })
})
