'use client'

import { motion } from 'framer-motion'
import { PlayerAvatar } from '@/flexgames/players/player-avatar'
import { PlayerChip } from '@/flexgames/ui/player-bubble'
import { StickerBadge } from '@/flexgames/ui/sticker-badge'
import { PartyCard } from '@/flexgames/ui/party-card'
import { RoleBadge } from '@/games/the-imposter/components/role-badge'
import { Shape } from '@/flexgames/ui/decor'
import { t } from '@/i18n'
import type { DescriptionRounds, Role } from '@/games/the-imposter/engine/types'

export interface DiscussionPlayer {
  id: string
  name: string
  avatarKey: string
  isAlive: boolean
  revealedRole?: Role | null
}

export interface DiscussionBoardProps {
  players: DiscussionPlayer[]
  speakingOrder: string[]
  currentSpeakerId: string | null
  descriptionPass: number
  totalPasses: DescriptionRounds
}

/** Orateur courant en grand, puis l'ordre de parole en pastilles. */
export function DiscussionBoard({
  players,
  speakingOrder,
  currentSpeakerId,
  descriptionPass,
  totalPasses,
}: DiscussionBoardProps) {
  const byId = new Map(players.map((player) => [player.id, player]))
  const ordered = speakingOrder.map((id) => byId.get(id)).filter((p): p is DiscussionPlayer => Boolean(p))
  const speaker = currentSpeakerId ? byId.get(currentSpeakerId) : null
  const first = ordered[0]
  const speakerIndex = currentSpeakerId ? speakingOrder.indexOf(currentSpeakerId) : -1
  const next = speakerIndex >= 0 ? ordered[speakerIndex + 1] : undefined

  return (
    <section className="space-y-4">
      <PartyCard tone="yellow" padding="lg" tilt="right" className="text-center">
        <span aria-hidden className="absolute -left-3 -top-3 rotate-12">
          <Shape shape="star" tone="blue" size={28} />
        </span>

        <StickerBadge tone="paper" size="sm">
          {totalPasses === 'free'
            ? t('discussion.free')
            : t('discussion.pass', { current: descriptionPass, total: totalPasses })}
        </StickerBadge>

        {speaker ? (
          <motion.div
            key={speaker.id}
            initial={{ scale: 0.86, opacity: 0, rotate: -3 }}
            animate={{ scale: 1, opacity: 1, rotate: 0 }}
            transition={{ type: 'spring', stiffness: 520, damping: 16 }}
            className="mt-3 flex flex-col items-center gap-2"
          >
            <PlayerAvatar avatarKey={speaker.avatarKey} name={speaker.name} size="xl" />
            <p className="toy-title-ink text-3xl uppercase leading-none">{speaker.name}</p>
            <p className="font-display text-lg font-extrabold uppercase text-ink">à toi de jouer !</p>
          </motion.div>
        ) : (
          <p className="mt-3 font-display text-xl font-extrabold uppercase text-ink">
            {first ? t('discussion.starts', { name: first.name }) : t('discussion.free')}
          </p>
        )}

        {next && (
          <p className="mt-3 text-xs font-extrabold uppercase tracking-widest text-ink/70">
            {t('discussion.next')} : {next.name}
          </p>
        )}
      </PartyCard>

      <div>
        <h2 className="mb-2 font-display text-sm font-extrabold uppercase tracking-widest text-ink-soft">
          {t('discussion.order')}
        </h2>
        <ol className="space-y-2">
          {ordered.map((player, index) => (
            <li key={player.id}>
              <PlayerChip
                name={player.name}
                avatarKey={player.avatarKey}
                isAlive={player.isAlive}
                highlighted={player.id === currentSpeakerId}
                leading={
                  <span className="w-5 text-center font-display text-sm font-extrabold tabular-nums text-ink-soft">
                    {index + 1}
                  </span>
                }
                trailing={
                  player.revealedRole ? (
                    <RoleBadge role={player.revealedRole} />
                  ) : player.id === currentSpeakerId ? (
                    <StickerBadge tone="red" size="sm">
                      en cours
                    </StickerBadge>
                  ) : undefined
                }
              />
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}
