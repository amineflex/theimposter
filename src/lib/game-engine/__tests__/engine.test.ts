import { describe, expect, it } from 'vitest'
import {
  advanceSpeaker,
  allRolesSeen,
  allVotesIn,
  applyVoteResult,
  autoAdvance,
  beginDiscussion,
  castVote,
  closeVoting,
  computeSpeakingOrder,
  createGame,
  currentSpeakerId,
  defaultSettings,
  EngineError,
  markRoleSeen,
  pendingVoterIds,
  phaseDuration,
  removePlayer,
  resolveElimination,
  submitMrWhiteGuess,
} from '../engine'
import { IllegalTransitionError } from '../state-machine'
import type { GameSettings, GameState, WordSet } from '../types'

const UNDERCOVER_WORDS: WordSet = {
  civilianWord: 'Lion',
  undercoverWord: 'Tigre',
  impostorHint: null,
  acceptedAnswers: [],
  sourceId: 'pair-1',
  category: 'Animaux',
  difficulty: 'easy',
}

const IMPOSTOR_WORDS: WordSet = {
  civilianWord: 'Girafe',
  undercoverWord: null,
  impostorHint: 'Animal',
  acceptedAnswers: [],
  sourceId: 'word-1',
  category: 'Animaux',
  difficulty: 'easy',
}

function players(count: number) {
  return Array.from({ length: count }, (_, i) => ({ id: `p${i + 1}`, name: `J${i + 1}` }))
}

function seededRng(seed = 42) {
  let state = seed
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296
    return state / 4294967296
  }
}

/** Crée une partie avec des rôles imposés, pour tester les règles précisément. */
function gameWithRoles(
  mode: 'impostor' | 'undercover',
  roles: GameState['players'][number]['role'][],
  overrides: Partial<GameSettings> = {},
): GameState {
  const settings: GameSettings = {
    ...defaultSettings(mode, roles.length),
    impostorCount: roles.filter((r) => r === 'impostor').length,
    undercoverCount: roles.filter((r) => r === 'undercover').length,
    mrWhiteCount: roles.filter((r) => r === 'mr_white').length,
    ...overrides,
  }
  const state = createGame({
    players: players(roles.length),
    settings,
    words: mode === 'impostor' ? IMPOSTOR_WORDS : UNDERCOVER_WORDS,
    order: 'as-is',
    rng: seededRng(5),
  })
  return {
    ...state,
    players: state.players.map((p, i) => {
      const role = roles[i] ?? 'civilian'
      return {
        ...p,
        role,
        word:
          role === 'civilian'
            ? state.words.civilianWord
            : role === 'undercover'
              ? state.words.undercoverWord
              : null,
        hint: role === 'impostor' ? state.words.impostorHint : null,
      }
    }),
  }
}

/** Fait voter tous les joueurs vivants contre `targetId`, sauf lui-même. */
function everyoneVotes(state: GameState, targetId: string): GameState {
  let next = state
  for (const voter of state.players.filter((p) => p.isAlive)) {
    if (voter.id === targetId) continue
    next = castVote(next, voter.id, targetId)
  }
  // La cible doit voter aussi : elle vote pour le premier autre joueur vivant.
  const target = state.players.find((p) => p.id === targetId)
  if (target?.isAlive) {
    const other = state.players.find((p) => p.isAlive && p.id !== targetId)
    if (other) next = castVote(next, targetId, other.id)
  }
  return next
}

describe('createGame', () => {
  it('attribue les mots selon les rôles et démarre en role_reveal', () => {
    const state = createGame({
      players: players(6),
      settings: defaultSettings('undercover', 6),
      words: UNDERCOVER_WORDS,
      rng: seededRng(),
    })
    expect(state.phase).toBe('role_reveal')
    expect(state.round).toBe(1)
    expect(state.players).toHaveLength(6)
    for (const p of state.players) {
      if (p.role === 'civilian') expect(p.word).toBe('Lion')
      if (p.role === 'undercover') expect(p.word).toBe('Tigre')
      if (p.role === 'mr_white') expect(p.word).toBeNull()
      expect(p.isAlive).toBe(true)
    }
  })

  it("donne un indice à l'imposteur et aucun mot", () => {
    const state = createGame({
      players: players(6),
      settings: defaultSettings('impostor', 6),
      words: IMPOSTOR_WORDS,
      rng: seededRng(3),
    })
    const impostor = state.players.find((p) => p.role === 'impostor')
    expect(impostor).toBeDefined()
    expect(impostor?.word).toBeNull()
    expect(impostor?.hint).toBe('Animal')
    for (const civ of state.players.filter((p) => p.role === 'civilian')) {
      expect(civ.word).toBe('Girafe')
      expect(civ.hint).toBeNull()
    }
  })

  it('refuse une configuration invalide', () => {
    expect(() =>
      createGame({
        players: players(2),
        settings: defaultSettings('undercover', 4),
        words: UNDERCOVER_WORDS,
      }),
    ).toThrow(EngineError)
  })
})

describe('ordre de parole', () => {
  it('fait tourner le premier orateur entre les tours', () => {
    const state = gameWithRoles('undercover', ['civilian', 'civilian', 'civilian', 'undercover'])
    const round1 = computeSpeakingOrder(state)
    const round2 = computeSpeakingOrder({ ...state, firstSpeakerOffset: 1 })
    const round3 = computeSpeakingOrder({ ...state, firstSpeakerOffset: 2 })
    expect(round1[0]).not.toBe(round2[0])
    expect(round2[0]).not.toBe(round3[0])
    expect(new Set(round2)).toEqual(new Set(round1))
  })

  it("ne fait parler que les joueurs vivants", () => {
    const state = gameWithRoles('undercover', ['civilian', 'civilian', 'civilian', 'undercover'])
    const withDead: GameState = {
      ...state,
      players: state.players.map((p) => (p.id === 'p2' ? { ...p, isAlive: false } : p)),
    }
    expect(computeSpeakingOrder(withDead)).not.toContain('p2')
    expect(computeSpeakingOrder(withDead)).toHaveLength(3)
  })

  it('enchaîne les passes de description puis ouvre le vote', () => {
    let state = beginDiscussion(
      gameWithRoles('undercover', ['civilian', 'civilian', 'civilian', 'undercover'], {
        descriptionRounds: 2,
      }),
    )
    expect(state.phase).toBe('discussion')
    expect(state.descriptionPass).toBe(1)
    expect(currentSpeakerId(state)).toBe(state.speakingOrder[0])

    // 4 joueurs : 3 passages de parole restants dans la 1re passe.
    for (let i = 0; i < 3; i++) state = advanceSpeaker(state)
    expect(state.descriptionPass).toBe(1)
    expect(state.currentSpeakerIndex).toBe(3)

    // Le 4e appel boucle sur la 2e passe de description.
    state = advanceSpeaker(state)
    expect(state.descriptionPass).toBe(2)
    expect(state.currentSpeakerIndex).toBe(0)

    for (let i = 0; i < 4; i++) state = advanceSpeaker(state)
    expect(state.phase).toBe('voting')
  })

  it('en discussion libre, un seul passage puis vote', () => {
    let state = beginDiscussion(
      gameWithRoles('undercover', ['civilian', 'civilian', 'civilian', 'undercover'], {
        descriptionRounds: 'free',
      }),
    )
    expect(currentSpeakerId(state)).toBeNull()
    state = advanceSpeaker(state)
    expect(state.phase).toBe('voting')
  })
})

describe('révélation des rôles', () => {
  it('attend que tous les joueurs aient vu leur rôle', () => {
    let state = gameWithRoles('undercover', ['civilian', 'civilian', 'civilian', 'undercover'])
    expect(allRolesSeen(state)).toBe(false)
    for (const p of state.players) state = markRoleSeen(state, p.id)
    expect(allRolesSeen(state)).toBe(true)
  })
})

describe('votes', () => {
  function votingState() {
    return beginDiscussion(
      gameWithRoles('undercover', ['civilian', 'civilian', 'civilian', 'undercover'], {
        descriptionRounds: 'free',
      }),
    )
  }

  it('interdit de voter pour soi-même', () => {
    const state = advanceSpeaker(votingState())
    expect(() => castVote(state, 'p1', 'p1')).toThrow(/vous-même/i)
  })

  it('interdit de voter deux fois', () => {
    let state = advanceSpeaker(votingState())
    state = castVote(state, 'p1', 'p4')
    expect(() => castVote(state, 'p1', 'p3')).toThrow(/déjà voté/i)
  })

  it('interdit à un joueur éliminé de voter', () => {
    let state = advanceSpeaker(votingState())
    state = { ...state, players: state.players.map((p) => (p.id === 'p1' ? { ...p, isAlive: false } : p)) }
    expect(() => castVote(state, 'p1', 'p4')).toThrow(/vivants/i)
  })

  it('suit les votants restants', () => {
    let state = advanceSpeaker(votingState())
    expect(pendingVoterIds(state)).toHaveLength(4)
    state = castVote(state, 'p1', 'p4')
    expect(pendingVoterIds(state)).toEqual(['p2', 'p3', 'p4'])
    expect(allVotesIn(state)).toBe(false)
  })

  it('élimine le joueur majoritaire', () => {
    let state = advanceSpeaker(votingState())
    state = everyoneVotes(state, 'p4')
    expect(allVotesIn(state)).toBe(true)
    state = closeVoting(state, seededRng())
    expect(state.phase).toBe('vote_result')
    expect(state.lastVote?.eliminatedId).toBe('p4')
    expect(state.lastVote?.tally.p4).toBe(3)
    state = applyVoteResult(state)
    expect(state.phase).toBe('elimination')
    expect(state.players.find((p) => p.id === 'p4')?.isAlive).toBe(false)
    expect(state.players.find((p) => p.id === 'p4')?.roleRevealed).toBe(true)
  })

  it("ne révèle pas le rôle si l'option est désactivée", () => {
    let state = beginDiscussion(
      gameWithRoles('undercover', ['civilian', 'civilian', 'civilian', 'undercover'], {
        descriptionRounds: 'free',
        revealRoleOnElimination: false,
      }),
    )
    state = advanceSpeaker(state)
    state = everyoneVotes(state, 'p1')
    state = applyVoteResult(closeVoting(state, seededRng()))
    expect(state.players.find((p) => p.id === 'p1')?.isAlive).toBe(false)
    expect(state.players.find((p) => p.id === 'p1')?.roleRevealed).toBe(false)
  })

  it('organise un barrage en cas d\'égalité, puis tranche', () => {
    let state = advanceSpeaker(
      beginDiscussion(
        gameWithRoles('undercover', ['civilian', 'civilian', 'civilian', 'undercover'], {
          descriptionRounds: 'free',
        }),
      ),
    )
    // p1 & p2 votent p4 ; p3 & p4 votent p1  => égalité p4/p1 (2-2)
    state = castVote(state, 'p1', 'p4')
    state = castVote(state, 'p2', 'p4')
    state = castVote(state, 'p3', 'p1')
    state = castVote(state, 'p4', 'p1')
    state = closeVoting(state, seededRng())
    expect(state.lastVote?.tie).toBe(true)
    expect(state.lastVote?.eliminatedId).toBeNull()
    expect(state.runoffCandidates).toEqual(['p1', 'p4'])

    state = applyVoteResult(state)
    expect(state.phase).toBe('voting')
    expect(state.runoffCount).toBe(1)
    expect(state.votes).toHaveLength(0)

    // Barrage : nouvelle égalité => résolution aléatoire (pas de boucle infinie)
    state = castVote(state, 'p1', 'p4')
    state = castVote(state, 'p2', 'p4')
    state = castVote(state, 'p3', 'p1')
    state = castVote(state, 'p4', 'p1')
    state = closeVoting(state, seededRng(9))
    expect(state.lastVote?.resolvedByChance).toBe(true)
    expect(['p1', 'p4']).toContain(state.lastVote?.eliminatedId)
    state = applyVoteResult(state)
    expect(state.phase).toBe('elimination')
  })

  it('interdit de voter hors des candidats du barrage', () => {
    let state = advanceSpeaker(
      beginDiscussion(
        gameWithRoles('undercover', ['civilian', 'civilian', 'civilian', 'undercover', 'civilian'], {
          descriptionRounds: 'free',
          undercoverCount: 1,
          mrWhiteCount: 0,
        }),
      ),
    )
    state = { ...state, runoffCandidates: ['p1', 'p2'] }
    expect(() => castVote(state, 'p3', 'p4')).toThrow(/barrage/i)
    expect(() => castVote(state, 'p3', 'p1')).not.toThrow()
  })

  it('passe au tour suivant si personne ne vote (AFK)', () => {
    let state = advanceSpeaker(
      beginDiscussion(
        gameWithRoles('undercover', ['civilian', 'civilian', 'civilian', 'undercover'], {
          descriptionRounds: 'free',
        }),
      ),
    )
    state = closeVoting(state, seededRng())
    expect(state.lastVote?.eliminatedId).toBeNull()
    expect(state.lastVote?.tie).toBe(false)
    state = applyVoteResult(state)
    expect(state.phase).toBe('elimination')
    state = resolveElimination(state)
    expect(state.phase).toBe('discussion')
    expect(state.round).toBe(2)
    expect(state.players.every((p) => p.isAlive)).toBe(true)
  })
})

describe('conditions de victoire  ·  mode undercover', () => {
  it('les civils gagnent quand tous les intrus sont éliminés', () => {
    let state = advanceSpeaker(
      beginDiscussion(
        gameWithRoles('undercover', ['civilian', 'civilian', 'civilian', 'undercover'], {
          descriptionRounds: 'free',
        }),
      ),
    )
    state = everyoneVotes(state, 'p4')
    state = resolveElimination(applyVoteResult(closeVoting(state, seededRng())))
    expect(state.phase).toBe('results')
    expect(state.winner).toBe('civilians')
    expect(state.players.every((p) => p.roleRevealed)).toBe(true)
  })

  it('les intrus gagnent par domination (parité)', () => {
    // 3 civils + 1 undercover : deux civils éliminés => 1 civil vs 1 undercover
    let state = advanceSpeaker(
      beginDiscussion(
        gameWithRoles('undercover', ['civilian', 'civilian', 'civilian', 'undercover'], {
          descriptionRounds: 'free',
        }),
      ),
    )
    state = everyoneVotes(state, 'p1')
    state = resolveElimination(applyVoteResult(closeVoting(state, seededRng())))
    expect(state.phase).toBe('discussion')
    expect(state.winner).toBeNull()

    state = advanceSpeaker(state)
    state = everyoneVotes(state, 'p2')
    state = resolveElimination(applyVoteResult(closeVoting(state, seededRng())))
    expect(state.winner).toBe('undercover')
    expect(state.phase).toBe('results')
  })
})

describe('conditions de victoire  ·  mode imposteur', () => {
  it('les joueurs gagnent quand l\'imposteur est éliminé', () => {
    let state = advanceSpeaker(
      beginDiscussion(
        gameWithRoles('impostor', ['civilian', 'civilian', 'civilian', 'impostor'], {
          descriptionRounds: 'free',
        }),
      ),
    )
    state = everyoneVotes(state, 'p4')
    state = resolveElimination(applyVoteResult(closeVoting(state, seededRng())))
    expect(state.winner).toBe('civilians')
  })

  it("l'imposteur gagne s'il atteint la parité", () => {
    let state = advanceSpeaker(
      beginDiscussion(
        gameWithRoles('impostor', ['civilian', 'civilian', 'civilian', 'impostor'], {
          descriptionRounds: 'free',
        }),
      ),
    )
    state = everyoneVotes(state, 'p1')
    state = resolveElimination(applyVoteResult(closeVoting(state, seededRng())))
    state = advanceSpeaker(state)
    state = everyoneVotes(state, 'p2')
    state = resolveElimination(applyVoteResult(closeVoting(state, seededRng())))
    expect(state.winner).toBe('impostors')
  })
})

describe('Mr. White', () => {
  function untilMrWhiteEliminated(): GameState {
    let state = advanceSpeaker(
      beginDiscussion(
        gameWithRoles('undercover', ['civilian', 'civilian', 'civilian', 'undercover', 'mr_white'], {
          descriptionRounds: 'free',
          undercoverCount: 1,
          mrWhiteCount: 1,
        }),
      ),
    )
    state = everyoneVotes(state, 'p5')
    return resolveElimination(applyVoteResult(closeVoting(state, seededRng())))
  }

  it('a une dernière chance de deviner le mot', () => {
    const state = untilMrWhiteEliminated()
    expect(state.phase).toBe('mr_white_guess')
    expect(state.pendingMrWhiteId).toBe('p5')
  })

  it('gagne la partie en devinant correctement (insensible casse/accents)', () => {
    const state = submitMrWhiteGuess(untilMrWhiteEliminated(), 'p5', '  LÎON ')
    expect(state.winner).toBe('mr_white')
    expect(state.phase).toBe('results')
    expect(state.lastMrWhiteGuess?.correct).toBe(true)
  })

  it('perd sa chance en cas de mauvaise réponse et la partie continue', () => {
    const state = submitMrWhiteGuess(untilMrWhiteEliminated(), 'p5', 'Éléphant')
    expect(state.lastMrWhiteGuess?.correct).toBe(false)
    expect(state.winner).toBeNull()
    expect(state.phase).toBe('discussion')
    expect(state.round).toBe(2)
  })

  it("empêche un autre joueur de soumettre la devinette", () => {
    expect(() => submitMrWhiteGuess(untilMrWhiteEliminated(), 'p1', 'Lion')).toThrow(/concerné/i)
  })
})

describe('machine d\'état', () => {
  it('rejette une transition interdite', () => {
    const state = gameWithRoles('undercover', ['civilian', 'civilian', 'civilian', 'undercover'])
    expect(() => applyVoteResult(state)).toThrow(/résultat de vote/i)
    expect(() => castVote(state, 'p1', 'p2')).toThrow(/vote n'est pas ouvert/i)
    expect(() => advanceSpeaker(state)).toThrow(/discussion/i)
  })

  it('interdit de sauter de la révélation au vote', () => {
    const state = gameWithRoles('undercover', ['civilian', 'civilian', 'civilian', 'undercover'])
    // Le seul chemin autorisé depuis role_reveal est la discussion (ou results).
    expect(() => closeVoting(state)).toThrow()
    expect(beginDiscussion(state).phase).toBe('discussion')
  })

  it('empêche une double fermeture du scrutin', () => {
    let state = advanceSpeaker(
      beginDiscussion(
        gameWithRoles('undercover', ['civilian', 'civilian', 'civilian', 'undercover'], {
          descriptionRounds: 'free',
        }),
      ),
    )
    state = everyoneVotes(state, 'p4')
    const closed = closeVoting(state, seededRng())
    expect(() => closeVoting(closed, seededRng())).toThrow()
  })
})

describe('autoAdvance (AFK / timers)', () => {
  it('abandonne la partie si plus personne ne vote (jamais de boucle infinie)', () => {
    let state: GameState = gameWithRoles(
      'undercover',
      ['civilian', 'civilian', 'civilian', 'undercover'],
      { descriptionRounds: 1 },
    )
    const rng = seededRng(31)
    let guard = 0
    while (state.phase !== 'results' && guard++ < 200) {
      const next = autoAdvance(state, rng)
      if (!next) break
      state = next
    }
    expect(guard).toBeLessThan(200)
    expect(state.phase).toBe('results')
    // Aucun vote n'a jamais été exprimé : partie abandonnée, pas de vainqueur.
    expect(state.winner).toBeNull()
    expect(state.players.every((p) => p.isAlive)).toBe(true)
  })

  it('mène une partie complète à un vainqueur quand les joueurs votent', () => {
    let state: GameState = gameWithRoles(
      'undercover',
      ['civilian', 'civilian', 'civilian', 'undercover'],
      { descriptionRounds: 1 },
    )
    const rng = seededRng(17)
    let guard = 0
    while (state.phase !== 'results' && guard++ < 200) {
      if (state.phase === 'voting') {
        const target = state.players.find((p) => p.isAlive && p.role === 'undercover')
        state = everyoneVotes(state, target?.id ?? (state.players.find((p) => p.isAlive)?.id as string))
      }
      const next = autoAdvance(state, rng)
      if (!next) break
      state = next
    }
    expect(state.phase).toBe('results')
    expect(state.winner).toBe('civilians')
  })

  it('donne des durées cohérentes par phase', () => {
    const state = gameWithRoles('undercover', ['civilian', 'civilian', 'civilian', 'undercover'])
    expect(phaseDuration(state)).toBeGreaterThan(0)
    const discussion = beginDiscussion(state)
    expect(phaseDuration(discussion)).toBe(discussion.settings.speakDuration)
    const free = beginDiscussion({ ...state, settings: { ...state.settings, descriptionRounds: 'free' } })
    expect(phaseDuration(free)).toBe(free.settings.speakDuration * 4)
    const unlimited = beginDiscussion({ ...state, settings: { ...state.settings, speakDuration: 0 } })
    expect(phaseDuration(unlimited)).toBe(0)
  })
})

describe('removePlayer (déconnexion définitive / exclusion)', () => {
  it('retire le joueur du vote et de l\'ordre de parole', () => {
    let state = advanceSpeaker(
      beginDiscussion(
        gameWithRoles('undercover', ['civilian', 'civilian', 'civilian', 'undercover', 'civilian'], {
          descriptionRounds: 'free',
          undercoverCount: 1,
          mrWhiteCount: 0,
        }),
      ),
    )
    state = castVote(state, 'p1', 'p5')
    state = removePlayer(state, 'p1')
    expect(state.votes).toHaveLength(0)
    expect(state.speakingOrder).not.toContain('p1')
    expect(pendingVoterIds(state)).not.toContain('p1')
  })

  it('termine la partie si le départ déclenche une condition de victoire', () => {
    const state = removePlayer(
      beginDiscussion(gameWithRoles('undercover', ['civilian', 'civilian', 'civilian', 'undercover'])),
      'p4',
    )
    expect(state.phase).toBe('results')
    expect(state.winner).toBe('civilians')
  })
})

describe('rematch', () => {
  it('repart d\'un état neuf en conservant les joueurs', () => {
    const finished = removePlayer(
      beginDiscussion(gameWithRoles('undercover', ['civilian', 'civilian', 'civilian', 'undercover'])),
      'p4',
    )
    expect(finished.phase).toBe('results')

    const rematch = createGame({
      players: finished.players.map((p) => ({ id: p.id, name: p.name })),
      settings: finished.settings,
      words: { ...UNDERCOVER_WORDS, civilianWord: 'Plage', undercoverWord: 'Piscine', sourceId: 'pair-2' },
      recentSpecialCounts: { p4: 1 },
      rng: seededRng(77),
    })
    expect(rematch.phase).toBe('role_reveal')
    expect(rematch.round).toBe(1)
    expect(rematch.players).toHaveLength(4)
    expect(rematch.players.every((p) => p.isAlive && !p.hasSeenRole)).toBe(true)
    expect(rematch.eliminations).toHaveLength(0)
    expect(rematch.winner).toBeNull()
  })
})

describe('IllegalTransitionError', () => {
  it('est exportée et typée', () => {
    const error = new IllegalTransitionError('lobby', 'voting')
    expect(error.message).toContain('lobby')
    expect(error.name).toBe('IllegalTransitionError')
  })
})
