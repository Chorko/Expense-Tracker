'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { HeroStats } from '@/components/dashboard/HeroStats'
import { CategoryCard } from '@/components/dashboard/CategoryCard'
import { DonutChart } from '@/components/dashboard/DonutChart'
import { StackOverviewPanel } from '@/components/stacks/StackOverviewPanel'
import { LoansWidget } from '@/components/dashboard/LoansWidget'
import { AddTransactionModal } from '@/components/transactions/AddTransactionModal'
import { MoveFromStacksModal } from '@/components/stacks/MoveFromStacksModal'
import { formatCurrency, formatDate } from '@/lib/utils/format'

import { SpendingCalendar } from '@/components/dashboard/SpendingCalendar'
import { CategoryManageModal } from '@/components/categories/CategoryManageModal'

// Period type matching getDashboardData return
type Period = {
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
    monthly_budget_amount: number
    group_id: string | null
    parent_id: string | null
    category_groups: { name: string; color_hex: string } | null
  } | null
  category_stacks: { current_balance: number } | null
}

type Goal = {
  id: string
  name: string
  target_amount: number
  current_amount: number
  color_hex: string
}

type Transaction = {
  id: string
  amount: number
  description: string | null
  txn_date: string
  source: string
  created_at: string
  categories: { id: string; name: string; icon: string | null } | null
}

interface DashboardClientProps {
  profile: { id: string; display_name: string | null; monthly_income: number; currency: string } | null
  periods: Period[]
  donutData: Array<{ name: string; value: number; color: string }>
  stackChartData: Array<{ name: string; balance: number; icon: string | null; color: string }>
  loanSummary: { totalOutstanding: number; overdueCount: number; nextReminder: string | null; loanCount: number } | null
  recentTxns: Transaction[]
  monthTxns?: Transaction[]
  goals: Goal[]
  categories: Array<{ id: string; name: string; icon: string | null; parent_id?: string | null }>
  currentPeriods: Array<{ category_id: string; name: string; month: number; year: number }>
  stacksForModal: Array<{ category_id: string; name: string; icon: string | null; current_balance: number }>
  totalBudgeted: number
  totalSpent: number
  month: string
  monthNum?: number
  year: number
}

export function DashboardClient(props: DashboardClientProps) {
  const router = useRouter()
  const [showAddTxn, setShowAddTxn] = useState(false)
  const [addTxnCategoryId, setAddTxnCategoryId] = useState<string | undefined>()
  const [showMoveStacks, setShowMoveStacks] = useState(false)
  const [moveStacksCategoryId, setMoveStacksCategoryId] = useState<string | undefined>()
  const [showManageCategories, setShowManageCategories] = useState(false)

  const handleSuccess = useCallback(() => {
    router.refresh()
  }, [router])

  function openAddTxn(categoryId?: string) {
    setAddTxnCategoryId(categoryId)
    setShowAddTxn(true)
  }

  function openMoveStacks(categoryId?: string) {
    setMoveStacksCategoryId(categoryId)
    setShowMoveStacks(true)
  }

  const income = props.profile?.monthly_income ?? 0
  const totalStackBalance = props.stacksForModal.reduce((s, st) => s + st.current_balance, 0)
  const monthNumber = props.monthNum ?? (new Date().getMonth() + 1)

  return (
    <div className="animate-fadeIn">
      {/* Page header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-parchment tracking-tight">
            {props.month} {props.year}
          </h1>
          <p className="text-parchment-dim text-sm mt-0.5">
            Welcome back{props.profile?.display_name ? `, ${props.profile.display_name}` : ''}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowManageCategories(true)}
            className="btn btn-ghost text-sm border border-white/10"
          >
            ⚙ Categories
          </button>
          {props.stacksForModal.length > 0 && (
            <button
              id="btn-move-stacks"
              onClick={() => openMoveStacks()}
              className="btn btn-secondary text-sm"
            >
              ⊞ Move stacks
            </button>
          )}
          <button
            id="btn-add-transaction"
            onClick={() => openAddTxn()}
            className="btn btn-primary text-sm"
          >
            + Add transaction
          </button>
        </div>
      </div>

      {/* Hero stats */}
      <HeroStats
        income={income}
        totalSpent={props.totalSpent}
        totalBudgeted={props.totalBudgeted}
        month={props.month}
        year={props.year}
      />

      {/* Main content grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <div className="card">
          <h3 className="font-semibold text-parchment text-sm mb-1">Spending by Group</h3>
          <p className="text-parchment-faint text-xs mb-3">This month&apos;s breakdown</p>
          <DonutChart data={props.donutData} />
        </div>
        <div className="lg:col-span-2">
          <StackOverviewPanel
            data={props.stackChartData}
            onCategoryClick={() => openMoveStacks()}
          />
        </div>
      </div>

      {/* Daily Spending Calendar */}
      <div className="mb-6">
        <SpendingCalendar
          month={monthNumber}
          year={props.year}
          transactions={props.monthTxns ?? props.recentTxns}
          onAddTransactionOnDate={() => openAddTxn()}
        />
      </div>

      {/* Category cards grid */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-parchment text-sm">Budget Categories</h2>
          {totalStackBalance > 0 && (
            <span className="text-xs font-mono text-teal">
              Total in stacks: {formatCurrency(totalStackBalance)}
            </span>
          )}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 stagger-children">
          {props.periods.map((period, i) => (
            <CategoryCard
              key={period.categories?.id ?? i}
              period={period}
              onAddTransaction={id => openAddTxn(id)}
              onMoveStack={id => openMoveStacks(id)}
            />
          ))}
        </div>
      </div>

      {/* Bottom row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Recent transactions */}
        <div className="card lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-parchment text-sm">Recent Transactions</h3>
            <button
              onClick={() => router.push('/dashboard/transactions')}
              className="text-xs text-brass hover:text-brass-light transition-colors"
            >
              View all →
            </button>
          </div>
          {props.recentTxns.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-parchment-dim text-sm mb-2">No transactions yet</p>
              <button onClick={() => openAddTxn()} className="btn btn-secondary text-xs">
                + Add your first transaction
              </button>
            </div>
          ) : (
            <table className="table-ledger">
              <tbody>
                {props.recentTxns.map(txn => (
                  <tr key={txn.id}>
                    <td className="py-2">
                      <div className="flex items-center gap-2">
                        <span className="text-base" aria-hidden="true">
                          {txn.categories?.icon ?? '💳'}
                        </span>
                        <div>
                          <p className="text-sm text-parchment">
                            {txn.description || txn.categories?.name || 'Uncategorised'}
                          </p>
                          <p className="text-xs text-parchment-faint font-mono">
                            {formatDate(txn.txn_date)}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="text-right amount-negative font-mono font-semibold text-sm">
                      − {formatCurrency(txn.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Right column */}
        <div className="flex flex-col gap-4">
          <LoansWidget
            summary={props.loanSummary}
            onViewAll={() => router.push('/dashboard/loans')}
          />

          {props.goals.length > 0 && (
            <div className="card">
              <h3 className="font-semibold text-parchment text-sm mb-3">Goals</h3>
              <div className="flex flex-col gap-3">
                {props.goals.slice(0, 3).map(goal => {
                  const progress = Math.min(
                    (goal.current_amount / goal.target_amount) * 100,
                    100
                  )
                  return (
                    <div key={goal.id}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-parchment truncate">{goal.name}</span>
                        <span className="text-xs font-mono text-parchment-dim">
                          {Math.round(progress)}%
                        </span>
                      </div>
                      <div className="progress-bar">
                        <div
                          className="progress-bar-fill"
                          style={{ width: `${progress}%`, background: goal.color_hex }}
                        />
                      </div>
                      <div className="flex justify-between mt-0.5">
                        <span className="text-[0.625rem] font-mono text-parchment-faint">
                          {formatCurrency(goal.current_amount)}
                        </span>
                        <span className="text-[0.625rem] font-mono text-parchment-faint">
                          {formatCurrency(goal.target_amount)}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      {showAddTxn && (
        <AddTransactionModal
          categories={props.categories}
          defaultCategoryId={addTxnCategoryId}
          onClose={() => setShowAddTxn(false)}
          onSuccess={handleSuccess}
        />
      )}

      {showMoveStacks && props.stacksForModal.length > 0 && (
        <MoveFromStacksModal
          stacks={props.stacksForModal}
          currentPeriods={props.currentPeriods}
          onClose={() => setShowMoveStacks(false)}
          onSuccess={handleSuccess}
          preselectedCategoryId={moveStacksCategoryId}
        />
      )}

      {showManageCategories && (
        <CategoryManageModal
          categories={props.categories.map(c => ({
            id: c.id,
            name: c.name,
            icon: c.icon,
            parent_id: c.parent_id ?? null,
            monthly_budget_amount: props.periods.find(p => p.categories?.id === c.id)?.categories?.monthly_budget_amount ?? 0,
          }))}
          onClose={() => setShowManageCategories(false)}
          onSuccess={handleSuccess}
        />
      )}
    </div>
  )
}
