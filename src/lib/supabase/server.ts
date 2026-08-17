import { createServerClient } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

/**
 * Client Supabase serveur adossé aux cookies de la requête.
 * Sert à identifier l'appelant (`auth.getUser()`) dans les route handlers et
 * les composants serveur. Respecte la RLS : ne jamais l'utiliser pour écrire
 * dans les tables de jeu.
 */
export async function getSupabaseServerClient(): Promise<SupabaseClient> {
  const cookieStore = await cookies()
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) throw new Error('Configuration Supabase manquante.')

  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options)
          }
        } catch {
          // Appelé depuis un composant serveur en lecture seule : ignorable,
          // le rafraîchissement de session est alors géré côté client.
        }
      },
    },
  })
}

/** Utilisateur authentifié (session anonyme incluse), ou null. */
export async function getCurrentUserId(): Promise<string | null> {
  const supabase = await getSupabaseServerClient()
  const { data } = await supabase.auth.getUser()
  return data.user?.id ?? null
}
