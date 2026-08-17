'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { toast } from 'sonner'
import { PartyButton } from '@/components/party/party-button'
import { ErrorState } from '@/components/game/states'
import { Shape } from '@/components/party/decor'
import { api, describeError } from '@/lib/api/client'
import { ensureAnonymousSession, isOnlineConfigured } from '@/lib/supabase/client'
import { isValidRoomCode } from '@/lib/room-code'
import { playerNameSchema } from '@/lib/validations/schemas'
import { usePreferences } from '@/stores/preferences-store'
import { useOnlineStatus } from '@/hooks/use-online-status'
import { useSound } from '@/hooks/use-sound'
import { t } from '@/i18n'

/** Saisie du pseudo puis entrée dans la room (ou reconnexion). */
export function JoinRoomForm({ code }: { code: string }) {
  const router = useRouter()
  const online = useOnlineStatus()
  const { play } = useSound()
  const lastName = usePreferences((state) => state.lastPlayerName)
  const setLastPlayerName = usePreferences((state) => state.setLastPlayerName)
  const [name, setName] = React.useState(lastName)
  const [submitting, setSubmitting] = React.useState(false)

  const nameCheck = playerNameSchema.safeParse(name)

  if (!isOnlineConfigured()) {
    return <ErrorState title={t('error.title')} message={t('error.notConfigured')} />
  }
  if (!isValidRoomCode(code)) {
    return (
      <div className="space-y-4">
        <ErrorState title={t('error.title')} message={t('error.roomNotFound')} />
        <PartyButton asChild variant="paper" block>
          <Link href="/online">{t('join.title')}</Link>
        </PartyButton>
      </div>
    )
  }
  if (!online) {
    return <ErrorState title={t('offline.title')} message={t('offline.onlineUnavailable')} />
  }

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
      await api.post('/api/room/join', { code, playerName: nameCheck.data })
      setLastPlayerName(nameCheck.data)
      router.push(`/room/${code}`)
    } catch (error) {
      toast.error(describeError(error, t('error.network')))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-7">
      <div className="relative flex flex-col items-center gap-3 text-center">
        <span aria-hidden className="absolute -left-1 top-0 -rotate-12">
          <Shape shape="star" tone="yellow" size={30} />
        </span>
        <p className="font-display text-sm font-extrabold uppercase tracking-widest text-ink-soft">
          {t('join.code')}
        </p>
        <p className="tilt-right-sm rounded-blob border-3 border-ink bg-blue px-5 py-2 font-display text-4xl font-extrabold uppercase tracking-[0.2em] text-paper shadow-toy-md">
          {code}
        </p>
      </div>

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
          autoFocus
          className="h-14 w-full rounded-blob border-3 border-ink bg-paper px-4 text-center font-display text-2xl font-extrabold text-ink shadow-toy-md placeholder:font-sans placeholder:text-base placeholder:font-bold placeholder:text-ink/35 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        />
        <span className="mt-2 block text-center text-xs font-bold text-ink-soft">
          2 à 20 caractères, unique dans la partie.
        </span>
      </label>

      <PartyButton type="submit" variant="red" size="xl" block loading={submitting} disabled={!nameCheck.success}>
        {t('join.submit')}
      </PartyButton>

      <PartyButton asChild variant="ghost" size="sm" block>
        <Link href="/">
          <ArrowLeft className="h-4 w-4" aria-hidden />
          {t('common.backHome')}
        </Link>
      </PartyButton>
    </form>
  )
}
