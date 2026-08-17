'use client'

import Link from 'next/link'
import { Home, RotateCcw, Settings2 } from 'lucide-react'
import { PartyButton } from '@/components/party/party-button'
import { PartyCard } from '@/components/party/party-card'
import { PlayerChip } from '@/components/party/player-bubble'
import { Confetti, ResultBurst } from '@/components/party/result-burst'
import { RoleBadge } from '@/components/game/role-badge'
import { t } from '@/i18n'
import type { GameState, Role, Winner } from '@/lib/game-engine/types'

export interface ResultPlayerView {
  id: string
  name: string
  role: Role
  isAlive: boolean
  avatarKey: string
}

export interface GameResultProps {
  /** Mode local : l'état complet du moteur. */
  state?: GameState
  /** Mode en ligne : données reconstituées depuis la vue publique. */
  view?: {
    mode: GameState['mode']
    winner: Winner | null
    abandoned: boolean
    civilianWord: string | null
    undercoverWord: string | null
    impostorHint: string | null
    players: ResultPlayerView[]
    mrWhiteGuess: { name: string; guess: string; correct: boolean } | null
  }
  avatarFor?: (playerId: string) => string
  onReplay?: () => void
  onChangeSettings?: () => void
  replayLoading?: boolean
}

/** Écran de fin : vainqueur en énorme, rôles révélés, boutons de reprise. */
export function GameResult({
  state,
  view,
  avatarFor,
  onReplay,
  onChangeSettings,
  replayLoading,
}: GameResultProps) {
  const resolved = view ?? (state ? fromState(state, avatarFor) : null)
  if (!resolved) return null

  const { mode, winner, abandoned, civilianWord, undercoverWord, impostorHint, players, mrWhiteGuess } =
    resolved

  const intruders = players.filter((player) => player.role === 'undercover')
  const impostors = players.filter((player) => player.role === 'impostor')
  const mrWhites = players.filter((player) => player.role === 'mr_white')

  const noWinner = abandoned || !winner
  const civiliansWon = winner === 'civilians'
  const title = noWinner ? t('result.abandoned') : winnerTitle(winner, mode)

  return (
    <div className="space-y-6 py-2">
      {/* Confettis uniquement quand un camp gagne réellement. */}
      {!noWinner && <Confetti />}

      <ResultBurst>
        <h1
          className={`toy-title text-balance text-center text-[2.5rem] uppercase leading-[0.9] sm:text-5xl ${
            noWinner ? 'text-ink-soft' : civiliansWon ? 'text-green' : 'text-red'
          }`}
        >
          {title}
        </h1>
      </ResultBurst>

      {noWinner && (
        <p className="text-center text-sm font-bold text-ink-soft">{t('result.abandonedBody')}</p>
      )}
      {mrWhiteGuess && (
        <p className="text-center text-sm font-bold text-ink-soft">
          {mrWhiteGuess.name} a proposé « {mrWhiteGuess.guess} » —{' '}
          {mrWhiteGuess.correct ? 'correct' : 'incorrect'}.
        </p>
      )}

      {/* Mots de la partie */}
      <PartyCard tone="yellow" padding="lg" tilt="right">
        <dl className="grid gap-4 sm:grid-cols-2">
          <div>
            <dt className="font-display text-xs font-extrabold uppercase tracking-widest text-ink/70">
              {mode === 'impostor' ? t('result.secretWord') : t('result.civilianWord')}
            </dt>
            <dd className="font-display text-2xl font-extrabold uppercase leading-tight text-ink">
              {civilianWord ?? '—'}
            </dd>
          </div>
          {mode === 'undercover' && (
            <div>
              <dt className="font-display text-xs font-extrabold uppercase tracking-widest text-ink/70">
                {t('result.undercoverWord')}
              </dt>
              <dd className="font-display text-2xl font-extrabold uppercase leading-tight text-ink">
                {undercoverWord ?? '—'}
              </dd>
            </div>
          )}
          {mode === 'impostor' && (
            <div>
              <dt className="font-display text-xs font-extrabold uppercase tracking-widest text-ink/70">
                {t('result.hintGiven')}
              </dt>
              <dd className="font-display text-2xl font-extrabold uppercase leading-tight text-ink">
                {impostorHint ?? '—'}
              </dd>
            </div>
          )}
        </dl>
      </PartyCard>

      {/* Qui était qui */}
      <div className="space-y-2">
        {impostors.length > 0 && (
          <RoleLine
            label={impostors.length > 1 ? t('result.impostorsWere') : t('result.impostorWas')}
            players={impostors}
          />
        )}
        {intruders.length > 0 && (
          <RoleLine
            label={intruders.length > 1 ? t('result.undercoverWere') : t('result.undercoverWas')}
            players={intruders}
          />
        )}
        {mrWhites.length > 0 && <RoleLine label={t('result.mrWhiteWas')} players={mrWhites} />}
      </div>

      <section>
        <h2 className="mb-2 font-display text-sm font-extrabold uppercase tracking-widest text-ink-soft">
          {t('result.roles')}
        </h2>
        <ul className="space-y-2">
          {players.map((player) => (
            <li key={player.id}>
              <PlayerChip
                name={player.name}
                avatarKey={player.avatarKey}
                isAlive={player.isAlive}
                trailing={<RoleBadge role={player.role} />}
              />
            </li>
          ))}
        </ul>
      </section>

      <div className="flex flex-col gap-3">
        {onReplay && (
          <PartyButton variant="red" size="xl" block onClick={onReplay} loading={replayLoading}>
            <RotateCcw className="h-5 w-5" aria-hidden />
            {t('result.replay')}
          </PartyButton>
        )}
        {onChangeSettings && (
          <PartyButton variant="paper" size="lg" block onClick={onChangeSettings}>
            <Settings2 className="h-5 w-5" aria-hidden />
            {t('result.changeSettings')}
          </PartyButton>
        )}
        <PartyButton asChild variant="ghost" size="sm" block>
          <Link href="/">
            <Home className="h-4 w-4" aria-hidden />
            {t('common.backHome')}
          </Link>
        </PartyButton>
      </div>
    </div>
  )
}

function RoleLine({ label, players }: { label: string; players: ResultPlayerView[] }) {
  return (
    <div className="flex flex-wrap items-baseline gap-2 rounded-capsule border-3 border-ink bg-paper px-4 py-2 shadow-toy">
      <span className="font-display text-xs font-extrabold uppercase tracking-widest text-ink-soft">
        {label}
      </span>
      <span className="font-display text-lg font-extrabold uppercase text-ink">
        {players.map((player) => player.name).join(', ')}
      </span>
    </div>
  )
}

function winnerTitle(winner: Winner, mode: GameState['mode']): string {
  if (winner === 'civilians') {
    return mode === 'impostor' ? t('result.win.players') : t('result.win.civilians')
  }
  if (winner === 'impostors') return t('result.win.impostors')
  if (winner === 'undercover') return t('result.win.undercover')
  return t('result.win.mrWhite')
}

function fromState(state: GameState, avatarFor?: (playerId: string) => string) {
  const guess = state.lastMrWhiteGuess
  return {
    mode: state.mode,
    winner: state.winner,
    abandoned: state.winner === null,
    civilianWord: state.words.civilianWord,
    undercoverWord: state.words.undercoverWord,
    impostorHint: state.words.impostorHint,
    players: state.players.map((player) => ({
      id: player.id,
      name: player.name,
      role: player.role,
      isAlive: player.isAlive,
      avatarKey: avatarFor?.(player.id) ?? 'rouge-mask',
    })),
    mrWhiteGuess: guess
      ? {
          name: state.players.find((player) => player.id === guess.playerId)?.name ?? 'Mr. White',
          guess: guess.guess,
          correct: guess.correct,
        }
      : null,
  }
}
