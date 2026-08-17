import { NextResponse } from 'next/server'
import { ZodError } from 'zod'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getSupabaseAdminClient } from '@/lib/supabase/admin'
import { getSupabaseServerClient } from '@/lib/supabase/server'
import { EngineError } from '@/lib/game-engine/engine'
import { IllegalTransitionError } from '@/lib/game-engine/state-machine'
import { ConcurrentUpdateError, GameNotFoundError } from '@/lib/game/persistence'
import type { GameRow, RoomPlayerRow, RoomRow } from '@/types/db'

/** Erreur métier destinée à l'utilisateur (message affichable tel quel). */
export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status = 400,
    public readonly code?: string,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

export function jsonOk<T extends object>(data: T, status = 200): NextResponse {
  return NextResponse.json({ ok: true, ...data }, { status })
}

export function jsonError(message: string, status = 400, code?: string): NextResponse {
  return NextResponse.json({ ok: false, error: message, code }, { status })
}

/**
 * Enveloppe un handler : capture les erreurs et n'expose jamais de message
 * brut PostgreSQL au joueur.
 */
export async function handle(fn: () => Promise<NextResponse>): Promise<NextResponse> {
  try {
    return await fn()
  } catch (error) {
    if (error instanceof ApiError) return jsonError(error.message, error.status, error.code)
    if (error instanceof ZodError) {
      const first = error.issues[0]
      return jsonError(first?.message ?? 'Données invalides.', 422, 'validation')
    }
    if (error instanceof EngineError) return jsonError(error.message, 409, 'engine')
    if (error instanceof IllegalTransitionError) {
      return jsonError("Cette action n'est plus possible à cette étape.", 409, 'phase')
    }
    if (error instanceof ConcurrentUpdateError) {
      return jsonError(error.message, 409, 'conflict')
    }
    if (error instanceof GameNotFoundError) return jsonError(error.message, 404, 'not_found')

    console.error('[api] erreur inattendue', error)
    return jsonError('Une erreur est survenue. Réessayez dans un instant.', 500, 'internal')
  }
}

export async function parseBody<T>(request: Request, schema: { parse: (input: unknown) => T }): Promise<T> {
  let payload: unknown
  try {
    payload = await request.json()
  } catch {
    throw new ApiError('Requête invalide.', 400)
  }
  return schema.parse(payload)
}

/** Identité de l'appelant (session anonyme Supabase). */
export async function requireUserId(): Promise<string> {
  const supabase = await getSupabaseServerClient()
  const { data } = await supabase.auth.getUser()
  const userId = data.user?.id
  if (!userId) {
    throw new ApiError('Session expirée. Rechargez la page pour vous reconnecter.', 401, 'no_session')
  }
  return userId
}

export function admin(): SupabaseClient {
  return getSupabaseAdminClient()
}

/** Exige un compte administrateur (Supabase Auth email/mot de passe). */
export async function requireAdminUser(): Promise<{ userId: string; email: string }> {
  const supabase = await getSupabaseServerClient()
  const { data } = await supabase.auth.getUser()
  const user = data.user
  if (!user) throw new ApiError('Authentification requise.', 401, 'no_session')

  const { data: adminRow } = await admin()
    .from('admins')
    .select('user_id, email')
    .eq('user_id', user.id)
    .maybeSingle()
  if (!adminRow) throw new ApiError('Accès réservé aux administrateurs.', 403, 'not_admin')

  return { userId: user.id, email: (adminRow as { email: string }).email }
}

/** Variante non bloquante, pour les gardes de rendu. */
export async function isCurrentUserAdmin(): Promise<boolean> {
  try {
    await requireAdminUser()
    return true
  } catch {
    return false
  }
}

/* ---------------------------------------------------------------------------
 * Anti-abus
 * ------------------------------------------------------------------------- */

export interface RateLimitRule {
  action: string
  limit: number
  windowSeconds: number
}

export const RATE_LIMITS = {
  createRoom: { action: 'create_room', limit: 8, windowSeconds: 3600 },
  joinRoom: { action: 'join_room', limit: 30, windowSeconds: 600 },
  chat: { action: 'chat', limit: 20, windowSeconds: 60 },
  reaction: { action: 'reaction', limit: 30, windowSeconds: 60 },
  vote: { action: 'vote', limit: 60, windowSeconds: 300 },
  advance: { action: 'advance', limit: 240, windowSeconds: 300 },
  report: { action: 'report', limit: 5, windowSeconds: 3600 },
  lookup: { action: 'lookup', limit: 60, windowSeconds: 300 },
} satisfies Record<string, RateLimitRule>

export async function enforceRateLimit(userId: string, rule: RateLimitRule): Promise<void> {
  const { data, error } = await admin().rpc('rate_limit_hit', {
    p_user_id: userId,
    p_action: rule.action,
    p_limit: rule.limit,
    p_window_seconds: rule.windowSeconds,
  })
  if (error) {
    // Ne pas bloquer le jeu si le compteur est indisponible, mais le tracer.
    console.error('[api] rate_limit_hit indisponible', error)
    return
  }
  if (data === false) {
    throw new ApiError('Trop de tentatives. Patientez quelques instants.', 429, 'rate_limited')
  }
}

/* ---------------------------------------------------------------------------
 * Accès rooms / parties
 * ------------------------------------------------------------------------- */

export async function fetchRoom(roomId: string): Promise<RoomRow> {
  const { data } = await admin().from('rooms').select('*').eq('id', roomId).maybeSingle()
  const room = data as RoomRow | null
  if (!room) throw new ApiError('Cette partie est introuvable.', 404, 'room_not_found')
  return room
}

export async function fetchRoomByCode(code: string): Promise<RoomRow> {
  const { data } = await admin().from('rooms').select('*').eq('code', code).maybeSingle()
  const room = data as RoomRow | null
  if (!room) throw new ApiError('Aucune partie ne correspond à ce code.', 404, 'room_not_found')
  return room
}

export async function requireRoomMember(roomId: string, userId: string): Promise<RoomPlayerRow> {
  const { data } = await admin()
    .from('room_players')
    .select('*')
    .eq('room_id', roomId)
    .eq('user_id', userId)
    .maybeSingle()
  const player = data as RoomPlayerRow | null
  if (!player) throw new ApiError("Vous ne faites pas partie de cette partie.", 403, 'not_member')
  return player
}

export async function requireHost(roomId: string, userId: string): Promise<RoomPlayerRow> {
  const player = await requireRoomMember(roomId, userId)
  if (!player.is_host) {
    throw new ApiError("Seul l'hôte peut effectuer cette action.", 403, 'not_host')
  }
  return player
}

/** Charge la ligne de partie et vérifie l'appartenance à la room. */
export async function requireGameMembership(
  gameId: string,
  userId: string,
): Promise<{ game: GameRow; player: RoomPlayerRow }> {
  const { data } = await admin().from('games').select('*').eq('id', gameId).maybeSingle()
  const game = data as GameRow | null
  if (!game) throw new ApiError('Partie introuvable.', 404, 'game_not_found')
  const player = await requireRoomMember(game.room_id, userId)
  return { game, player }
}

/** Marque la room comme active (repousse l'expiration). */
export async function touchRoom(roomId: string): Promise<void> {
  const now = new Date()
  await admin()
    .from('rooms')
    .update({
      last_activity_at: now.toISOString(),
      expires_at: new Date(now.getTime() + 6 * 3600 * 1000).toISOString(),
    })
    .eq('id', roomId)
}

/** Enregistre un événement analytique anonyme (jamais de contenu personnel). */
export async function trackEvent(event: {
  event: string
  roomId?: string | null
  gameId?: string | null
  mode?: string | null
  playerCount?: number | null
  durationSeconds?: number | null
  packs?: string[] | null
  difficulty?: string | null
  winner?: string | null
}): Promise<void> {
  const { error } = await admin()
    .from('analytics_events')
    .insert({
      event: event.event,
      room_id: event.roomId ?? null,
      game_id: event.gameId ?? null,
      mode: event.mode ?? null,
      player_count: event.playerCount ?? null,
      duration_seconds: event.durationSeconds ?? null,
      packs: event.packs ?? null,
      difficulty: event.difficulty ?? null,
      winner: event.winner ?? null,
    })
  if (error) console.error('[analytics] insertion impossible', error)
}
