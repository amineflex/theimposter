'use client'

import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/game/states'
import { formatDuration } from '@/lib/utils'
import { t } from '@/i18n'
import type { AdminStats } from '@/types/db'

/** Statistiques principales (agrégats anonymes). */
export function AdminOverview({ stats }: { stats: AdminStats | null }) {
  if (!stats) {
    return (
      <EmptyState
        title="Statistiques indisponibles"
        message="Vérifiez que la migration a bien créé la fonction admin_stats()."
      />
    )
  }

  const tiles: { label: string; value: string }[] = [
    { label: t('admin.stats.gamesToday'), value: String(stats.games_today) },
    { label: t('admin.stats.gamesTotal'), value: String(stats.games_total) },
    { label: t('admin.stats.playersToday'), value: String(stats.players_today) },
    { label: t('admin.stats.activeRooms'), value: String(stats.active_rooms) },
    { label: t('admin.stats.avgDuration'), value: formatDuration(stats.avg_duration_seconds) },
    { label: t('admin.stats.avgPlayers'), value: String(stats.avg_player_count) },
    {
      label: t('admin.stats.topMode'),
      value: stats.most_played_mode ? t(`mode.${stats.most_played_mode}`) : ' · ',
    },
    { label: t('admin.stats.words'), value: String(stats.words_total) },
    { label: t('admin.stats.openReports'), value: String(stats.open_reports) },
  ]

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {tiles.map((tile) => (
          <Card key={tile.label}>
            <CardContent className="p-4 pt-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">{tile.label}</p>
              <p className="mt-1 text-2xl font-bold tabular-nums">{tile.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardContent className="p-4 pt-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            {t('admin.stats.topPacks')}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {stats.top_packs.length === 0 ? (
              <span className="text-sm text-muted-foreground">Aucune donnée pour le moment.</span>
            ) : (
              stats.top_packs.map((pack) => (
                <Badge key={pack.pack} variant="secondary">
                  {pack.pack} · {pack.games}
                </Badge>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
