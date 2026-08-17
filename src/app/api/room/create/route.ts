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
} from '@/lib/api/http'
import { pickAvatarKey } from '@/lib/avatars'
import { generateRoomCode } from '@/lib/room-code'
import { createRoomSchema } from '@/lib/validations/schemas'
import { validateSettings } from '@/lib/game-engine/roles'
import type { RoomRow } from '@/types/db'

/** POST /api/room/create — crée une room et y installe l'hôte. */
export async function POST(request: Request) {
  return handle(async () => {
    const userId = await requireUserId()
    await enforceRateLimit(userId, RATE_LIMITS.createRoom)
    const input = await parseBody(request, createRoomSchema)

    // La configuration doit rester atteignable : on la valide pour la taille
    // maximale annoncée (elle sera revalidée au lancement).
    const validation = validateSettings(input.settings, input.maxPlayers)
    if (!validation.ok) throw new ApiError(validation.errors.join(' '), 422, 'invalid_settings')

    const db = admin()
    const room = await createRoomWithUniqueCode(async (code) => {
      const { data, error } = await db
        .from('rooms')
        .insert({
          code,
          status: 'lobby',
          visibility: input.visibility,
          mode: input.settings.mode,
          settings: input.settings,
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

    await trackEvent({
      event: 'game_created',
      roomId: room.id,
      mode: input.settings.mode,
      packs: input.settings.packs.length > 0 ? input.settings.packs : ['tous'],
      difficulty: input.settings.difficulty,
    })

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
