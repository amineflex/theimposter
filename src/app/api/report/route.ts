import {
  RATE_LIMITS,
  admin,
  enforceRateLimit,
  handle,
  jsonOk,
  parseBody,
  requireUserId,
} from '@/lib/api/http'
import { reportSchema } from '@/lib/validations/schemas'

/** POST /api/report — signale un comportement problématique. */
export async function POST(request: Request) {
  return handle(async () => {
    const userId = await requireUserId()
    await enforceRateLimit(userId, RATE_LIMITS.report)
    const input = await parseBody(request, reportSchema)

    const { error } = await admin().from('reports').insert({
      room_id: input.roomId ?? null,
      reporter_user_id: userId,
      reason: input.reason,
      details: input.details ?? null,
    })
    if (error) throw error

    return jsonOk({})
  })
}
