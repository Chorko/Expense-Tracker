import 'server-only'

import { getViewer } from './session'
import { monthRange, type MonthRef } from '@/lib/dates'
import { toNumber } from '@/lib/format'
import type { TxnRow } from '@/lib/types'
import type { Frequency } from '@/lib/validations'

const TXN_COLUMNS = 'id, amount, description, txn_date, source, category_id, recurring_id'

function toTxn(row: TxnRow): TxnRow {
  return { ...row, amount: toNumber(row.amount) }
}

export async function getMonthTransactions(ref: MonthRef): Promise<TxnRow[]> {
  const { supabase } = await getViewer()
  const { start, end } = monthRange(ref)
  const { data, error } = await supabase
    .from('transactions')
    .select(TXN_COLUMNS)
    .gte('txn_date', start)
    .lte('txn_date', end)
    .order('txn_date', { ascending: false })
    .order('created_at', { ascending: false })
    .range(0, 1999)
  if (error) throw new Error(`Could not load transactions: ${error.message}`)
  return (data ?? []).map(toTxn)
}

export async function getRecentTransactions(limit = 8): Promise<TxnRow[]> {
  const { supabase, today } = await getViewer()
  const { data, error } = await supabase
    .from('transactions')
    .select(TXN_COLUMNS)
    .lte('txn_date', today)
    .order('txn_date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw new Error(`Could not load transactions: ${error.message}`)
  return (data ?? []).map(toTxn)
}

export type RecurringRule = {
  id: string
  category_id: string | null
  amount: number
  description: string | null
  frequency: Frequency
  next_due_date: string
  last_posted_date: string | null
  is_active: boolean
}

export async function getRecurringRules(): Promise<RecurringRule[]> {
  const { supabase } = await getViewer()
  const { data, error } = await supabase
    .from('recurring_transactions')
    .select('id, category_id, amount, description, frequency, next_due_date, last_posted_date, is_active')
    .order('is_active', { ascending: false })
    .order('next_due_date')
  if (error) throw new Error(`Could not load recurring transactions: ${error.message}`)
  return (data ?? []).map(r => ({ ...r, amount: toNumber(r.amount), frequency: r.frequency as Frequency }))
}
