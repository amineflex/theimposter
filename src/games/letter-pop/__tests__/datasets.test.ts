import { describe, expect, it } from 'vitest'
import { LETTER_POP_DATASETS, LETTER_POP_DATASET_SIZE } from '../data/datasets'
import { validateLetterPopDatasets } from '../data/validate-datasets'
import { LETTER_POP_CATEGORY_IDS } from '../types'

describe('datasets LetterPop', () => {
  it('contient plus de 500 entrées locales propres dans les douze catégories', () => {
    expect(LETTER_POP_DATASET_SIZE).toBeGreaterThan(500)
    expect(Object.keys(LETTER_POP_DATASETS)).toEqual([...LETTER_POP_CATEGORY_IDS])
    expect(LETTER_POP_CATEGORY_IDS.every((categoryId) => LETTER_POP_DATASETS[categoryId].length >= 30)).toBe(true)
    expect(validateLetterPopDatasets()).toEqual([])
  })

  it('connaît les aliases structurants', () => {
    expect(LETTER_POP_DATASETS.country.find((entry) => entry.aliases.includes('USA'))?.canonical).toBe('États-Unis')
    expect(LETTER_POP_DATASETS.animal.find((entry) => entry.canonical === 'Chat')?.aliases).toContain('Chats')
    expect(LETTER_POP_DATASETS.entertainment.some((entry) => entry.canonical === 'The Witcher')).toBe(true)
  })
})
