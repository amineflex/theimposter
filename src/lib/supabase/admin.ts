import { createClient, type SupabaseClient } from '@supabase/supabase-js'

/**
 * Client `service_role` : contourne la RLS.
 *
 * ⚠️ Serveur uniquement. Ce module ne doit jamais être importé depuis un
 * composant client — la clé n'est pas préfixée NEXT_PUBLIC_ et l'import
 * échouerait de toute façon côté navigateur.
 *
 * C'est ce client qui applique l'état du jeu calculé par le moteur : il est la
 * seule voie d'écriture sur les tables de jeu.
 */
let cached: SupabaseClient | null = null

export function getSupabaseAdminClient(): SupabaseClient {
  if (cached) return cached
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceRoleKey) {
    throw new Error(
      'Configuration serveur manquante : NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sont requis.',
    )
  }
  cached = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  return cached
}
