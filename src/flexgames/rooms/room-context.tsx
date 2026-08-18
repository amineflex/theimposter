'use client'

import * as React from 'react'
import type { RoomPlayerRow } from '@/flexgames/core/db'
import type { RefreshFn, RoomSnapshot } from './use-room'

/**
 * Contexte de room : ce que TOUT jeu peut lire, et rien de plus.
 *
 * Les composants d'un jeu appellent `useRoomContext()` au lieu de recevoir des
 * props imposées par la plateforme ; leurs données propres viennent de leurs
 * propres hooks.
 */
export interface RoomContextValue extends RoomSnapshot {
  refresh: RefreshFn
}

const RoomContext = React.createContext<RoomContextValue | null>(null)

export function RoomProvider({
  value,
  children,
}: {
  value: RoomContextValue
  children: React.ReactNode
}) {
  return <RoomContext.Provider value={value}>{children}</RoomContext.Provider>
}

export function useRoomContext(): RoomContextValue {
  const value = React.useContext(RoomContext)
  if (!value) throw new Error('useRoomContext() doit être utilisé dans un <RoomProvider>.')
  return value
}

/** Identité affichable d'un joueur. Aucune donnée de gameplay. */
export interface PlayerView {
  id: string
  name: string
  avatarKey: string
  isHost: boolean
  isYou: boolean
  isPresent: boolean
}

export function buildPlayerViews(players: RoomPlayerRow[], me: RoomPlayerRow | null): PlayerView[] {
  return players.map((player) => ({
    id: player.id,
    name: player.name,
    avatarKey: player.avatar_key,
    isHost: player.is_host,
    isYou: me?.id === player.id,
    isPresent: player.is_present,
  }))
}
