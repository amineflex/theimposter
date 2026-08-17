'use client'

import * as React from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { PartyButton } from '@/components/party/party-button'
import { RoleBadge } from '@/components/game/role-badge'
import { t } from '@/i18n'
import type { RoomViewModel } from '../room-context'

/**
 * Rappel discret de son propre rôle, masqué par défaut.
 * Un joueur doit pouvoir revoir son mot sans le montrer à son voisin : le
 * contenu n'apparaît que sur appui, et n'est pas sélectionnable.
 */
export function MyWordReminder({ room }: { room: RoomViewModel }) {
  const [visible, setVisible] = React.useState(false)
  const myRole = room.myRole
  if (!myRole?.role) return null

  return (
    <div className="flex items-center justify-between gap-3 rounded-capsule border-3 border-ink bg-paper px-3 py-2 shadow-toy">
      <div className="flex min-w-0 items-center gap-2">
        <RoleBadge role={myRole.role} />
        <span className="no-select truncate font-display text-base font-extrabold uppercase text-ink">
          {visible ? (myRole.word ?? myRole.hint ?? t('role.mr_white.noWord')) : '••••••'}
        </span>
      </div>
      <PartyButton
        variant="ghost"
        size="sm"
        onClick={() => setVisible((value) => !value)}
        aria-pressed={visible}
        aria-label={visible ? 'Masquer mon mot' : 'Afficher mon mot'}
      >
        {visible ? <EyeOff className="h-4 w-4" aria-hidden /> : <Eye className="h-4 w-4" aria-hidden />}
      </PartyButton>
    </div>
  )
}
