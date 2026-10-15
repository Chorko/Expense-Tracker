'use server'

import { z } from 'zod'
import { dbFail, done, fail, getActor, invalid, notSignedIn, ok, refreshDashboard } from '@/lib/actions'
import {
  categoryGroupSchema,
  categorySchema,
  categoryUpdateSchema,
  type CategoryGroupInput,
  type CategoryInput,
  type CategoryUpdateInput,
} from '@/lib/validations'
import type { ActionResult } from '@/lib/types'
import type { TablesUpdate } from '@/types/database'

const idSchema = z.guid('Invalid id')

export async function createCategory(input: CategoryInput): Promise<ActionResult<{ id: string }>> {
  const parsed = categorySchema.safeParse(input)
  if (!parsed.success) return invalid(parsed.error)
  const actor = await getActor()
  if (!actor) return notSignedIn()
  const { supabase, userId } = actor

  const { data: last } = await supabase
    .from('categories')
    .select('sort_order')
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle()

  // The database creates the stack and this month's budget automatically
  const { data, error } = await supabase
    .from('categories')
    .insert({
      user_id: userId,
      name: parsed.data.name,
      monthly_budget_amount: parsed.data.monthly_budget_amount,
      group_id: parsed.data.group_id ?? null,
      parent_id: parsed.data.parent_id ?? null,
      is_flexible: parsed.data.is_flexible ?? false,
      icon: parsed.data.icon ?? '💰',
      sort_order: (last?.sort_order ?? 0) + 1,
    })
    .select('id')
    .single()
  if (error) return dbFail('createCategory', error)

  refreshDashboard()
  return ok({ id: data.id })
}

export async function updateCategory(input: CategoryUpdateInput): Promise<ActionResult> {
  const parsed = categoryUpdateSchema.safeParse(input)
  if (!parsed.success) return invalid(parsed.error)
  const actor = await getActor()
  if (!actor) return notSignedIn()

  const { id, ...fields } = parsed.data
  const changes: TablesUpdate<'categories'> = {}
  if (fields.name !== undefined) changes.name = fields.name
  if (fields.monthly_budget_amount !== undefined) changes.monthly_budget_amount = fields.monthly_budget_amount
  if (fields.icon !== undefined) changes.icon = fields.icon
  if (fields.group_id !== undefined) changes.group_id = fields.group_id
  if (fields.parent_id !== undefined) changes.parent_id = fields.parent_id
  if (fields.is_flexible !== undefined) changes.is_flexible = fields.is_flexible
  if (Object.keys(changes).length === 0) return done()

  const { data, error } = await actor.supabase.from('categories').update(changes).eq('id', id).select('id')
  if (error) return dbFail('updateCategory', error)
  if (!data?.length) return fail('That category no longer exists.')

  refreshDashboard()
  return done()
}

async function setActive(id: string, active: boolean, context: string): Promise<ActionResult> {
  const parsed = idSchema.safeParse(id)
  if (!parsed.success) return invalid(parsed.error)
  const actor = await getActor()
  if (!actor) return notSignedIn()

  const { data, error } = await actor.supabase
    .from('categories')
    .update({ is_active: active })
    .eq('id', parsed.data)
    .select('id')
  if (error) return dbFail(context, error)
  if (!data?.length) return fail('That category no longer exists.')

  refreshDashboard()
  return done()
}

/**
 * Categories are archived, never deleted: their stack money and history
 * stay intact. Archiving releases this month's unspent budget, pauses
 * recurring rules and archives sub-categories (handled in the database).
 */
export async function archiveCategory(id: string): Promise<ActionResult> {
  return setActive(id, false, 'archiveCategory')
}

export async function restoreCategory(id: string): Promise<ActionResult> {
  return setActive(id, true, 'restoreCategory')
}

/** Saves a new display order (ids listed top to bottom). */
export async function reorderCategories(ids: string[]): Promise<ActionResult> {
  const parsed = z.array(idSchema).min(1).max(300).safeParse(ids)
  if (!parsed.success) return invalid(parsed.error)
  const actor = await getActor()
  if (!actor) return notSignedIn()

  const results = await Promise.all(
    parsed.data.map((categoryId, index) =>
      actor.supabase.from('categories').update({ sort_order: (index + 1) * 10 }).eq('id', categoryId)
    )
  )
  const failed = results.find(r => r.error)
  if (failed?.error) return dbFail('reorderCategories', failed.error)

  refreshDashboard()
  return done()
}

// ─── Groups ──────────────────────────────────────────────────────────────────

export async function createCategoryGroup(input: CategoryGroupInput): Promise<ActionResult<{ id: string }>> {
  const parsed = categoryGroupSchema.safeParse(input)
  if (!parsed.success) return invalid(parsed.error)
  const actor = await getActor()
  if (!actor) return notSignedIn()

  const { data: last } = await actor.supabase
    .from('category_groups')
    .select('sort_order')
    .order('sort_order', { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle()

  const { data, error } = await actor.supabase
    .from('category_groups')
    .insert({ ...parsed.data, user_id: actor.userId, sort_order: (last?.sort_order ?? 0) + 1 })
    .select('id')
    .single()
  if (error) return dbFail('createCategoryGroup', error)

  refreshDashboard()
  return ok({ id: data.id })
}

export async function updateCategoryGroup(id: string, input: CategoryGroupInput): Promise<ActionResult> {
  const parsedId = idSchema.safeParse(id)
  if (!parsedId.success) return invalid(parsedId.error)
  const parsed = categoryGroupSchema.safeParse(input)
  if (!parsed.success) return invalid(parsed.error)
  const actor = await getActor()
  if (!actor) return notSignedIn()

  const { data, error } = await actor.supabase
    .from('category_groups')
    .update(parsed.data)
    .eq('id', parsedId.data)
    .select('id')
  if (error) return dbFail('updateCategoryGroup', error)
  if (!data?.length) return fail('That group no longer exists.')

  refreshDashboard()
  return done()
}

/** Categories in the group become ungrouped; nothing else changes. */
export async function deleteCategoryGroup(id: string): Promise<ActionResult> {
  const parsed = idSchema.safeParse(id)
  if (!parsed.success) return invalid(parsed.error)
  const actor = await getActor()
  if (!actor) return notSignedIn()

  const { data, error } = await actor.supabase.from('category_groups').delete().eq('id', parsed.data).select('id')
  if (error) return dbFail('deleteCategoryGroup', error)
  if (!data?.length) return fail('That group no longer exists.')

  refreshDashboard()
  return done()
}
