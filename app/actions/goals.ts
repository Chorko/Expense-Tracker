'use server'

import { z } from 'zod'
import { dbFail, done, fail, getActor, invalid, notSignedIn, ok, refreshDashboard } from '@/lib/actions'
import { toNumber } from '@/lib/format'
import {
  goalAdjustSchema,
  goalSchema,
  goalUpdateSchema,
  type GoalAdjustInput,
  type GoalInput,
  type GoalUpdateInput,
} from '@/lib/validations'
import type { ActionResult } from '@/lib/types'

const idSchema = z.guid('Invalid id')

export async function createGoal(input: GoalInput): Promise<ActionResult<{ id: string }>> {
  const parsed = goalSchema.safeParse(input)
  if (!parsed.success) return invalid(parsed.error)
  const actor = await getActor()
  if (!actor) return notSignedIn()

  const { data, error } = await actor.supabase
    .from('goals')
    .insert({ ...parsed.data, user_id: actor.userId, current_amount: 0 })
    .select('id')
    .single()
  if (error) return dbFail('createGoal', error)

  refreshDashboard()
  return ok({ id: data.id })
}

export async function updateGoal(input: GoalUpdateInput): Promise<ActionResult> {
  const parsed = goalUpdateSchema.safeParse(input)
  if (!parsed.success) return invalid(parsed.error)
  const actor = await getActor()
  if (!actor) return notSignedIn()

  const { id, ...fields } = parsed.data
  const { data, error } = await actor.supabase.from('goals').update(fields).eq('id', id).select('id')
  if (error) return dbFail('updateGoal', error)
  if (!data?.length) return fail('That goal no longer exists.')

  refreshDashboard()
  return done()
}

export async function deleteGoal(id: string): Promise<ActionResult> {
  const parsed = idSchema.safeParse(id)
  if (!parsed.success) return invalid(parsed.error)
  const actor = await getActor()
  if (!actor) return notSignedIn()

  const { data, error } = await actor.supabase.from('goals').delete().eq('id', parsed.data).select('id')
  if (error) return dbFail('deleteGoal', error)
  if (!data?.length) return fail('That goal no longer exists.')

  refreshDashboard()
  return done()
}

/** Manual contribution or withdrawal (never below zero). */
export async function adjustGoal(input: GoalAdjustInput): Promise<ActionResult<{ current: number }>> {
  const parsed = goalAdjustSchema.safeParse(input)
  if (!parsed.success) return invalid(parsed.error)
  const actor = await getActor()
  if (!actor) return notSignedIn()

  const delta = parsed.data.direction === 'add' ? parsed.data.amount : -parsed.data.amount
  const { data, error } = await actor.supabase.rpc('adjust_goal_amount', {
    p_goal_id: parsed.data.goal_id,
    p_delta: delta,
  })
  if (error) return dbFail('adjustGoal', error)

  refreshDashboard()
  return ok({ current: toNumber(data) })
}
