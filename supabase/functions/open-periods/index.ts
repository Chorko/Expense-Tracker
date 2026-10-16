// Legacy endpoint. The budget engine now rolls months over inside Postgres
// (hourly `ledger-sync-periods` cron, plus lazily on page load), so this just
// triggers a sync for every user. Kept so old schedules keep working.
// Deploy with: supabase functions deploy open-periods --no-verify-jwt
import { jsonResponse, requireServiceKey } from '../_shared/supabase.ts'

Deno.serve(async (req: Request) => {
  const supabase = requireServiceKey(req)
  if (supabase instanceof Response) return supabase

  const { data, error } = await supabase.rpc('sync_all_periods')
  if (error) {
    console.error('sync_all_periods failed:', error.message)
    return jsonResponse({ success: false, error: error.message }, 500)
  }
  return jsonResponse({ success: true, users_synced: data ?? 0 })
})
