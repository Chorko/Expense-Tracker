'use server'

import { z } from 'zod'
import { dbFail, done, fail, getActor, invalid, notSignedIn, ok, refreshDashboard } from '@/lib/actions'
import { DEFAULT_TIMEZONE, parseYmd, todayIn } from '@/lib/dates'
import { rollForward } from '@/lib/recurring'
import {
  recurringSchema,
  recurringUpdateSchema,
  transactionSchema,
  transactionUpdateSchema,
  type RecurringInput,
  type RecurringUpdateInput,
  type TransactionInput,
  type TransactionUpdateInput,
} from '@/lib/validations'
import type { ActionResult } from '@/lib/types'

const idSchema = z.guid('Invalid id')

export async function addTransaction(input: TransactionInput): Promise<ActionResult<{ id: string }>> {
  const parsed = transactionSchema.safeParse(input)
  if (!parsed.success) return invalid(parsed.error)
  const actor = await getActor()
  if (!actor) return notSignedIn()

  const { data, error } = await actor.supabase
    .from('transactions')
    .insert({ ...parsed.data, user_id: actor.userId, source: 'manual' })
    .select('id')
    .single()
  if (error) return dbFail('addTransaction', error)

  refreshDashboard()
  return ok({ id: data.id })
}

export async function updateTransaction(input: TransactionUpdateInput): Promise<ActionResult> {
  const parsed = transactionUpdateSchema.safeParse(input)
  if (!parsed.success) return invalid(parsed.error)
  const actor = await getActor()
  if (!actor) return notSignedIn()

  const { id, ...fields } = parsed.data
  const { data, error } = await actor.supabase.from('transactions').update(fields).eq('id', id).select('id')
  if (error) return dbFail('updateTransaction', error)
  if (!data?.length) return fail('That transaction no longer exists.')

  refreshDashboard()
  return done()
}

export async function deleteTransaction(id: string): Promise<ActionResult> {
  const parsed = idSchema.safeParse(id)
  if (!parsed.success) return invalid(parsed.error)
  const actor = await getActor()
  if (!actor) return notSignedIn()

  const { data, error } = await actor.supabase.from('transactions').delete().eq('id', parsed.data).select('id')
  if (error) return dbFail('deleteTransaction', error)
  if (!data?.length) return fail('That transaction no longer exists.')

  refreshDashboard()
  return done()
}

// ─── Recurring transactions ──────────────────────────────────────────────────

export async function createRecurring(input: RecurringInput): Promise<ActionResult<{ id: string }>> {
  const parsed = recurringSchema.safeParse(input)
  if (!parsed.success) return invalid(parsed.error)
  const actor = await getActor()
  if (!actor) return notSignedIn()

  const { data, error } = await actor.supabase
    .from('recurring_transactions')
    .insert({
      ...parsed.data,
      user_id: actor.userId,
      anchor_day: parseYmd(parsed.data.next_due_date).day,
    })
    .select('id')
    .single()
  if (error) return dbFail('createRecurring', error)

  // Post anything already due (e.g. a rule starting today)
  const sync = await actor.supabase.rpc('sync_my_periods')
  if (sync.error) console.error('sync after createRecurring failed:', sync.error.message)

  refreshDashboard()
  return ok({ id: data.id })
}

export async function updateRecurring(input: RecurringUpdateInput): Promise<ActionResult> {
  const parsed = recurringUpdateSchema.safeParse(input)
  if (!parsed.success) return invalid(parsed.error)
  const actor = await getActor()
  if (!actor) return notSignedIn()
  const { supabase } = actor
  const { id, ...fields } = parsed.data

  const [{ data: current, error: loadError }, { data: profile }] = await Promise.all([
    supabase
      .from('recurring_transactions')
      .select('next_due_date, anchor_day, is_active, frequency')
      .eq('id', id)
      .maybeSingle(),
    supabase.from('profiles').select('timezone').eq('id', actor.userId).maybeSingle(),
  ])
  if (loadError) return dbFail('updateRecurring.load', loadError)
  if (!current) return fail('That recurring transaction no longer exists.')

  // A new due date means a new anchor day; keep the anchor otherwise so
  // month-end rules (e.g. the 31st) do not drift after a short month.
  const dateChanged = fields.next_due_date !== current.next_due_date
  let anchorDay = dateChanged ? parseYmd(fields.next_due_date).day : current.anchor_day
  let nextDue = fields.next_due_date

  // Resuming a paused rule must not back-post every missed occurrence
  const today = todayIn(profile?.timezone ?? DEFAULT_TIMEZONE)
  if (fields.is_active && !current.is_active && nextDue < today) {
    nextDue = rollForward(nextDue, fields.frequency, anchorDay, today)
    anchorDay ??= parseYmd(nextDue).day
  }

  const { error } = await supabase
    .from('recurring_transactions')
    .update({ ...fields, next_due_date: nextDue, anchor_day: anchorDay })
    .eq('id', id)
  if (error) return dbFail('updateRecurring', error)

  if (fields.is_active) {
    const sync = await supabase.rpc('sync_my_periods')
    if (sync.error) console.error('sync after updateRecurring failed:', sync.error.message)
  }

  refreshDashboard()
  return done()
}

export async function deleteRecurring(id: string): Promise<ActionResult> {
  const parsed = idSchema.safeParse(id)
  if (!parsed.success) return invalid(parsed.error)
  const actor = await getActor()
  if (!actor) return notSignedIn()

  // Transactions it already posted are kept (recurring_id becomes null)
  const { data, error } = await actor.supabase
    .from('recurring_transactions')
    .delete()
    .eq('id', parsed.data)
    .select('id')
  if (error) return dbFail('deleteRecurring', error)
  if (!data?.length) return fail('That recurring transaction no longer exists.')

  refreshDashboard()
  return done()
}
