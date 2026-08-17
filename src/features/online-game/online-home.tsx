'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { RefreshCw, Users } from 'lucide-react'
import { toast } from 'sonner'
import { PartyButton } from '@/components/party/party-button'
import { PartyCard } from '@/components/party/party-card'
import { StickerBadge } from '@/components/party/sticker-badge'
import { GameBanner } from '@/components/party/game-banner'
import { EmptyState, ErrorState } from '@/components/game/states'
import { SettingsPanel } from '@/features/game/settings-panel'
import { BigStepper, ModePicker } from '@/features/game/mode-picker'
import { api, describeError } from '@/lib/api/client'
import { ensureAnonymousSession, isOnlineConfigured } from '@/lib/supabase/client'
import { isValidRoomCode, normalizeRoomCode, ROOM_CODE_LENGTH } from '@/lib/room-code'
import { usePreferences } from '@/stores/preferences-store'
import { useOnlineStatus } from '@/hooks/use-online-status'
import { useSound } from '@/hooks/use-sound'
import { playerNameSchema } from '@/lib/validations/schemas'
import { MAX_PLAYERS, MIN_PLAYERS } from '@/lib/game-engine/types'
import { reconcileSettings } from '@/lib/game-engine/engine'
import { t } from '@/i18n'
import { cn } from '@/lib/utils'

interface PublicRoom {
  code: string
  mode: 'impostor' | 'undercover'
  playerCount: number
  maxPlayers: number
  seatsLeft: number
  difficulty: string | null
}

const TEXT_INPUT =
  'h-13 w-full rounded-blob border-3 border-ink bg-paper px-4 font-display text-lg font-extrabold text-ink shadow-toy placeholder:font-sans placeholder:text-sm placeholder:font-bold placeholder:text-ink/35 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background'

/** Créer ou rejoindre une partie en ligne. */
export function OnlineHome() {
  const online = useOnlineStatus()
  const [tab, setTab] = React.useState<'create' | 'join'>('create')

  if (!isOnlineConfigured()) {
    return <ErrorState title={t('error.title')} message={t('error.notConfigured')} />
  }
  if (!online) {
    return (
      <ErrorState
        title={t('offline.title')}
        message={`${t('offline.onlineUnavailable')} ${t('offline.body')}`}
      />
    )
  }

  return (
    <div className="space-y-6">
      {/* Onglets en capsules, façon manette de jeu */}
      <div role="tablist" aria-label="Partie en ligne" className="flex gap-2">
        {(['create', 'join'] as const).map((value) => (
          <button
            key={value}
            role="tab"
            aria-selected={tab === value}
            onClick={() => setTab(value)}
            className={cn(
              'toy-press min-h-12 flex-1 rounded-capsule border-3 border-ink font-display text-base font-extrabold uppercase text-ink shadow-toy',
              tab === value ? 'bg-yellow' : 'bg-paper',
            )}
          >
            {value === 'create' ? t('create.title') : t('join.title')}
          </button>
        ))}
      </div>

      {tab === 'create' ? <CreateRoomForm /> : <JoinSection />}
    </div>
  )
}

function CreateRoomForm() {
  const router = useRouter()
  const { play } = useSound()
  const lastName = usePreferences((state) => state.lastPlayerName)
  const lastSettings = usePreferences((state) => state.lastSettings)
  const setLastPlayerName = usePreferences((state) => state.setLastPlayerName)
  const setLastSettings = usePreferences((state) => state.setLastSettings)

  const [name, setName] = React.useState(lastName)
  const [visibility, setVisibility] = React.useState<'private' | 'public'>('private')
  const [maxPlayers, setMaxPlayers] = React.useState(8)
  const [draftSettings, setDraftSettings] = React.useState(lastSettings)
  const [submitting, setSubmitting] = React.useState(false)

  const nameCheck = playerNameSchema.safeParse(name)

  /**
   * La composition doit rester valide pour la taille de table annoncée : on la
   * DÉRIVE du brouillon au rendu, plutôt que de la corriger dans un effet.
   */
  const settings = React.useMemo(
    () => reconcileSettings(draftSettings, maxPlayers),
    [draftSettings, maxPlayers],
  )

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!nameCheck.success) {
      toast.error(nameCheck.error.issues[0]?.message ?? 'Pseudo invalide.')
      return
    }
    setSubmitting(true)
    try {
      play('pop')
      await ensureAnonymousSession()
      const result = await api.post<{ code: string }>('/api/room/create', {
        playerName: nameCheck.data,
        visibility,
        settings,
        maxPlayers,
      })
      setLastPlayerName(nameCheck.data)
      setLastSettings(settings)
      router.push(`/room/${result.code}`)
    } catch (error) {
      toast.error(describeError(error, t('error.network')))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      <label className="block">
        <span className="mb-2 block font-display text-lg font-extrabold uppercase text-ink">
          {t('create.nickname')}
        </span>
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder={t('create.nicknamePlaceholder')}
          maxLength={20}
          autoComplete="nickname"
          className={TEXT_INPUT}
        />
      </label>

      <BigStepper
        label={t('create.playerCount')}
        value={maxPlayers}
        min={MIN_PLAYERS}
        max={MAX_PLAYERS}
        onChange={setMaxPlayers}
      />

      <ModePicker
        value={settings.mode}
        onChange={(mode) => setDraftSettings({ ...settings, mode })}
      />

      <fieldset>
        <legend className="mb-2 font-display text-lg font-extrabold uppercase text-ink">
          {t('create.visibility')}
        </legend>
        <div className="grid grid-cols-2 gap-2">
          {(['private', 'public'] as const).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setVisibility(value)}
              aria-pressed={visibility === value}
              className={cn(
                'toy-press min-h-12 rounded-capsule border-3 border-ink px-3 font-display text-sm font-extrabold uppercase text-ink shadow-toy',
                visibility === value ? 'bg-green' : 'bg-paper',
              )}
            >
              {value === 'private' ? t('create.private') : t('create.public')}
            </button>
          ))}
        </div>
      </fieldset>

      <SettingsPanel
        settings={settings}
        onChange={setDraftSettings}
        playerCount={maxPlayers}
        hideMode
      />

      <PartyButton type="submit" variant="red" size="xl" block loading={submitting} disabled={!nameCheck.success}>
        {t('create.submit')}
      </PartyButton>
      <p className="text-center text-xs font-bold text-ink-soft">
        {MIN_PLAYERS} à {MAX_PLAYERS} joueurs · réglages modifiables dans la salle d&apos;attente.
      </p>
    </form>
  )
}

function JoinSection() {
  const router = useRouter()
  const [code, setCode] = React.useState('')
  const [rooms, setRooms] = React.useState<PublicRoom[] | null>(null)
  const [loading, setLoading] = React.useState(false)

  const loadRooms = React.useCallback(async () => {
    setLoading(true)
    try {
      const result = await api.get<{ rooms: PublicRoom[] }>('/api/rooms/public')
      setRooms(result.rooms)
    } catch {
      setRooms([])
    } finally {
      setLoading(false)
    }
  }, [])

  // Chargement initial : l'écriture d'état a lieu après l'`await`.
  React.useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const result = await api.get<{ rooms: PublicRoom[] }>('/api/rooms/public')
        if (!cancelled) setRooms(result.rooms)
      } catch {
        if (!cancelled) setRooms([])
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

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
                  <StickerBadge tone={room.mode === 'impostor' ? 'red' : 'blue'} size="sm">
                    {t(`mode.${room.mode}`)}
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
          Les parties publiques n&apos;exposent que le mode, le nombre de joueurs et la difficulté.
        </p>
      </PartyCard>
    </div>
  )
}
