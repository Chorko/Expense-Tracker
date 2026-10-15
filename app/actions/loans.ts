'use server'

import { z } from 'zod'
import { dbFail, done, fail, getActor, invalid, notSignedIn, ok, refreshDashboard } from '@/lib/actions'
import {
  loanReminderSchema,
  loanRepaymentSchema,
  loanSchema,
  loanUpdateSchema,
  type LoanInput,
  type LoanRepaymentInput,
  type LoanUpdateInput,
} from '@/lib/validations'
import type { ActionResult } from '@/lib/types'

const idSchema = z.guid('Invalid id')

export async function createLoan(input: LoanInput): Promise<ActionResult<{ id: string }>> {
  const parsed = loanSchema.safeParse(input)
  if (!parsed.success) return invalid(parsed.error)
  const actor = await getActor()
  if (!actor) return notSignedIn()

  const { data, error } = await actor.supabase
    .from('loans')
    .insert({ ...parsed.data, user_id: actor.userId, status: 'outstanding' })
    .select('id')
    .single()
  if (error) return dbFail('createLoan', error)

  refreshDashboard()
  return ok({ id: data.id })
}

/** Status is derived from repayments by the database, so it is not editable. */
export async function updateLoan(input: LoanUpdateInput): Promise<ActionResult> {
  const parsed = loanUpdateSchema.safeParse(input)
  if (!parsed.success) return invalid(parsed.error)
  const actor = await getActor()
  if (!actor) return notSignedIn()

  const { id, ...fields } = parsed.data
  const { data, error } = await actor.supabase.from('loans').update(fields).eq('id', id).select('id')
  if (error) return dbFail('updateLoan', error)
  if (!data?.length) return fail('That entry no longer exists.')

  refreshDashboard()
  return done()
}

export async function deleteLoan(id: string): Promise<ActionResult> {
  const parsed = idSchema.safeParse(id)
  if (!parsed.success) return invalid(parsed.error)
  const actor = await getActor()
  if (!actor) return notSignedIn()

  const { data, error } = await actor.supabase.from('loans').delete().eq('id', parsed.data).select('id')
  if (error) return dbFail('deleteLoan', error)
  if (!data?.length) return fail('That entry no longer exists.')

  refreshDashboard()
  return done()
}

export async function addLoanRepayment(input: LoanRepaymentInput): Promise<ActionResult> {
  const parsed = loanRepaymentSchema.safeParse(input)
  if (!parsed.success) return invalid(parsed.error)
  const actor = await getActor()
  if (!actor) return notSignedIn()

  // The database rejects repayments above the outstanding balance and
  // updates the loan status.
  const { error } = await actor.supabase
    .from('loan_repayments')
    .insert({ ...parsed.data, user_id: actor.userId })
  if (error) return dbFail('addLoanRepayment', error)

  refreshDashboard()
  return done()
}

export async function deleteLoanRepayment(id: string): Promise<ActionResult> {
  const parsed = idSchema.safeParse(id)
  if (!parsed.success) return invalid(parsed.error)
  const actor = await getActor()
  if (!actor) return notSignedIn()

  const { data, error } = await actor.supabase.from('loan_repayments').delete().eq('id', parsed.data).select('id')
  if (error) return dbFail('deleteLoanRepayment', error)
  if (!data?.length) return fail('That repayment no longer exists.')

  refreshDashboard()
  return done()
}

/** Sets (or clears, with null) the e-mail reminder date. */
export async function setLoanReminder(input: { loan_id: string; reminder_date: string | null }): Promise<ActionResult> {
  const parsed = loanReminderSchema.safeParse(input)
  if (!parsed.success) return invalid(parsed.error)
  const actor = await getActor()
  if (!actor) return notSignedIn()

  const { data, error } = await actor.supabase
    .from('loans')
    .update({ reminder_date: parsed.data.reminder_date })
    .eq('id', parsed.data.loan_id)
    .select('id')
  if (error) return dbFail('setLoanReminder', error)
  if (!data?.length) return fail('That entry no longer exists.')

  refreshDashboard()
  return done()
}
