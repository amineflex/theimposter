import { describe, expect, it } from 'vitest'
import { IMPOSTOR_WORDS } from '../impostor-words'
import { WORD_PAIRS } from '../word-pairs'
import { PACK_SLUGS } from '../packs'
import { normalizeAnswer } from '@/lib/game-engine/mr-white'

describe('base de mots', () => {
  it('contient au moins 500 entrées jouables', () => {
    expect(IMPOSTOR_WORDS.length + WORD_PAIRS.length).toBeGreaterThanOrEqual(500)
  })

  it("n'a aucun identifiant en doublon", () => {
    const wordIds = IMPOSTOR_WORDS.map((w) => w.id)
    const pairIds = WORD_PAIRS.map((p) => p.id)
    expect(new Set(wordIds).size).toBe(wordIds.length)
    expect(new Set(pairIds).size).toBe(pairIds.length)
  })

  it('utilise uniquement des packs déclarés', () => {
    for (const entry of [...IMPOSTOR_WORDS, ...WORD_PAIRS]) {
      expect(entry.packs.length).toBeGreaterThan(0)
      for (const pack of entry.packs) {
        expect(PACK_SLUGS, `pack inconnu « ${pack} » sur ${entry.id}`).toContain(pack)
      }
    }
  })

  it('remplit chaque pack avec assez de mots pour jouer', () => {
    for (const pack of PACK_SLUGS) {
      const words = IMPOSTOR_WORDS.filter((w) => w.packs.includes(pack))
      const pairs = WORD_PAIRS.filter((p) => p.packs.includes(pack))
      expect(words.length, `pack ${pack} (mode imposteur)`).toBeGreaterThanOrEqual(20)
      expect(pairs.length, `pack ${pack} (mode undercover)`).toBeGreaterThanOrEqual(20)
    }
  })

  it('couvre les trois niveaux de difficulté dans chaque mode', () => {
    for (const difficulty of ['easy', 'medium', 'hard'] as const) {
      expect(IMPOSTOR_WORDS.filter((w) => w.difficulty === difficulty).length).toBeGreaterThan(10)
      expect(WORD_PAIRS.filter((p) => p.difficulty === difficulty).length).toBeGreaterThan(10)
    }
  })

  describe('mode Imposteur', () => {
    it('donne un indice non vide, différent du mot et non contenu dans le mot', () => {
      for (const entry of IMPOSTOR_WORDS) {
        expect(entry.hint.trim().length, entry.id).toBeGreaterThan(2)
        const word = normalizeAnswer(entry.word)
        const hint = normalizeAnswer(entry.hint)
        expect(hint, entry.id).not.toBe(word)
        // L'indice ne doit pas contenir le mot secret (fuite directe).
        expect(hint.split(' ').includes(word), `${entry.id} : l'indice révèle le mot`).toBe(false)
      }
    })

    it('a un mot et une catégorie non vides', () => {
      for (const entry of IMPOSTOR_WORDS) {
        expect(entry.word.trim().length).toBeGreaterThan(1)
        expect(entry.category.trim().length).toBeGreaterThan(1)
      }
    })
  })

  describe('mode Undercover', () => {
    it('a deux mots distincts par paire', () => {
      for (const pair of WORD_PAIRS) {
        expect(normalizeAnswer(pair.civilianWord), pair.id).not.toBe(
          normalizeAnswer(pair.undercoverWord),
        )
        expect(pair.civilianWord.trim().length).toBeGreaterThan(1)
        expect(pair.undercoverWord.trim().length).toBeGreaterThan(1)
      }
    })

    it("n'a pas deux paires avec le même mot civil ET le même mot undercover inversés", () => {
      const seen = new Set<string>()
      for (const pair of WORD_PAIRS) {
        const key = [normalizeAnswer(pair.civilianWord), normalizeAnswer(pair.undercoverWord)]
          .sort()
          .join('|')
        expect(seen.has(key), `paire dupliquée : ${pair.id}`).toBe(false)
        seen.add(key)
      }
    })
  })

  it('ne déclare que des synonymes normalisés dans acceptedAnswers', () => {
    for (const entry of [...IMPOSTOR_WORDS, ...WORD_PAIRS]) {
      for (const answer of entry.acceptedAnswers ?? []) {
        expect(answer, `${entry.id} : « ${answer} » doit être en minuscules sans accent`).toBe(
          normalizeAnswer(answer),
        )
      }
    }
  })
})
