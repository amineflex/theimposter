'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { PartyButton } from '@/flexgames/ui/party-button'
import { BigStepper } from '@/flexgames/ui/big-stepper'
import { api, describeError } from '@/flexgames/core/api/client'
import { ensureAnonymousSession } from '@/flexgames/core/supabase/client'
import { usePreferences } from '@/flexgames/core/preferences-store'
import { useSound } from '@/flexgames/audio/use-sound'
import { playerNameSchema } from '@/flexgames/core/validations/schemas'
import type { PlayableGame } from '@/flexgames/core/game-definition'
import { t } from '@/i18n'
import { cn } from '@/lib/utils'

const TEXT_INPUT =
  'h-13 w-full rounded-blob border-3 border-ink bg-paper px-4 font-display text-lg font-extrabold text-ink shadow-toy placeholder:font-sans placeholder:text-sm placeholder:font-bold placeholder:text-ink/35 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background'

/**
 * Création d'une room pour un jeu donné.
 *
 * La plateforme gère le pseudo, la taille de table et la visibilité ; les
 * réglages du jeu sont rendus par son propre slot `LobbySettings`.
 */
export function CreateRoomForm({ game }: { game: PlayableGame }) {
  const router = useRouter()
  const { play } = useSound()
  const lastName = usePreferences((state) => state.lastPlayerName)
  const setLastPlayerName = usePreferences((state) => state.setLastPlayerName)
  const setLastConfig = usePreferences((state) => state.setLastConfig)

  const { minPlayers, maxPlayers: hardMax } = game.manifest
  const [name, setName] = React.useState(lastName)
  const [visibility, setVisibility] = React.useState<'private' | 'public'>('private')
  const [maxPlayers, setMaxPlayers] = React.useState(Math.min(8, hardMax))
  const [draftConfig, setDraftConfig] = React.useState<unknown>(() => game.client.defaultConfig())
  const [submitting, setSubmitting] = React.useState(false)

  const nameCheck = playerNameSchema.safeParse(name)

  /*
   * La configuration doit rester jouable pour la table annoncée : on la DÉRIVE
   * au rendu via le jeu, plutôt que de la corriger dans un effet.
   */
  const config = React.useMemo(
    () => game.client.reconcileConfig?.(draftConfig, maxPlayers) ?? draftConfig,
    [game.client, draftConfig, maxPlayers],
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
        gameId: game.manifest.id,
        playerName: nameCheck.data,
        visibility,
        config,
        maxPlayers,
      })
      setLastPlayerName(nameCheck.data)
      setLastConfig(game.manifest.id, config)
      game.client.onConfigSaved?.(config)
      router.push(`/room/${result.code}`)
    } catch (error) {
      toast.error(describeError(error, t('error.network')))
    } finally {
      setSubmitting(false)
    }
  }

  const { LobbySettings } = game.ui

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
        min={minPlayers}
        max={hardMax}
        onChange={setMaxPlayers}
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

      {/* Slot du jeu : ses propres réglages. */}
      {LobbySettings && (
        <LobbySettings
          config={config}
          onChange={setDraftConfig}
          playerCount={maxPlayers}
          maxPlayers={maxPlayers}
        />
      )}

      <PartyButton
        type="submit"
        variant="red"
        size="xl"
        block
        loading={submitting}
        disabled={!nameCheck.success}
      >
        {t('create.submit')}
      </PartyButton>
      <p className="text-center text-xs font-bold text-ink-soft">
        {minPlayers} à {hardMax} joueurs · réglages modifiables dans la salle d&apos;attente.
      </p>
    </form>
  )
}
