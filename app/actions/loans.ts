'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { loanSchema, loanRepaymentSchema, snoozeLoanSchema } from '@/lib/validations'
import type { LoanInput, LoanRepaymentInput } from '@/lib/validations'

type ActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string }

export async function createLoan(raw: LoanInput): Promise<ActionResult<{ id: string }>> {
  const parsed = loanSchema.safeParse(raw)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Validation error' }
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Not authenticated' }

  const input = parsed.data

  const result = await (supabase as any)
    .from('loans')
    .insert({
      user_id: user.id,
      borrower_name: input.borrower_name,
      amount: input.amount,
      direction: input.direction ?? 'lent_out',
      date_lent: input.date_lent,
      reason: input.reason ?? null,
      expected_return_date: input.expected_return_date ?? null,
      reminder_date: input.reminder_date ?? input.expected_return_date ?? null,
      notes: input.notes ?? null,
    })
    .select('id')
    .single()

  if (result.error) {
    console.error('createLoan error:', result.error)
    return { success: false, error: 'Failed to create loan record' }
  }

  revalidatePath('/dashboard')
  revalidatePath('/dashboard/loans')
  return { success: true, data: { id: (result.data as { id: string }).id } }
}

export async function addLoanRepayment(raw: LoanRepaymentInput): Promise<ActionResult> {
  const parsed = loanRepaymentSchema.safeParse(raw)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Validation error' }
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Not authenticated' }

  // Verify the loan belongs to this user
  const loanResult = await (supabase as any)
    .from('loans')
    .select('id, amount, status')
    .eq('id', parsed.data.loan_id)
    .eq('user_id', user.id)
    .single()

  const loan = loanResult.data as { id: string; amount: number; status: string } | null
  if (!loan) return { success: false, error: 'Loan not found' }
  if (loan.status === 'repaid') return { success: false, error: 'This loan is already fully repaid' }

  const repayResult = await (supabase as any)
    .from('loan_repayments')
    .select('amount')
    .eq('loan_id', loan.id)

  const existingRepayments = (repayResult.data ?? []) as Array<{ amount: number }>
  const alreadyRepaid = existingRepayments.reduce((s, r) => s + r.amount, 0)
  const outstanding = loan.amount - alreadyRepaid

  if (parsed.data.amount > outstanding + 0.01) {
    return {
      success: false,
      error: `Repayment (₹${parsed.data.amount}) exceeds outstanding balance (₹${outstanding.toFixed(2)})`,
    }
  }

  const { error } = await (supabase as any)
    .from('loan_repayments')
    .insert({
      loan_id: parsed.data.loan_id,
      user_id: user.id,
      amount: parsed.data.amount,
      repaid_date: parsed.data.repaid_date,
      notes: parsed.data.notes ?? null,
    })

  if (error) {
    console.error('addLoanRepayment error:', error)
    return { success: false, error: 'Failed to record repayment' }
  }

  revalidatePath('/dashboard')
  revalidatePath('/dashboard/loans')
  return { success: true, data: undefined }
}

export async function snoozeLoanReminder(
  loanId: string,
  newReminderDate: string
): Promise<ActionResult> {
  const parsed = snoozeLoanSchema.safeParse({ loan_id: loanId, new_reminder_date: newReminderDate })
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Validation error' }
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Not authenticated' }

  const { error } = await (supabase as any)
    .from('loans')
    .update({ reminder_date: parsed.data.new_reminder_date })
    .eq('id', parsed.data.loan_id)
    .eq('user_id', user.id)
    .neq('status', 'repaid')

  if (error) return { success: false, error: 'Failed to snooze reminder' }

  revalidatePath('/dashboard')
  revalidatePath('/dashboard/loans')
  return { success: true, data: undefined }
}

export async function getLoans(opts?: { includeRepaid?: boolean; direction?: 'lent_out' | 'borrowed_in' }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  let query = (supabase as any)
    .from('loans')
    .select(`
      id, borrower_name, amount, direction, date_lent, reason,
      expected_return_date, reminder_date, status, notes, created_at,
      loan_repayments (id, amount, repaid_date, notes)
    `)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (!opts?.includeRepaid) {
    query = query.neq('status', 'repaid')
  }

  if (opts?.direction) {
    query = query.eq('direction', opts.direction)
  }

  const { data, error } = await query
  if (error) {
    console.error('getLoans error:', error)
    return []
  }

  return (data ?? []) as Array<{
    id: string
    borrower_name: string
    amount: number
    direction: 'lent_out' | 'borrowed_in'
    date_lent: string
    reason: string | null
    expected_return_date: string | null
    reminder_date: string | null
    status: 'outstanding' | 'partially_repaid' | 'repaid'
    notes: string | null
    created_at: string
    loan_repayments: Array<{ id: string; amount: number; repaid_date: string; notes: string | null }>
  }>
}

export async function getLoanSummary() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const today = new Date().toISOString().slice(0, 10)

  const { data, error } = await (supabase as any)
    .from('loans')
    .select('amount, direction, status, reminder_date, loan_repayments(amount)')
    .eq('user_id', user.id)
    .neq('status', 'repaid')

  if (error || !data) return null

  const loans = data as Array<{
    amount: number
    direction: 'lent_out' | 'borrowed_in'
    status: string
    reminder_date: string | null
    loan_repayments: Array<{ amount: number }>
  }>

  let lentOutTotal = 0
  let borrowedInTotal = 0
  let overdueCount = 0
  let nextReminder: string | null = null

  for (const loan of loans) {
    const repaid = loan.loan_repayments?.reduce((s, r) => s + r.amount, 0) ?? 0
    const outstanding = loan.amount - repaid

    if (loan.direction === 'borrowed_in') {
      borrowedInTotal += outstanding
    } else {
      lentOutTotal += outstanding
    }

    if (loan.reminder_date && loan.reminder_date <= today) overdueCount++

    if (
      loan.reminder_date &&
      loan.reminder_date >= today &&
      (!nextReminder || loan.reminder_date < nextReminder)
    ) {
      nextReminder = loan.reminder_date
    }
  }

  return {
    totalOutstanding: lentOutTotal,
    lentOutTotal,
    borrowedInTotal,
    overdueCount,
    nextReminder,
    loanCount: loans.length,
  }
}
