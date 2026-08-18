'use client'

import type { ReactNode } from 'react'
import type { GameTheme } from '@/flexgames/core/game-definition'

/**
 * Thème d'un jeu, projeté en variables CSS.
 *
 * Volontairement minuscule : trois variables, aucune logique. Un jeu qui veut
 * une identité plus poussée le fait dans ses propres composants ; la plateforme
 * se contente d'exposer ses couleurs à l'arbre courant.
 */
export function GameThemeStyle({ theme, children }: { theme: GameTheme; children: ReactNode }) {
  return (
    <div
      className="flex w-full flex-1 flex-col"
      style={
        {
          '--game-primary': theme.primary,
          '--game-secondary': theme.secondary,
          '--game-accent': theme.accent ?? theme.primary,
        } as React.CSSProperties
      }
    >
      {children}
    </div>
  )
}
