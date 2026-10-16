// Monthly report e-mail. Scheduled by pg_cron (migration 005) for the 2nd-5th
// of each month; sends the previous month's summary once per user. Deploy with:
//   supabase functions deploy monthly-report --no-verify-jwt
import type { SupabaseClient } from 'jsr:@supabase/supabase-js@2'
import { appUrl, jsonResponse, requireServiceKey } from '../_shared/supabase.ts'
import { card, ctaButton, emailShell, escapeHtml, formatINR, sendEmail } from '../_shared/email.ts'

type Recipient = {
  user_id: string
  email: string
  display_name: string | null
  monthly_income: number
  timezone: string
}

// PostgREST returns an embedded one-to-one relation as an array
type PeriodRow = {
  budgeted_amount: number
  rollover_in: number
  spent_amount: number
  accrued_amount: number
  categories: { name: string; icon: string | null }[] | { name: string; icon: string | null } | null
}

function categoryOf(period: PeriodRow): { name: string; icon: string | null } | null {
  const c = period.categories
  return Array.isArray(c) ? c[0] ?? null : c
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

/** The calendar month before "now" in the given timezone. */
function previousMonth(timezone: string): { month: number; year: number } {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: timezone, year: 'numeric', month: 'numeric' }).formatToParts(new Date())
  const month = Number(parts.find(p => p.type === 'month')?.value ?? '1')
  const year = Number(parts.find(p => p.type === 'year')?.value ?? '2000')
  return month === 1 ? { month: 12, year: year - 1 } : { month: month - 1, year }
}

function statRow(cells: Array<[string, string, string]>): string {
  return `<table style="width:100%;border-collapse:collapse;margin:16px 0;"><tr>${cells
    .map(
      ([label, value, color]) => `<td style="width:33%;text-align:center;padding:8px;">
<p style="margin:0 0 2px;font-size:11px;color:#8b8476;text-transform:uppercase;letter-spacing:0.06em;">${escapeHtml(label)}</p>
<p style="margin:0;font-size:18px;font-weight:700;color:${color};">${escapeHtml(value)}</p></td>`
    )
    .join('')}</tr></table>`
}

function categoryRows(periods: PeriodRow[]): string {
  const spending = periods
    .filter(p => categoryOf(p) && p.spent_amount > 0)
    .sort((a, b) => b.spent_amount - a.spent_amount)
    .slice(0, 8)
  if (spending.length === 0) return '<p style="margin:0;font-size:13px;color:#8b8476;">No spending recorded this month.</p>'
  return `<table style="width:100%;border-collapse:collapse;font-size:13px;">${spending
    .map(p => {
      const category = categoryOf(p)
      const available = p.budgeted_amount + p.rollover_in
      const over = p.spent_amount > available && available > 0
      return `<tr>
<td style="padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.05);">${escapeHtml(category?.icon ?? '💰')} ${escapeHtml(category?.name ?? '')}</td>
<td style="padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.05);text-align:right;font-family:monospace;color:${over ? '#f87171' : '#ece5d6'};">${formatINR(p.spent_amount)}</td>
<td style="padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.05);text-align:right;font-family:monospace;color:#8b8476;">of ${formatINR(available)}</td>
</tr>`
    })
    .join('')}</table>`
}

async function buildReport(supabase: SupabaseClient, user: Recipient, month: number, year: number): Promise<string | null> {
  const { data, error } = await supabase
    .from('category_periods')
    .select('budgeted_amount, rollover_in, spent_amount, accrued_amount, categories(name, icon)')
    .eq('user_id', user.user_id)
    .eq('month', month)
    .eq('year', year)
  if (error) {
    console.error(`periods failed for ${user.user_id}:`, error.message)
    return null
  }
  const periods = (data ?? []) as PeriodRow[]
  if (periods.length === 0) return null // nothing budgeted that month; skip

  const budgeted = periods.reduce((s, p) => s + p.budgeted_amount + p.rollover_in, 0)
  const spent = periods.reduce((s, p) => s + p.spent_amount, 0)
  const rolled = periods.reduce((s, p) => s + Math.max(0, p.accrued_amount), 0)
  const savingsRate = user.monthly_income > 0 ? Math.round(((user.monthly_income - spent) / user.monthly_income) * 100) : null
  const overspent = periods.filter(p => categoryOf(p) && p.spent_amount > p.budgeted_amount + p.rollover_in && p.budgeted_amount + p.rollover_in > 0)

  const greeting = user.display_name ? `Hi ${escapeHtml(user.display_name)},` : 'Hi,'
  const title = `${MONTHS[month - 1]} ${year} report`
  const body = card(`
<h1 style="margin:0 0 4px;font-size:20px;color:#c9a84c;font-weight:700;">${escapeHtml(title)}</h1>
<p style="margin:0;font-size:14px;color:#b3aa9b;">${greeting} here is how last month went.</p>
${statRow([
  ['Spent', formatINR(spent), spent > budgeted ? '#f87171' : '#2dd4bf'],
  ['Budget', formatINR(budgeted), '#c9a84c'],
  savingsRate === null ? ['Saved to stacks', formatINR(rolled), '#2dd4bf'] : ['Savings rate', `${savingsRate}%`, savingsRate >= 20 ? '#34d399' : '#fbbf24'],
])}
${rolled > 0 && savingsRate !== null ? `<p style="margin:0 0 16px;font-size:13px;color:#2dd4bf;">${formatINR(rolled)} of unused budget rolled into your stacks.</p>` : ''}
${overspent.length > 0 ? `<p style="margin:0 0 16px;font-size:13px;color:#f87171;">You went over in ${overspent.length} categor${overspent.length === 1 ? 'y' : 'ies'}: ${escapeHtml(overspent.map(p => categoryOf(p)?.name).filter(Boolean).join(', '))}.</p>` : ''}
<h2 style="margin:8px 0 8px;font-size:14px;color:#ece5d6;">Top categories</h2>
${categoryRows(periods)}
${ctaButton(`${appUrl()}/dashboard?month=${year}-${String(month).padStart(2, '0')}`, 'View the full month')}`)

  return emailShell({ title, preheader: `You spent ${formatINR(spent)} of ${formatINR(budgeted)} in ${MONTHS[month - 1]}.`, body })
}

Deno.serve(async (req: Request) => {
  const supabase = requireServiceKey(req)
  if (supabase instanceof Response) return supabase

  const { data, error } = await supabase.rpc('get_report_recipients')
  if (error) {
    console.error('get_report_recipients failed:', error.message)
    return jsonResponse({ success: false, error: error.message }, 500)
  }

  let sent = 0
  let skipped = 0
  let failed = 0

  for (const user of (data ?? []) as Recipient[]) {
    if (!user.email) continue
    const { month, year } = previousMonth(user.timezone || 'Asia/Kolkata')

    // The unique index uq_email_reports_monthly also protects against races
    const { count } = await supabase
      .from('email_reports_log')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.user_id)
      .eq('report_type', 'monthly')
      .eq('month', month)
      .eq('year', year)
    if ((count ?? 0) > 0) {
      skipped++
      continue
    }

    const html = await buildReport(supabase, user, month, year)
    if (!html) {
      skipped++
      continue
    }

    const result = await sendEmail({ to: user.email, subject: `Your ${MONTHS[month - 1]} ${year} report — Ledger`, html })
    if (!result.ok) {
      console.error(`report e-mail failed for ${user.user_id}:`, result.error)
      failed++
      continue
    }
    const logged = await supabase
      .from('email_reports_log')
      .insert({ user_id: user.user_id, report_type: 'monthly', month, year, status: 'sent' })
    if (logged.error) console.error(`report log insert failed for ${user.user_id}:`, logged.error.message)
    sent++
  }

  return jsonResponse({ success: true, sent, skipped, failed })
})
