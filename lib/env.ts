// Public Supabase settings. Referenced statically so Next.js can inline them
// into client bundles. The publishable key (sb_publishable_...) replaces the
// legacy anon key; either works.
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

export function getSupabaseEnv(): { url: string; key: string } {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    throw new Error(
      'Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and ' +
        'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (or NEXT_PUBLIC_SUPABASE_ANON_KEY) in .env.local. ' +
        'See .env.example.'
    )
  }
  return { url: SUPABASE_URL, key: SUPABASE_KEY }
}

export function isSupabaseConfigured(): boolean {
  return Boolean(SUPABASE_URL && SUPABASE_KEY)
}
