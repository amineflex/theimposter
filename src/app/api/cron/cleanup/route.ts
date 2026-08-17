import { admin, handle, jsonError, jsonOk } from '@/lib/api/http'

/**
 * GET /api/cron/cleanup  ·  expire et purge les rooms abandonnées.
 *
 * Protégé par `CRON_SECRET` (en-tête `Authorization: Bearer …`, format utilisé
 * par Vercel Cron). Voir la stratégie d'expiration dans la migration SQL et le
 * README.
 */
export async function GET(request: Request) {
  return handle(async () => {
    const secret = process.env.CRON_SECRET
    const authorization = request.headers.get('authorization')
    if (!secret || authorization !== `Bearer ${secret}`) {
      return jsonError('Non autorisé.', 401, 'unauthorized')
    }

    const { data, error } = await admin().rpc('cleanup_rooms')
    if (error) throw error

    const result = (Array.isArray(data) ? data[0] : data) as
      | { expired_count: number; deleted_count: number }
      | undefined

    return jsonOk({
      expired: result?.expired_count ?? 0,
      deleted: result?.deleted_count ?? 0,
    })
  })
}
