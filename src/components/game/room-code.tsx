'use client'

import * as React from 'react'
import { Check, Copy, QrCode, Share2 } from 'lucide-react'
import { toast } from 'sonner'
import { PartyButton } from '@/components/party/party-button'
import { PopModal } from '@/components/party/pop-modal'
import { Shape } from '@/components/party/decor'
import { useSound } from '@/hooks/use-sound'
import { t } from '@/i18n'
import { cn } from '@/lib/utils'

export interface RoomCodeProps {
  code: string
  className?: string
}

/**
 * Code de partie : énorme, sur une carte bleue posée de travers, avec copie,
 * partage natif et QR code.
 */
export function RoomCode({ code, className }: RoomCodeProps) {
  const { play } = useSound()
  const [copied, setCopied] = React.useState(false)
  const [qrOpen, setQrOpen] = React.useState(false)
  const [qrDataUrl, setQrDataUrl] = React.useState<string | null>(null)
  const [origin, setOrigin] = React.useState('')

  React.useEffect(() => {
    setOrigin(window.location.origin)
  }, [])

  const joinUrl = origin ? `${origin}/join/${code}` : `/join/${code}`

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(joinUrl)
      play('pop')
      setCopied(true)
      toast.success(t('common.copied'))
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error('Copie impossible sur cet appareil.')
    }
  }

  const share = async () => {
    if (!navigator.share) {
      await copy()
      return
    }
    try {
      await navigator.share({
        title: 'The Imposter',
        text: `Rejoins ma partie de The Imposter (code ${code})`,
        url: joinUrl,
      })
    } catch {
      // Partage annulé par l'utilisateur : rien à signaler.
    }
  }

  const openQr = async () => {
    setQrOpen(true)
    if (qrDataUrl) return
    const QRCode = (await import('qrcode')).default
    const url = await QRCode.toDataURL(joinUrl, {
      width: 512,
      margin: 1,
      color: { dark: '#202020', light: '#fffdf5' },
    })
    setQrDataUrl(url)
  }

  return (
    <div className={cn('relative', className)}>
      <span aria-hidden className="absolute -left-2 -top-3 z-10 rotate-12">
        <Shape shape="star" tone="yellow" size={30} />
      </span>

      <div className="tilt-left-sm rounded-blob border-3 border-ink bg-blue px-4 py-4 text-center shadow-toy-md">
        <p className="font-display text-xs font-extrabold uppercase tracking-[0.2em] text-paper/90">
          {t('lobby.code')}
        </p>
        <p className="mt-1 select-all font-display text-[2.75rem] font-extrabold uppercase leading-none tracking-[0.16em] text-paper">
          {code}
        </p>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
        <PartyButton variant="yellow" size="sm" onClick={copy}>
          {copied ? <Check className="h-4 w-4" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />}
          {t('common.copy')}
        </PartyButton>
        <PartyButton variant="paper" size="sm" onClick={share}>
          <Share2 className="h-4 w-4" aria-hidden />
          {t('common.share')}
        </PartyButton>
        <PartyButton variant="paper" size="sm" onClick={openQr}>
          <QrCode className="h-4 w-4" aria-hidden />
          {t('lobby.qr')}
        </PartyButton>
      </div>

      <PopModal open={qrOpen} onOpenChange={setQrOpen} title={t('lobby.qr')} tone="blue">
        <div className="flex flex-col items-center gap-3">
          {qrDataUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- data URL générée localement
            <img
              src={qrDataUrl}
              alt={`QR code pour rejoindre la partie ${code}`}
              className="w-full max-w-[260px] rounded-blob border-3 border-ink shadow-toy"
            />
          ) : (
            <div className="h-[260px] w-[260px] rounded-blob border-3 border-ink bg-paper" />
          )}
          <p className="break-all text-center text-xs font-bold text-ink-soft">{joinUrl}</p>
        </div>
      </PopModal>
    </div>
  )
}
