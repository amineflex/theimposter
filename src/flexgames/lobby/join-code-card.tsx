'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { ArrowRight } from 'lucide-react'
import { PartyButton } from '@/flexgames/ui/party-button'
import { isValidRoomCode, normalizeRoomCode, ROOM_CODE_LENGTH } from '@/flexgames/rooms/room-code'
import { t } from '@/i18n'

/** Saisie rapide d'un code de partie depuis la page d'un jeu. */
export function JoinCodeCard() {
  const router = useRouter()
  const [code, setCode] = React.useState('')
  const valid = isValidRoomCode(code)

  const submit = (event: React.FormEvent) => {
    event.preventDefault()
    if (!valid) return
    router.push(`/join/${normalizeRoomCode(code)}`)
  }

  return (
    <form onSubmit={submit} className="flex flex-col items-center gap-2">
      <label
        htmlFor="join-code"
        className="font-display text-sm font-extrabold uppercase tracking-widest text-ink-soft"
      >
        {t('home.joinWithCode')}
      </label>
      <div className="flex w-full gap-2">
        <input
          id="join-code"
          value={code}
          onChange={(event) => setCode(normalizeRoomCode(event.target.value))}
          placeholder="ABC123"
          inputMode="text"
          autoCapitalize="characters"
          autoComplete="off"
          spellCheck={false}
          maxLength={ROOM_CODE_LENGTH}
          className="h-14 min-w-0 flex-1 rounded-blob border-3 border-ink bg-paper px-4 text-center font-display text-2xl font-extrabold uppercase tracking-[0.25em] text-ink shadow-toy placeholder:text-ink/25 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        />
        <PartyButton
          type="submit"
          variant="blue"
          size="icon"
          className="h-14 w-14"
          disabled={!valid}
          aria-label={t('join.submit')}
        >
          <ArrowRight className="h-6 w-6" aria-hidden />
        </PartyButton>
      </div>
    </form>
  )
}
