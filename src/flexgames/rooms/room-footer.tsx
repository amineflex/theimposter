'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Flag, LogOut } from 'lucide-react'
import { toast } from 'sonner'
import { PartyButton } from '@/flexgames/ui/party-button'
import { PopModal } from '@/flexgames/ui/pop-modal'
import { SoundToggle } from '@/flexgames/audio/sound-toggle'
import { api, describeError } from '@/flexgames/core/api/client'
import { t } from '@/i18n'
import { useRoomContext } from './room-context'

/**
 * Pied de page commun à toutes les phases en ligne : son, signalement et
 * départ. Quitter en cours de partie marque le joueur comme éliminé côté
 * serveur (et transfère l'hôte si nécessaire).
 */
export function RoomFooter() {
  const room = useRoomContext()
  const router = useRouter()
  const [reportOpen, setReportOpen] = React.useState(false)
  const [reason, setReason] = React.useState('')
  const [details, setDetails] = React.useState('')
  const [sending, setSending] = React.useState(false)
  const [leaving, setLeaving] = React.useState(false)

  const leave = async () => {
    if (!room.room) return
    if (!window.confirm('Quitter la partie ? Vous serez éliminé si elle est en cours.')) return
    setLeaving(true)
    try {
      await api.post('/api/room/leave', { roomId: room.room.id })
    } catch {
      // On quitte l'écran même si l'appel échoue (réseau coupé, room expirée).
    } finally {
      setLeaving(false)
      router.push('/')
    }
  }

  const submitReport = async () => {
    if (reason.trim().length < 3) {
      toast.error('Précisez le motif (3 caractères minimum).')
      return
    }
    setSending(true)
    try {
      await api.post('/api/report', {
        roomId: room.room?.id ?? null,
        reason: reason.trim(),
        details: details.trim() || null,
      })
      toast.success('Signalement envoyé. Merci.')
      setReportOpen(false)
      setReason('')
      setDetails('')
    } catch (error) {
      toast.error(describeError(error, t('error.network')))
    } finally {
      setSending(false)
    }
  }

  return (
    <>
      <div className="mt-8 flex flex-wrap items-center justify-between gap-2 border-t-3 border-dashed border-ink/25 pt-4">
        <SoundToggle />
        <div className="flex gap-1">
          <PartyButton variant="ghost" size="sm" onClick={() => setReportOpen(true)}>
            <Flag className="h-4 w-4" aria-hidden />
            Signaler
          </PartyButton>
          <PartyButton variant="ghost" size="sm" onClick={leave} loading={leaving}>
            <LogOut className="h-4 w-4" aria-hidden />
            {t('lobby.leave')}
          </PartyButton>
        </div>
      </div>

      <PopModal
        open={reportOpen}
        onOpenChange={setReportOpen}
        title="Signaler un problème"
        tone="red"
        footer={
          <>
            <PartyButton variant="paper" size="sm" onClick={() => setReportOpen(false)}>
              {t('common.cancel')}
            </PartyButton>
            <PartyButton variant="red" size="sm" onClick={submitReport} loading={sending}>
              {t('common.confirm')}
            </PartyButton>
          </>
        }
      >
        <div className="space-y-3">
          <label className="block">
            <span className="mb-1 block font-display text-sm font-extrabold uppercase text-ink">
              Motif
            </span>
            <input
              value={reason}
              onChange={(event) => setReason(event.target.value.slice(0, 80))}
              placeholder="Insultes, pseudo inapproprié, triche…"
              className="h-12 w-full rounded-md border-3 border-ink bg-paper px-3 text-base font-bold text-ink shadow-toy placeholder:text-ink/35 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring"
            />
          </label>
          <label className="block">
            <span className="mb-1 block font-display text-sm font-extrabold uppercase text-ink">
              Détails (facultatif)
            </span>
            <input
              value={details}
              onChange={(event) => setDetails(event.target.value.slice(0, 500))}
              placeholder="Ce qui s'est passé"
              className="h-12 w-full rounded-md border-3 border-ink bg-paper px-3 text-base font-bold text-ink shadow-toy placeholder:text-ink/35 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring"
            />
          </label>
          <p className="text-xs font-bold text-ink-soft">
            Le code de la partie est transmis avec le signalement. Aucun message de chat n&apos;est
            envoyé automatiquement.
          </p>
        </div>
      </PopModal>
    </>
  )
}
