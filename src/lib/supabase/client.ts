'use client'

import { createBrowserClient } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'

let cached: SupabaseClient | null = null

/**
 * Client Supabase navigateur (clé anonyme publique).
 * Lecture seule sur les données de jeu : toutes les mutations passent par
 * les route handlers `/api/*`.
 */
export function getSupabaseBrowserClient(): SupabaseClient {
  if (cached) return cached
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) {
    throw new Error(
      'Configuration Supabase manquante : renseignez NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_ANON_KEY.',
    )
  }
  cached = createBrowserClient(url, key)
  return cached
}

/** Le mode en ligne est-il configuré dans cet environnement ? */
export function isOnlineConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
}

/**
 * Garantit une session : crée une session anonyme si nécessaire.
 * Aucun écran de connexion n'est présenté au joueur ; l'identité anonyme sert
 * uniquement à appliquer la RLS et à permettre la reconnexion.
 */
export async function ensureAnonymousSession(): Promise<string> {
  const supabase = getSupabaseBrowserClient()
  const { data } = await supabase.auth.getSession()
  if (data.session?.user) return data.session.user.id

  const { data: signedIn, error } = await supabase.auth.signInAnonymously()
  if (error || !signedIn.user) {
    throw new Error("Impossible d'initialiser la session de jeu.")
  }
  return signedIn.user.id
}
