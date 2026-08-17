import { z } from 'zod'
import { admin, handle, jsonOk, parseBody, requireAdminUser } from '@/lib/api/http'

const actionSchema = z.object({
  roomId: z.string().uuid(),
  action: z.enum(['cancel', 'expire']),
})

/** GET /api/admin/rooms  ·  rooms récentes avec leur activité. */
export async function GET() {
  return handle(async () => {
    await requireAdminUser()
    const { data, error } = await admin()
      .from('rooms')
      .select(
        'id, code, status, visibility, mode, max_players, created_at, last_activity_at, expires_at, room_players ( id )',
      )
      .order('last_activity_at', { ascending: false })
      .limit(60)
    if (error) throw error

    const rooms = ((data ?? []) as { room_players?: unknown[] }[]).map((room) => ({
      ...room,
      player_count: (room.room_players ?? []).length,
      room_players: undefined,
    }))
    return jsonOk({ rooms })
  })
}

/** POST /api/admin/rooms  ·  annule ou expire une room. */
export async function POST(request: Request) {
  return handle(async () => {
    await requireAdminUser()
    const input = await parseBody(request, actionSchema)
    const db = admin()

    await db
      .from('games')
      .update({ finished_at: new Date().toISOString(), phase: 'results' })
      .eq('room_id', input.roomId)
      .is('finished_at', null)

    const { error } = await db
      .from('rooms')
      .update({ status: input.action === 'cancel' ? 'cancelled' : 'expired' })
      .eq('id', input.roomId)
    if (error) throw error

    return jsonOk({})
  })
}
