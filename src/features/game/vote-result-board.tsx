'use client'

import { motion } from 'framer-motion'
import { ArrowRight, Dices } from 'lucide-react'
import { PartyCard } from '@/components/party/party-card'
import { StickerBadge } from '@/components/party/sticker-badge'
import { t } from '@/i18n'
import type { LastVoteJson } from '@/types/db'

export interface VoteResultBoardProps {
  lastVote: LastVoteJson
  players: { id: string; name: string }[]
}

/**
 * Détail du scrutin, révélé seulement après la fermeture du vote.
 * Les lignes apparaissent en cascade pour créer un peu de suspense.
 */
export function VoteResultBoard({ lastVote, players }: VoteResultBoardProps) {
  const nameOf = (id: string) => players.find((player) => player.id === id)?.name ?? '—'
  const tally = Object.entries(lastVote.tally).sort((a, b) => b[1] - a[1])

  return (
    <div className="space-y-4">
      {lastVote.tie && (
        <PartyCard tone="orange" padding="md" tilt="left" className="text-center">
          <p className="font-display text-2xl font-extrabold uppercase text-ink">{t('vote.tie')}</p>
          <p className="mt-1 text-sm font-bold text-ink">
            {lastVote.resolvedByChance ? t('vote.resolvedByChance') : t('vote.runoffBody')}
          </p>
          {lastVote.resolvedByChance && <Dices className="mx-auto mt-2 h-6 w-6 text-ink" aria-hidden />}
        </PartyCard>
      )}

      {lastVote.votes.length === 0 ? (
        <PartyCard tone="paper" padding="md" className="text-center">
          <p className="text-sm font-bold text-ink-soft">{t('vote.noElimination')}</p>
        </PartyCard>
      ) : (
        <>
          <div>
            <h2 className="mb-2 font-display text-sm font-extrabold uppercase tracking-widest text-ink-soft">
              {t('vote.results')}
            </h2>
            <ul className="space-y-2">
              {lastVote.votes.map((vote, index) => (
                <motion.li
                  key={`${vote.voterId}-${vote.targetId}`}
                  initial={{ opacity: 0, x: -14 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.16, type: 'spring', stiffness: 500, damping: 20 }}
                  className="flex items-center gap-2 rounded-capsule border-3 border-ink bg-paper px-3 py-2 shadow-toy"
                >
                  <span className="min-w-0 flex-1 truncate font-display text-sm font-extrabold text-ink">
                    {nameOf(vote.voterId)}
                  </span>
                  <ArrowRight className="h-4 w-4 shrink-0 text-ink-soft" aria-hidden />
                  <span className="min-w-0 flex-1 truncate text-right font-display text-sm font-extrabold text-ink">
                    {nameOf(vote.targetId)}
                  </span>
                </motion.li>
              ))}
            </ul>
          </div>

          <div className="flex flex-wrap gap-2">
            {tally.map(([id, count]) => (
              <StickerBadge key={id} tone={id === lastVote.eliminatedId ? 'red' : 'cream'}>
                {nameOf(id)} : {count}
              </StickerBadge>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
