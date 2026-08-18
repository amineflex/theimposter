'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { RefreshCw, Users } from 'lucide-react'
import { PartyButton } from '@/flexgames/ui/party-button'
import { PartyCard } from '@/flexgames/ui/party-card'
import { StickerBadge } from '@/flexgames/ui/sticker-badge'
import { GameBanner } from '@/flexgames/ui/game-banner'
import { EmptyState } from '@/flexgames/ui/states'
import { api } from '@/flexgames/core/api/client'
import { isValidRoomCode, normalizeRoomCode, ROOM_CODE_LENGTH } from './room-code'
import { getGame } from '@/flexgames/game-registry'
import { t } from '@/i18n'
import { cn } from '@/lib/utils'

interface PublicRoom {
  code: string
  gameId: string
  playerCount: number
  maxPlayers: number
  seatsLeft: number
}

/**
 * Rejoindre une partie : par code, ou depuis la liste des rooms publiques.
 * La liste couvre tous les jeux ; le nom du jeu vient du registry.
 */
export function JoinSection({ gameId }: { gameId?: string } = {}) {
  const router = useRouter()
  const [code, setCode] = React.useState('')
  const [rooms, setRooms] = React.useState<PublicRoom[] | null>(null)
  const [loading, setLoading] = React.useState(false)

  const query = gameId ? `?gameId=${encodeURIComponent(gameId)}` : ''

  const loadRooms = React.useCallback(async () => {
    setLoading(true)
    try {
      const result = await api.get<{ rooms: PublicRoom[] }>(`/api/rooms/public${query}`)
      setRooms(result.rooms)
    } catch {
      setRooms([])
    } finally {
      setLoading(false)
    }
  }, [query])

  // Chargement initial : l'écriture d'état a lieu après l'`await`.
  React.useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const result = await api.get<{ rooms: PublicRoom[] }>(`/api/rooms/public${query}`)
        if (!cancelled) setRooms(result.rooms)
      } catch {
        if (!cancelled) setRooms([])
      }
    })()
    return () => {
      cancelled = true
    }
  }, [query])

  return (
    <div className="space-y-8">
      <form
        onSubmit={(event) => {
          event.preventDefault()
          if (isValidRoomCode(code)) router.push(`/join/${normalizeRoomCode(code)}`)
        }}
      >
        <GameBanner title={t('join.code')} tone="ink" />
        <input
          value={code}
          onChange={(event) => setCode(normalizeRoomCode(event.target.value))}
          placeholder="ABC123"
          aria-label={t('join.code')}
          maxLength={ROOM_CODE_LENGTH}
          autoCapitalize="characters"
          autoComplete="off"
          spellCheck={false}
          className="mt-3 h-16 w-full rounded-blob border-3 border-ink bg-paper text-center font-display text-3xl font-extrabold uppercase tracking-[0.25em] text-ink shadow-toy-md placeholder:text-ink/25 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        />
        <PartyButton
          type="submit"
          variant="blue"
          size="xl"
          block
          className="mt-3"
          disabled={!isValidRoomCode(code)}
        >
          {t('join.submit')}
        </PartyButton>
      </form>

      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="font-display text-lg font-extrabold uppercase text-ink">
            {t('join.publicRooms')}
          </h2>
          <PartyButton variant="ghost" size="sm" onClick={loadRooms} loading={loading}>
            <RefreshCw className="h-4 w-4" aria-hidden />
            {t('join.refresh')}
          </PartyButton>
        </div>

        {rooms === null ? null : rooms.length === 0 ? (
          <EmptyState title={t('join.noPublicRooms')} message="Crée la tienne, ou entre un code." />
        ) : (
          <ul className="space-y-2">
            {rooms.map((room, index) => (
              <li key={room.code}>
                <button
                  type="button"
                  onClick={() => router.push(`/join/${room.code}`)}
                  className={cn(
                    'toy-press flex min-h-16 w-full items-center gap-3 rounded-blob border-3 border-ink bg-paper px-4 text-left shadow-toy-md',
                    index % 2 === 0 ? 'tilt-left-sm' : 'tilt-right-sm',
                  )}
                >
                  <span className="font-display text-2xl font-extrabold uppercase tracking-widest text-ink">
                    {room.code}
                  </span>
                  <StickerBadge tone="cream" size="sm">
                    {getGame(room.gameId)?.manifest.name ?? room.gameId}
                  </StickerBadge>
                  <span className="ml-auto flex items-center gap-1 font-display text-sm font-extrabold text-ink">
                    <Users className="h-4 w-4" aria-hidden />
                    {room.playerCount}/{room.maxPlayers}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <PartyCard tone="cream" padding="md" className="text-center">
        <p className="text-xs font-bold text-ink-soft">
          Les parties publiques n&apos;exposent que le jeu et le nombre de joueurs.
        </p>
      </PartyCard>
    </div>
  )
}
