import { describe, expect, it } from 'vitest'
import { containsSecret } from '../description-guard'

describe('containsSecret', () => {
  it('refuse une description qui contient le mot exact', () => {
    expect(containsSecret('Ma pizza préférée est la reine', 'pizza')).toBe(true)
  })

  it('ignore la casse et les accents', () => {
    expect(containsSecret('Un CAFÉ le matin', 'cafe')).toBe(true)
    expect(containsSecret('un cafe le matin', 'Café')).toBe(true)
  })

  it('accepte une description qui ne fait que suggérer', () => {
    expect(containsSecret('Ça se mange avec du fromage fondu', 'pizza')).toBe(false)
  })

  it("ne se déclenche pas sur un mot simplement inclus dans un autre", () => {
    // « cartable » contient « car » : ce n'est pas une fuite du mot « car ».
    expect(containsSecret('Je le mets dans mon cartable', 'car')).toBe(false)
  })

  it('détecte un mot composé écrit en entier', () => {
    expect(containsSecret('Je bois un coca cola glacé', 'coca-cola')).toBe(true)
    expect(containsSecret('Je bois un cola glacé', 'coca cola')).toBe(false)
  })

  it('reste permissif si le secret est vide (Mr. White)', () => {
    expect(containsSecret("Je n'ai aucune idée", '')).toBe(false)
  })

  it('détecte le mot malgré la ponctuation', () => {
    expect(containsSecret("C'est un « chat », non ?", 'chat')).toBe(true)
  })
})
