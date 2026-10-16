// Shared helpers for Ledger's Edge Functions (Deno).
//
// These functions are called by pg_cron over pg_net with the project's secret
// key in the `apikey` header, so deploy them with `--no-verify-jwt` and let
// `requireServiceKey` do the check instead.
import { createClient, type SupabaseClient } from 'jsr:@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!

/** Every secret key the project accepts (new `SUPABASE_SECRET_KEYS` JSON + legacy service role). */
function serviceKeys(): string[] {
  const keys = new Set<string>()
  const legacy = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (legacy) keys.add(legacy)
  const json = Deno.env.get('SUPABASE_SECRET_KEYS')
  if (json) {
    try {
      const parsed = JSON.parse(json) as Record<string, string>
      for (const value of Object.values(parsed)) if (typeof value === 'string') keys.add(value)
    } catch {
      // Not JSON: treat the whole value as a single key
      keys.add(json)
    }
  }
  const single = Deno.env.get('SUPABASE_SECRET_KEY')
  if (single) keys.add(single)
  return [...keys]
}

function timingSafeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder()
  const ab = enc.encode(a)
  const bb = enc.encode(b)
  // Compare against a fixed length so the duration does not leak which key matched
  const length = Math.max(ab.length, bb.length, 1)
  let diff = ab.length ^ bb.length
  for (let i = 0; i < length; i++) diff |= (ab[i] ?? 0) ^ (bb[i] ?? 0)
  return diff === 0
}

/**
 * Returns an admin Supabase client when the caller presented a valid secret
 * key (in `apikey` or `Authorization: Bearer`), otherwise a 401 Response.
 */
export function requireServiceKey(req: Request): SupabaseClient | Response {
  const presented =
    req.headers.get('apikey') ?? req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '') ?? ''
  const keys = serviceKeys()
  const authorised = presented.length > 0 && keys.some(key => timingSafeEqual(presented, key))
  if (!authorised) {
    return jsonResponse({ success: false, error: 'Unauthorized' }, 401)
  }
  return createClient(SUPABASE_URL, keys[0], { auth: { persistSession: false } })
}

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

export function appUrl(): string {
  return (Deno.env.get('APP_URL') ?? Deno.env.get('NEXT_PUBLIC_APP_URL') ?? 'https://ledger.app').replace(/\/+$/, '')
}
