import 'server-only'

import { cache } from 'react'
import { redirect } from 'next/navigation'
import { createClient, type SupabaseServerClient } from '@/lib/supabase/server'
import { isSupabaseConfigured } from '@/lib/env'
import { DEFAULT_TIMEZONE, isValidTimezone, todayIn } from '@/lib/dates'
import type { Tables } from '@/types/database'

export type Profile = Tables<'profiles'>

export type Viewer = {
  supabase: SupabaseServerClient
  userId: string
  email: string | null
  profile: Profile
  timezone: string
  /** Today's date (YYYY-MM-DD) in the user's timezone */
  today: string
}

// PostgREST / Postgres codes that mean "migration 005 has not been run yet"
const MISSING_SCHEMA_CODES = new Set(['PGRST202', 'PGRST204', '42883', '42703', '42P01'])

function isMissingSchema(error: { code?: string } | null | undefined) {
  return Boolean(error?.code && MISSING_SCHEMA_CODES.has(error.code))
}

/** The verified signed-in user for this request, or null. */
export const getSessionUser = cache(async () => {
  if (!isSupabaseConfigured()) redirect('/setup?reason=env')
  const supabase = await createClient()
  const { data, error } = await supabase.auth.getClaims()
  const claims = data?.claims
  if (error || !claims?.sub) return null
  return {
    supabase,
    userId: claims.sub,
    email: typeof claims.email === 'string' ? claims.email : null,
  }
})

async function loadProfile(supabase: SupabaseServerClient, userId: string, email: string | null) {
  const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle()
  if (isMissingSchema(error)) redirect('/setup?reason=migration')
  if (error) throw new Error(`Could not load your profile: ${error.message}`)
  if (data) return data

  // The auth trigger normally creates this row; heal accounts that predate it
  const created = await supabase
    .from('profiles')
    .upsert({ id: userId, email, display_name: email?.split('@')[0] ?? null }, { onConflict: 'id' })
    .select('*')
    .single()
  if (created.error) throw new Error(`Could not create your profile: ${created.error.message}`)
  return created.data
}

/**
 * Signed-in user with profile (redirects to /login when signed out).
 * Also rolls budget months forward (closes finished months, opens the
 * current one, posts due recurring transactions). Deduplicated per request.
 */
export const getViewer = cache(async (): Promise<Viewer> => {
  const session = await getSessionUser()
  if (!session) redirect('/login')
  const { supabase, userId, email } = session

  const [sync, profile] = await Promise.all([
    supabase.rpc('sync_my_periods'),
    loadProfile(supabase, userId, email),
  ])
  if (isMissingSchema(sync.error)) redirect('/setup?reason=migration')
  if (sync.error) console.error('sync_my_periods failed:', sync.error.message)

  const timezone = isValidTimezone(profile.timezone) ? profile.timezone : DEFAULT_TIMEZONE
  return { supabase, userId, email, profile, timezone, today: todayIn(timezone) }
})

/** For pages outside the dashboard (onboarding): no period sync. */
export const getViewerWithoutSync = cache(async () => {
  const session = await getSessionUser()
  if (!session) redirect('/login')
  const profile = await loadProfile(session.supabase, session.userId, session.email)
  const timezone = isValidTimezone(profile.timezone) ? profile.timezone : DEFAULT_TIMEZONE
  return { ...session, profile, timezone, today: todayIn(timezone) }
})
