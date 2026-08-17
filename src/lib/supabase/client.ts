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
    throw new SessionError(
      'Configuration Supabase manquante : renseignez NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_ANON_KEY, puis redéployez.',
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
 * Erreur d'initialisation de session, avec un message directement affichable.
 * `detail` conserve le message brut de Supabase pour la console (diagnostic).
 */
export class SessionError extends Error {
  constructor(
    message: string,
    public readonly detail?: string,
  ) {
    super(message)
    this.name = 'SessionError'
  }
}

/**
 * Garantit une session : crée une session anonyme si nécessaire.
 *
 * Aucun écran de connexion n'est présenté au joueur ; l'identité anonyme sert
 * uniquement à appliquer la RLS et à permettre la reconnexion.
 *
 * Les échecs sont traduits en messages actionnables : la cause de très loin la
 * plus fréquente est l'option « Anonymous sign-ins » restée désactivée dans le
 * tableau de bord Supabase.
 */
export async function ensureAnonymousSession(): Promise<string> {
  const supabase = getSupabaseBrowserClient()

  const { data } = await supabase.auth.getSession()
  if (data.session?.user) return data.session.user.id

  const { data: signedIn, error } = await supabase.auth.signInAnonymously()
  if (signedIn?.user) return signedIn.user.id

  const detail = error?.message ?? 'réponse vide de Supabase'
  console.error('[auth] connexion anonyme impossible :', detail)

  const normalized = detail.toLowerCase()
  if (normalized.includes('anonymous') && normalized.includes('disabled')) {
    throw new SessionError(
      'Les connexions anonymes sont désactivées sur ce projet Supabase. Activez « Anonymous sign-ins » dans Authentication → Sign In / Providers.',
      detail,
    )
  }
  if (normalized.includes('signups not allowed') || normalized.includes('signup is disabled')) {
    throw new SessionError(
      'Les inscriptions sont désactivées sur ce projet Supabase : réactivez-les pour permettre les sessions anonymes.',
      detail,
    )
  }
  if (normalized.includes('failed to fetch') || normalized.includes('network')) {
    throw new SessionError(
      "Supabase est injoignable depuis ce navigateur. Vérifiez l'URL du projet et votre connexion.",
      detail,
    )
  }
  if (normalized.includes('invalid api key') || normalized.includes('jwt')) {
    throw new SessionError(
      'La clé Supabase publique (anon key) est invalide : vérifiez NEXT_PUBLIC_SUPABASE_ANON_KEY.',
      detail,
    )
  }

  throw new SessionError(`Session de jeu impossible à créer : ${detail}`, detail)
}
