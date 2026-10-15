'use client'

import { createBrowserClient } from '@supabase/ssr'
import { getSupabaseEnv } from '@/lib/env'
import type { Database } from '@/types/database'

// Browser client (singleton inside @supabase/ssr). Only call this from event
// handlers or effects, never during render of a statically prerendered page.
export function createClient() {
  const { url, key } = getSupabaseEnv()
  return createBrowserClient<Database>(url, key)
}
