import 'server-only'

import { getViewer } from './session'
import { toNumber } from '@/lib/format'
import type { Json } from '@/types/database'

export const STACK_MOVEMENT_TYPES = [
  'accrual',
  'reallocation_out',
  'reallocation_in',
  'pulled_to_period',
  'adjustment_in',
  'adjustment_out',
] as const
export type StackMovementType = (typeof STACK_MOVEMENT_TYPES)[number]

export type StackMovement = {
  id: string
  category_id: string | null
  type: StackMovementType
  amount: number
  related_category_id: string | null
  related_goal_id: string | null
  related_stock_purchase_id: string | null
  comment: string | null
  month: number | null
  year: number | null
  created_at: string | null
}

export async function getStackHistory(limit = 200): Promise<StackMovement[]> {
  const { supabase } = await getViewer()
  const { data, error } = await supabase
    .from('stack_transactions')
    .select(
      'id, category_id, type, amount, related_category_id, related_goal_id, related_stock_purchase_id, comment, month, year, created_at'
    )
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw new Error(`Could not load stack history: ${error.message}`)
  return (data ?? [])
    .filter(row => (STACK_MOVEMENT_TYPES as readonly string[]).includes(row.type))
    .map(row => ({ ...row, type: row.type as StackMovementType, amount: toNumber(row.amount) }))
}

export type StockPurchase = {
  id: string
  amount: number
  purchase_date: string
  ticker_or_note: string | null
  funded_from: Array<{ category_id: string | null; category: string; amount: number }>
}

function parseFundedFrom(value: Json | null): StockPurchase['funded_from'] {
  if (!Array.isArray(value)) return []
  return value.flatMap(item => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return []
    const entry = item as Record<string, Json | undefined>
    return [
      {
        category_id: typeof entry.category_id === 'string' ? entry.category_id : null,
        category: typeof entry.category === 'string' ? entry.category : '',
        amount: toNumber(entry.amount),
      },
    ]
  })
}

export async function getStockPurchases(): Promise<StockPurchase[]> {
  const { supabase } = await getViewer()
  const { data, error } = await supabase
    .from('stock_purchases')
    .select('id, amount, purchase_date, ticker_or_note, funded_from')
    .order('purchase_date', { ascending: false })
    .order('created_at', { ascending: false })
  if (error) throw new Error(`Could not load stock purchases: ${error.message}`)
  return (data ?? []).map(p => ({ ...p, amount: toNumber(p.amount), funded_from: parseFundedFrom(p.funded_from) }))
}
