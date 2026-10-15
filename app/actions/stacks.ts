'use server'

import { dbFail, done, fail, getActor, invalid, notSignedIn, ok, refreshDashboard } from '@/lib/actions'
import { toNumber } from '@/lib/format'
import { stackMoveSchema, stockNoteSchema, type StackMoveInput } from '@/lib/validations'
import type { ActionResult } from '@/lib/types'

/**
 * Moves money out of one or more stacks in a single database transaction.
 * The database checks ownership and balances; this only validates shape.
 */
export async function moveStackMoney(
  input: StackMoveInput
): Promise<ActionResult<{ total: number; destination: string }>> {
  const parsed = stackMoveSchema.safeParse(input)
  if (!parsed.success) return invalid(parsed.error)
  const actor = await getActor()
  if (!actor) return notSignedIn()
  const move = parsed.data

  const { data, error } = await actor.supabase.rpc('move_stack_money', {
    p_sources: move.sources,
    p_dest_type: move.dest_type,
    p_dest_category_id: move.dest_type === 'period' || move.dest_type === 'stack' ? move.dest_category_id ?? undefined : undefined,
    p_dest_goal_id: move.dest_type === 'goal' ? move.dest_goal_id ?? undefined : undefined,
    p_ticker_or_note: move.dest_type === 'stock' ? move.ticker_or_note ?? undefined : undefined,
    p_comment: move.comment,
  })
  if (error) return dbFail('moveStackMoney', error)

  const result = (data ?? {}) as { total?: unknown; destination?: unknown }
  refreshDashboard()
  return ok({ total: toNumber(result.total), destination: String(result.destination ?? '') })
}

export async function updateStockNote(input: { id: string; ticker_or_note: string }): Promise<ActionResult> {
  const parsed = stockNoteSchema.safeParse(input)
  if (!parsed.success) return invalid(parsed.error)
  const actor = await getActor()
  if (!actor) return notSignedIn()

  const { data, error } = await actor.supabase
    .from('stock_purchases')
    .update({ ticker_or_note: parsed.data.ticker_or_note })
    .eq('id', parsed.data.id)
    .select('id')
  if (error) return dbFail('updateStockNote', error)
  if (!data?.length) return fail('That purchase no longer exists.')

  refreshDashboard()
  return done()
}
