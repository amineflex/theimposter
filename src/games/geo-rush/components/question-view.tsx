'use client'

import * as React from 'react'
import { Check, Flag, LockKeyhole, Send } from 'lucide-react'
import { Countdown } from '@/flexgames/ui/countdown'
import { PartyButton } from '@/flexgames/ui/party-button'
import { PartyCard } from '@/flexgames/ui/party-card'
import type { GeoPublicQuestion } from '../types'
import { CountrySilhouette, WorldMap } from './map-visual'

function QuestionVisual({ question }: { question: GeoPublicQuestion }) {
  if (question.type === 'map-capital' || question.type === 'map-country') {
    return <WorldMap geometryIndex={question.geometryIndex} />
  }
  if (question.type === 'silhouette-country') {
    return <CountrySilhouette geometryIndex={question.geometryIndex} />
  }
  if (question.type === 'flag-country') {
    return (
      <div className="flex min-h-44 items-center justify-center" aria-label="Drapeau mystère">
        <span className={`fi fi-${question.countryCode} rounded-lg border-3 border-ink shadow-toy-md text-[8rem]`} aria-hidden />
      </div>
    )
  }
  return (
    <div className="flex min-h-32 items-center justify-center">
      <Flag className="h-20 w-20 fill-green text-ink" strokeWidth={2.5} aria-hidden />
    </div>
  )
}

export function QuestionView({ question, round, total, remaining, duration, locked, pending, responseCount, totalPlayers, onSubmit }: {
  question: GeoPublicQuestion
  round: number
  total: number
  remaining: number | null
  duration: number
  locked: boolean
  pending: boolean
  responseCount: number
  totalPlayers: number
  onSubmit: (answer: string) => Promise<void>
}) {
  const [answer, setAnswer] = React.useState('')
  const submit = async (value: string) => {
    if (locked || pending || !value.trim()) return
    await onSubmit(value.trim())
  }
  return (
    <div className="flex flex-1 flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <span className="rounded-capsule border-3 border-ink bg-paper px-3 py-1 font-display text-sm font-extrabold text-ink shadow-toy">Question {round}/{total}</span>
        <Countdown remaining={remaining} total={duration} />
      </div>
      <PartyCard tone="paper" padding="md" className="overflow-hidden">
        <QuestionVisual question={question} />
        <h1 className="mt-3 text-center font-display text-xl font-extrabold leading-tight text-ink sm:text-2xl">{question.prompt}</h1>
      </PartyCard>

      {question.answerMode === 'choices' ? (
        <div className="grid grid-cols-2 gap-3">
          {question.choices.map((choice) => (
            <PartyButton key={choice} variant="paper" className="min-h-15 h-auto whitespace-normal px-3 py-3 text-base normal-case leading-tight" disabled={locked} loading={pending && answer === choice} onClick={() => { setAnswer(choice); void submit(choice) }}>
              {choice}
            </PartyButton>
          ))}
        </div>
      ) : (
        <form className="flex gap-2" onSubmit={(event) => { event.preventDefault(); void submit(answer) }}>
          <input value={answer} onChange={(event) => setAnswer(event.target.value)} disabled={locked} autoComplete="off" inputMode="text" placeholder="Ta réponse…" className="min-h-13 min-w-0 flex-1 rounded-blob border-3 border-ink bg-paper px-4 text-base font-bold text-ink shadow-toy placeholder:text-ink-soft" />
          <PartyButton type="submit" variant="yellow" size="icon" loading={pending} aria-label="Envoyer"><Send className="h-5 w-5" /></PartyButton>
        </form>
      )}

      {locked && (
        <div className="flex items-center justify-center gap-2 rounded-blob border-3 border-ink bg-green px-4 py-3 font-display text-sm font-extrabold text-ink shadow-toy">
          <Check className="h-5 w-5" aria-hidden /> Réponse envoyée · {responseCount}/{totalPlayers} <LockKeyhole className="h-4 w-4" aria-hidden />
        </div>
      )}
    </div>
  )
}
