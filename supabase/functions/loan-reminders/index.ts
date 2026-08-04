import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!
const FROM_EMAIL = Deno.env.get('RESEND_FROM_EMAIL') ?? 'Ledger <onboarding@resend.dev>'

async function sendReminderEmail(opts: {
  to: string
  borrowerName: string
  amount: number
  daysOverdue: number
  loanId: string
  appUrl: string
}) {
  const subject = opts.daysOverdue > 0
    ? `Reminder: ${opts.borrowerName} owes you ₹${opts.amount.toLocaleString('en-IN')} — ${opts.daysOverdue} day${opts.daysOverdue !== 1 ? 's' : ''} overdue`
    : `Reminder: ${opts.borrowerName} owes you ₹${opts.amount.toLocaleString('en-IN')}`

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="margin:0;padding:0;background:#0d1117;font-family:'IBM Plex Sans',system-ui,sans-serif;color:#e8e0d0;">
  <div style="max-width:500px;margin:40px auto;padding:32px;background:#161b22;border:1px solid rgba(201,168,76,0.15);border-radius:12px;">
    <div style="margin-bottom:24px;text-align:center;">
      <div style="display:inline-block;width:48px;height:48px;background:rgba(201,168,76,0.1);border:1px solid rgba(201,168,76,0.2);border-radius:12px;line-height:48px;font-size:24px;margin-bottom:12px;">₹</div>
      <h1 style="margin:0;font-size:20px;color:#c9a84c;font-weight:700;">Loan Reminder</h1>
    </div>

    <div style="background:#1c2333;border:1px solid rgba(255,255,255,0.06);border-radius:8px;padding:20px;margin-bottom:20px;">
      <p style="margin:0 0 8px;font-size:14px;color:#a89f91;">Borrower</p>
      <p style="margin:0 0 16px;font-size:20px;font-weight:600;color:#e8e0d0;">${opts.borrowerName}</p>
      <p style="margin:0 0 4px;font-size:12px;color:#a89f91;text-transform:uppercase;letter-spacing:0.08em;">Outstanding amount</p>
      <p style="margin:0;font-size:28px;font-weight:700;color:#c9a84c;font-family:'IBM Plex Mono',monospace;">₹${opts.amount.toLocaleString('en-IN')}</p>
    </div>

    ${opts.daysOverdue > 0 ? `
    <div style="background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.2);border-radius:8px;padding:12px 16px;margin-bottom:20px;">
      <p style="margin:0;color:#ef4444;font-size:14px;">
        ⚠ This reminder is <strong>${opts.daysOverdue} day${opts.daysOverdue !== 1 ? 's' : ''} overdue</strong>
      </p>
    </div>
    ` : ''}

    <div style="text-align:center;margin-top:24px;">
      <a href="${opts.appUrl}/dashboard/loans" style="display:inline-block;padding:12px 24px;background:#c9a84c;color:#0d1117;border-radius:8px;font-weight:600;text-decoration:none;font-size:14px;">
        View in Ledger →
      </a>
    </div>

    <p style="margin:24px 0 0;font-size:11px;color:#6b6459;text-align:center;">
      You're receiving this because you set a loan reminder in Ledger.<br>
      Update the reminder date in your dashboard to stop these.
    </p>
  </div>
</body>
</html>
`

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: FROM_EMAIL,
      to: [opts.to],
      subject,
      html,
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Resend API error: ${response.status} ${errorText}`)
  }

  return response.json()
}

Deno.serve(async (req: Request) => {
  try {
    const appUrl = Deno.env.get('NEXT_PUBLIC_APP_URL') ?? 'https://ledger.app'

    // Get all due loan reminders
    const { data: dueLoans, error } = await supabase.rpc('get_due_loan_reminders')

    if (error) {
      console.error('get_due_loan_reminders error:', error)
      return new Response(JSON.stringify({ success: false, error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    if (!dueLoans || dueLoans.length === 0) {
      return new Response(JSON.stringify({ success: true, sent: 0 }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    let sent = 0
    let errors = 0

    for (const loan of dueLoans) {
      if (!loan.user_email) continue

      try {
        await sendReminderEmail({
          to: loan.user_email,
          borrowerName: loan.borrower_name,
          amount: loan.amount,
          daysOverdue: Math.max(0, loan.days_overdue),
          loanId: loan.loan_id,
          appUrl,
        })

        // Log that we sent the email
        await supabase.from('email_reports_log').insert({
          user_id: loan.user_id,
          report_type: 'loan_reminder',
          status: 'sent',
        })

        sent++
      } catch (emailErr) {
        console.error(`Failed to send reminder for loan ${loan.loan_id}:`, emailErr)
        errors++
      }
    }

    return new Response(
      JSON.stringify({ success: true, sent, errors, total: dueLoans.length }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    console.error('loan-reminders function error:', err)
    return new Response(JSON.stringify({ success: false, error: String(err) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
})
