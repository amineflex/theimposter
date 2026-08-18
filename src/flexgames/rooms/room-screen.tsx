'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { AnimatePresence, motion } from 'framer-motion'
import { toast } from 'sonner'
import { ErrorState, LoadingState, ReconnectingState } from '@/flexgames/ui/states'
import { PartyButton } from '@/flexgames/ui/party-button'
import { GameThemeStyle } from '@/flexgames/ui/game-theme'
import { FlexLobby } from '@/flexgames/lobby/flex-lobby'
import { RoomProvider } from './room-context'
import { RoomFooter } from './room-footer'
import { useRoom } from './use-room'
import { getGame } from '@/flexgames/game-registry'
import { isPlayable } from '@/flexgames/core/game-definition'
import { isOnlineConfigured } from '@/flexgames/core/supabase/client'
import { useOnlineStatus } from '@/flexgames/realtime/use-online-status'
import { t } from '@/i18n'

/**
 * Écran de room FlexGames.
 *
 * Il ne connaît aucun jeu : il garantit l'accès (room existante, joueur membre,
 * room active), puis monte soit le salon générique, soit l'écran du jeu déclaré
 * par la room. Toute la spécialisation vit dans le module du jeu.
 */
export function RoomScreen({ code }: { code: string }) {
  const router = useRouter()
  const online = useOnlineStatus()
  const configured = isOnlineConfigured()
  const room = useRoom(code)

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
    return <Blocker message={t('error.notConfigured')} />
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
      <Blocker message={t('error.roomNotFound')}>
        <PartyButton asChild variant="paper" block>
          <Link href="/online">{t('join.title')}</Link>
        </PartyButton>
      </Blocker>
    )
  }

  if (!room.me) {
    return (
      <Blocker message="Vous n'avez pas encore rejoint cette partie.">
        <PartyButton asChild variant="red" block>
          <Link href={`/join/${code}`}>{t('join.submit')}</Link>
        </PartyButton>
      </Blocker>
    )
  }

  if (room.room.status === 'cancelled' || room.room.status === 'expired') {
    return (
      <Blocker
        message={
          room.room.status === 'cancelled' ? 'Cette partie a été annulée.' : t('error.roomExpired')
        }
      >
        <PartyButton asChild variant="red" block>
          <Link href="/">{t('common.backHome')}</Link>
        </PartyButton>
      </Blocker>
    )
  }

  const game = getGame(room.room.game_id)
  if (!game || !isPlayable(game)) {
    return (
      <Blocker message={t('error.gameUnavailable')}>
        <PartyButton asChild variant="red" block>
          <Link href="/games">{t('catalog.title')}</Link>
        </PartyButton>
      </Blocker>
    )
  }

  const session = room.session
  /*
   * On reste sur l'écran du jeu tant que la partie n'est pas rangée : pendant la
   * partie, et sur l'écran de fin. L'hôte qui rouvre le salon (`status = lobby`)
   * ramène tout le monde au salon.
   */
  const showGame = session != null && (session.status === 'active' || room.room.status !== 'lobby')
  const GameScreen = game.ui.GameScreen

  return (
    <RoomProvider value={room}>
      <GameThemeStyle theme={game.manifest.theme}>
        <main className="flex flex-1 flex-col py-4">
          {!online && <ReconnectingState className="mb-4" />}

          <AnimatePresence mode="wait">
            <motion.div
              key={showGame ? `game:${session.id}` : 'lobby'}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
              className="flex flex-1 flex-col"
            >
              {showGame ? <GameScreen /> : <FlexLobby game={game} />}
            </motion.div>
          </AnimatePresence>

          <RoomFooter />
        </main>
      </GameThemeStyle>
    </RoomProvider>
  )
}

function Blocker({ message, children }: { message: string; children?: React.ReactNode }) {
  return (
    <main className="flex flex-1 flex-col justify-center gap-4 py-6">
      <ErrorState title={t('error.title')} message={message} />
      {children}
    </main>
  )
}
