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
} from '@/flexgames/core/api/http'
import { requireGameModule } from '@/flexgames/core/api/game-routing'
import { updateSettingsSchema } from '@/flexgames/core/validations/schemas'

/** POST /api/room/settings  ·  l'hôte modifie la configuration (lobby uniquement). */
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
    const { module, manifest } = requireGameModule(room.game_id)
    const maxPlayers = input.maxPlayers ?? room.max_players

    if (maxPlayers < playerCount) {
      throw new ApiError(`Il y a déjà ${playerCount} joueurs dans la partie.`, 422, 'max_players_too_low')
    }
    if (maxPlayers < manifest.minPlayers || maxPlayers > manifest.maxPlayers) {
      throw new ApiError(
        `${manifest.name} se joue de ${manifest.minPlayers} à ${manifest.maxPlayers} joueurs.`,
        422,
        'invalid_player_count',
      )
    }

    // Validée pour la table courante dès qu'elle est complète, et au plus tard
    // au lancement.
    module.validateConfig(input.config, Math.max(playerCount, manifest.minPlayers))

    const { error } = await db
      .from('rooms')
      .update({
        game_config: input.config,
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
