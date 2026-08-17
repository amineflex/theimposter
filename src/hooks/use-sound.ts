'use client'

import * as React from 'react'
import { usePreferences } from '@/stores/preferences-store'

/**
 * Effets sonores légers générés par la Web Audio API.
 *
 * Aucun fichier audio à télécharger : les sons fonctionnent donc hors connexion
 * et n'alourdissent pas le bundle. Le jeu reste parfaitement jouable sans son.
 */
export type SoundName =
  | 'click'
  | 'pop'
  | 'join'
  | 'tick'
  | 'vote'
  | 'reveal'
  | 'eliminate'
  | 'win'
  | 'lose'
  | 'turn'

interface Tone {
  frequency: number
  duration: number
  type?: OscillatorType
  /** Décalage de départ, en secondes. */
  delay?: number
  gain?: number
}

const SOUNDS: Record<SoundName, Tone[]> = {
  // Clic de touche : court, rond, satisfaisant.
  click: [{ frequency: 420, duration: 0.06, type: 'triangle', gain: 0.18 }],
  // « Pop » de bouton : deux notes qui montent très vite.
  pop: [
    { frequency: 620, duration: 0.05, type: 'triangle', gain: 0.16 },
    { frequency: 880, duration: 0.07, type: 'triangle', delay: 0.04, gain: 0.14 },
  ],
  // Arrivée d'un joueur dans le salon.
  join: [
    { frequency: 523, duration: 0.08, type: 'triangle' },
    { frequency: 784, duration: 0.12, type: 'triangle', delay: 0.07 },
  ],
  tick: [{ frequency: 900, duration: 0.04, type: 'square', gain: 0.08 }],
  vote: [
    { frequency: 520, duration: 0.08, type: 'triangle' },
    { frequency: 700, duration: 0.1, type: 'triangle', delay: 0.07 },
  ],
  reveal: [
    { frequency: 300, duration: 0.14, type: 'sine' },
    { frequency: 480, duration: 0.18, type: 'sine', delay: 0.1 },
  ],
  turn: [{ frequency: 640, duration: 0.09, type: 'sine' }],
  eliminate: [
    { frequency: 260, duration: 0.16, type: 'sawtooth', gain: 0.14 },
    { frequency: 150, duration: 0.26, type: 'sawtooth', delay: 0.12, gain: 0.12 },
  ],
  win: [
    { frequency: 523, duration: 0.14, type: 'triangle' },
    { frequency: 659, duration: 0.14, type: 'triangle', delay: 0.12 },
    { frequency: 784, duration: 0.28, type: 'triangle', delay: 0.24 },
  ],
  lose: [
    { frequency: 392, duration: 0.16, type: 'triangle' },
    { frequency: 294, duration: 0.3, type: 'triangle', delay: 0.14 },
  ],
}

let audioContext: AudioContext | null = null

function getContext(): AudioContext | null {
  if (typeof window === 'undefined') return null
  const Ctor = window.AudioContext ?? (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!Ctor) return null
  if (!audioContext) audioContext = new Ctor()
  return audioContext
}

export function useSound() {
  const soundEnabled = usePreferences((state) => state.soundEnabled)

  const play = React.useCallback(
    (name: SoundName) => {
      if (!soundEnabled) return
      const context = getContext()
      if (!context) return
      // Les navigateurs suspendent le contexte tant qu'il n'y a pas d'interaction.
      if (context.state === 'suspended') void context.resume()

      const now = context.currentTime
      for (const tone of SOUNDS[name]) {
        const oscillator = context.createOscillator()
        const gain = context.createGain()
        oscillator.type = tone.type ?? 'sine'
        oscillator.frequency.value = tone.frequency
        const start = now + (tone.delay ?? 0)
        const peak = tone.gain ?? 0.12
        gain.gain.setValueAtTime(0.0001, start)
        gain.gain.exponentialRampToValueAtTime(peak, start + 0.012)
        gain.gain.exponentialRampToValueAtTime(0.0001, start + tone.duration)
        oscillator.connect(gain).connect(context.destination)
        oscillator.start(start)
        oscillator.stop(start + tone.duration + 0.02)
      }
    },
    [soundEnabled],
  )

  return { play, soundEnabled }
}
