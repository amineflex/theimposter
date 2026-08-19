'use client'

import * as React from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { Settings2, Trophy } from 'lucide-react'
import { toast } from 'sonner'
import { useRoomContext } from '@/flexgames/rooms/room-context'
import { useGameAction } from '@/flexgames/session/use-game-action'
import { useDeadlineTicker } from '@/flexgames/session/use-deadline-ticker'
import { useCountdown } from '@/flexgames/ui/use-countdown'
import { PartyButton } from '@/flexgames/ui/party-button'
import { PartyCard } from '@/flexgames/ui/party-card'
import { Confetti, ResultBurst } from '@/flexgames/ui/result-burst'
import { Podium } from '@/flexgames/ui/podium'
import { PlayerAvatar } from '@/flexgames/players/player-avatar'
import { api, describeError } from '@/flexgames/core/api/client'
import { useSound } from '@/flexgames/audio/use-sound'
import type { GeoPlayerPrivateView, GeoPublicState } from '../types'
import { isGeoPublicState } from '../types'
import { QuestionView } from './question-view'
import { GeoLeaderboard } from './leaderboard'

export function GameScreen() {
  const room = useRoomContext()
  const refreshRoom = room.refresh
  const { send, pending } = useGameAction()
  const { play } = useSound()
  const session = room.session
  const state = session && isGeoPublicState(session.state) ? session.state : null
  const [submission, setSubmission] = React.useState<{ sessionId: string; roundIndex: number } | null>(null)
  const remaining = useCountdown(state?.phaseEndsAt)
  const sessionId = session?.id
  const roundIndex = state?.roundIndex
  const phase = state?.phase
  const myRevealCorrect = state?.reveal?.results.find((entry) => entry.id === room.me?.id)?.correct
  const winnerId = state?.winnerId

  React.useEffect(() => {
    if (!sessionId || roundIndex == null || phase !== 'question') return
    let cancelled = false
    void api.get<{ state: GeoPlayerPrivateView }>(`/api/game/private-state?sessionId=${sessionId}`).then((value) => {
      if (!cancelled && value.state.submittedRound === roundIndex) setSubmission({ sessionId, roundIndex })
    }).catch(() => {})
    return () => { cancelled = true }
  }, [sessionId, roundIndex, phase])

  React.useEffect(() => {
    if (phase === 'question') play('turn')
    if (phase === 'reveal') play(myRevealCorrect ? 'win' : 'lose')
    if (phase === 'leaderboard') play('pop')
    if (phase === 'results') play(winnerId === room.me?.id ? 'win' : 'pop')
  }, [phase, roundIndex, myRevealCorrect, winnerId, play, room.me?.id])

  const tick = React.useCallback(async () => {
    if (!session || session.status !== 'active') return
    await send({ type: 'tick' })
    // Le Realtime reste le chemin rapide ; cette lecture garantit que chaque
    // joueur rejoint la phase autoritaire même après un événement manqué.
    await refreshRoom({ silent: true })
  }, [send, session, refreshRoom])
  useDeadlineTicker({ endsAt: state?.phaseEndsAt, active: session?.status === 'active', onExpired: tick })

  if (!state || !session) {
    return <PartyCard tone="paper" className="my-auto text-center font-bold text-ink">Préparation de GeoRush…</PartyCard>
  }

  const submit = async (answer: string) => {
    try {
      await send<{ result: { accepted: boolean } }>({ type: 'submit', roundIndex: state.roundIndex, answer })
      setSubmission({ sessionId: session.id, roundIndex: state.roundIndex })
      await refreshRoom({ silent: true })
      play('pop')
    } catch (error) {
      toast.error(describeError(error))
    }
  }

  if (state.phase === 'countdown') return <CountIn remaining={remaining} />
  if (state.phase === 'question' && state.question) {
    const locked = submission?.sessionId === session.id && submission.roundIndex === state.roundIndex
    return <QuestionView key={state.question.id} question={state.question} round={state.roundIndex + 1} total={state.totalQuestions} remaining={remaining} duration={state.config.durationSeconds} locked={locked} pending={pending} responseCount={state.responseCount} totalPlayers={state.totalPlayers} onSubmit={submit} />
  }
  if (state.phase === 'reveal' && state.reveal) return <Reveal state={state} currentPlayerId={room.me?.id} />
  if (state.phase === 'leaderboard') return <GeoLeaderboard entries={state.leaderboard} currentPlayerId={room.me?.id} title={`Après ${state.roundIndex + 1} questions`} />
  return <Results state={state} />
}

function CountIn({ remaining }: { remaining: number | null }) {
  return (
    <div className="my-auto text-center">
      <p className="font-display text-lg font-extrabold uppercase tracking-widest text-ink-soft">Prêts à faire le tour du monde ?</p>
      <motion.p key={remaining} initial={{ scale: .4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="toy-title mt-4 text-8xl text-yellow">{remaining ?? 3}</motion.p>
    </div>
  )
}

function Reveal({ state, currentPlayerId }: { state: GeoPublicState; currentPlayerId?: string }) {
  const mine = state.reveal?.results.find((entry) => entry.id === currentPlayerId)
  return (
    <div className="space-y-4">
      <ResultBurst>
        <PartyCard tone={mine?.correct ? 'green' : 'red'} className="w-full text-center">
          <p className="font-display text-3xl font-extrabold uppercase">{mine?.correct ? 'Bien joué !' : 'Raté !'}</p>
          <p className="mt-1 text-sm font-bold">La bonne réponse était</p>
          <p className="font-display text-2xl font-extrabold">{state.reveal?.correctAnswer}</p>
          {mine && <p className="mt-2 font-display text-lg font-extrabold">+{mine.score} points {mine.streak >= 3 ? `· série ×${mine.streak}` : ''}</p>}
        </PartyCard>
      </ResultBurst>
      <div className="space-y-2">
        {state.reveal?.results.slice().sort((a, b) => b.score - a.score).slice(0, 5).map((result) => (
          <div key={result.id} className="flex items-center gap-2 rounded-blob border-3 border-ink bg-paper px-3 py-2 text-ink shadow-toy">
            <PlayerAvatar avatarKey={result.avatarId} name={result.name} size="xs" />
            <span className="min-w-0 flex-1 truncate text-sm font-extrabold">{result.name}</span>
            <span className="font-display text-sm font-extrabold tabular-nums">+{result.score}</span>
          </div>
        ))}
        {(state.reveal?.results.length ?? 0) > 5 && <p className="text-center text-xs font-extrabold text-ink-soft">+ {(state.reveal?.results.length ?? 0) - 5} autres joueurs</p>}
      </div>
    </div>
  )
}

function Results({ state }: { state: GeoPublicState }) {
  const room = useRoomContext()
  const [busy, setBusy] = React.useState(false)
  const winner = state.leaderboard[0]
  const replay = async (path: '/api/room/rematch' | '/api/room/reopen') => {
    if (!room.room) return
    setBusy(true)
    try {
      await api.post(path, { roomId: room.room.id })
      await room.refresh({ silent: true })
    } catch (error) {
      toast.error(describeError(error))
    } finally { setBusy(false) }
  }
  return (
    <div className="space-y-5">
      <Confetti />
      <div className="text-center">
        <Trophy className="mx-auto h-12 w-12 fill-yellow text-ink" />
        {winner && <PlayerAvatar avatarKey={winner.avatarId} name={winner.name} size="lg" className="mt-2" />}
        <h1 className="toy-title text-4xl text-yellow">{winner?.name ?? 'Le gagnant'} gagne GeoRush !</h1>
        {winner && <p className="font-display text-xl font-extrabold text-ink">{winner.score} points</p>}
      </div>
      <PartyCard tone="paper" padding="md"><Podium entries={state.leaderboard.slice(0, 3)} currentPlayerId={room.me?.id} /></PartyCard>
      <GeoLeaderboard entries={state.leaderboard} currentPlayerId={room.me?.id} title="Classement final" />
      {room.me?.is_host ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <PartyButton variant="yellow" block loading={busy} onClick={() => void replay('/api/room/rematch')}>Rejouer</PartyButton>
          <PartyButton variant="paper" block disabled={busy} onClick={() => void replay('/api/room/reopen')}><Settings2 className="h-5 w-5" /> Réglages</PartyButton>
        </div>
      ) : <p className="text-center font-display font-extrabold uppercase text-ink-soft">L’hôte choisit la suite…</p>}
      <PartyButton asChild variant="ghost" block><Link href="/">Retour aux jeux</Link></PartyButton>
    </div>
  )
}
