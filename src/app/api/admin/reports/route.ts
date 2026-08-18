import { admin, handle, jsonOk, parseBody, requireAdminUser } from '@/flexgames/core/api/http'
import { adminReportUpdateSchema } from '@/flexgames/core/validations/schemas'

/** PATCH /api/admin/reports  ·  change le statut d'un signalement. */
export async function PATCH(request: Request) {
  return handle(async () => {
    await requireAdminUser()
    const input = await parseBody(request, adminReportUpdateSchema)
    const { error } = await admin().from('reports').update({ status: input.status }).eq('id', input.id)
    if (error) throw error
    return jsonOk({})
  })
}
