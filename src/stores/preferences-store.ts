'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { defaultSettings } from '@/lib/game-engine/engine'
import type { GameMode, GameSettings } from '@/lib/game-engine/types'

/**
 * Préférences locales (localStorage). Aucune donnée personnelle : pseudo choisi,
 * réglages de la dernière partie, historique des mots joués pour l'anti-répétition.
 */
export interface PreferencesState {
  soundEnabled: boolean
  lastPlayerName: string
  lastSettings: GameSettings
  /** Ids des dernières entrées de mots jouées (les plus récentes en tête). */
  wordHistory: string[]
  /** Noms saisis lors de la dernière partie locale. */
  localPlayerNames: string[]

  setSoundEnabled: (enabled: boolean) => void
  toggleSound: () => void
  setLastPlayerName: (name: string) => void
  setLastSettings: (settings: GameSettings) => void
  rememberWord: (id: string | null) => void
  setLocalPlayerNames: (names: string[]) => void
}

/** Nombre de parties dont on retient les mots (cf. cahier des charges §40). */
export const WORD_HISTORY_SIZE = 20

export const usePreferences = create<PreferencesState>()(
  persist(
    (set) => ({
      soundEnabled: true,
      lastPlayerName: '',
      lastSettings: defaultSettings('undercover', 6),
      wordHistory: [],
      localPlayerNames: [],

      setSoundEnabled: (soundEnabled) => set({ soundEnabled }),
      toggleSound: () => set((state) => ({ soundEnabled: !state.soundEnabled })),
      setLastPlayerName: (lastPlayerName) => set({ lastPlayerName }),
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
      // On ne persiste pas d'état transitoire : uniquement les préférences.
      partialize: (state) => ({
        soundEnabled: state.soundEnabled,
        lastPlayerName: state.lastPlayerName,
        lastSettings: state.lastSettings,
        wordHistory: state.wordHistory,
        localPlayerNames: state.localPlayerNames,
      }),
    },
  ),
)

/** Réglages par défaut adaptés à un mode et une taille de table. */
export function defaultSettingsFor(mode: GameMode, playerCount: number): GameSettings {
  return defaultSettings(mode, playerCount)
}
