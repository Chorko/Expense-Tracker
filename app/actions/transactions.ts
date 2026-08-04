'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { transactionSchema } from '@/lib/validations'
import { getCurrentMonthYear } from '@/lib/utils/format'
import type { TransactionInput } from '@/lib/validations'

type ActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string }

export async function addTransaction(
  raw: TransactionInput
): Promise<ActionResult<{ id: string }>> {
  const parsed = transactionSchema.safeParse(raw)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Validation error' }
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Not authenticated' }

  const { month, year } = getCurrentMonthYear()

  // Ensure a period exists for this category + month (idempotent)
  if (parsed.data.category_id) {
    const catResult = await (supabase as any)
      .from('categories')
      .select('monthly_budget_amount')
      .eq('id', parsed.data.category_id)
      .eq('user_id', user.id)
      .single()

    const cat = catResult?.data as { monthly_budget_amount: number } | null

    if (cat) {
      await (supabase as any).from('category_periods').upsert(
        {
          user_id: user.id,
          category_id: parsed.data.category_id,
          month,
          year,
          budgeted_amount: cat.monthly_budget_amount,
        },
        { onConflict: 'user_id,category_id,month,year', ignoreDuplicates: true }
      )
    }
  }

  const insertResult = await (supabase as any)
    .from('transactions')
    .insert({
      user_id: user.id,
      category_id: parsed.data.category_id ?? null,
      amount: parsed.data.amount,
      description: parsed.data.description ?? null,
      txn_date: parsed.data.txn_date,
    })
    .select('id')
    .single()

  if (insertResult.error) {
    console.error('addTransaction error:', insertResult.error)
    return { success: false, error: 'Failed to add transaction' }
  }

  revalidatePath('/dashboard')
  return { success: true, data: { id: (insertResult.data as { id: string }).id } }
}

export async function deleteTransaction(
  transactionId: string
): Promise<ActionResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Not authenticated' }

  const { error } = await (supabase as any)
    .from('transactions')
    .delete()
    .eq('id', transactionId)
    .eq('user_id', user.id)

  if (error) return { success: false, error: 'Failed to delete transaction' }

  revalidatePath('/dashboard')
  return { success: true, data: undefined }
}

export async function getTransactions(opts?: {
  categoryId?: string
  month?: number
  year?: number
  limit?: number
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { month, year } = getCurrentMonthYear()
  const m = opts?.month ?? month
  const y = opts?.year ?? year

  const query = (supabase as any)
    .from('transactions')
    .select(`
      id, amount, description, txn_date, source, created_at,
      categories (id, name, icon)
    `)
    .eq('user_id', user.id)
    .gte('txn_date', `${y}-${String(m).padStart(2, '0')}-01`)
    .lte('txn_date', `${y}-${String(m).padStart(2, '0')}-31`)
    .order('txn_date', { ascending: false })
    .order('created_at', { ascending: false })

  const filteredQuery = opts?.categoryId
    ? query.eq('category_id', opts.categoryId)
    : query

  const limitedQuery = opts?.limit
    ? filteredQuery.limit(opts.limit)
    : filteredQuery

  const { data, error } = await limitedQuery

  if (error) {
    console.error('getTransactions error:', error)
    return []
  }

  return (data ?? []) as Array<{
    id: string
    amount: number
    description: string | null
    txn_date: string
    source: string
    created_at: string
    categories: { id: string; name: string; icon: string | null } | null
  }>
}

export async function getCurrentPeriods() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { month, year } = getCurrentMonthYear()

  const { data, error } = await (supabase as any)
    .from('category_periods')
    .select(`
      id, month, year, budgeted_amount, rollover_in, spent_amount, closed,
      categories (id, name, icon, group_id,
        category_groups (name, color_hex)
      ),
      category_stacks (current_balance)
    `)
    .eq('user_id', user.id)
    .eq('month', month)
    .eq('year', year)

  if (error) {
    console.error('getCurrentPeriods error:', error)
    return []
  }

  return (data ?? []) as Array<{
    id: string
    month: number
    year: number
    budgeted_amount: number
    rollover_in: number
    spent_amount: number
    closed: boolean
    categories: {
      id: string
      name: string
      icon: string | null
      group_id: string | null
      category_groups: { name: string; color_hex: string } | null
    } | null
    category_stacks: { current_balance: number } | null
  }>
}
