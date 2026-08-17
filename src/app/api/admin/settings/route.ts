import { admin, handle, jsonOk, parseBody, requireAdminUser } from '@/lib/api/http'
import { adminSettingSchema } from '@/lib/validations/schemas'

/** POST /api/admin/settings — met à jour un réglage applicatif. */
export async function POST(request: Request) {
  return handle(async () => {
    await requireAdminUser()
    const input = await parseBody(request, adminSettingSchema)
    const { error } = await admin()
      .from('app_settings')
      .upsert(
        { key: input.key, value: input.value ?? null, updated_at: new Date().toISOString() },
        { onConflict: 'key' },
      )
    if (error) throw error
    return jsonOk({})
  })
}
