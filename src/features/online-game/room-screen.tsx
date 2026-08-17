'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { AnimatePresence, motion } from 'framer-motion'
import { toast } from 'sonner'
import { ErrorState, LoadingState, ReconnectingState } from '@/components/game/states'
import { PartyButton } from '@/components/party/party-button'
import { LobbyView } from './lobby-view'
import { RoleRevealView } from './phases/role-reveal-view'
import { DiscussionView } from './phases/discussion-view'
import { VotingView } from './phases/voting-view'
import { VoteResultView } from './phases/vote-result-view'
import { EliminationView } from './phases/elimination-view'
import { MrWhiteView } from './phases/mr-white-view'
import { ResultsView } from './phases/results-view'
import { RoomFooter } from './room-footer'
import { useRoom } from './use-room'
import { usePhaseTicker } from './use-phase-ticker'
import { isOnlineConfigured } from '@/lib/supabase/client'
import { useOnlineStatus } from '@/hooks/use-online-status'
import { t } from '@/i18n'

/**
 * Écran de partie en ligne.
 *
 * Le composant ne décide de rien : il affiche la phase renvoyée par le serveur.
 * Toute action passe par `/api/*`, et l'état revient par Realtime.
 */
export function RoomScreen({ code }: { code: string }) {
  const router = useRouter()
  const online = useOnlineStatus()
  const configured = isOnlineConfigured()
  const room = useRoom(code)

  usePhaseTicker(room.game, room.refresh)

  // Exclusion ou départ : on quitte l'écran proprement.
  const wasMember = React.useRef(false)
  React.useEffect(() => {
    if (room.me) wasMember.current = true
    else if (wasMember.current && !room.loading) {
      toast.info(t('lobby.kicked'))
      router.push('/')
    }
  }, [room.me, room.loading, router])

  if (!configured) {
    return (
      <main className="flex flex-1 flex-col justify-center py-6">
        <ErrorState title={t('error.title')} message={t('error.notConfigured')} />
      </main>
    )
  }

  if (room.loading) {
    return (
      <main className="flex flex-1 flex-col justify-center">
        <LoadingState label={t('lobby.reconnecting')} />
      </main>
    )
  }

  if (room.error === 'not_found' || !room.room) {
    return (
      <main className="flex flex-1 flex-col justify-center gap-4 py-6">
        <ErrorState title={t('error.title')} message={t('error.roomNotFound')} />
        <PartyButton asChild variant="paper" block>
          <Link href="/online">{t('join.title')}</Link>
        </PartyButton>
      </main>
    )
  }

  if (!room.me) {
    return (
      <main className="flex flex-1 flex-col justify-center gap-4 py-6">
        <ErrorState
          title={t('error.title')}
          message="Vous n'avez pas encore rejoint cette partie."
        />
        <PartyButton asChild variant="red" block>
          <Link href={`/join/${code}`}>{t('join.submit')}</Link>
        </PartyButton>
      </main>
    )
  }

  if (room.room.status === 'cancelled') {
    return (
      <main className="flex flex-1 flex-col justify-center gap-4 py-6">
        <ErrorState title={t('error.title')} message="Cette partie a été annulée." />
        <PartyButton asChild variant="red" block>
          <Link href="/">{t('common.backHome')}</Link>
        </PartyButton>
      </main>
    )
  }

  if (room.room.status === 'expired') {
    return (
      <main className="flex flex-1 flex-col justify-center gap-4 py-6">
        <ErrorState title={t('error.title')} message={t('error.roomExpired')} />
        <PartyButton asChild variant="red" block>
          <Link href="/">{t('common.backHome')}</Link>
        </PartyButton>
      </main>
    )
  }

  const game = room.game
  const inGame = game && !game.finished_at && game.phase !== 'results'
  // L'hôte peut réouvrir le salon après une partie (pour changer les réglages) :
  // dans ce cas la room repasse en `lobby` et l'écran de résultats s'effface.
  const showResults =
    game && (game.phase === 'results' || game.finished_at) && room.room.status !== 'lobby'

  return (
    <main className="flex flex-1 flex-col py-4">
      {!online && <ReconnectingState className="mb-4" />}

      <AnimatePresence mode="wait">
        <motion.div
          key={inGame ? game.phase : showResults ? 'results' : 'lobby'}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.2 }}
          className="flex flex-1 flex-col"
        >
          {showResults ? (
            <ResultsView room={room} />
          ) : !inGame ? (
            <LobbyView room={room} />
          ) : game.phase === 'role_reveal' ? (
            <RoleRevealView room={room} />
          ) : game.phase === 'discussion' ? (
            <DiscussionView room={room} />
          ) : game.phase === 'voting' ? (
            <VotingView room={room} />
          ) : game.phase === 'vote_result' ? (
            <VoteResultView room={room} />
          ) : game.phase === 'elimination' ? (
            <EliminationView room={room} />
          ) : game.phase === 'mr_white_guess' ? (
            <MrWhiteView room={room} />
          ) : (
            <LoadingState />
          )}
        </motion.div>
      </AnimatePresence>

      <RoomFooter room={room} />
    </main>
  )
}
