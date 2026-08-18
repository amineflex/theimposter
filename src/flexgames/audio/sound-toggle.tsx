'use client'

import { Volume2, VolumeX } from 'lucide-react'
import { PartyButton } from '@/flexgames/ui/party-button'
import { useSound } from '@/flexgames/audio/use-sound'
import { usePreferences } from '@/flexgames/core/preferences-store'
import { t } from '@/i18n'

/** Bascule son on/off, mémorisée localement. */
export function SoundToggle() {
  const soundEnabled = usePreferences((state) => state.soundEnabled)
  const toggleSound = usePreferences((state) => state.toggleSound)
  const { play } = useSound()

  return (
    <PartyButton
      variant="ghost"
      size="sm"
      onClick={() => {
        if (!soundEnabled) play('pop')
        toggleSound()
      }}
      aria-pressed={soundEnabled}
    >
      {soundEnabled ? (
        <Volume2 className="h-4 w-4" aria-hidden />
      ) : (
        <VolumeX className="h-4 w-4" aria-hidden />
      )}
      {t('common.sound')} : {soundEnabled ? t('common.soundOn') : t('common.soundOff')}
    </PartyButton>
  )
}
