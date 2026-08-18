import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Le store local persiste des préférences via `localStorage` : on le stubbe
 * avant d'importer les modules pour que zustand/persist fonctionne en Node.
 */
// zustand/persist désactive son stockage hors navigateur et le signale sur la
// console : on masque ce bruit, sans rapport avec ce qui est testé ici.
vi.spyOn(console, 'error').mockImplementation(() => {})

const memory = new Map<string, string>()
vi.stubGlobal('localStorage', {
  getItem: (key: string) => memory.get(key) ?? null,
  setItem: (key: string, value: string) => void memory.set(key, value),
  removeItem: (key: string) => void memory.delete(key),
  clear: () => memory.clear(),
  key: () => null,
  length: 0,
})

const { useLocalGame, revealedPlayer, votingPlayer } = await import('../local-store')
const { defaultSettings } = await import('@/games/the-imposter/engine/engine')
const { recommendedComposition } = await import('@/games/the-imposter/engine/roles')

function startGame(names = ['Adam', 'Sarah', 'Rayan', 'Yanis']) {
  const store = useLocalGame.getState()
  store.reset()
  store.setPlayers(names)
  const composition = recommendedComposition('undercover', names.length)
  useLocalGame.getState().start({
    ...defaultSettings('undercover', names.length),
    undercoverCount: composition.undercover,
    mrWhiteCount: composition.mrWhite,
    descriptionRounds: 'free',
  })
  return useLocalGame.getState()
}

describe('mode local  ·  fenêtre de révélation', () => {
  beforeEach(() => {
    useLocalGame.getState().reset()
  })

  it('ne révèle aucun rôle avant confirmation d\'identité', () => {
    startGame()
    expect(useLocalGame.getState().revealPlayerId).toBeNull()
    expect(revealedPlayer(useLocalGame.getState())).toBeNull()
  })

  it('autorise uniquement le joueur qui vient de confirmer', () => {
    startGame()
    useLocalGame.getState().confirmIdentity()
    const state = useLocalGame.getState()
    const revealed = revealedPlayer(state)
    expect(revealed).not.toBeNull()
    expect(revealed?.id).toBe(state.game?.players[0]?.id)
  })

  /**
   * Régression : au moment de passer le téléphone, l'index de tour avance vers le
   * joueur suivant. Si l'écran s'appuyait sur cet index, le mot du joueur suivant
   * apparaissait une fraction de seconde pendant l'animation de sortie.
   */
  it('révoque immédiatement l\'autorisation quand on passe le téléphone', () => {
    startGame()
    useLocalGame.getState().confirmIdentity()
    useLocalGame.getState().revealRole()
    expect(revealedPlayer(useLocalGame.getState())).not.toBeNull()

    useLocalGame.getState().hideAndPass()

    const state = useLocalGame.getState()
    // Le tour a bien avancé…
    expect(state.turnIndex).toBe(1)
    expect(state.step).toBe('handoff')
    // …mais plus aucun rôle n'est affichable.
    expect(state.revealPlayerId).toBeNull()
    expect(revealedPlayer(state)).toBeNull()
  })

  it('ne laisse aucun rôle affichable après le dernier joueur', () => {
    startGame()
    for (let index = 0; index < 4; index++) {
      useLocalGame.getState().confirmIdentity()
      useLocalGame.getState().revealRole()
      useLocalGame.getState().hideAndPass()
    }
    const state = useLocalGame.getState()
    expect(state.step).toBe('discussion')
    expect(revealedPlayer(state)).toBeNull()
  })

  it('ne laisse aucun rôle affichable pendant la discussion ou le vote', () => {
    startGame()
    for (let index = 0; index < 4; index++) {
      useLocalGame.getState().confirmIdentity()
      useLocalGame.getState().revealRole()
      useLocalGame.getState().hideAndPass()
    }
    useLocalGame.getState().openVoting()
    expect(revealedPlayer(useLocalGame.getState())).toBeNull()
    useLocalGame.getState().confirmVoter()
    expect(revealedPlayer(useLocalGame.getState())).toBeNull()
  })
})

describe('mode local  ·  fenêtre de vote', () => {
  beforeEach(() => {
    useLocalGame.getState().reset()
  })

  it('n\'autorise que le votant courant, et le révoque après son vote', () => {
    startGame()
    for (let index = 0; index < 4; index++) {
      useLocalGame.getState().confirmIdentity()
      useLocalGame.getState().revealRole()
      useLocalGame.getState().hideAndPass()
    }
    useLocalGame.getState().openVoting()
    expect(votingPlayer(useLocalGame.getState())).toBeNull()

    useLocalGame.getState().confirmVoter()
    const voter = votingPlayer(useLocalGame.getState())
    expect(voter?.id).toBe('local-1')

    const target = useLocalGame.getState().game?.players[1]?.id as string
    useLocalGame.getState().vote(target)

    const state = useLocalGame.getState()
    expect(state.step).toBe('vote-handoff')
    expect(state.turnIndex).toBe(1)
    expect(votingPlayer(state)).toBeNull()
  })
})
