import type { Metadata } from 'next'
import { DashboardClient } from './DashboardClient'
import { MonthSwitcher } from '@/components/ui/MonthSwitcher'
import { toCategoryMeta, toCategoryOptions, toStackOptions } from '@/lib/budget'
import { getViewer } from '@/lib/data/session'
import { getBudgetMonth, getTrend } from '@/lib/data/budget'
import { getMonthTransactions } from '@/lib/data/transactions'
import { getLoans, summarizeLoans } from '@/lib/data/loans'
import { getGoals } from '@/lib/data/goals'
import { compareMonths, formatMonth, hourIn, monthOf, monthRange, parseMonthKey, parseYmd } from '@/lib/dates'
import { CHART_COLORS, roundMoney } from '@/lib/format'
import type { Slice } from '@/components/dashboard/Charts'
import type { BudgetLine } from '@/lib/types'

export const metadata: Metadata = { title: 'Overview' }

function greetingFor(hour: number) {
  if (hour < 5) return 'Working late'
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

/** Spending split by category group, or by top-level category when no groups exist. */
function buildSlices(lines: BudgetLine[], uncategorised: number): Slice[] {
  const spending = lines.filter(l => l.rollup.spent > 0)
  const useGroups = spending.some(l => l.group)
  const buckets = new Map<string, Slice>()
  spending.forEach((line, index) => {
    const key = useGroups ? line.group?.id ?? 'none' : line.categoryId
    const name = useGroups ? line.group?.name ?? 'Ungrouped' : line.name
    const color = useGroups ? line.group?.color ?? '#64748b' : CHART_COLORS[index % CHART_COLORS.length]
    const slice = buckets.get(key) ?? { name, value: 0, color }
    slice.value = roundMoney(slice.value + line.rollup.spent)
    buckets.set(key, slice)
  })
  const slices = [...buckets.values()].sort((a, b) => b.value - a.value)
  if (uncategorised > 0) slices.push({ name: 'Uncategorised', value: uncategorised, color: '#8b8476' })
  return slices
}

export default async function OverviewPage({ searchParams }: { searchParams: Promise<{ month?: string | string[] }> }) {
  const viewer = await getViewer()
  const { month: monthParam } = await searchParams
  const current = monthOf(viewer.today)
  const requested = parseMonthKey(monthParam) ?? current
  const month = compareMonths(requested, current) > 0 ? current : requested

  const [budget, transactions, loans, goals, trend] = await Promise.all([
    getBudgetMonth(month),
    getMonthTransactions(month),
    getLoans(),
    getGoals(),
    getTrend(month, 6),
  ])

  const { lines, totals, isLiveMonth, categories, stacks } = budget
  const { days, end } = monthRange(month)
  const spentTotal = roundMoney(transactions.reduce((sum, t) => sum + t.amount, 0))
  const uncategorised = roundMoney(transactions.filter(t => !t.category_id).reduce((sum, t) => sum + t.amount, 0))
  const stackOptions = toStackOptions(categories, stacks)
  const stackTotal = roundMoney([...stacks.values()].reduce((sum, v) => sum + v, 0))
  const daysLeft = isLiveMonth ? days - parseYmd(viewer.today).day + 1 : null
  const firstName = (viewer.profile.display_name ?? '').trim().split(/\s+/)[0]

  return (
    <DashboardClient
      greeting={`${greetingFor(hourIn(viewer.timezone))}${firstName ? `, ${firstName}` : ''}`}
      subtitle={
        isLiveMonth
          ? `${formatMonth(month)} · ${daysLeft} ${daysLeft === 1 ? 'day' : 'days'} left`
          : `${formatMonth(month)} · closed month`
      }
      monthSwitcher={<MonthSwitcher month={month} today={viewer.today} basePath="/dashboard" />}
      month={month}
      today={viewer.today}
      isLiveMonth={isLiveMonth}
      defaultAddDate={isLiveMonth ? viewer.today : end}
      lines={lines}
      stats={{
        income: Number(viewer.profile.monthly_income) || 0,
        spent: spentTotal,
        uncategorised,
        budgeted: totals.budgeted,
        available: totals.available,
        remaining: roundMoney(totals.remaining - uncategorised),
        stackTotal,
        daysLeft,
      }}
      donut={buildSlices(lines, uncategorised)}
      spentTotal={spentTotal}
      trend={trend.map(point => ({ label: point.label, budgeted: point.budgeted, spent: point.spent }))}
      transactions={transactions}
      categoryMeta={toCategoryMeta(categories)}
      categoryOptions={toCategoryOptions(categories)}
      stacks={stackOptions}
      stackTotal={stackTotal}
      goals={goals}
      goalOptions={goals.map(g => ({ id: g.id, name: g.name, icon: g.icon }))}
      loanSummary={summarizeLoans(loans, viewer.today)}
      dailyBudget={days > 0 ? roundMoney(totals.available / days) : 0}
    />
  )
}
