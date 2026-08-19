import { ArrowDown, ArrowUp, Minus } from 'lucide-react'
import { PlayerAvatar } from '@/flexgames/players/player-avatar'
import { PartyCard } from '@/flexgames/ui/party-card'
import { cn } from '@/lib/utils'
import type { LetterPopLeaderboardEntry } from '../types'

export function LetterPopLeaderboard({ entries, currentPlayerId, title = 'Classement' }: {
  entries: LetterPopLeaderboardEntry[]
  currentPlayerId?: string
  title?: string
}) {
  return (
    <div>
      <h1 className="mb-4 text-center font-display text-3xl font-extrabold uppercase text-ink">{title}</h1>
      <div className="space-y-2">
        {entries.map((entry) => {
          const change = entry.previousRank - entry.rank
          return (
            <PartyCard key={entry.id} padding="sm" shadow="sm" tone={entry.id === currentPlayerId ? 'yellow' : 'paper'} className="flex items-center gap-3">
              <span className="w-7 text-center font-display text-xl font-extrabold text-ink">{entry.rank}</span>
              <PlayerAvatar avatarKey={entry.avatarId} name={entry.name} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-display text-base font-extrabold text-ink">{entry.name}{entry.id === currentPlayerId ? ' · toi' : ''}</p>
                <p className="text-xs font-bold text-ink-soft">{entry.uniqueCount} réponse{entry.uniqueCount > 1 ? 's' : ''} unique{entry.uniqueCount > 1 ? 's' : ''}</p>
              </div>
              <span className={cn('flex items-center text-xs font-black', change > 0 ? 'text-green-deep' : change < 0 ? 'text-red' : 'text-ink-soft')}>
                {change > 0 ? <ArrowUp className="h-4 w-4" /> : change < 0 ? <ArrowDown className="h-4 w-4" /> : <Minus className="h-4 w-4" />}
              </span>
              <div className="text-right">
                {entry.roundScore > 0 && <p className="text-xs font-black text-green-deep">+{entry.roundScore}</p>}
                <p className="font-display text-lg font-extrabold tabular-nums text-ink">{entry.score}</p>
              </div>
            </PartyCard>
          )
        })}
      </div>
    </div>
  )
}
