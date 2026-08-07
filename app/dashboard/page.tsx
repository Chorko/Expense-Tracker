import { Suspense } from 'react'
import { getDashboardData } from '@/app/actions/categories'
import { getStackBalances } from '@/app/actions/stacks'
import { getLoanSummary } from '@/app/actions/loans'
import { getTransactions } from '@/app/actions/transactions'
import { DashboardClient } from './DashboardClient'
import { MONTH_NAMES } from '@/lib/utils/format'

export default async function DashboardPage() {
  const [dashData, stacks, loanSummary, recentTxns, monthTxns] = await Promise.all([
    getDashboardData(),
    getStackBalances(),
    getLoanSummary(),
    getTransactions({ limit: 8 }),
    getTransactions({ month: new Date().getMonth() + 1, year: new Date().getFullYear() }),
  ])

  if (!dashData) {
    return (
      <div className="flex items-center justify-center h-64 text-parchment-dim">
        <p>Unable to load dashboard. Please try refreshing.</p>
      </div>
    )
  }

  const { profile, periods, goals, month, year } = dashData

  // Aggregate totals
  const totalBudgeted = periods.reduce(
    (s, p) => s + p.budgeted_amount + p.rollover_in, 0
  )
  const totalSpent = periods.reduce((s, p) => s + p.spent_amount, 0)

  // Donut data by group
  const groupSpend: Record<string, { name: string; value: number; color: string }> = {}
  for (const p of periods) {
    if (!p.categories?.category_groups || p.spent_amount === 0) continue
    const grp = p.categories.category_groups
    const key = grp.name
    if (!groupSpend[key]) {
      groupSpend[key] = { name: grp.name, value: 0, color: grp.color_hex }
    }
    groupSpend[key].value += p.spent_amount
  }
  const donutData = Object.values(groupSpend)

  // Stack chart data
  const stackChartData = stacks
    .filter(s => s.categories)
    .map(s => ({
      name: s.categories!.name,
      balance: s.current_balance,
      icon: s.categories!.icon,
      color: s.categories!.category_groups?.color_hex ?? '#2dd4bf',
    }))

  // Categories for modals
  const categories = periods
    .filter(p => p.categories)
    .map(p => ({
      id: p.categories!.id,
      name: p.categories!.name,
      icon: p.categories!.icon,
      parent_id: p.categories!.parent_id,
    }))

  // Current periods for reallocation modal
  const currentPeriods = periods
    .filter(p => p.categories?.id)
    .map(p => ({
      category_id: p.categories!.id,
      name: p.categories!.name,
      month,
      year,
    }))

  // All stacks for reallocation
  const stacksForModal = stacks
    .filter(s => s.categories?.id)
    .map(s => ({
      category_id: s.categories!.id,
      name: s.categories!.name,
      icon: s.categories!.icon,
      current_balance: s.current_balance,
    }))

  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <DashboardClient
        profile={profile}
        periods={periods}
        donutData={donutData}
        stackChartData={stackChartData}
        loanSummary={loanSummary}
        recentTxns={recentTxns}
        monthTxns={monthTxns}
        goals={goals}
        categories={categories}
        currentPeriods={currentPeriods}
        stacksForModal={stacksForModal}
        totalBudgeted={totalBudgeted}
        totalSpent={totalSpent}
        month={MONTH_NAMES[month - 1]}
        monthNum={month}
        year={year}
      />
    </Suspense>
  )
}

function DashboardSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="skeleton h-24 rounded-lg" />
        ))}
      </div>
      <div className="grid grid-cols-3 gap-4">
        <div className="skeleton h-48 rounded-lg col-span-2" />
        <div className="skeleton h-48 rounded-lg" />
      </div>
    </div>
  )
}
