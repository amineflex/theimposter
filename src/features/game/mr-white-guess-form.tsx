'use client'

import * as React from 'react'
import { motion } from 'framer-motion'
import { PartyButton } from '@/components/party/party-button'
import { PartyCard } from '@/components/party/party-card'
import { ResultBurst } from '@/components/party/result-burst'
import { Shape } from '@/components/party/decor'
import { t } from '@/i18n'

export interface MrWhiteGuessFormProps {
  playerName: string
  /** Renvoie `true` si la réponse est correcte (la validation est faite ailleurs). */
  onSubmit: (guess: string) => Promise<boolean>
}

/** Dernière chance de Mr. White : une seule tentative, façon mini-jeu. */
export function MrWhiteGuessForm({ playerName, onSubmit }: MrWhiteGuessFormProps) {
  const [guess, setGuess] = React.useState('')
  const [submitting, setSubmitting] = React.useState(false)
  const [result, setResult] = React.useState<boolean | null>(null)

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!guess.trim() || submitting) return
    setSubmitting(true)
    try {
      setResult(await onSubmit(guess.trim()))
    } finally {
      setSubmitting(false)
    }
  }

  if (result !== null) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center">
        <ResultBurst>
          <p className="toy-title text-4xl uppercase text-blue">
            {result ? t('mrWhite.correct') : t('mrWhite.wrong')}
          </p>
        </ResultBurst>
      </div>
    )
  }

  return (
    <motion.form
      onSubmit={submit}
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22 }}
      className="flex flex-1 flex-col items-center justify-center gap-5"
    >
      <PartyCard tone="paper" padding="lg" tilt="left" className="w-full text-center">
        <span aria-hidden className="absolute -left-3 -top-3 rotate-12">
          <Shape shape="triangle" tone="blue" size={28} />
        </span>
        <p className="toy-title text-4xl uppercase text-blue">{t('mrWhite.title')}</p>
        <p className="mt-3 font-display text-2xl font-extrabold uppercase text-ink">
          {t('mrWhite.lastChance')}
        </p>
        <p className="mt-2 text-sm font-bold text-ink-soft">{t('mrWhite.guessPrompt')}</p>
        <p className="mt-1 font-display text-sm font-extrabold uppercase text-ink-soft">{playerName}</p>
      </PartyCard>

      <input
        value={guess}
        onChange={(event) => setGuess(event.target.value)}
        placeholder={t('mrWhite.placeholder')}
        aria-label={t('mrWhite.guessPrompt')}
        maxLength={60}
        autoFocus
        autoComplete="off"
        className="h-16 w-full rounded-blob border-3 border-ink bg-paper px-4 text-center font-display text-2xl font-extrabold uppercase text-ink shadow-toy-md placeholder:font-sans placeholder:text-base placeholder:font-bold placeholder:normal-case placeholder:text-ink/35 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      />

      <PartyButton
        type="submit"
        variant="blue"
        size="xl"
        block
        loading={submitting}
        disabled={!guess.trim()}
      >
        {t('mrWhite.confirm')}
      </PartyButton>
      <p className="text-center text-xs font-bold text-ink-soft">
        La casse, les accents et la ponctuation n&apos;ont pas d&apos;importance.
      </p>
    </motion.form>
  )
}
