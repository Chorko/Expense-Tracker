import 'server-only'

import { cache } from 'react'
import { getViewer } from './session'
import { getCategories } from './categories'
import { buildBudgetLines, totalFigures } from '@/lib/budget'
import { compareMonths, formatMonth, monthKey, monthOf, monthRange, shiftMonth, type MonthRef } from '@/lib/dates'
import { toNumber } from '@/lib/format'

/** Current stack balance per category id. */
export const getStackBalances = cache(async (): Promise<Map<string, number>> => {
  const { supabase } = await getViewer()
  const { data, error } = await supabase.from('category_stacks').select('category_id, current_balance')
  if (error) throw new Error(`Could not load stacks: ${error.message}`)
  return new Map((data ?? []).map(s => [s.category_id, toNumber(s.current_balance)]))
})

export const getMonthPeriods = cache(async (year: number, month: number) => {
  const { supabase } = await getViewer()
  const { data, error } = await supabase
    .from('category_periods')
    .select('category_id, budgeted_amount, rollover_in, spent_amount, closed, accrued_amount')
    .eq('year', year)
    .eq('month', month)
  if (error) throw new Error(`Could not load the budget: ${error.message}`)
  return data ?? []
})

export async function getBudgetMonth(ref: MonthRef) {
  const viewer = await getViewer()
  const [categories, periods, stacks] = await Promise.all([
    getCategories(),
    getMonthPeriods(ref.year, ref.month),
    getStackBalances(),
  ])
  const isLiveMonth = compareMonths(ref, monthOf(viewer.today)) === 0
  const lines = buildBudgetLines(categories, periods, stacks, { isLiveMonth })
  return { lines, totals: totalFigures(lines), isLiveMonth, categories, stacks }
}

export type TrendPoint = { key: string; label: string; budgeted: number; spent: number }

/** Budget vs. spend for the `count` months ending with `end`. */
export async function getTrend(end: MonthRef, count = 6): Promise<TrendPoint[]> {
  const { supabase } = await getViewer()
  const start = shiftMonth(end, -(count - 1))
  const { data, error } = await supabase.rpc('monthly_trend', {
    p_from: monthRange(start).start,
    p_to: monthRange(end).end,
  })
  if (error) {
    console.error('monthly_trend failed:', error.message)
    return []
  }
  return (data ?? []).map(row => {
    const ref = monthOf(row.month_start)
    return {
      key: monthKey(ref),
      label: formatMonth(ref, 'short'),
      budgeted: toNumber(row.budgeted),
      spent: toNumber(row.spent),
    }
  })
}
