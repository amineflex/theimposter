'use client'

import * as React from 'react'
import { MessageCircle, Send } from 'lucide-react'
import { toast } from 'sonner'
import { PartyButton } from '@/flexgames/ui/party-button'
import { PlayerAvatar } from '@/flexgames/players/player-avatar'
import { api, describeError } from '@/flexgames/core/api/client'
import { ALLOWED_REACTIONS } from '@/flexgames/chat/reactions'
import { cn } from '@/lib/utils'
import { t } from '@/i18n'
import { useRoomContext } from '@/flexgames/rooms/room-context'

const MAX_LENGTH = 200

/** Chat texte + réactions rapides. Anti-spam appliqué côté serveur. */
export function ChatPanel({ className }: { className?: string } = {}) {
  const room = useRoomContext()
  const [body, setBody] = React.useState('')
  const [sending, setSending] = React.useState(false)
  const [open, setOpen] = React.useState(false)
  const listRef = React.useRef<HTMLUListElement>(null)

  const playerById = React.useMemo(
    () => new Map(room.players.map((player) => [player.id, player])),
    [room.players],
  )

  React.useEffect(() => {
    if (!open) return
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight })
  }, [room.messages.length, open])

  const send = async (kind: 'text' | 'reaction', value: string) => {
    if (!room.room || !value.trim()) return
    setSending(true)
    try {
      await api.post('/api/chat/send', { roomId: room.room.id, kind, body: value.trim() })
      if (kind === 'text') setBody('')
      await room.refresh({ silent: true })
    } catch (error) {
      toast.error(describeError(error, t('error.network')))
    } finally {
      setSending(false)
    }
  }

  return (
    <section className={cn('rounded-blob border-3 border-ink bg-paper shadow-toy', className)}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="flex min-h-12 w-full items-center justify-between px-4 py-3 font-display text-sm font-extrabold uppercase text-ink"
      >
        <span className="flex items-center gap-2">
          <MessageCircle className="h-4 w-4" aria-hidden />
          {t('lobby.chat')}
        </span>
        <span className="rounded-capsule border-2 border-ink bg-yellow px-2 text-xs font-extrabold text-ink">
          {room.messages.length}
        </span>
      </button>

      {open && (
        <div className="border-t-3 border-ink p-3">
          <ul ref={listRef} className="max-h-56 space-y-2 overflow-y-auto" aria-live="polite">
            {room.messages.length === 0 && (
              <li className="py-4 text-center text-xs font-bold text-ink-soft">
                Aucun message pour le moment.
              </li>
            )}
            {room.messages.map((message) => {
              const author = playerById.get(message.room_player_id)
              return (
                <li key={message.id} className="flex items-start gap-2">
                  <PlayerAvatar
                    avatarKey={author?.avatar_key ?? 'rouge-mask'}
                    name={author?.name ?? '?'}
                    size="sm"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-ink-soft">
                      {author?.name ?? 'Joueur'}{' '}
                      <time dateTime={message.created_at}>
                        {new Date(message.created_at).toLocaleTimeString('fr-FR', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </time>
                    </p>
                    <p className={cn('break-words text-sm font-bold text-ink', message.kind === 'reaction' && 'text-2xl')}>
                      {message.body}
                    </p>
                  </div>
                </li>
              )
            })}
          </ul>

          <div className="mt-3 flex gap-1.5">
            {ALLOWED_REACTIONS.map((reaction) => (
              <button
                key={reaction}
                type="button"
                onClick={() => void send('reaction', reaction)}
                disabled={sending}
                className="toy-press min-h-11 flex-1 rounded-md border-3 border-ink bg-cream-deep text-xl shadow-toy disabled:opacity-50"
                aria-label={`Envoyer la réaction ${reaction}`}
              >
                {reaction}
              </button>
            ))}
          </div>

          <form
            className="mt-2 flex gap-2"
            onSubmit={(event) => {
              event.preventDefault()
              void send('text', body)
            }}
          >
            <input
              value={body}
              onChange={(event) => setBody(event.target.value.slice(0, MAX_LENGTH))}
              placeholder={t('lobby.chatPlaceholder')}
              aria-label={t('lobby.chatPlaceholder')}
              maxLength={MAX_LENGTH}
              className="h-12 min-w-0 flex-1 rounded-md border-3 border-ink bg-cream px-3 text-base font-bold text-ink shadow-toy placeholder:text-ink/35 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            />
            <PartyButton
              type="submit"
              variant="blue"
              size="icon"
              disabled={sending || !body.trim()}
              aria-label={t('lobby.send')}
            >
              <Send className="h-4 w-4" aria-hidden />
            </PartyButton>
          </form>
        </div>
      )}
    </section>
  )
}
