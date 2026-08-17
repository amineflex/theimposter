'use client'

import * as React from 'react'
import { toast } from 'sonner'
import { GameResult, type ResultPlayerView } from '@/features/game/game-result'
import { LoadingState } from '@/components/game/states'
import { ChatPanel } from '../chat-panel'
import { api, describeError } from '@/lib/api/client'
import { getSupabaseBrowserClient } from '@/lib/supabase/client'
import { usePreferences } from '@/stores/preferences-store'
import { useSound } from '@/hooks/use-sound'
import { buildPlayerViews, type RoomViewModel } from '../room-context'
import { t } from '@/i18n'
import type { GamePlayerRow } from '@/types/db'

/**
 * Écran de fin. Les rôles de tous les joueurs deviennent lisibles ici : la RLS
 * de `game_players` n'autorise cette lecture qu'une fois la partie terminée.
 */
export function ResultsView({ room }: { room: RoomViewModel }) {
  const { play } = useSound()
  const [roles, setRoles] = React.useState<GamePlayerRow[] | null>(null)
  const [replaying, setReplaying] = React.useState(false)
  const [reopening, setReopening] = React.useState(false)
  const game = room.game
  const wordHistory = usePreferences((state) => state.wordHistory)
  const rememberWord = usePreferences((state) => state.rememberWord)

  React.useEffect(() => {
    if (!game) return
    const load = async () => {
      const supabase = getSupabaseBrowserClient()
      const { data } = await supabase.from('game_players').select('*').eq('game_id', game.id)
      setRoles((data ?? []) as GamePlayerRow[])
    }
    void load()
  }, [game])

  // Mémorise l'entrée de mots jouée (et non l'id de partie) pour que les
  // prochaines parties évitent de la retirer.
  React.useEffect(() => {
    if (game?.word_source_id) rememberWord(game.word_source_id)
  }, [game?.word_source_id, rememberWord])

  // Son de fin : victoire si le camp du joueur a gagné, défaite sinon.
  const myRole = room.myRole?.role ?? null
  React.useEffect(() => {
    if (!game?.winner || !myRole) return
    const iAmIntruder = myRole !== 'civilian'
    const intrudersWon = game.winner !== 'civilians'
    play(iAmIntruder === intrudersWon ? 'win' : 'lose')
  }, [game?.winner, myRole, play])

  if (!game) return null
  if (!roles) return <LoadingState />

  const playerViews = buildPlayerViews(room.players, room.statuses, room.me)
  const roleById = new Map(roles.map((row) => [row.room_player_id, row]))

  const players: ResultPlayerView[] = playerViews
    .filter((player) => roleById.has(player.id))
    .map((player) => ({
      id: player.id,
      name: player.name,
      role: roleById.get(player.id)?.role ?? 'civilian',
      isAlive: player.isAlive,
      avatarKey: player.avatarKey,
    }))

  const guess = game.last_mr_white_guess

  /** Repasse la room en salon pour ajuster les réglages avant de rejouer. */
  const reopenLobby = async () => {
    if (!room.room) return
    setReopening(true)
    try {
      await api.post('/api/room/reopen', { roomId: room.room.id })
      await room.refresh({ silent: true })
    } catch (error) {
      toast.error(describeError(error, t('error.network')))
    } finally {
      setReopening(false)
    }
  }

  const replay = async () => {
    if (!room.room) return
    setReplaying(true)
    try {
      await api.post('/api/room/rematch', { roomId: room.room.id, excludeWordIds: wordHistory })
      await room.refresh({ silent: true })
    } catch (error) {
      toast.error(describeError(error, t('error.network')))
    } finally {
      setReplaying(false)
    }
  }

  return (
    <div className="space-y-6">
      <GameResult
        view={{
          mode: game.mode,
          winner: game.winner,
          abandoned: game.abandoned,
          civilianWord: game.civilian_word,
          undercoverWord: game.undercover_word,
          impostorHint: game.impostor_hint,
          players,
          mrWhiteGuess: guess
            ? {
                name: playerViews.find((player) => player.id === guess.playerId)?.name ?? 'Mr. White',
                guess: guess.guess,
                correct: guess.correct,
              }
            : null,
        }}
        onReplay={room.me?.is_host ? replay : undefined}
        replayLoading={replaying || reopening}
        onChangeSettings={room.me?.is_host ? reopenLobby : undefined}
      />
      {!room.me?.is_host && (
        <p className="text-center font-display text-base font-extrabold uppercase text-ink-soft">
          {t('lobby.waitingHost')}
        </p>
      )}
      <ChatPanel room={room} />
    </div>
  )
}
