'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Settings2, UserX, XCircle } from 'lucide-react'
import { toast } from 'sonner'
import { PartyButton } from '@/flexgames/ui/party-button'
import { PartyCard } from '@/flexgames/ui/party-card'
import { StickerBadge } from '@/flexgames/ui/sticker-badge'
import { PlayerBubble } from '@/flexgames/ui/player-bubble'
import { PopModal } from '@/flexgames/ui/pop-modal'
import { RoomCode } from '@/flexgames/rooms/room-code-card'
import { ChatPanel } from '@/flexgames/chat/chat-panel'
import { buildPlayerViews, useRoomContext } from '@/flexgames/rooms/room-context'
import { api, describeError } from '@/flexgames/core/api/client'
import { useSound } from '@/flexgames/audio/use-sound'
import type { PlayableGame } from '@/flexgames/core/game-definition'
import { t } from '@/i18n'
import { cn } from '@/lib/utils'

/**
 * Salon FlexGames, identique pour tous les jeux : code, joueurs, hôte, kick,
 * départ, chat, lancement.
 *
 * Ce que le jeu apporte, par composition :
 *  - `ui.LobbySummary`  : ce qu'il veut afficher de sa configuration,
 *  - `ui.LobbySettings` : son formulaire de réglages,
 *  - `client.validateConfig` : est-il jouable avec ce nombre de joueurs ?
 */
export function FlexLobby({ game }: { game: PlayableGame }) {
  const router = useRouter()
  const { play } = useSound()
  const room = useRoomContext()
  const [settingsOpen, setSettingsOpen] = React.useState(false)
  const [starting, setStarting] = React.useState(false)
  const [draftConfig, setDraftConfig] = React.useState<unknown>(room.room?.game_config)
  const [savingSettings, setSavingSettings] = React.useState(false)

  const players = buildPlayerViews(room.players, room.me)
  const present = players.filter((player) => player.isPresent)
  const isHost = room.me?.is_host ?? false
  const config = room.room?.game_config
  const { minPlayers, maxPlayers: manifestMax } = game.manifest
  const maxPlayers = room.room?.max_players ?? manifestMax

  // Petit son quand un joueur rejoint.
  const previousCount = React.useRef(present.length)
  React.useEffect(() => {
    if (present.length > previousCount.current) play('join')
    previousCount.current = present.length
  }, [present.length, play])

  if (!room.room || !config) return null
  const roomId = room.room.id

  const validation = game.client.validateConfig(config, Math.max(present.length, minPlayers))
  const canStart = isHost && present.length >= minPlayers && validation.ok
  const isFull = present.length >= maxPlayers

  const start = async () => {
    setStarting(true)
    try {
      play('pop')
      await api.post('/api/room/start', { roomId, options: game.client.startOptions?.() ?? {} })
      await room.refresh({ silent: true })
    } catch (error) {
      toast.error(describeError(error, t('error.network')))
    } finally {
      setStarting(false)
    }
  }

  const saveSettings = async () => {
    if (draftConfig === undefined) return
    setSavingSettings(true)
    try {
      await api.post('/api/room/settings', { roomId, config: draftConfig, maxPlayers })
      game.client.onConfigSaved?.(draftConfig)
      setSettingsOpen(false)
      await room.refresh({ silent: true })
    } catch (error) {
      toast.error(describeError(error, t('error.network')))
    } finally {
      setSavingSettings(false)
    }
  }

  const kick = async (playerId: string) => {
    try {
      await api.post('/api/room/kick', { roomId, playerId })
      await room.refresh({ silent: true })
    } catch (error) {
      toast.error(describeError(error, t('error.network')))
    }
  }

  const cancelRoom = async () => {
    try {
      await api.post('/api/room/cancel', { roomId })
      router.push('/')
    } catch (error) {
      toast.error(describeError(error, t('error.network')))
    }
  }

  const { LobbySummary, LobbySettings } = game.ui

  return (
    <div className="space-y-6">
      <RoomCode code={room.room.code} />

      {/* Compteur + jauge de remplissage */}
      <div>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <p className="font-display text-xl font-extrabold uppercase text-ink">
            {t('lobby.playersCount', { count: present.length, max: maxPlayers })}
          </p>
          <StickerBadge tone="cream" size="sm">
            {game.manifest.name}
          </StickerBadge>
        </div>

        <div
          className="h-5 w-full overflow-hidden rounded-capsule border-3 border-ink bg-paper"
          role="progressbar"
          aria-valuenow={present.length}
          aria-valuemin={0}
          aria-valuemax={maxPlayers}
          aria-label={t('lobby.playersCount', { count: present.length, max: maxPlayers })}
        >
          <div
            className={cn('h-full transition-[width] duration-base', isFull ? 'bg-green' : 'bg-yellow')}
            style={{ width: `${Math.min(100, (present.length / maxPlayers) * 100)}%` }}
          />
        </div>
        <p className="mt-1.5 text-xs font-extrabold uppercase tracking-wide text-ink-soft">
          {isFull
            ? t('lobby.full')
            : present.length < minPlayers
              ? t('lobby.needMorePlayers', { min: minPlayers })
              : t('lobby.waitingPlayers')}
        </p>
      </div>

      {/* Joueurs en bulles colorées */}
      <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4">
        {present.map((player, index) => (
          <li key={player.id} className="relative">
            <PlayerBubble
              name={player.name}
              avatarKey={player.avatarKey}
              isHost={player.isHost}
              isYou={player.isYou}
              index={index}
            />
            {isHost && !player.isYou && (
              <button
                type="button"
                onClick={() => kick(player.id)}
                aria-label={`${t('lobby.kick')} ${player.name}`}
                className="toy-press absolute -bottom-1 left-1/2 z-10 -translate-x-1/2 rounded-capsule border-3 border-ink bg-paper p-1 text-ink shadow-toy"
              >
                <UserX className="h-3.5 w-3.5" aria-hidden />
              </button>
            )}
          </li>
        ))}
      </ul>

      {/* Slot du jeu : sa configuration, résumée comme il l'entend. */}
      {LobbySummary && (
        <PartyCard tone="cream" padding="md">
          <LobbySummary config={config} playerCount={Math.max(present.length, minPlayers)} />
          {present.length >= minPlayers && !validation.ok && (
            <p className="mt-2 text-xs font-extrabold text-red" role="alert">
              {validation.error}
            </p>
          )}
        </PartyCard>
      )}

      <div className="flex flex-col gap-3">
        {isHost ? (
          <>
            <PartyButton
              variant="red"
              size="xl"
              block
              onClick={start}
              disabled={!canStart}
              loading={starting}
            >
              {t('lobby.start')}
            </PartyButton>
            {LobbySettings && (
              <PartyButton
                variant="paper"
                size="md"
                block
                onClick={() => {
                  // Le brouillon part toujours des réglages actuels de la room.
                  setDraftConfig(config)
                  setSettingsOpen(true)
                }}
              >
                <Settings2 className="h-5 w-5" aria-hidden />
                {t('common.settings')}
              </PartyButton>
            )}
          </>
        ) : (
          <PartyCard tone="paper" padding="lg" tilt="left" className="text-center">
            <p className="font-display text-xl font-extrabold uppercase text-ink">
              {t('lobby.waitingHost')}
            </p>
            <p className="mt-1 text-xs font-bold text-ink-soft">
              L&apos;hôte lance la partie quand tout le monde est là.
            </p>
          </PartyCard>
        )}
      </div>

      <ChatPanel />

      {isHost && (
        <div className="flex justify-center">
          <PartyButton variant="ghost" size="sm" onClick={cancelRoom}>
            <XCircle className="h-4 w-4" aria-hidden />
            {t('lobby.cancel')}
          </PartyButton>
        </div>
      )}

      {LobbySettings && (
        <PopModal
          open={settingsOpen}
          onOpenChange={setSettingsOpen}
          title={t('common.settings')}
          tone="blue"
          footer={
            <>
              <PartyButton variant="paper" size="sm" onClick={() => setSettingsOpen(false)}>
                {t('common.cancel')}
              </PartyButton>
              <PartyButton variant="green" size="sm" onClick={saveSettings} loading={savingSettings}>
                {t('common.confirm')}
              </PartyButton>
            </>
          }
        >
          <LobbySettings
            config={draftConfig}
            onChange={setDraftConfig}
            playerCount={Math.max(present.length, minPlayers)}
            maxPlayers={maxPlayers}
          />
        </PopModal>
      )}
    </div>
  )
}
