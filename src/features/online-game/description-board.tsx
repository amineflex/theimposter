'use client'

import * as React from 'react'
import { motion } from 'framer-motion'
import { Send } from 'lucide-react'
import { toast } from 'sonner'
import { PartyButton } from '@/components/party/party-button'
import { PartyCard } from '@/components/party/party-card'
import { StickerBadge } from '@/components/party/sticker-badge'
import { PlayerAvatar } from '@/components/game/player-avatar'
import { api, describeError } from '@/lib/api/client'
import { useSound } from '@/hooks/use-sound'
import { cn } from '@/lib/utils'
import { t } from '@/i18n'
import type { GameDescriptionRow } from '@/types/db'
import { buildPlayerViews, type RoomViewModel } from './room-context'

const MAX_LENGTH = 120

/**
 * Saisie de sa description : chaque joueur ÉCRIT son indice à son tour, plutôt
 * que de le dire dans le chat. Valider envoie la description ET passe la parole.
 */
export function DescriptionInput({ room }: { room: RoomViewModel }) {
  const { play } = useSound()
  const [body, setBody] = React.useState('')
  const [sending, setSending] = React.useState(false)
  const game = room.game
  if (!game) return null

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    const value = body.trim()
    if (!value || sending) return
    setSending(true)
    try {
      await api.post('/api/game/describe', { gameId: game.id, body: value })
      play('turn')
      setBody('')
      await room.refresh({ silent: true })
    } catch (error) {
      toast.error(describeError(error, t('error.network')))
    } finally {
      setSending(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-2">
      <label className="block">
        <span className="mb-2 block font-display text-base font-extrabold uppercase text-ink">
          {t('describe.label')}
        </span>
        <input
          value={body}
          onChange={(event) => setBody(event.target.value.slice(0, MAX_LENGTH))}
          placeholder={t('describe.placeholder')}
          aria-label={t('describe.label')}
          maxLength={MAX_LENGTH}
          autoFocus
          autoComplete="off"
          className="h-14 w-full rounded-blob border-3 border-ink bg-paper px-4 text-base font-bold text-ink shadow-toy-md placeholder:font-bold placeholder:text-ink/35 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        />
      </label>

      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-bold text-ink-soft">
          {body.length}/{MAX_LENGTH} · {t('describe.hint')}
        </span>
      </div>

      <PartyButton
        type="submit"
        variant="yellow"
        size="lg"
        block
        loading={sending}
        disabled={!body.trim()}
      >
        <Send className="h-5 w-5" aria-hidden />
        {t('describe.send')}
      </PartyButton>
    </form>
  )
}

export interface DescriptionEntry {
  id: string
  round: number
  pass: number
  body: string
  name: string
  avatarKey: string
  isYou: boolean
  isAlive: boolean
}

/** Assemble les descriptions avec l'identité de leurs auteurs. */
export function useDescriptionEntries(room: RoomViewModel): DescriptionEntry[] {
  const players = buildPlayerViews(room.players, room.statuses, room.me)
  return room.descriptions.map((entry: GameDescriptionRow) => {
    const author = players.find((player) => player.id === entry.room_player_id)
    return {
      id: entry.id,
      round: entry.round,
      pass: entry.pass,
      body: entry.body,
      name: author?.name ?? 'Joueur',
      avatarKey: author?.avatarKey ?? 'rouge-mask',
      isYou: author?.isYou ?? false,
      isAlive: author?.isAlive ?? true,
    }
  })
}

/**
 * Historique des descriptions.
 *
 * Affiché pendant la discussion (tour courant) et surtout pendant le VOTE, où
 * l'on veut relire tout ce qui a été dit avant de désigner un suspect.
 */
export function DescriptionHistory({
  entries,
  currentRound,
  mode = 'all',
  className,
}: {
  entries: DescriptionEntry[]
  currentRound: number
  /** `current` : seulement le tour en cours. `all` : toute la partie. */
  mode?: 'current' | 'all'
  className?: string
}) {
  const visible = mode === 'current' ? entries.filter((entry) => entry.round === currentRound) : entries

  if (visible.length === 0) {
    return (
      <PartyCard tone="paper" padding="md" className={cn('text-center', className)}>
        <p className="text-sm font-bold text-ink-soft">{t('describe.empty')}</p>
      </PartyCard>
    )
  }

  // Regroupe par tour, du plus récent au plus ancien : le tour en cours d'abord.
  const rounds = Array.from(new Set(visible.map((entry) => entry.round))).sort((a, b) => b - a)

  return (
    <section className={cn('space-y-3', className)} aria-live="polite">
      <h2 className="font-display text-sm font-extrabold uppercase tracking-widest text-ink-soft">
        {mode === 'all' ? t('describe.history') : t('describe.thisRound')}
      </h2>

      {rounds.map((round) => (
        <div key={round} className="space-y-2">
          {rounds.length > 1 && (
            <StickerBadge tone={round === currentRound ? 'yellow' : 'cream'} size="sm">
              {t('common.round')} {round}
            </StickerBadge>
          )}

          <ul className="space-y-2">
            {visible
              .filter((entry) => entry.round === round)
              .map((entry, index) => (
                <motion.li
                  key={entry.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: Math.min(index * 0.04, 0.2) }}
                  className={cn(
                    'flex items-start gap-2.5 rounded-blob border-3 border-ink bg-paper px-3 py-2 shadow-toy',
                    entry.isYou && 'bg-yellow',
                    !entry.isAlive && 'opacity-70',
                  )}
                >
                  <PlayerAvatar avatarKey={entry.avatarKey} name={entry.name} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="font-display text-xs font-extrabold uppercase text-ink-soft">
                      {entry.name}
                      {!entry.isAlive && ' · éliminé'}
                    </p>
                    <p className="break-words text-sm font-bold text-ink">{entry.body}</p>
                  </div>
                </motion.li>
              ))}
          </ul>
        </div>
      ))}
    </section>
  )
}
