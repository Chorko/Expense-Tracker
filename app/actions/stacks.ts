'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { stackReallocationSchema } from '@/lib/validations'
import { getCurrentMonthYear } from '@/lib/utils/format'
import type { StackReallocationInput } from '@/lib/validations'

type ActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string }

export async function reallocateFromStacks(
  raw: StackReallocationInput
): Promise<ActionResult> {
  const parsed = stackReallocationSchema.safeParse(raw)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Validation error' }
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Not authenticated' }

  const { month, year } = getCurrentMonthYear()
  const input = parsed.data

  let stockPurchaseId: string | undefined

  // If destination is a stock, create the stock_purchases row first
  if (input.dest_type === 'stock') {
    const totalAmount = input.sources.reduce((sum, s) => sum + s.amount, 0)
    const fundedFrom = input.sources.map(s => ({
      category_id: s.category_id,
      amount: s.amount,
    }))

    const spResult = await (supabase as any)
      .from('stock_purchases')
      .insert({
        user_id: user.id,
        amount: totalAmount,
        purchase_date: new Date().toISOString().slice(0, 10),
        ticker_or_note: input.ticker_or_note ?? null,
        funded_from: fundedFrom,
      })
      .select('id')
      .single()

    if (spResult.error || !spResult.data) {
      console.error('stock purchase insert error:', spResult.error)
      return { success: false, error: 'Failed to create stock purchase record' }
    }

    stockPurchaseId = (spResult.data as { id: string }).id
  }

  // Build sources JSON for the Postgres function
  const sourcesJson = input.sources.map(s => ({
    category_id: s.category_id,
    amount: s.amount,
  }))

  const { error } = await (supabase as any).rpc('reallocate_stack', {
    p_user_id: user.id,
    p_sources: sourcesJson,
    p_dest_type: input.dest_type,
    p_dest_category_id: input.dest_category_id ?? null,
    p_dest_period_month: input.dest_type === 'period' ? (input.dest_period_month ?? month) : null,
    p_dest_period_year: input.dest_type === 'period' ? (input.dest_period_year ?? year) : null,
    p_stock_purchase_id: stockPurchaseId ?? null,
    p_comment: input.comment,
  })

  if (error) {
    console.error('reallocate_stack rpc error:', error)
    return { success: false, error: (error as { message?: string }).message ?? 'Reallocation failed' }
  }

  revalidatePath('/dashboard')
  revalidatePath('/dashboard/stacks')
  return { success: true, data: undefined }
}

export async function getStackBalances() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data, error } = await (supabase as any)
    .from('category_stacks')
    .select(`
      id, current_balance, last_updated,
      categories (id, name, icon, group_id,
        category_groups (name, color_hex)
      )
    `)
    .eq('user_id', user.id)
    .gt('current_balance', 0)
    .order('current_balance', { ascending: false })

  if (error) {
    console.error('getStackBalances error:', error)
    return []
  }

  return (data ?? []) as Array<{
    id: string
    current_balance: number
    last_updated: string
    categories: {
      id: string
      name: string
      icon: string | null
      group_id: string | null
      category_groups: { name: string; color_hex: string } | null
    } | null
  }>
}

export async function getStackHistory(opts?: {
  categoryId?: string
  limit?: number
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const baseQuery = (supabase as any)
    .from('stack_transactions')
    .select(`
      id, type, amount, comment, month, year, created_at,
      categories:category_id (id, name, icon),
      related_categories:related_category_id (id, name, icon)
    `)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  const filteredQuery = opts?.categoryId
    ? baseQuery.eq('category_id', opts.categoryId)
    : baseQuery

  const limitedQuery = opts?.limit
    ? filteredQuery.limit(opts.limit)
    : filteredQuery

  const { data, error } = await limitedQuery
  if (error) {
    console.error('getStackHistory error:', error)
    return []
  }

  return (data ?? []) as Array<{
    id: string
    type: string
    amount: number
    comment: string | null
    month: number | null
    year: number | null
    created_at: string
    categories: { id: string; name: string; icon: string | null } | null
    related_categories: { id: string; name: string; icon: string | null } | null
  }>
}

export async function manuallyCloseAndAccrueCurrentMonth(): Promise<ActionResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Not authenticated' }

  const { month, year } = getCurrentMonthYear()

  const { error } = await (supabase as any).rpc('close_periods_and_accrue_stacks', {
    p_month: month,
    p_year: year,
  })

  if (error) return { success: false, error: (error as { message?: string }).message ?? 'Failed' }

  revalidatePath('/dashboard')
  return { success: true, data: undefined }
}
