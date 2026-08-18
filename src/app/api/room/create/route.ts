import {
  ApiError,
  RATE_LIMITS,
  admin,
  enforceRateLimit,
  handle,
  jsonOk,
  parseBody,
  requireUserId,
  trackEvent,
} from '@/flexgames/core/api/http'
import { requireGameModule } from '@/flexgames/core/api/game-routing'
import { pickAvatarKey } from '@/flexgames/players/avatars'
import { generateRoomCode } from '@/flexgames/rooms/room-code'
import { createRoomSchema } from '@/flexgames/core/validations/schemas'
import type { RoomRow } from '@/flexgames/core/db'

/**
 * POST /api/room/create  ·  crée une room pour un jeu et y installe l'hôte.
 *
 * La plateforme vérifie ce qu'elle sait vérifier (jeu connu, effectif dans les
 * bornes du manifest) ; la configuration est validée par le module du jeu.
 */
export async function POST(request: Request) {
  return handle(async () => {
    const userId = await requireUserId()
    await enforceRateLimit(userId, RATE_LIMITS.createRoom)
    const input = await parseBody(request, createRoomSchema)

    const { module, manifest } = requireGameModule(input.gameId)
    if (!manifest.supportedModes.online) {
      throw new ApiError("Ce jeu ne se joue pas en ligne.", 422, 'online_unsupported')
    }
    if (input.maxPlayers < manifest.minPlayers || input.maxPlayers > manifest.maxPlayers) {
      throw new ApiError(
        `${manifest.name} se joue de ${manifest.minPlayers} à ${manifest.maxPlayers} joueurs.`,
        422,
        'invalid_player_count',
      )
    }

    // La configuration doit rester atteignable : on la valide pour la taille
    // maximale annoncée (elle sera revalidée au lancement).
    const config = input.config ?? module.defaultConfig()
    module.validateConfig(config, input.maxPlayers)

    const db = admin()
    const room = await createRoomWithUniqueCode(async (code) => {
      const { data, error } = await db
        .from('rooms')
        .insert({
          code,
          game_id: input.gameId,
          game_config: config,
          status: 'lobby',
          visibility: input.visibility,
          max_players: input.maxPlayers,
          created_by: userId,
        })
        .select('*')
        .single()
      if (error) {
        // 23505 = violation d'unicité sur `code` : on retente avec un autre code.
        if (error.code === '23505') return null
        throw error
      }
      return data as RoomRow
    })

    const { data: playerRow, error: playerError } = await db
      .from('room_players')
      .insert({
        room_id: room.id,
        user_id: userId,
        name: input.playerName,
        avatar_key: pickAvatarKey([]),
        is_host: true,
      })
      .select('id')
      .single()
    if (playerError) throw playerError

    const hostPlayerId = (playerRow as { id: string }).id
    await db.from('rooms').update({ host_player_id: hostPlayerId }).eq('id', room.id)

    await trackEvent({ event: 'room_created', roomId: room.id, gameKey: input.gameId })

    return jsonOk({ code: room.code, roomId: room.id, playerId: hostPlayerId })
  })
}

/** Génère un code unique, avec quelques tentatives en cas de collision. */
async function createRoomWithUniqueCode(
  insert: (code: string) => Promise<RoomRow | null>,
): Promise<RoomRow> {
  for (let attempt = 0; attempt < 8; attempt++) {
    const room = await insert(generateRoomCode())
    if (room) return room
  }
  throw new ApiError('Impossible de créer une partie pour le moment. Réessayez.', 503, 'code_collision')
}
