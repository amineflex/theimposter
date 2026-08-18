import { getSupabaseServerClient } from '@/flexgames/core/supabase/server'
import { getSupabaseAdminClient } from '@/flexgames/core/supabase/admin'
import { AdminDashboard } from '@/flexgames/admin/components/admin-dashboard'
import { AdminLogin } from '@/flexgames/admin/components/admin-login'
import type { AdminStats } from '@/flexgames/core/db'

/**
 * Zone d'administration.
 *
 * Double garde : ce composant serveur vérifie la session ET l'appartenance à la
 * table `admins`, et chaque route `/api/admin/*` refait la vérification. Un
 * joueur standard (session anonyme) ne peut donc rien voir ni modifier.
 */
export default async function AdminPage() {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY || !process.env.NEXT_PUBLIC_SUPABASE_URL) {
    return (
      <main className="mx-auto max-w-md">
        <p className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm">
          Supabase n&apos;est pas configuré sur ce déploiement : l&apos;administration est
          indisponible.
        </p>
      </main>
    )
  }

  const supabase = await getSupabaseServerClient()
  const { data } = await supabase.auth.getUser()
  const user = data.user

  if (!user || user.is_anonymous) return <AdminLogin />

  const { data: adminRow } = await getSupabaseAdminClient()
    .from('admins')
    .select('user_id, email')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!adminRow) return <AdminLogin error="Ce compte n'a pas les droits d'administration." />

  // `admin_stats()` est appelée avec la session de l'admin : la fonction SQL
  // vérifie elle-même `is_admin()` (elle échouerait avec la clé service_role,
  // pour laquelle `auth.uid()` est nul).
  const { data: statsData } = await supabase.rpc('admin_stats')
  const stats = (statsData ?? null) as AdminStats | null

  return <AdminDashboard email={(adminRow as { email: string }).email} stats={stats} />
}
