import 'server-only'

import { getViewer } from './session'
import { roundMoney, toNumber } from '@/lib/format'
import type { LoanRow, LoanSummary } from '@/lib/types'

export async function getLoans(): Promise<LoanRow[]> {
  const { supabase } = await getViewer()
  const { data, error } = await supabase
    .from('loans')
    .select(
      'id, borrower_name, amount, direction, date_lent, reason, expected_return_date, reminder_date, status, notes, created_at, loan_repayments(id, amount, repaid_date, notes, created_at)'
    )
    .order('created_at', { ascending: false })
  if (error) throw new Error(`Could not load loans: ${error.message}`)

  return (data ?? []).map(loan => {
    const repayments = [...(loan.loan_repayments ?? [])]
      .sort((a, b) => b.repaid_date.localeCompare(a.repaid_date) || (b.created_at ?? '').localeCompare(a.created_at ?? ''))
      .map(r => ({ id: r.id, amount: toNumber(r.amount), repaid_date: r.repaid_date, notes: r.notes }))
    const amount = toNumber(loan.amount)
    const repaid = roundMoney(repayments.reduce((sum, r) => sum + r.amount, 0))
    return {
      id: loan.id,
      borrower_name: loan.borrower_name,
      amount,
      direction: loan.direction === 'borrowed_in' ? 'borrowed_in' : 'lent_out',
      date_lent: loan.date_lent,
      reason: loan.reason,
      expected_return_date: loan.expected_return_date,
      reminder_date: loan.reminder_date,
      status: (['outstanding', 'partially_repaid', 'repaid'].includes(loan.status)
        ? loan.status
        : 'outstanding') as LoanRow['status'],
      notes: loan.notes,
      repaid,
      outstanding: roundMoney(Math.max(0, amount - repaid)),
      repayments,
    }
  })
}

export function summarizeLoans(loans: LoanRow[], today: string): LoanSummary {
  const open = loans.filter(l => l.status !== 'repaid')
  const upcoming = open
    .filter(l => l.reminder_date)
    .sort((a, b) => (a.reminder_date ?? '').localeCompare(b.reminder_date ?? ''))
  const next = upcoming[0]
  return {
    lentOutstanding: roundMoney(open.filter(l => l.direction === 'lent_out').reduce((s, l) => s + l.outstanding, 0)),
    borrowedOutstanding: roundMoney(open.filter(l => l.direction === 'borrowed_in').reduce((s, l) => s + l.outstanding, 0)),
    activeCount: open.length,
    overdueCount: open.filter(l => l.reminder_date && l.reminder_date <= today).length,
    nextReminder: next?.reminder_date ? { name: next.borrower_name, date: next.reminder_date } : null,
  }
}
