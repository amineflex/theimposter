'use client'

import * as React from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { EmptyState, LoadingState } from '@/components/game/states'
import { api, describeError } from '@/lib/api/client'
import { getSupabaseBrowserClient } from '@/lib/supabase/client'

interface ReportRow {
  id: string
  room_id: string | null
  reason: string
  details: string | null
  status: 'open' | 'reviewed' | 'dismissed'
  created_at: string
}

/** Traitement des signalements (lecture via RLS admin). */
export function AdminReports() {
  const [reports, setReports] = React.useState<ReportRow[] | null>(null)

  const load = React.useCallback(async () => {
    const { data, error } = await getSupabaseBrowserClient()
      .from('reports')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100)
    if (error) {
      toast.error('Chargement impossible.')
      setReports([])
      return
    }
    setReports((data ?? []) as ReportRow[])
  }, [])

  // Chargement initial : l'écriture d'état a lieu après l'`await`.
  React.useEffect(() => {
    let cancelled = false
    void (async () => {
      const { data, error } = await getSupabaseBrowserClient()
        .from('reports')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100)
      if (cancelled) return
      if (error) {
        toast.error('Chargement impossible.')
        setReports([])
        return
      }
      setReports((data ?? []) as ReportRow[])
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const setStatus = async (id: string, status: ReportRow['status']) => {
    try {
      await api.patch('/api/admin/reports', { id, status })
      await load()
    } catch (error) {
      toast.error(describeError(error, 'Action impossible.'))
    }
  }

  if (reports === null) return <LoadingState />
  if (reports.length === 0) return <EmptyState title="Aucun signalement" />

  return (
    <ul className="space-y-2">
      {reports.map((report) => (
        <li key={report.id} className="rounded-lg border border-border bg-card p-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={report.status === 'open' ? 'danger' : 'outline'}>{report.status}</Badge>
            <span className="font-semibold">{report.reason}</span>
            <span className="text-xs text-muted-foreground">
              {new Date(report.created_at).toLocaleString('fr-FR')}
            </span>
          </div>
          {report.details && <p className="mt-2 text-sm text-muted-foreground">{report.details}</p>}
          {report.status === 'open' && (
            <div className="mt-2 flex gap-2">
              <Button size="sm" variant="secondary" onClick={() => void setStatus(report.id, 'reviewed')}>
                Traité
              </Button>
              <Button size="sm" variant="ghost" onClick={() => void setStatus(report.id, 'dismissed')}>
                Ignorer
              </Button>
            </div>
          )}
        </li>
      ))}
    </ul>
  )
}
