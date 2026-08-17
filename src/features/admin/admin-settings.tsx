'use client'

import * as React from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { LoadingState } from '@/components/game/states'
import { api, ApiClientError } from '@/lib/api/client'
import { getSupabaseBrowserClient } from '@/lib/supabase/client'

interface SettingRow {
  key: string
  value: unknown
}

const LABELS: Record<string, string> = {
  room_expiry_hours: "Durée de vie d'une room (heures)",
  chat_enabled: 'Chat activé',
  public_rooms_enabled: 'Parties publiques activées',
  max_rooms_per_hour: 'Rooms max par joueur et par heure',
}

/** Réglages globaux stockés dans `app_settings`. */
export function AdminSettings() {
  const [settings, setSettings] = React.useState<SettingRow[] | null>(null)
  const [savingKey, setSavingKey] = React.useState<string | null>(null)

  const load = React.useCallback(async () => {
    const { data } = await getSupabaseBrowserClient().from('app_settings').select('*').order('key')
    setSettings((data ?? []) as SettingRow[])
  }, [])

  React.useEffect(() => {
    void load()
  }, [load])

  const save = async (key: string, value: unknown) => {
    setSavingKey(key)
    try {
      await api.post('/api/admin/settings', { key, value })
      toast.success('Réglage enregistré.')
      await load()
    } catch (error) {
      toast.error(error instanceof ApiClientError ? error.message : 'Enregistrement impossible.')
    } finally {
      setSavingKey(null)
    }
  }

  if (settings === null) return <LoadingState />

  return (
    <ul className="space-y-3">
      {settings.map((setting) => (
        <li
          key={setting.key}
          className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card px-3 py-3"
        >
          <div className="min-w-0">
            <p className="font-medium">{LABELS[setting.key] ?? setting.key}</p>
            <p className="font-mono text-xs text-muted-foreground">{setting.key}</p>
          </div>
          {typeof setting.value === 'boolean' ? (
            <Switch
              checked={setting.value}
              disabled={savingKey === setting.key}
              onCheckedChange={(checked) => void save(setting.key, checked)}
              aria-label={LABELS[setting.key] ?? setting.key}
            />
          ) : (
            <NumberField
              value={Number(setting.value ?? 0)}
              disabled={savingKey === setting.key}
              onSave={(value) => void save(setting.key, value)}
              label={LABELS[setting.key] ?? setting.key}
            />
          )}
        </li>
      ))}
    </ul>
  )
}

function NumberField({
  value,
  onSave,
  disabled,
  label,
}: {
  value: number
  onSave: (value: number) => void
  disabled?: boolean
  label: string
}) {
  const [draft, setDraft] = React.useState(String(value))
  return (
    <div className="flex items-center gap-2">
      <Input
        value={draft}
        onChange={(event) => setDraft(event.target.value.replace(/[^0-9]/g, ''))}
        inputMode="numeric"
        aria-label={label}
        className="h-11 w-24 text-center"
      />
      <Button
        size="sm"
        variant="secondary"
        disabled={disabled || draft === String(value) || draft === ''}
        onClick={() => onSave(Number(draft))}
      >
        OK
      </Button>
    </div>
  )
}
