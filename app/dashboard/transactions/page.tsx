import type { Metadata } from 'next'
import { TransactionsClient } from './TransactionsClient'
import { MonthSwitcher } from '@/components/ui/MonthSwitcher'
import { toCategoryMeta, toCategoryOptions } from '@/lib/budget'
import { getViewer } from '@/lib/data/session'
import { getCategories } from '@/lib/data/categories'
import { getMonthTransactions, getRecurringRules } from '@/lib/data/transactions'
import { compareMonths, monthOf, parseMonthKey, shiftMonth } from '@/lib/dates'

export const metadata: Metadata = { title: 'Transactions' }

type SearchParams = Promise<{ month?: string | string[]; tab?: string | string[] }>

export default async function TransactionsPage({ searchParams }: { searchParams: SearchParams }) {
  const viewer = await getViewer()
  const params = await searchParams
  const current = monthOf(viewer.today)
  const requested = parseMonthKey(params.month) ?? current
  // Future-dated expenses can be browsed up to a year ahead
  const latest = shiftMonth(current, 12)
  const month = compareMonths(requested, latest) > 0 ? latest : requested

  const [transactions, rules, categories] = await Promise.all([
    getMonthTransactions(month),
    getRecurringRules(),
    getCategories(),
  ])

  return (
    <TransactionsClient
      month={month}
      today={viewer.today}
      isLiveMonth={compareMonths(month, current) === 0}
      monthSwitcher={<MonthSwitcher month={month} today={viewer.today} basePath="/dashboard/transactions" maxAhead={12} />}
      initialTab={params.tab === 'recurring' ? 'recurring' : 'list'}
      transactions={transactions}
      rules={rules}
      categoryMeta={toCategoryMeta(categories)}
      categoryOptions={toCategoryOptions(categories)}
    />
  )
}
