'use client'

import * as React from 'react'
import Link from 'next/link'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowLeft, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { PartyButton } from '@/components/party/party-button'
import { StickerBadge } from '@/components/party/sticker-badge'
import { GameBanner } from '@/components/party/game-banner'
import { Countdown } from '@/components/party/countdown'
import { PlayerAvatar } from '@/components/game/player-avatar'
import { HoldToReveal } from '@/components/game/hold-to-reveal'
import { RoleRevealCard } from '@/components/party/role-reveal-card'
import { ResultBurst, CountIn } from '@/components/party/result-burst'
import { Shape, ShapeRow } from '@/components/party/decor'
import { VoteCard } from '@/components/game/vote-card'
import { GameResult } from '@/features/game/game-result'
import { SettingsPanel } from '@/features/game/settings-panel'
import { BigStepper } from '@/features/game/mode-picker'
import { DiscussionBoard } from '@/features/game/discussion-board'
import { VoteResultBoard } from '@/features/game/vote-result-board'
import { MrWhiteGuessForm } from '@/features/game/mr-white-guess-form'
import { useLocalGame, currentTurnPlayer, revealedPlayer, votingPlayer } from './local-store'
import { usePreferences } from '@/stores/preferences-store'
import { useSound } from '@/hooks/use-sound'
import { useLocalCountdown } from '@/hooks/use-countdown'
import { MIN_PLAYERS, MAX_PLAYERS } from '@/lib/game-engine/types'
import { phaseDuration, reconcileSettings } from '@/lib/game-engine/engine'
import { validateSettings } from '@/lib/game-engine/roles'
import { t } from '@/i18n'
import { AVATAR_KEYS } from '@/lib/avatars'

/**
 * Mode local : tous les joueurs partagent un appareil.
 *
 * Protections anti-fuite :
 *  - un écran neutre s'interpose entre deux joueurs (« passe le téléphone à … »),
 *  - le rôle ne s'affiche que pendant un appui maintenu, et se remasque au passage,
 *  - l'état n'est jamais persisté (ni URL, ni localStorage) : impossible de
 *    revoir un mot via l'historique ou un rechargement.
 */
export function LocalGameScreen() {
  const store = useLocalGame()
  const { step, game, error } = store
  const { play } = useSound()

  // Avertit avant un rechargement qui perdrait la partie en cours.
  React.useEffect(() => {
    if (step === 'setup' || step === 'results') return
    const handler = (event: BeforeUnloadEvent) => event.preventDefault()
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [step])

  React.useEffect(() => {
    if (error) toast.error(error)
  }, [error])

  return (
    <main className="flex flex-1 flex-col py-5">
      <div className="mb-4 flex items-center justify-between gap-2">
        {step === 'setup' ? (
          <PartyButton asChild variant="ghost" size="sm">
            <Link href="/">
              <ArrowLeft className="h-4 w-4" aria-hidden />
              {t('common.back')}
            </Link>
          </PartyButton>
        ) : (
          <PartyButton
            variant="ghost"
            size="sm"
            onClick={() => {
              if (window.confirm(t('local.quitConfirm'))) store.reset()
            }}
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
            {t('local.quit')}
          </PartyButton>
        )}
        <StickerBadge tone="green" size="sm" tilt>
          {t('local.offlineReady')}
        </StickerBadge>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, y: 14, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -10, scale: 0.98 }}
          transition={{ duration: 0.22, ease: [0.34, 1.4, 0.64, 1] }}
          className="flex flex-1 flex-col"
        >
          {step === 'setup' && <SetupStep onStart={() => play('pop')} />}
          {(step === 'handoff' || step === 'confirm') && <HandoffStep />}
          {(step === 'reveal' || step === 'revealed') && <RevealStep />}
          {step === 'discussion' && game && <LocalDiscussion />}
          {step === 'vote-handoff' && <VoteHandoffStep />}
          {step === 'vote' && <VoteStep />}
          {step === 'vote-result' && game && <LocalVoteResult />}
          {step === 'elimination' && game && <LocalElimination />}
          {step === 'mr-white' && game && <LocalMrWhite />}
          {step === 'results' && game && <LocalResults />}
        </motion.div>
      </AnimatePresence>
    </main>
  )
}

/* -------------------------------------------------------------------------- */
/* Étape 1 — joueurs et réglages                                              */
/* -------------------------------------------------------------------------- */

function SetupStep({ onStart }: { onStart: () => void }) {
  const { players, setPlayers, start } = useLocalGame()
  const savedNames = usePreferences((state) => state.localPlayerNames)
  const lastSettings = usePreferences((state) => state.lastSettings)
  const [settings, setSettings] = React.useState(lastSettings)

  // Pré-remplit avec les joueurs de la dernière partie locale.
  React.useEffect(() => {
    if (players.length > 0) return
    setPlayers(savedNames.length >= MIN_PLAYERS ? savedNames : ['', '', ''])
  }, [players.length, savedNames, setPlayers])

  const filled = players.map((name) => name.trim()).filter(Boolean)
  const duplicates = new Set(filled.map((name) => name.toLowerCase())).size !== filled.length
  const playerCount = Math.max(filled.length, MIN_PLAYERS)

  // Les réglages mémorisés peuvent viser une autre taille de table : on les
  // réaligne sur la composition recommandée quand le nombre de joueurs change.
  React.useEffect(() => {
    setSettings((current) => reconcileSettings(current, playerCount))
  }, [playerCount])

  const settingsValid = validateSettings(settings, playerCount).ok
  const canStart = filled.length >= MIN_PLAYERS && !duplicates && settingsValid

  const updateName = (index: number, value: string) => {
    const next = [...players]
    next[index] = value.slice(0, 20)
    setPlayers(next)
  }

  const setCount = (count: number) => {
    const next = [...players]
    while (next.length < count) next.push('')
    setPlayers(next.slice(0, count))
  }

  return (
    <div className="space-y-6">
      <GameBanner title={t('local.title')} subtitle={t('local.subtitle')} tone="red" />

      <BigStepper
        label={t('create.playerCount')}
        value={players.length}
        min={MIN_PLAYERS}
        max={MAX_PLAYERS}
        onChange={setCount}
      />

      <section aria-labelledby="local-players" className="space-y-2">
        <h2 id="local-players" className="sr-only">
          {t('local.players')}
        </h2>
        {players.map((name, index) => (
          <div key={index} className="flex items-center gap-2">
            <span aria-hidden className="shrink-0">
              <PlayerAvatar avatarKey={avatarForLocal(`local-${index + 1}`)} name={name || `Joueur ${index + 1}`} size="sm" />
            </span>
            <input
              value={name}
              onChange={(event) => updateName(index, event.target.value)}
              placeholder={t('local.playerName', { index: index + 1 })}
              aria-label={t('local.playerName', { index: index + 1 })}
              maxLength={20}
              autoComplete="off"
              className="h-13 min-w-0 flex-1 rounded-blob border-3 border-ink bg-paper px-4 font-display text-lg font-extrabold text-ink shadow-toy placeholder:font-sans placeholder:text-sm placeholder:font-bold placeholder:text-ink/35 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            />
            <PartyButton
              variant="ghost"
              size="icon"
              onClick={() => setPlayers(players.filter((_, i) => i !== index))}
              disabled={players.length <= MIN_PLAYERS}
              aria-label={`${t('local.remove')} ${name || index + 1}`}
            >
              <Trash2 className="h-5 w-5" aria-hidden />
            </PartyButton>
          </div>
        ))}

        <PartyButton
          variant="paper"
          size="sm"
          block
          onClick={() => setPlayers([...players, ''])}
          disabled={players.length >= MAX_PLAYERS}
        >
          <Plus className="h-4 w-4" aria-hidden />
          {t('local.addPlayer')}
        </PartyButton>

        {duplicates && (
          <p className="text-xs font-extrabold text-red" role="alert">
            {t('local.duplicateName')}
          </p>
        )}
        {filled.length < MIN_PLAYERS && (
          <p className="text-xs font-bold text-ink-soft">{t('local.needPlayers', { min: MIN_PLAYERS })}</p>
        )}
      </section>

      <SettingsPanel settings={settings} onChange={setSettings} playerCount={playerCount} />

      <PartyButton
        variant="red"
        size="xl"
        block
        disabled={!canStart}
        onClick={() => {
          onStart()
          setPlayers(filled)
          start(settings)
        }}
      >
        {t('local.start')}
      </PartyButton>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* Étape 2 — passage du téléphone et révélation                               */
/* -------------------------------------------------------------------------- */

function HandoffStep() {
  const store = useLocalGame()
  const player = currentTurnPlayer(store)
  const { play } = useSound()
  if (!player || !store.game) return null

  const seen = store.game.players.filter((p) => p.hasSeenRole).length

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 text-center">
      <StickerBadge tone="blue" tilt>
        {t('reveal.seen', { count: seen, total: store.game.players.length })}
      </StickerBadge>

      <ResultBurst shapes={false}>
        <p className="font-display text-lg font-extrabold uppercase text-ink-soft">{t('local.pass')}</p>
        <p className="toy-title-ink mt-1 text-5xl uppercase">{player.name}</p>
        <span className="mt-4 inline-block">
          <PlayerAvatar avatarKey={avatarForLocal(player.id)} name={player.name} size="xl" />
        </span>
      </ResultBurst>

      <PartyButton
        variant="yellow"
        size="xl"
        block
        onClick={() => {
          play('pop')
          store.confirmIdentity()
        }}
      >
        {t('reveal.iAm', { name: player.name.toUpperCase() })}
      </PartyButton>
    </div>
  )
}

function RevealStep() {
  const store = useLocalGame()
  // On n'utilise JAMAIS `currentTurnPlayer` ici : pendant l'animation de sortie,
  // l'index de tour pointe déjà vers le joueur suivant, ce qui ferait apparaître
  // son mot une fraction de seconde. `revealedPlayer` ne renvoie que le joueur
  // explicitement autorisé, et `null` dès que l'appareil change de main.
  const player = revealedPlayer(store)
  const { play } = useSound()
  if (!player) return null

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-5">
      {store.step === 'reveal' ? (
        <>
          <p className="text-center font-display text-2xl font-extrabold uppercase text-ink">
            {t('reveal.ready')}
          </p>
          <p className="text-center text-sm font-bold text-ink-soft">{t('reveal.dontLook')}</p>
          <HoldToReveal
            onRevealed={() => {
              play('reveal')
              store.revealRole()
            }}
          />
        </>
      ) : (
        <>
          <RoleRevealCard role={player.role} word={player.word} hint={player.hint} />
          <PartyButton
            variant="ink"
            size="lg"
            block
            onClick={() => {
              play('click')
              store.hideAndPass()
            }}
          >
            {t('reveal.hideAndPass')}
          </PartyButton>
        </>
      )}
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* Étape 3 — descriptions                                                      */
/* -------------------------------------------------------------------------- */

function LocalDiscussion() {
  const store = useLocalGame()
  const game = store.game
  const { play } = useSound()
  const duration = game ? phaseDuration(game) : 0
  const speakerId = game?.speakingOrder[game.currentSpeakerIndex] ?? null

  const remaining = useLocalCountdown(duration > 0 ? duration : null, true, () => {
    play('turn')
    store.nextSpeaker()
  })

  if (!game) return null

  const speaker = game.players.find((player) => player.id === speakerId)

  return (
    <div className="space-y-5">
      <GameBanner
        title={speaker ? t('discussion.turnOf', { name: speaker.name }) : t('phase.discussion')}
        tone="blue"
        chip={`${t('common.round')} ${game.round}`}
        subtitle={t('discussion.instruction')}
        aside={<Countdown remaining={remaining} total={duration > 0 ? duration : null} />}
      />

      <DiscussionBoard
        players={game.players.map((player) => ({
          id: player.id,
          name: player.name,
          avatarKey: avatarForLocal(player.id),
          isAlive: player.isAlive,
          revealedRole: player.roleRevealed ? player.role : null,
        }))}
        speakingOrder={game.speakingOrder}
        currentSpeakerId={speakerId}
        descriptionPass={game.descriptionPass}
        totalPasses={game.settings.descriptionRounds}
      />

      <div className="flex flex-col gap-2">
        <PartyButton
          variant="yellow"
          size="lg"
          block
          onClick={() => {
            play('turn')
            store.nextSpeaker()
          }}
        >
          {speakerId ? t('discussion.done') : t('discussion.toVote')}
        </PartyButton>
        {speakerId && (
          <PartyButton variant="ghost" size="sm" onClick={() => store.openVoting()}>
            {t('discussion.toVote')}
          </PartyButton>
        )}
      </div>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* Étape 4 — vote hot-seat                                                     */
/* -------------------------------------------------------------------------- */

function VoteHandoffStep() {
  const store = useLocalGame()
  const player = currentTurnPlayer(store)
  const { play } = useSound()
  if (!player || !store.game) return null

  const voters = store.game.players.filter((p) => p.isAlive)

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 text-center">
      <StickerBadge tone="red" tilt>
        {t('vote.progress', { count: store.game.votes.length, total: voters.length })}
      </StickerBadge>

      <ResultBurst shapes={false}>
        <p className="font-display text-lg font-extrabold uppercase text-ink-soft">{t('local.pass')}</p>
        <p className="toy-title-ink mt-1 text-5xl uppercase">{player.name}</p>
        <span className="mt-4 inline-block">
          <PlayerAvatar avatarKey={avatarForLocal(player.id)} name={player.name} size="xl" />
        </span>
      </ResultBurst>

      <PartyButton
        variant="yellow"
        size="xl"
        block
        onClick={() => {
          play('pop')
          store.confirmVoter()
        }}
      >
        {t('reveal.iAm', { name: player.name.toUpperCase() })}
      </PartyButton>
    </div>
  )
}

function VoteStep() {
  const store = useLocalGame()
  const game = store.game
  // Même précaution que pour la révélation : on n'affiche que le votant autorisé.
  const voter = votingPlayer(store)
  const { play } = useSound()
  const [selected, setSelected] = React.useState<string | null>(null)

  if (!game || !voter) return null

  const candidates = game.players.filter(
    (player) => player.isAlive && (!game.runoffCandidates || game.runoffCandidates.includes(player.id)),
  )

  return (
    <div className="space-y-5">
      <GameBanner
        title={t('vote.title')}
        tone="red"
        chip={voter.name}
        subtitle={game.runoffCandidates ? t('vote.runoffBody') : t('vote.instruction')}
      />

      <div className="grid grid-cols-3 gap-2.5">
        {candidates.map((player, index) => (
          <VoteCard
            key={player.id}
            name={player.name}
            avatarKey={avatarForLocal(player.id)}
            index={index}
            selected={selected === player.id}
            disabled={player.id === voter.id}
            onSelect={() => {
              play('click')
              setSelected(player.id)
            }}
          />
        ))}
      </div>

      <PartyButton
        variant="red"
        size="xl"
        block
        disabled={!selected}
        onClick={() => {
          if (!selected) return
          play('vote')
          setSelected(null)
          store.vote(selected)
        }}
      >
        {t('vote.confirm')}
      </PartyButton>
    </div>
  )
}

function LocalVoteResult() {
  const store = useLocalGame()
  const game = store.game
  const { play } = useSound()

  React.useEffect(() => {
    play('vote')
  }, [play])

  if (!game?.lastVote) return null

  return (
    <div className="space-y-5">
      <GameBanner title={t('phase.vote_result')} tone="purple" chip={`${t('common.round')} ${game.round}`} />
      <VoteResultBoard
        lastVote={game.lastVote}
        players={game.players.map((player) => ({ id: player.id, name: player.name }))}
      />
      <PartyButton variant="yellow" size="xl" block onClick={() => store.applyVote()}>
        {t('common.continue')}
      </PartyButton>
    </div>
  )
}

function LocalElimination() {
  const store = useLocalGame()
  const game = store.game
  const { play } = useSound()
  const [counted, setCounted] = React.useState(false)

  React.useEffect(() => {
    if (counted) play('eliminate')
  }, [counted, play])

  if (!game) return null

  const eliminatedId = game.lastVote?.eliminatedId
  const eliminated = game.players.find((player) => player.id === eliminatedId)

  if (!counted) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4">
        <p className="font-display text-lg font-extrabold uppercase text-ink-soft">
          {t('vote.votesIn')}
        </p>
        <CountIn onDone={() => setCounted(true)} />
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 text-center">
      {eliminated ? (
        <ResultBurst>
          <PlayerAvatar
            avatarKey={avatarForLocal(eliminated.id)}
            name={eliminated.name}
            size="xl"
            dimmed
          />
          <p className="toy-title mt-3 text-4xl uppercase text-red">{eliminated.name}</p>
          <p className="toy-title-ink mt-1 text-3xl uppercase">est éliminé !</p>
          {game.settings.revealRoleOnElimination && (
            <p className="mt-4 rounded-capsule border-3 border-ink bg-paper px-4 py-1.5 font-display text-base font-extrabold uppercase text-ink shadow-toy">
              {t(`role.${eliminated.role}`)}
            </p>
          )}
        </ResultBurst>
      ) : (
        <p className="toy-title-ink text-3xl uppercase">{t('vote.noElimination')}</p>
      )}

      <PartyButton variant="yellow" size="xl" block onClick={() => store.resolve()}>
        {t('common.continue')}
      </PartyButton>
    </div>
  )
}

function LocalMrWhite() {
  const store = useLocalGame()
  const game = store.game
  const { play } = useSound()
  if (!game?.pendingMrWhiteId) return null

  const player = game.players.find((entry) => entry.id === game.pendingMrWhiteId)

  return (
    <MrWhiteGuessForm
      playerName={player?.name ?? 'Mr. White'}
      onSubmit={async (guess) => {
        const correct = store.guessMrWhite(guess)
        play(correct ? 'win' : 'lose')
        return correct
      }}
    />
  )
}

function LocalResults() {
  const store = useLocalGame()
  const game = store.game
  const { play } = useSound()

  React.useEffect(() => {
    play(game?.winner === 'civilians' ? 'win' : 'lose')
  }, [game?.winner, play])

  if (!game) return null

  return (
    <>
      <GameResult
        state={game}
        onReplay={() => store.rematch()}
        onChangeSettings={() => store.reset()}
        avatarFor={avatarForLocal}
      />
      <ShapeRow className="mt-6" />
      <span aria-hidden className="sr-only">
        <Shape shape="star" tone="yellow" />
      </span>
    </>
  )
}

/** Avatar déterministe pour un joueur local (pas de compte, pas de choix). */
function avatarForLocal(playerId: string): string {
  const index = Number(playerId.replace('local-', '')) - 1
  return AVATAR_KEYS[Math.max(0, index) % AVATAR_KEYS.length] as string
}
