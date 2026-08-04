import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

Deno.serve(async (req: Request) => {
  try {
    const now = new Date()
    // Run for the previous month (this is called at end of month)
    const month = now.getMonth() + 1 // 1-indexed
    const year = now.getFullYear()

    const { error } = await supabase.rpc('close_periods_and_accrue_stacks', {
      p_month: month,
      p_year: year,
    })

    if (error) {
      console.error('close_periods_and_accrue_stacks error:', error)
      return new Response(JSON.stringify({ success: false, error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    console.log(`Periods closed and stacks accrued for ${month}/${year}`)
    return new Response(JSON.stringify({ success: true, month, year }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('close-periods function error:', err)
    return new Response(JSON.stringify({ success: false, error: String(err) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
})
