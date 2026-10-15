'use client'

import Link from 'next/link'
import { useState } from 'react'
import { BudgetCard } from '@/components/dashboard/BudgetCard'
import { HeroStats } from '@/components/dashboard/HeroStats'
import { SpendingDonut, TrendChart, type Slice, type TrendDatum } from '@/components/dashboard/Charts'
import { SpendingCalendar } from '@/components/dashboard/SpendingCalendar'
import { GoalsWidget, LoansWidget, RecentTransactions, StacksWidget } from '@/components/dashboard/Widgets'
import { MoveMoneyModal } from '@/components/stacks/MoveMoneyModal'
import { TransactionModal } from '@/components/transactions/TransactionModal'
import { EmptyState, PageHeader } from '@/components/ui/primitives'
import type { MonthRef } from '@/lib/dates'
import type {
  BudgetLine,
  CategoryMeta,
  CategoryOption,
  GoalOption,
  GoalRow,
  LoanSummary,
  StackOption,
  TxnRow,
} from '@/lib/types'

export type DashboardProps = {
  greeting: string
  subtitle: string
  monthSwitcher: React.ReactNode
  month: MonthRef
  today: string
  isLiveMonth: boolean
  defaultAddDate: string
  lines: BudgetLine[]
  stats: React.ComponentProps<typeof HeroStats>
  donut: Slice[]
  spentTotal: number
  trend: TrendDatum[]
  transactions: TxnRow[]
  categoryMeta: Record<string, CategoryMeta>
  categoryOptions: CategoryOption[]
  stacks: StackOption[]
  stackTotal: number
  goals: GoalRow[]
  goalOptions: GoalOption[]
  loanSummary: LoanSummary
  dailyBudget: number
}

type AddState = { categoryId?: string | null; date?: string }

/** Groups top-level budget lines by category group, keeping their order. */
function groupLines(lines: BudgetLine[]) {
  const sections = new Map<string, { name: string; color: string | null; lines: BudgetLine[] }>()
  for (const line of lines) {
    const key = line.group?.id ?? 'none'
    const section = sections.get(key) ?? { name: line.group?.name ?? 'Other', color: line.group?.color ?? null, lines: [] }
    section.lines.push(line)
    sections.set(key, section)
  }
  return [...sections.entries()]
}

export function DashboardClient(props: DashboardProps) {
  const [adding, setAdding] = useState<AddState | null>(null)
  const [editing, setEditing] = useState<TxnRow | null>(null)
  const [moving, setMoving] = useState<{ sourceId?: string } | null>(null)
  const sections = groupLines(props.lines)
  const showSectionTitles = sections.length > 1

  return (
    <div className="animate-fadeIn">
      <PageHeader
        title={props.greeting}
        subtitle={props.subtitle}
        actions={
          <>
            {props.monthSwitcher}
            {props.stacks.length > 0 && (
              <button type="button" className="btn btn-secondary" onClick={() => setMoving({})}>
                Move money
              </button>
            )}
            <button type="button" className="btn btn-primary" onClick={() => setAdding({ date: props.defaultAddDate })}>
              + Add expense
            </button>
          </>
        }
      />

      <HeroStats {...props.stats} />

      <section aria-labelledby="budget-title" className="mb-6">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 id="budget-title" className="section-title">
            Budget by category
          </h2>
          <Link href="/dashboard/settings#categories" className="text-xs font-medium text-brass hover:text-brass-light">
            Edit categories →
          </Link>
        </div>
        {props.lines.length === 0 ? (
          <EmptyState
            icon="🗂️"
            title={props.isLiveMonth ? 'No budget categories yet' : 'No budget for this month'}
            description={
              props.isLiveMonth
                ? 'Create categories such as Rent or Groceries and give each a monthly amount.'
                : 'This month was not budgeted in Ledger.'
            }
            action={
              props.isLiveMonth && (
                <Link href="/dashboard/settings#categories" className="btn btn-primary">
                  Set up categories
                </Link>
              )
            }
          />
        ) : (
          <div className="space-y-5">
            {sections.map(([key, section]) => (
              <div key={key}>
                {showSectionTitles && (
                  <h3 className="section-header mb-2 flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full" style={{ background: section.color ?? 'var(--slate)' }} aria-hidden="true" />
                    {section.name}
                  </h3>
                )}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                  {section.lines.map(line => (
                    <BudgetCard
                      key={line.categoryId}
                      line={line}
                      canAdd
                      onAdd={categoryId => setAdding({ categoryId, date: props.defaultAddDate })}
                      onMove={sourceId => setMoving({ sourceId })}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-5">
        <section className="card lg:col-span-2" aria-labelledby="split-title">
          <h2 id="split-title" className="section-title mb-3">
            Where it went
          </h2>
          <SpendingDonut data={props.donut} total={props.spentTotal} />
        </section>
        <section className="card lg:col-span-3" aria-labelledby="trend-title">
          <h2 id="trend-title" className="section-title mb-3">
            Last 6 months
          </h2>
          <TrendChart data={props.trend} />
        </section>
      </div>

      <div className="mb-6">
        <SpendingCalendar
          month={props.month}
          today={props.today}
          transactions={props.transactions}
          categoryMeta={props.categoryMeta}
          dailyBudget={props.dailyBudget}
          onAddOnDate={date => setAdding({ date })}
          onEdit={setEditing}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <RecentTransactions
            transactions={props.transactions.slice(0, 8)}
            categoryMeta={props.categoryMeta}
            today={props.today}
            onEdit={setEditing}
            onAdd={() => setAdding({ date: props.defaultAddDate })}
          />
        </div>
        <div className="flex flex-col gap-4">
          <StacksWidget stacks={props.stacks} total={props.stackTotal} onMove={() => setMoving({})} />
          <LoansWidget summary={props.loanSummary} today={props.today} />
          <GoalsWidget goals={props.goals} />
        </div>
      </div>

      {adding && (
        <TransactionModal
          categories={props.categoryOptions}
          today={props.today}
          defaultCategoryId={adding.categoryId}
          defaultDate={adding.date}
          onClose={() => setAdding(null)}
        />
      )}
      {editing && (
        <TransactionModal
          categories={props.categoryOptions}
          today={props.today}
          transaction={editing}
          onClose={() => setEditing(null)}
        />
      )}
      {moving && (
        <MoveMoneyModal
          stacks={props.stacks}
          categories={props.categoryOptions}
          goals={props.goalOptions}
          preselectedSourceId={moving.sourceId}
          onClose={() => setMoving(null)}
        />
      )}
    </div>
  )
}
