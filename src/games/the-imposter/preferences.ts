'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { defaultSettings } from './engine/engine'
import type { GameMode, GameSettings } from './engine/types'

/**
 * Mémoire locale propre à The Imposter.
 *
 * Séparée des préférences de la plateforme : l'historique des mots et les noms
 * de la table locale n'ont de sens que pour ce jeu.
 */
export interface ImposterPreferencesState {
  lastSettings: GameSettings
  /** Ids des dernières entrées de mots jouées (les plus récentes en tête). */
  wordHistory: string[]
  /** Noms saisis lors de la dernière partie locale. */
  localPlayerNames: string[]

  setLastSettings: (settings: GameSettings) => void
  rememberWord: (id: string | null) => void
  setLocalPlayerNames: (names: string[]) => void
}

/** Nombre de parties dont on retient les mots (cf. cahier des charges §40). */
export const WORD_HISTORY_SIZE = 20

export const useImposterPreferences = create<ImposterPreferencesState>()(
  persist(
    (set) => ({
      lastSettings: defaultSettings('undercover', 6),
      wordHistory: [],
      localPlayerNames: [],

      setLastSettings: (lastSettings) => set({ lastSettings }),
      rememberWord: (id) =>
        set((state) => {
          if (!id) return state
          const next = [id, ...state.wordHistory.filter((entry) => entry !== id)]
          return { wordHistory: next.slice(0, WORD_HISTORY_SIZE) }
        }),
      setLocalPlayerNames: (localPlayerNames) => set({ localPlayerNames }),
    }),
    {
      name: 'the-imposter:preferences',
      version: 1,
    },
  ),
)

/** Réglages par défaut adaptés à un mode et une taille de table. */
export function defaultSettingsFor(mode: GameMode, playerCount: number): GameSettings {
  return defaultSettings(mode, playerCount)
}
