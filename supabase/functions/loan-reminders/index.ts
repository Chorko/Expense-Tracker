// Daily loan reminders. Scheduled by pg_cron (see migration 005) which POSTs
// with the project's secret key in the `apikey` header. Deploy with:
//   supabase functions deploy loan-reminders --no-verify-jwt
import { appUrl, jsonResponse, requireServiceKey } from '../_shared/supabase.ts'
import { card, ctaButton, emailShell, escapeHtml, formatINR, sendEmail } from '../_shared/email.ts'

type DueLoan = {
  loan_id: string
  user_id: string
  borrower_name: string
  direction: 'lent_out' | 'borrowed_in' | string
  amount: number
  outstanding: number
  reason: string | null
  reminder_date: string
  days_overdue: number
  user_email: string
  display_name: string | null
}

function loanLine(loan: DueLoan): string {
  const borrowed = loan.direction === 'borrowed_in'
  const who = escapeHtml(loan.borrower_name)
  const amount = formatINR(loan.outstanding)
  const sentence = borrowed ? `You owe <strong>${who}</strong> ${amount}` : `<strong>${who}</strong> owes you ${amount}`
  const overdue = loan.days_overdue > 0
  const when = overdue
    ? `<span style="color:#f87171;">${loan.days_overdue} day${loan.days_overdue === 1 ? '' : 's'} overdue</span>`
    : 'due today'
  const reason = loan.reason ? ` · ${escapeHtml(loan.reason)}` : ''
  return `<tr>
<td style="padding:12px 0;border-bottom:1px solid rgba(255,255,255,0.06);">
<p style="margin:0;font-size:15px;color:#ece5d6;">${sentence}</p>
<p style="margin:4px 0 0;font-size:12px;color:#8b8476;">${when}${reason}</p>
</td></tr>`
}

function buildEmail(name: string | null, loans: DueLoan[]): { subject: string; html: string } {
  const greeting = name ? `Hi ${escapeHtml(name)},` : 'Hi,'
  const subject =
    loans.length === 1
      ? loans[0].direction === 'borrowed_in'
        ? `Reminder: you owe ${loans[0].borrower_name} ${formatINR(loans[0].outstanding)}`
        : `Reminder: ${loans[0].borrower_name} owes you ${formatINR(loans[0].outstanding)}`
      : `You have ${loans.length} loan reminders due`

  const body = card(`
<h1 style="margin:0 0 4px;font-size:20px;color:#c9a84c;font-weight:700;">Loan reminders</h1>
<p style="margin:0 0 16px;font-size:14px;color:#b3aa9b;">${greeting} here is what needs following up today.</p>
<table style="width:100%;border-collapse:collapse;">${loans.map(loanLine).join('')}</table>
${ctaButton(`${appUrl()}/dashboard/loans`, 'Open loans in Ledger')}`)

  return { subject, html: emailShell({ title: subject, preheader: subject, body }) }
}

Deno.serve(async (req: Request) => {
  const supabase = requireServiceKey(req)
  if (supabase instanceof Response) return supabase

  const { data, error } = await supabase.rpc('get_due_loan_reminders')
  if (error) {
    console.error('get_due_loan_reminders failed:', error.message)
    return jsonResponse({ success: false, error: error.message }, 500)
  }

  const dueLoans = (data ?? []) as DueLoan[]
  // One e-mail per user, covering all of their due reminders
  const byUser = new Map<string, DueLoan[]>()
  for (const loan of dueLoans) {
    if (!loan.user_email) continue
    byUser.set(loan.user_id, [...(byUser.get(loan.user_id) ?? []), loan])
  }

  const today = new Date().toISOString().slice(0, 10)
  let sent = 0
  let failed = 0
  let skipped = 0

  for (const [userId, loans] of byUser) {
    // At most one reminder e-mail per user per day
    const { count, error: logError } = await supabase
      .from('email_reports_log')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('report_type', 'loan_reminder')
      .gte('sent_at', `${today}T00:00:00Z`)
    if (logError) {
      console.error(`log lookup failed for ${userId}:`, logError.message)
      failed++
      continue
    }
    if ((count ?? 0) > 0) {
      skipped++
      continue
    }

    const { subject, html } = buildEmail(loans[0].display_name, loans)
    const result = await sendEmail({ to: loans[0].user_email, subject, html })
    if (!result.ok) {
      console.error(`reminder e-mail failed for ${userId}:`, result.error)
      failed++
      continue
    }
    await supabase.from('email_reports_log').insert({ user_id: userId, report_type: 'loan_reminder', status: 'sent' })
    sent++
  }

  return jsonResponse({ success: true, users: byUser.size, sent, skipped, failed })
})
