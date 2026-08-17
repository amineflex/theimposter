'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Settings2, UserX, XCircle } from 'lucide-react'
import { toast } from 'sonner'
import { PartyButton } from '@/components/party/party-button'
import { PartyCard } from '@/components/party/party-card'
import { StickerBadge } from '@/components/party/sticker-badge'
import { PlayerBubble } from '@/components/party/player-bubble'
import { PopModal } from '@/components/party/pop-modal'
import { RoomCode } from '@/components/game/room-code'
import { SettingsPanel } from '@/features/game/settings-panel'
import { ChatPanel } from './chat-panel'
import { buildPlayerViews, type RoomViewModel } from './room-context'
import { api, ApiClientError } from '@/lib/api/client'
import { usePreferences } from '@/stores/preferences-store'
import { useSound } from '@/hooks/use-sound'
import { compositionFromSettings, validateSettings } from '@/lib/game-engine/roles'
import { MIN_PLAYERS } from '@/lib/game-engine/types'
import { t } from '@/i18n'
import { cn } from '@/lib/utils'

/** Salle d'attente : code géant, joueurs en bulles, lancement. */
export function LobbyView({ room }: { room: RoomViewModel }) {
  const router = useRouter()
  const { play } = useSound()
  const wordHistory = usePreferences((state) => state.wordHistory)
  const [settingsOpen, setSettingsOpen] = React.useState(false)
  const [starting, setStarting] = React.useState(false)
  const [draftSettings, setDraftSettings] = React.useState(room.room?.settings)
  const [savingSettings, setSavingSettings] = React.useState(false)

  const players = buildPlayerViews(room.players, room.statuses, room.me)
  const present = players.filter((player) => player.isPresent)
  const isHost = room.me?.is_host ?? false
  const settings = room.room?.settings
  const maxPlayers = room.room?.max_players ?? 12

  // Petit son quand un joueur rejoint.
  const previousCount = React.useRef(present.length)
  React.useEffect(() => {
    if (present.length > previousCount.current) play('join')
    previousCount.current = present.length
  }, [present.length, play])

  if (!room.room || !settings) return null

  const validation = validateSettings(settings, present.length)
  const canStart = isHost && present.length >= MIN_PLAYERS && validation.ok
  const composition = compositionFromSettings(settings, Math.max(present.length, MIN_PLAYERS))
  const isFull = present.length >= maxPlayers

  const start = async () => {
    setStarting(true)
    try {
      play('pop')
      await api.post('/api/room/start', {
        roomId: room.room!.id,
        // Anti-répétition sans compte : le client transmet son historique local.
        excludeWordIds: wordHistory,
      })
      await room.refresh({ silent: true })
    } catch (error) {
      toast.error(error instanceof ApiClientError ? error.message : t('error.network'))
    } finally {
      setStarting(false)
    }
  }

  const saveSettings = async () => {
    if (!draftSettings) return
    setSavingSettings(true)
    try {
      await api.post('/api/room/settings', {
        roomId: room.room!.id,
        settings: draftSettings,
        maxPlayers,
      })
      usePreferences.getState().setLastSettings(draftSettings)
      setSettingsOpen(false)
      await room.refresh({ silent: true })
    } catch (error) {
      toast.error(error instanceof ApiClientError ? error.message : t('error.network'))
    } finally {
      setSavingSettings(false)
    }
  }

  const kick = async (playerId: string) => {
    try {
      await api.post('/api/room/kick', { roomId: room.room!.id, playerId })
      await room.refresh({ silent: true })
    } catch (error) {
      toast.error(error instanceof ApiClientError ? error.message : t('error.network'))
    }
  }

  const cancelRoom = async () => {
    try {
      await api.post('/api/room/cancel', { roomId: room.room!.id })
      router.push('/')
    } catch (error) {
      toast.error(error instanceof ApiClientError ? error.message : t('error.network'))
    }
  }

  return (
    <div className="space-y-6">
      <RoomCode code={room.room.code} />

      {/* Compteur + jauge de remplissage */}
      <div>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <p className="font-display text-xl font-extrabold uppercase text-ink">
            {t('lobby.playersCount', { count: present.length, max: maxPlayers })}
          </p>
          <div className="flex items-center gap-1.5">
            <StickerBadge tone={settings.mode === 'impostor' ? 'red' : 'blue'}>
              {t(`mode.${settings.mode}`)}
            </StickerBadge>
            <StickerBadge tone="cream" size="sm">
              {t(`difficulty.${settings.difficulty}`)}
            </StickerBadge>
          </div>
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
            : present.length < MIN_PLAYERS
              ? t('lobby.needMorePlayers', { min: MIN_PLAYERS })
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

      <PartyCard tone="cream" padding="md">
        <p className="font-display text-xs font-extrabold uppercase tracking-widest text-ink-soft">
          {t('lobby.composition')}
        </p>
        <p className="mt-1 text-sm font-bold text-ink">
          {settings.mode === 'impostor'
            ? `${composition.civilians} civils · ${composition.impostors} imposteur(s)`
            : `${composition.civilians} civils · ${composition.undercover} undercover · ${composition.mrWhite} Mr. White`}
        </p>
        {present.length >= MIN_PLAYERS && !validation.ok && (
          <p className="mt-2 text-xs font-extrabold text-red" role="alert">
            {validation.errors[0]}
          </p>
        )}
      </PartyCard>

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
            <PartyButton
              variant="paper"
              size="md"
              block
              onClick={() => {
                // Le brouillon part toujours des réglages actuels de la room.
                setDraftSettings(settings)
                setSettingsOpen(true)
              }}
            >
              <Settings2 className="h-5 w-5" aria-hidden />
              {t('common.settings')}
            </PartyButton>
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

      <ChatPanel room={room} />

      {isHost && (
        <div className="flex justify-center">
          <PartyButton variant="ghost" size="sm" onClick={cancelRoom}>
            <XCircle className="h-4 w-4" aria-hidden />
            {t('lobby.cancel')}
          </PartyButton>
        </div>
      )}

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
        {draftSettings && (
          <SettingsPanel
            settings={draftSettings}
            onChange={setDraftSettings}
            playerCount={Math.max(present.length, MIN_PLAYERS)}
            maxPlayers={maxPlayers}
          />
        )}
      </PopModal>
    </div>
  )
}
