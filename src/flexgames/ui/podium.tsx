import { Crown, Medal } from 'lucide-react'
import { PlayerAvatar } from '@/flexgames/players/player-avatar'
import { cn } from '@/lib/utils'

export interface PodiumEntry {
  id: string
  name: string
  avatarId: string
  score: number
  rank?: number
}

export function Podium({ entries, currentPlayerId }: { entries: PodiumEntry[]; currentPlayerId?: string }) {
  const ordered = [entries[1], entries[0], entries[2]].filter((entry): entry is PodiumEntry => Boolean(entry))
  return (
    <div className="flex items-end justify-center gap-2 pt-5" aria-label="Podium final">
      {ordered.map((entry) => {
        const actualRank = entry.rank ?? entries.findIndex((candidate) => candidate.id === entry.id) + 1
        return (
          <div key={entry.id} className={cn('flex min-w-0 flex-1 flex-col items-center', actualRank === 1 && '-mt-5')}>
            {actualRank === 1 ? <Crown className="mb-1 h-8 w-8 fill-yellow text-ink" aria-hidden /> : <Medal className="mb-1 h-6 w-6 text-ink" aria-hidden />}
            <PlayerAvatar avatarKey={entry.avatarId} name={entry.name} size={actualRank === 1 ? 'lg' : 'md'} />
            <div className={cn(
              'mt-2 flex w-full flex-col items-center rounded-t-blob border-3 border-b-0 border-ink px-1 py-3 text-center text-ink',
              actualRank === 1 ? 'min-h-32 bg-yellow' : actualRank === 2 ? 'min-h-24 bg-blue text-paper' : 'min-h-20 bg-orange',
            )}>
              <span className="font-display text-2xl font-extrabold">{actualRank}</span>
              <span className="w-full truncate font-display text-sm font-extrabold">{entry.name}{entry.id === currentPlayerId ? ' · toi' : ''}</span>
              <span className="text-xs font-black tabular-nums">{entry.score} pts</span>
            </div>
          </div>
        )
      })}
    </div>
  )
}
