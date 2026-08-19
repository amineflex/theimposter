'use client'

import * as React from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { Check, FastForward, LockKeyhole, Save, Settings2, Sparkles, Trophy, X } from 'lucide-react'
import { toast } from 'sonner'
import { api, describeError } from '@/flexgames/core/api/client'
import { useSound } from '@/flexgames/audio/use-sound'
import { PlayerAvatar } from '@/flexgames/players/player-avatar'
import { useRoomContext } from '@/flexgames/rooms/room-context'
import { useGameAction } from '@/flexgames/session/use-game-action'
import { useDeadlineTicker } from '@/flexgames/session/use-deadline-ticker'
import { Countdown } from '@/flexgames/ui/countdown'
import { Podium } from '@/flexgames/ui/podium'
import { PartyButton } from '@/flexgames/ui/party-button'
import { PartyCard } from '@/flexgames/ui/party-card'
import { Confetti, ResultBurst } from '@/flexgames/ui/result-burst'
import { useCountdown } from '@/flexgames/ui/use-countdown'
import { cn } from '@/lib/utils'
import { CATEGORY_BY_ID, categoryLabel } from '../data/categories'
import { areLetterPopAnswersComplete } from '../engine/normalization'
import type {
  LetterPopCategoryId,
  LetterPopPlayerPrivateView,
  LetterPopPublicState,
} from '../types'
import { isLetterPopPublicState } from '../types'
import { LetterPopLeaderboard } from './leaderboard'

export function GameScreen() {
  const room = useRoomContext()
  const refreshRoom = room.refresh
  const { send, pending } = useGameAction()
  const { play } = useSound()
  const session = room.session
  const state = session && isLetterPopPublicState(session.state) ? session.state : null
  const [privateState, setPrivateState] = React.useState<LetterPopPlayerPrivateView | null>(null)
  const sessionId = session?.id
  const version = session?.version
  const phase = state?.phase
  const roundIndex = state?.roundIndex
  const revealCategoryId = state?.reveal?.categoryId
  const hasUniqueReveal = state?.reveal?.entries.some((entry) => entry.playerId === room.me?.id && entry.points === 100) ?? false
  const isWinner = state?.winnerIds.includes(room.me?.id ?? '') ?? false

  const refreshPrivate = React.useCallback(async () => {
    if (!sessionId) return
    try {
      const response = await api.get<{ state: LetterPopPlayerPrivateView }>(`/api/game/private-state?sessionId=${sessionId}`)
      setPrivateState(response.state)
    } catch {
      // Le snapshot public continue de s'afficher ; le prochain événement retente.
    }
  }, [sessionId])

  React.useEffect(() => {
    if (!sessionId) return
    let cancelled = false
    void api.get<{ state: LetterPopPlayerPrivateView }>(`/api/game/private-state?sessionId=${sessionId}`).then((response) => {
      if (!cancelled) setPrivateState(response.state)
    }).catch(() => {
      // Le snapshot public continue de s'afficher ; le prochain événement retente.
    })
    return () => { cancelled = true }
  }, [sessionId, version])

  const tick = React.useCallback(async () => {
    if (!session || session.status !== 'active') return
    await send({ type: 'tick' })
    await Promise.all([refreshRoom({ silent: true }), refreshPrivate()])
  }, [session, send, refreshRoom, refreshPrivate])
  useDeadlineTicker({ endsAt: state?.phaseEndsAt, active: session?.status === 'active', onExpired: tick })

  React.useEffect(() => {
    if (phase === 'round_intro') play('letter')
    if (phase === 'final_countdown') play('complete')
    if (phase === 'reveal') play(hasUniqueReveal ? 'unique' : 'reveal')
    if (phase === 'round_results' || phase === 'mid_leaderboard') play('pop')
    if (phase === 'results') play(isWinner ? 'win' : 'pop')
  }, [phase, roundIndex, revealCategoryId, hasUniqueReveal, isWinner, play])

  if (!state || !session) return <PartyCard tone="paper" className="my-auto text-center font-bold text-ink">Préparation de LetterPop!…</PartyCard>

  const playerPrivate = privateState?.roundIndex === state.roundIndex ? privateState : null
  if (state.phase === 'round_intro') return <RoundIntro state={state} />
  if (state.phase === 'answering' || state.phase === 'final_countdown') {
    if (!playerPrivate) return <PartyCard tone="paper" className="my-auto text-center font-bold text-ink">Récupération de tes réponses…</PartyCard>
    return <Answering key={`${session.id}:${state.roundIndex}`} state={state} privateState={playerPrivate} send={send} refresh={async () => { await Promise.all([refreshRoom({ silent: true }), refreshPrivate()]) }} />
  }
  if (state.phase === 'validation') {
    return <Validation state={state} privateState={playerPrivate} pending={pending} decide={async (type, pendingId, valid) => {
      try {
        await send({ type, pendingId, valid })
        await Promise.all([refreshRoom({ silent: true }), refreshPrivate()])
      } catch (error) { toast.error(describeError(error)) }
    }} />
  }
  if (state.phase === 'reveal' && state.reveal) {
    return <Reveal state={state} isHost={room.me?.is_host ?? false} pending={pending} next={async () => {
      try { await send({ type: 'advance' }); await refreshRoom({ silent: true }) } catch (error) { toast.error(describeError(error)) }
    }} />
  }
  if (state.phase === 'round_results' || state.phase === 'mid_leaderboard') {
    return <LetterPopLeaderboard entries={state.leaderboard} currentPlayerId={room.me?.id} title={state.phase === 'mid_leaderboard' ? 'Mi-partie !' : `Manche ${state.roundIndex + 1} terminée`} />
  }
  return <Results state={state} />
}

function LetterTile({ letter, small = false }: { letter: string; small?: boolean }) {
  return (
    <motion.div initial={{ scale: .4, rotate: -12 }} animate={{ scale: 1, rotate: -3 }} transition={{ type: 'spring', stiffness: 420, damping: 20 }} className={cn(
      'inline-flex items-center justify-center rounded-blob border-4 border-ink bg-yellow font-display font-black text-ink shadow-toy-lg',
      small ? 'h-20 w-20 text-6xl' : 'h-40 w-40 text-9xl',
    )}>{letter}</motion.div>
  )
}

function RoundIntro({ state }: { state: LetterPopPublicState }) {
  const remaining = useCountdown(state.phaseEndsAt)
  return (
    <div className="my-auto space-y-6 text-center">
      <p className="font-display text-xl font-extrabold uppercase tracking-widest text-ink-soft">La lettre est…</p>
      <LetterTile letter={state.letter} />
      <p className="font-display text-lg font-extrabold uppercase text-ink">Manche {state.roundIndex + 1} / {state.totalRounds}</p>
      <div className="flex flex-wrap justify-center gap-2">
        {state.categories.map((categoryId) => <span key={categoryId} className="rounded-capsule border-3 border-ink bg-paper px-3 py-1 text-xs font-extrabold text-ink shadow-toy">{CATEGORY_BY_ID[categoryId].emoji} {categoryLabel(categoryId)}</span>)}
      </div>
      <span className="sr-only">Début dans {remaining ?? 0} secondes</span>
    </div>
  )
}

function Answering({ state, privateState, send, refresh }: {
  state: LetterPopPublicState
  privateState: LetterPopPlayerPrivateView
  send: <T = unknown>(action: { type: string } & Record<string, unknown>) => Promise<T>
  refresh: () => Promise<void>
}) {
  const { play } = useSound()
  const remaining = useCountdown(state.phaseEndsAt)
  const [answers, setAnswers] = React.useState<Partial<Record<LetterPopCategoryId, string>>>(privateState.answers)
  const [saving, setSaving] = React.useState(false)
  const [saved, setSaved] = React.useState(Boolean(privateState.savedAt))
  const [finishing, setFinishing] = React.useState(false)
  const dirty = React.useRef(false)
  const inputs = React.useRef<Array<HTMLInputElement | null>>([])
  const locked = privateState.locked
  const complete = areLetterPopAnswersComplete(state.categories, answers)

  React.useEffect(() => {
    if (!dirty.current || locked) return
    const timeout = window.setTimeout(() => {
      setSaving(true)
      void send({ type: 'save', roundIndex: state.roundIndex, answers }).then(() => {
        dirty.current = false
        setSaved(true)
      }).catch(() => setSaved(false)).finally(() => setSaving(false))
    }, 500)
    return () => window.clearTimeout(timeout)
  }, [answers, locked, send, state.roundIndex])

  const finish = async () => {
    if (!complete || locked || state.phase !== 'answering') return
    setFinishing(true)
    try {
      const response = await send<{ result: { accepted: boolean } }>({ type: 'finish', roundIndex: state.roundIndex, answers })
      if (response.result.accepted) play('pop')
      await refresh()
    } catch (error) { toast.error(describeError(error)) } finally { setFinishing(false) }
  }

  return (
    <div className="flex flex-1 flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="font-display text-xs font-extrabold uppercase tracking-widest text-ink-soft">Manche {state.roundIndex + 1} / {state.totalRounds}</p>
          {state.phase === 'final_countdown' && <p className="font-display text-sm font-extrabold uppercase text-red">{state.triggeredBy?.name} a fini !</p>}
        </div>
        <LetterTile letter={state.letter} small />
        <Countdown remaining={remaining} total={state.phase === 'final_countdown' ? 10 : state.config.durationSeconds} warnAt={3} />
      </div>

      {state.phase === 'final_countdown' && (
        <PartyCard tone="red" padding="sm" className="text-center font-display text-lg font-extrabold uppercase">
          Plus que {remaining ?? 10} seconde{remaining === 1 ? '' : 's'} !
        </PartyCard>
      )}

      <div className="space-y-3 pb-24">
        {state.categories.map((categoryId, index) => {
          const category = CATEGORY_BY_ID[categoryId]
          return (
            <label key={categoryId} className="block rounded-blob border-3 border-ink bg-paper p-3 shadow-toy">
              <span className="mb-2 block font-display text-xs font-extrabold uppercase tracking-widest text-ink-soft">{category.emoji} {category.label}</span>
              <input
                ref={(node) => { inputs.current[index] = node }}
                value={answers[categoryId] ?? ''}
                disabled={locked}
                maxLength={80}
                autoComplete="off"
                autoCapitalize="sentences"
                enterKeyHint={index === state.categories.length - 1 ? 'done' : 'next'}
                onFocus={(event) => window.setTimeout(() => event.currentTarget.scrollIntoView({ block: 'center', behavior: 'smooth' }), 150)}
                onKeyDown={(event) => {
                  if (event.key !== 'Enter') return
                  event.preventDefault()
                  if (event.currentTarget.value.trim()) play('pop')
                  if (index < state.categories.length - 1) inputs.current[index + 1]?.focus()
                  else event.currentTarget.blur()
                }}
                onChange={(event) => {
                  dirty.current = true
                  setSaved(false)
                  setAnswers((current) => ({ ...current, [categoryId]: event.target.value }))
                }}
                placeholder={`${state.letter}…`}
                className="min-h-12 w-full rounded-xl border-2 border-ink bg-cream px-3 text-base font-bold text-ink outline-none focus:ring-4 focus:ring-yellow disabled:opacity-60"
              />
            </label>
          )
        })}
      </div>

      <div className="sticky bottom-3 z-20 -mt-20 space-y-2 rounded-blob border-3 border-ink bg-cream p-3 shadow-toy-lg">
        <p className="flex items-center justify-center gap-1 text-xs font-extrabold text-ink-soft">
          {locked ? <><LockKeyhole className="h-4 w-4" /> Réponses verrouillées</> : saving ? <><Save className="h-4 w-4" /> Sauvegarde…</> : saved ? <><Check className="h-4 w-4" /> Sauvegardé</> : 'Tes réponses sont sauvegardées automatiquement'}
        </p>
        <PartyButton variant={complete ? 'red' : 'cream'} size="xl" block disabled={!complete || locked || state.phase !== 'answering'} loading={finishing} onClick={() => void finish()}>
          {locked ? 'Terminé !' : 'J’ai fini !'}
        </PartyButton>
      </div>
    </div>
  )
}

function Validation({ state, privateState, pending, decide }: {
  state: LetterPopPublicState
  privateState: LetterPopPlayerPrivateView | null
  pending: boolean
  decide: (type: 'adjudicate' | 'vote', pendingId: string, valid: boolean) => Promise<void>
}) {
  const item = privateState?.adjudication
  if (!state.validation.prepared) return <PartyCard tone="yellow" className="my-auto text-center"><p className="font-display text-2xl font-extrabold uppercase">Analyse des réponses…</p></PartyCard>
  if (!item) return (
    <div className="my-auto space-y-4 text-center">
      <PartyCard tone="blue" padding="lg">
        <p className="font-display text-3xl font-extrabold uppercase">Validation en cours…</p>
        <p className="mt-2 font-bold">{state.validation.pending} réponse{state.validation.pending > 1 ? 's' : ''} à vérifier</p>
        {state.validation.mode === 'vote' && <p className="mt-2 text-sm font-bold">Votes : {state.validation.votesCast}/{state.validation.votersTotal}</p>}
      </PartyCard>
      <p className="font-bold text-ink-soft">L’arbitrage avance automatiquement.</p>
    </div>
  )
  return (
    <div className="my-auto space-y-4">
      <p className="text-center font-display text-sm font-extrabold uppercase tracking-widest text-ink-soft">Réponse à vérifier · {state.validation.resolved + 1}/{state.validation.total}</p>
      <PartyCard tone="yellow" padding="lg" className="text-center">
        <p className="text-sm font-extrabold uppercase text-ink-soft">{categoryLabel(item.categoryId)} · lettre {item.letter}</p>
        <p className="mt-4 font-bold">{item.playerName} a écrit :</p>
        <p className="mt-2 break-words font-display text-4xl font-extrabold uppercase text-ink">{item.answer}</p>
      </PartyCard>
      {item.mode === 'vote' && item.hasVoted ? (
        <PartyCard tone="blue" className="text-center font-extrabold">Vote enregistré · {item.voteCount}/{item.votersTotal}</PartyCard>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <PartyButton variant="red" size="lg" loading={pending} onClick={() => void decide(item.mode === 'host' ? 'adjudicate' : 'vote', item.id, false)}><X className="h-5 w-5" /> Refuser</PartyButton>
          <PartyButton variant="green" size="lg" disabled={pending} onClick={() => void decide(item.mode === 'host' ? 'adjudicate' : 'vote', item.id, true)}><Check className="h-5 w-5" /> Valider</PartyButton>
        </div>
      )}
    </div>
  )
}

function Reveal({ state, isHost, pending, next }: { state: LetterPopPublicState; isHost: boolean; pending: boolean; next: () => Promise<void> }) {
  const reveal = state.reveal!
  return (
    <div className="space-y-4">
      <div className="text-center">
        <p className="font-display text-sm font-extrabold uppercase tracking-widest text-ink-soft">{state.letter} comme…</p>
        <h1 className="font-display text-3xl font-extrabold uppercase text-ink">{categoryLabel(reveal.categoryId)}</h1>
      </div>
      <div className="space-y-2">
        {reveal.entries.map((entry) => (
          <ResultBurst key={entry.playerId}>
            <PartyCard tone={entry.verdict === 'unique' ? 'green' : entry.verdict === 'duplicate' ? 'yellow' : 'paper'} padding="sm" className="flex items-center gap-3">
              <PlayerAvatar avatarKey={entry.avatarId} name={entry.name} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-extrabold text-ink-soft">{entry.name}</p>
                <p className="truncate font-display text-lg font-extrabold uppercase text-ink">{entry.answer || '—'}</p>
              </div>
              <div className="text-right">
                {entry.verdict === 'unique' && <p className="flex items-center gap-1 text-xs font-black uppercase text-green-deep"><Sparkles className="h-4 w-4" /> Unique !</p>}
                {entry.verdict === 'duplicate' && <p className="text-xs font-black uppercase text-ink-soft">Doublon</p>}
                <p className="font-display text-xl font-extrabold text-ink">+{entry.points}</p>
              </div>
            </PartyCard>
          </ResultBurst>
        ))}
      </div>
      {isHost && <PartyButton variant="blue" block loading={pending} onClick={() => void next()}><FastForward className="h-5 w-5" /> Suivant</PartyButton>}
    </div>
  )
}

function Results({ state }: { state: LetterPopPublicState }) {
  const room = useRoomContext()
  const [busy, setBusy] = React.useState(false)
  const winners = state.leaderboard.filter((entry) => state.winnerIds.includes(entry.id))
  const replay = async (path: '/api/room/rematch' | '/api/room/reopen') => {
    if (!room.room) return
    setBusy(true)
    try { await api.post(path, { roomId: room.room.id }); await room.refresh({ silent: true }) }
    catch (error) { toast.error(describeError(error)) } finally { setBusy(false) }
  }
  return (
    <div className="space-y-5">
      <Confetti />
      <div className="text-center">
        <Trophy className="mx-auto h-12 w-12 fill-yellow text-ink" />
        <h1 className="toy-title text-4xl text-red">{winners.length > 1 ? 'Victoire partagée !' : `${winners[0]?.name ?? 'Le gagnant'} gagne !`}</h1>
        {winners.length > 1 && <p className="font-display text-lg font-extrabold text-ink">{winners.map((winner) => winner.name).join(' & ')}</p>}
      </div>
      <PartyCard tone="paper" padding="md"><Podium entries={state.leaderboard.slice(0, 3)} currentPlayerId={room.me?.id} /></PartyCard>
      <LetterPopLeaderboard entries={state.leaderboard} currentPlayerId={room.me?.id} title="Classement final" />
      {room.me?.is_host ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <PartyButton variant="yellow" block loading={busy} onClick={() => void replay('/api/room/rematch')}>Rejouer</PartyButton>
          <PartyButton variant="paper" block disabled={busy} onClick={() => void replay('/api/room/reopen')}><Settings2 className="h-5 w-5" /> Changer les paramètres</PartyButton>
        </div>
      ) : <p className="text-center font-display font-extrabold uppercase text-ink-soft">L’hôte choisit la suite…</p>}
      <PartyButton asChild variant="ghost" block><Link href="/">Retour aux jeux</Link></PartyButton>
    </div>
  )
}
