import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

/**
 * GET /api/health — diagnostic d'installation du mode en ligne.
 *
 * Répond par une liste de vérifications lisibles : variables d'environnement
 * présentes, base joignable, migration appliquée, seed injecté, connexions
 * anonymes activées.
 *
 * Ne divulgue AUCUN secret : uniquement des booléens, des compteurs et des
 * messages d'aide. C'est le premier réflexe quand « le mode en ligne ne
 * fonctionne pas ».
 */
export const dynamic = 'force-dynamic'

interface Check {
  name: string
  ok: boolean
  detail?: string
  hint?: string
}

export async function GET() {
  const checks: Check[] = []

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  checks.push({
    name: 'NEXT_PUBLIC_SUPABASE_URL',
    ok: Boolean(url),
    detail: url ? maskUrl(url) : undefined,
    hint: url ? undefined : 'Variable absente : ajoutez-la puis redéployez.',
  })
  checks.push({
    name: 'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    ok: Boolean(anonKey),
    hint: anonKey ? undefined : 'Variable absente : ajoutez-la puis redéployez.',
  })
  checks.push({
    name: 'SUPABASE_SERVICE_ROLE_KEY',
    ok: Boolean(serviceKey),
    hint: serviceKey
      ? undefined
      : "Variable serveur absente : sans elle, aucune partie ne peut être créée. Ne la préfixez jamais par NEXT_PUBLIC_.",
  })
  checks.push({
    name: 'CRON_SECRET',
    ok: Boolean(process.env.CRON_SECRET),
    hint: process.env.CRON_SECRET
      ? undefined
      : "Optionnel : sans lui, l'endpoint de nettoyage refuse les appels.",
  })

  if (url && serviceKey) {
    const admin = createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    // Migration appliquée ? La table `rooms` est créée par la migration initiale.
    const rooms = await admin.from('rooms').select('id', { count: 'exact', head: true })
    checks.push({
      name: 'Migration appliquée',
      ok: !rooms.error,
      detail: rooms.error?.message,
      hint: rooms.error
        ? 'Exécutez supabase/migrations/20250101000000_init.sql dans le SQL Editor.'
        : undefined,
    })

    // Seed injecté ? Sans mots, aucune partie ne peut démarrer.
    const words = await admin.from('impostor_words').select('id', { count: 'exact', head: true })
    const pairs = await admin.from('word_pairs').select('id', { count: 'exact', head: true })
    const total = (words.count ?? 0) + (pairs.count ?? 0)
    checks.push({
      name: 'Base de mots',
      ok: !words.error && !pairs.error && total > 0,
      detail: words.error?.message ?? pairs.error?.message ?? `${total} entrées`,
      hint:
        !words.error && total === 0
          ? 'Exécutez supabase/seed.sql pour injecter les 884 entrées.'
          : undefined,
    })

    // Au moins un administrateur déclaré ?
    const admins = await admin.from('admins').select('user_id', { count: 'exact', head: true })
    checks.push({
      name: 'Administrateur déclaré',
      ok: !admins.error && (admins.count ?? 0) > 0,
      detail: admins.error?.message ?? `${admins.count ?? 0} compte(s)`,
      hint:
        !admins.error && (admins.count ?? 0) === 0
          ? "Optionnel : insérez une ligne dans `admins` pour accéder à /admin."
          : undefined,
    })
  }

  /*
   * Connexions anonymes : cause n°1 d'un mode en ligne inopérant.
   *
   * On LIT le réglage (`/auth/v1/settings`) plutôt que de tenter une connexion :
   * un `signInAnonymously()` créerait un utilisateur à chaque appel de ce
   * diagnostic, et donnerait de quoi remplir `auth.users` à n'importe qui.
   */
  if (url && anonKey) {
    try {
      const response = await fetch(`${url}/auth/v1/settings`, {
        headers: { apikey: anonKey },
        cache: 'no-store',
      })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const settings = (await response.json()) as {
        external?: { anonymous_users?: boolean }
        disable_signup?: boolean
      }
      const anonymousEnabled = settings.external?.anonymous_users === true
      checks.push({
        name: 'Connexions anonymes',
        ok: anonymousEnabled,
        detail: anonymousEnabled ? 'activées' : 'désactivées',
        hint: anonymousEnabled
          ? undefined
          : 'Activez « Anonymous sign-ins » dans Supabase → Authentication → Sign In / Providers.',
      })
      checks.push({
        name: 'Inscriptions autorisées',
        ok: settings.disable_signup !== true,
        detail: settings.disable_signup === true ? 'désactivées' : 'activées',
        hint:
          settings.disable_signup === true
            ? 'Les sessions anonymes sont impossibles tant que les inscriptions sont bloquées.'
            : undefined,
      })
    } catch (error) {
      checks.push({
        name: 'Connexions anonymes',
        ok: false,
        detail: error instanceof Error ? error.message : 'appel impossible',
        hint: "Supabase Auth est injoignable : vérifiez l'URL du projet et la clé publique.",
      })
    }
  }

  const healthy = checks.every((check) => check.ok || check.name === 'CRON_SECRET')

  return NextResponse.json(
    {
      ok: healthy,
      onlineMode: healthy ? 'opérationnel' : 'non opérationnel',
      checks,
    },
    { status: healthy ? 200 : 503 },
  )
}

/** Masque l'identifiant de projet : on garde juste de quoi vérifier la région. */
function maskUrl(value: string): string {
  try {
    const parsed = new URL(value)
    const [ref, ...rest] = parsed.hostname.split('.')
    const masked = ref ? `${ref.slice(0, 4)}…${ref.slice(-2)}` : '…'
    return `${parsed.protocol}//${masked}.${rest.join('.')}`
  } catch {
    return 'URL invalide'
  }
}
