import type { SupabaseClient } from '@supabase/supabase-js'
import { ConcurrentUpdateError, NotFoundError } from '@/flexgames/core/errors'
import type { GeoPrivateState } from '../types'
import { toPublicGeoState } from '../engine/state-machine'

interface GeoSessionRow {
  session_id: string
  room_id: string
  state: GeoPrivateState
  version: number
}

export async function loadGeoSession(db: SupabaseClient, sessionId: string): Promise<GeoSessionRow> {
  const { data, error } = await db.from('geo_sessions').select('*').eq('session_id', sessionId).maybeSingle()
  if (error) throw error
  if (!data) throw new NotFoundError('Partie GeoRush introuvable.', 'geo_session_not_found')
  return data as GeoSessionRow
}

/** Mise à jour atomique de l'état secret et de sa projection publique. */
export async function commitGeoState(
  db: SupabaseClient,
  sessionId: string,
  expectedVersion: number,
  state: GeoPrivateState,
): Promise<number> {
  const { data, error } = await db.rpc('geo_commit_state', {
    p_session_id: sessionId,
    p_expected_version: expectedVersion,
    p_private_state: state,
    p_public_state: toPublicGeoState(state),
  })
  if (error) throw error
  if (data !== true) throw new ConcurrentUpdateError()
  return expectedVersion + 1
}
