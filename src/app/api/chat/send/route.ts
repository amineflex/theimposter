import {
  ApiError,
  RATE_LIMITS,
  admin,
  enforceRateLimit,
  fetchRoom,
  handle,
  jsonOk,
  parseBody,
  requireRoomMember,
  requireUserId,
} from '@/flexgames/core/api/http'
import { chatMessageSchema } from '@/flexgames/core/validations/schemas'
import { ALLOWED_REACTIONS } from '@/flexgames/chat/reactions'


/** POST /api/chat/send  ·  envoie un message ou une réaction. */
export async function POST(request: Request) {
  return handle(async () => {
    const userId = await requireUserId()
    const input = await parseBody(request, chatMessageSchema)
    await enforceRateLimit(userId, input.kind === 'reaction' ? RATE_LIMITS.reaction : RATE_LIMITS.chat)

    const room = await fetchRoom(input.roomId)
    const player = await requireRoomMember(input.roomId, userId)

    if (room.status === 'cancelled' || room.status === 'expired') {
      throw new ApiError("Cette partie n'est plus active.", 410, 'room_closed')
    }
    if (input.kind === 'reaction' && !ALLOWED_REACTIONS.includes(input.body as never)) {
      throw new ApiError('Réaction non autorisée.', 400, 'invalid_reaction')
    }

    const { error } = await admin().from('chat_messages').insert({
      room_id: input.roomId,
      room_player_id: player.id,
      kind: input.kind,
      body: input.body,
    })
    if (error) throw error

    return jsonOk({})
  })
}
