'use client'

import * as React from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { EmptyState, LoadingState } from '@/components/game/states'
import { api, ApiClientError } from '@/lib/api/client'
import { t } from '@/i18n'

interface AdminRoom {
  id: string
  code: string
  status: string
  visibility: string
  mode: 'impostor' | 'undercover'
  max_players: number
  created_at: string
  last_activity_at: string
  expires_at: string
  player_count: number
}

/** Suivi et modération des parties. */
export function AdminRooms() {
  const [rooms, setRooms] = React.useState<AdminRoom[] | null>(null)

  const load = React.useCallback(async () => {
    try {
      const result = await api.get<{ rooms: AdminRoom[] }>('/api/admin/rooms')
      setRooms(result.rooms)
    } catch (error) {
      toast.error(error instanceof ApiClientError ? error.message : 'Chargement impossible.')
      setRooms([])
    }
  }, [])

  // Le chargement initial se fait dans une fonction asynchrone : l'écriture
  // d'état a lieu après l'`await`, jamais dans le corps de l'effet.
  React.useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const result = await api.get<{ rooms: AdminRoom[] }>('/api/admin/rooms')
        if (!cancelled) setRooms(result.rooms)
      } catch {
        if (!cancelled) setRooms([])
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const act = async (roomId: string, action: 'cancel' | 'expire') => {
    try {
      await api.post('/api/admin/rooms', { roomId, action })
      await load()
    } catch (error) {
      toast.error(error instanceof ApiClientError ? error.message : 'Action impossible.')
    }
  }

  if (rooms === null) return <LoadingState />
  if (rooms.length === 0) return <EmptyState title="Aucune partie récente" />

  return (
    <ul className="space-y-2">
      {rooms.map((room) => (
        <li
          key={room.id}
          className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card px-3 py-2"
        >
          <span className="font-mono text-lg font-bold tracking-widest text-primary">{room.code}</span>
          <Badge variant="secondary">{t(`mode.${room.mode}`)}</Badge>
          <Badge variant={room.status === 'in_game' ? 'default' : 'outline'}>{room.status}</Badge>
          <span className="text-xs text-muted-foreground">
            {room.player_count}/{room.max_players} · {room.visibility}
          </span>
          <span className="text-xs text-muted-foreground">
            activité : {new Date(room.last_activity_at).toLocaleString('fr-FR')}
          </span>
          <div className="ml-auto flex gap-1">
            {(room.status === 'lobby' || room.status === 'in_game') && (
              <>
                <Button variant="ghost" size="sm" onClick={() => void act(room.id, 'cancel')}>
                  Annuler
                </Button>
                <Button variant="ghost" size="sm" onClick={() => void act(room.id, 'expire')}>
                  Expirer
                </Button>
              </>
            )}
          </div>
        </li>
      ))}
    </ul>
  )
}
