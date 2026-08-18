'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/**
 * Préférences locales de la plateforme (localStorage).
 *
 * Uniquement ce qui vaut pour TOUS les jeux : son, pseudo, derniers réglages
 * par jeu (opaques). Les mémoires propres à un jeu (historique de mots, noms de
 * la dernière partie locale…) vivent dans le module du jeu.
 */
export interface PreferencesState {
  soundEnabled: boolean
  lastPlayerName: string
  /** Derniers réglages choisis, indexés par identifiant de jeu. */
  lastConfigByGame: Record<string, unknown>

  setSoundEnabled: (enabled: boolean) => void
  toggleSound: () => void
  setLastPlayerName: (name: string) => void
  setLastConfig: (gameId: string, config: unknown) => void
}

export const usePreferences = create<PreferencesState>()(
  persist(
    (set) => ({
      soundEnabled: true,
      lastPlayerName: '',
      lastConfigByGame: {},

      setSoundEnabled: (soundEnabled) => set({ soundEnabled }),
      toggleSound: () => set((state) => ({ soundEnabled: !state.soundEnabled })),
      setLastPlayerName: (lastPlayerName) => set({ lastPlayerName }),
      setLastConfig: (gameId, config) =>
        set((state) => ({ lastConfigByGame: { ...state.lastConfigByGame, [gameId]: config } })),
    }),
    {
      name: 'flexgames:preferences',
      version: 2,
      partialize: (state) => ({
        soundEnabled: state.soundEnabled,
        lastPlayerName: state.lastPlayerName,
        lastConfigByGame: state.lastConfigByGame,
      }),
    },
  ),
)

/** Derniers réglages connus pour un jeu, ou `null`. */
export function lastConfigFor(gameId: string): unknown {
  return usePreferences.getState().lastConfigByGame[gameId] ?? null
}
