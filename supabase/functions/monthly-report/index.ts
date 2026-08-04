import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!
const FROM_EMAIL = Deno.env.get('RESEND_FROM_EMAIL') ?? 'Ledger <onboarding@resend.dev>'

function formatINR(amount: number): string {
  return `₹${amount.toLocaleString('en-IN')}`
}

function getMonthName(month: number): string {
  const names = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  return names[month - 1] ?? ''
}

Deno.serve(async (req: Request) => {
  try {
    const now = new Date()
    // Report is for the previous month
    const reportMonth = now.getMonth() === 0 ? 12 : now.getMonth()
    const reportYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear()

    // Get all users
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, display_name, email, monthly_income')

    if (!profiles?.length) {
      return new Response(JSON.stringify({ success: true, sent: 0 }), { status: 200 })
    }

    let sent = 0

    for (const profile of profiles) {
      if (!profile.email) continue

      // Check not already sent
      const { data: existingLog } = await supabase
        .from('email_reports_log')
        .select('id')
        .eq('user_id', profile.id)
        .eq('report_type', 'monthly')
        .eq('month', reportMonth)
        .eq('year', reportYear)
        .single()

      if (existingLog) continue // already sent

      // Fetch data for this user
      const [periodsRes, stacksRes, stackTxnsRes, stocksRes, loansRes] = await Promise.all([
        supabase
          .from('category_periods')
          .select('budgeted_amount, rollover_in, spent_amount, categories(name, icon, category_groups(name, color_hex))')
          .eq('user_id', profile.id)
          .eq('month', reportMonth)
          .eq('year', reportYear),
        supabase
          .from('category_stacks')
          .select('current_balance, categories(name, icon)')
          .eq('user_id', profile.id)
          .gt('current_balance', 0),
        supabase
          .from('stack_transactions')
          .select('type, amount, comment, categories:category_id(name), related_categories:related_category_id(name)')
          .eq('user_id', profile.id)
          .eq('month', reportMonth)
          .eq('year', reportYear)
          .in('type', ['reallocation_out', 'reallocation_in', 'pulled_to_period']),
        supabase
          .from('stock_purchases')
          .select('amount, purchase_date, ticker_or_note, funded_from')
          .eq('user_id', profile.id)
          .gte('purchase_date', `${reportYear}-${String(reportMonth).padStart(2,'0')}-01`)
          .lte('purchase_date', `${reportYear}-${String(reportMonth).padStart(2,'0')}-31`),
        supabase
          .from('loans')
          .select('borrower_name, amount, status, reminder_date, loan_repayments(amount)')
          .eq('user_id', profile.id)
          .neq('status', 'repaid'),
      ])

      const periods = periodsRes.data ?? []
      const stacks = stacksRes.data ?? []
      const stackTxns = stackTxnsRes.data ?? []
      const stocks = stocksRes.data ?? []
      const loans = loansRes.data ?? []

      const totalBudgeted = periods.reduce((s, p) => s + p.budgeted_amount + p.rollover_in, 0)
      const totalSpent = periods.reduce((s, p) => s + p.spent_amount, 0)
      const totalStack = stacks.reduce((s, st) => s + st.current_balance, 0)

      const html = buildMonthlyReportHtml({
        displayName: profile.display_name ?? profile.email,
        month: reportMonth,
        year: reportYear,
        income: profile.monthly_income,
        totalBudgeted,
        totalSpent,
        periods: periods as any,
        stacks: stacks as any,
        stackTxns: stackTxns as any,
        stocks: stocks as any,
        loans: loans as any,
        totalStack,
      })

      try {
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${RESEND_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: FROM_EMAIL,
            to: [profile.email],
            subject: `Your ${getMonthName(reportMonth)} ${reportYear} Financial Report — Ledger`,
            html,
          }),
        })

        await supabase.from('email_reports_log').insert({
          user_id: profile.id,
          report_type: 'monthly',
          month: reportMonth,
          year: reportYear,
          status: 'sent',
        })

        sent++
      } catch (err) {
        console.error(`Failed to send report to ${profile.email}:`, err)
      }
    }

    return new Response(JSON.stringify({ success: true, sent }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('monthly-report function error:', err)
    return new Response(JSON.stringify({ success: false, error: String(err) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
})

function buildMonthlyReportHtml(data: {
  displayName: string
  month: number
  year: number
  income: number
  totalBudgeted: number
  totalSpent: number
  periods: Array<{ budgeted_amount: number; rollover_in: number; spent_amount: number; categories: { name: string; icon: string | null; category_groups: { name: string } | null } | null }>
  stacks: Array<{ current_balance: number; categories: { name: string; icon: string | null } | null }>
  stackTxns: Array<{ type: string; amount: number; comment: string | null; categories: { name: string } | null }>
  stocks: Array<{ amount: number; purchase_date: string; ticker_or_note: string | null; funded_from: unknown }>
  loans: Array<{ borrower_name: string; amount: number; status: string; reminder_date: string | null; loan_repayments: Array<{ amount: number }> }>
  totalStack: number
}): string {
  const savingsRate = data.income > 0
    ? Math.round(((data.income - data.totalSpent) / data.income) * 100)
    : 0

  const periodRows = data.periods
    .filter(p => p.categories)
    .map(p => {
      const remaining = p.budgeted_amount + p.rollover_in - p.spent_amount
      const pct = Math.round((p.spent_amount / (p.budgeted_amount + p.rollover_in)) * 100)
      const color = pct >= 100 ? '#ef4444' : pct >= 80 ? '#f59e0b' : '#22c55e'
      return `
        <tr>
          <td style="padding:10px 12px;border-bottom:1px solid rgba(255,255,255,0.04);">
            ${p.categories?.icon ?? '💰'} ${p.categories?.name}
          </td>
          <td style="padding:10px 12px;border-bottom:1px solid rgba(255,255,255,0.04);font-family:monospace;text-align:right;">
            ${formatINR(p.budgeted_amount + p.rollover_in)}
          </td>
          <td style="padding:10px 12px;border-bottom:1px solid rgba(255,255,255,0.04);font-family:monospace;text-align:right;color:#c9a84c;">
            ${formatINR(p.spent_amount)}
          </td>
          <td style="padding:10px 12px;border-bottom:1px solid rgba(255,255,255,0.04);font-family:monospace;text-align:right;color:${color};">
            ${formatINR(Math.max(0, remaining))}
          </td>
        </tr>
      `
    }).join('')

  const stackRows = data.stacks.map(s => `
    <tr>
      <td style="padding:8px 12px;">${s.categories?.icon ?? '💰'} ${s.categories?.name}</td>
      <td style="padding:8px 12px;font-family:monospace;text-align:right;color:#2dd4bf;">${formatINR(s.current_balance)}</td>
    </tr>
  `).join('')

  const reallocationRows = data.stackTxns.slice(0, 10).map(t => `
    <tr>
      <td style="padding:8px 12px;color:#a89f91;font-size:12px;">${t.categories?.name ?? '—'}</td>
      <td style="padding:8px 12px;font-family:monospace;font-size:12px;">${formatINR(t.amount)}</td>
      <td style="padding:8px 12px;font-size:12px;color:#e8e0d0;">${t.comment ?? '—'}</td>
    </tr>
  `).join('')

  const loanRows = data.loans.map(l => {
    const repaid = l.loan_repayments.reduce((s, r) => s + r.amount, 0)
    const outstanding = l.amount - repaid
    return `
      <tr>
        <td style="padding:8px 12px;">${l.borrower_name}</td>
        <td style="padding:8px 12px;font-family:monospace;color:#c9a84c;">${formatINR(outstanding)}</td>
        <td style="padding:8px 12px;font-size:12px;">${l.status.replace('_', ' ')}</td>
      </tr>
    `
  }).join('')

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <title>${getMonthName(data.month)} ${data.year} — Ledger Report</title>
</head>
<body style="margin:0;padding:0;background:#0d1117;font-family:'IBM Plex Sans',system-ui,sans-serif;color:#e8e0d0;">
  <div style="max-width:600px;margin:40px auto;padding:0 16px;">

    <!-- Header -->
    <div style="text-align:center;padding:32px;background:#161b22;border:1px solid rgba(201,168,76,0.15);border-radius:12px 12px 0 0;border-bottom:none;">
      <div style="font-size:32px;margin-bottom:8px;">₹</div>
      <h1 style="margin:0;font-size:22px;color:#c9a84c;font-weight:700;">
        ${getMonthName(data.month)} ${data.year} — Financial Report
      </h1>
      <p style="margin:8px 0 0;color:#a89f91;font-size:14px;">Hi ${data.displayName}</p>
    </div>

    <!-- Hero stats -->
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;background:#1c2333;border:1px solid rgba(201,168,76,0.1);border-top:none;">
      ${[
        ['Income', formatINR(data.income), '#c9a84c'],
        ['Spent', formatINR(data.totalSpent), data.totalSpent > data.totalBudgeted ? '#ef4444' : '#2dd4bf'],
        ['Savings Rate', `${savingsRate}%`, savingsRate > 20 ? '#22c55e' : '#f59e0b'],
      ].map(([label, value, color]) => `
        <div style="padding:20px;text-align:center;border-right:1px solid rgba(255,255,255,0.05);">
          <p style="margin:0 0 4px;font-size:11px;color:#6b6459;text-transform:uppercase;letter-spacing:0.08em;">${label}</p>
          <p style="margin:0;font-size:20px;font-weight:700;color:${color};font-family:monospace;">${value}</p>
        </div>
      `).join('')}
    </div>

    <!-- Spend by category -->
    <div style="background:#161b22;border:1px solid rgba(201,168,76,0.1);margin-top:16px;border-radius:8px;overflow:hidden;">
      <div style="padding:16px 20px;border-bottom:1px solid rgba(255,255,255,0.06);">
        <h2 style="margin:0;font-size:15px;font-weight:600;">Spend by Category</h2>
      </div>
      <table style="width:100%;border-collapse:collapse;font-size:13px;">
        <thead>
          <tr style="background:#1c2333;">
            <th style="padding:10px 12px;text-align:left;font-size:11px;color:#6b6459;font-weight:600;text-transform:uppercase;letter-spacing:0.06em;">Category</th>
            <th style="padding:10px 12px;text-align:right;font-size:11px;color:#6b6459;font-weight:600;text-transform:uppercase;letter-spacing:0.06em;">Budget</th>
            <th style="padding:10px 12px;text-align:right;font-size:11px;color:#6b6459;font-weight:600;text-transform:uppercase;letter-spacing:0.06em;">Spent</th>
            <th style="padding:10px 12px;text-align:right;font-size:11px;color:#6b6459;font-weight:600;text-transform:uppercase;letter-spacing:0.06em;">Remaining</th>
          </tr>
        </thead>
        <tbody>${periodRows}</tbody>
      </table>
    </div>

    <!-- Stack balances -->
    ${data.stacks.length > 0 ? `
    <div style="background:#161b22;border:1px solid rgba(45,212,191,0.12);margin-top:16px;border-radius:8px;overflow:hidden;">
      <div style="padding:16px 20px;border-bottom:1px solid rgba(255,255,255,0.06);">
        <h2 style="margin:0;font-size:15px;font-weight:600;">Stack Balances</h2>
        <p style="margin:4px 0 0;font-size:12px;color:#a89f91;">Accumulated unused budget — total: ${formatINR(data.totalStack)}</p>
      </div>
      <table style="width:100%;border-collapse:collapse;font-size:13px;">
        <tbody>${stackRows}</tbody>
      </table>
    </div>
    ` : ''}

    <!-- Reallocations -->
    ${data.stackTxns.length > 0 ? `
    <div style="background:#161b22;border:1px solid rgba(139,92,246,0.12);margin-top:16px;border-radius:8px;overflow:hidden;">
      <div style="padding:16px 20px;border-bottom:1px solid rgba(255,255,255,0.06);">
        <h2 style="margin:0;font-size:15px;font-weight:600;">Stack Reallocations This Month</h2>
      </div>
      <table style="width:100%;border-collapse:collapse;font-size:13px;">
        <thead>
          <tr style="background:#1c2333;">
            <th style="padding:8px 12px;text-align:left;font-size:11px;color:#6b6459;">Category</th>
            <th style="padding:8px 12px;text-align:left;font-size:11px;color:#6b6459;">Amount</th>
            <th style="padding:8px 12px;text-align:left;font-size:11px;color:#6b6459;">Comment</th>
          </tr>
        </thead>
        <tbody>${reallocationRows}</tbody>
      </table>
    </div>
    ` : ''}

    <!-- Loans -->
    ${data.loans.length > 0 ? `
    <div style="background:#161b22;border:1px solid rgba(201,168,76,0.12);margin-top:16px;border-radius:8px;overflow:hidden;">
      <div style="padding:16px 20px;border-bottom:1px solid rgba(255,255,255,0.06);">
        <h2 style="margin:0;font-size:15px;font-weight:600;">Outstanding Loans</h2>
      </div>
      <table style="width:100%;border-collapse:collapse;font-size:13px;">
        <tbody>${loanRows}</tbody>
      </table>
    </div>
    ` : ''}

    <!-- Footer -->
    <div style="padding:24px;text-align:center;">
      <p style="margin:0 0 12px;font-size:13px;color:#a89f91;">
        View your full dashboard at <a href="#" style="color:#c9a84c;">ledger.app</a>
      </p>
      <p style="margin:0;font-size:11px;color:#6b6459;">
        Ledger — Personal Finance Tracker
      </p>
    </div>
  </div>
</body>
</html>
`
}

function getMonthName(month: number): string {
  const names = ['January','February','March','April','May','June','July','August','September','October','November','December']
  return names[month - 1] ?? ''
}
