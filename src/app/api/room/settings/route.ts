import {
  ApiError,
  admin,
  fetchRoom,
  handle,
  jsonOk,
  parseBody,
  requireHost,
  requireUserId,
  touchRoom,
} from '@/lib/api/http'
import { updateSettingsSchema } from '@/lib/validations/schemas'
import { validateSettings } from '@/lib/game-engine/roles'

/** POST /api/room/settings — l'hôte modifie la configuration (lobby uniquement). */
export async function POST(request: Request) {
  return handle(async () => {
    const userId = await requireUserId()
    const input = await parseBody(request, updateSettingsSchema)
    const room = await fetchRoom(input.roomId)
    await requireHost(input.roomId, userId)

    if (room.status !== 'lobby') {
      throw new ApiError('Les paramètres ne peuvent plus être modifiés.', 409, 'already_started')
    }

    const db = admin()
    const { count } = await db
      .from('room_players')
      .select('id', { count: 'exact', head: true })
      .eq('room_id', input.roomId)
      .eq('is_present', true)
    const playerCount = count ?? 0
    const maxPlayers = input.maxPlayers ?? room.max_players

    if (maxPlayers < playerCount) {
      throw new ApiError(
        `Il y a déjà ${playerCount} joueurs dans la partie.`,
        422,
        'max_players_too_low',
      )
    }

    // La configuration doit être valide pour la table actuelle dès qu'elle est
    // complète, et au plus tard au lancement.
    if (playerCount >= 4) {
      const validation = validateSettings(input.settings, playerCount)
      if (!validation.ok) throw new ApiError(validation.errors.join(' '), 422, 'invalid_settings')
    }

    const { error } = await db
      .from('rooms')
      .update({
        settings: input.settings,
        mode: input.settings.mode,
        visibility: input.visibility ?? room.visibility,
        max_players: maxPlayers,
        last_activity_at: new Date().toISOString(),
      })
      .eq('id', input.roomId)
    if (error) throw error

    await touchRoom(input.roomId)
    return jsonOk({})
  })
}
