'use client'

import { useId, useState } from 'react'
import { MoveMoneyModal } from '@/components/stacks/MoveMoneyModal'
import { EmptyState, PageHeader } from '@/components/ui/primitives'
import { formatTimestamp } from '@/lib/dates'
import { formatCurrency } from '@/lib/format'
import type { CategoryOption, GoalOption, StackOption } from '@/lib/types'

export type HistoryItem = {
  id: string
  categoryId: string | null
  stackName: string
  icon: string
  type: string
  title: string
  comment: string | null
  /** Positive when money entered the stack */
  amount: number
  createdAt: string | null
}

type StacksClientProps = {
  stacks: StackOption[]
  total: number
  history: HistoryItem[]
  timezone: string
  categoryOptions: CategoryOption[]
  goalOptions: GoalOption[]
}

const TYPE_BADGE: Record<string, { label: string; className: string }> = {
  accrual: { label: 'Rollover', className: 'badge-teal' },
  adjustment_in: { label: 'Correction', className: 'badge-muted' },
  adjustment_out: { label: 'Correction', className: 'badge-muted' },
  reallocation_in: { label: 'Moved in', className: 'badge-violet' },
  reallocation_out: { label: 'Moved out', className: 'badge-violet' },
  pulled_to_period: { label: 'To budget', className: 'badge-brass' },
}

export function StacksClient({ stacks, total, history, timezone, categoryOptions, goalOptions }: StacksClientProps) {
  const filterId = useId()
  const [moving, setMoving] = useState<{ sourceId?: string } | null>(null)
  const [filter, setFilter] = useState('all')
  const visible = filter === 'all' ? history : history.filter(item => item.categoryId === filter)
  const historyStacks = [...new Map(history.filter(h => h.categoryId).map(h => [h.categoryId as string, h.stackName])).entries()]

  return (
    <div className="animate-fadeIn">
      <PageHeader
        title="Stacks"
        subtitle="Budget you did not spend, saved per category"
        actions={
          stacks.length > 0 && (
            <button type="button" className="btn btn-teal" onClick={() => setMoving({})}>
              Move money
            </button>
          )
        }
      />

      <section className="card mb-6 grid gap-4 md:grid-cols-[auto_1fr] md:items-center">
        <div>
          <p className="eyebrow">Total in stacks</p>
          <p className="mono-number mt-1 text-3xl font-bold text-teal">{formatCurrency(total)}</p>
          <p className="text-xs text-parchment-faint">across {stacks.length} {stacks.length === 1 ? 'stack' : 'stacks'}</p>
        </div>
        <p className="text-sm text-parchment-dim md:border-l md:border-white/5 md:pl-6">
          When a month ends, whatever is left in each category&apos;s budget moves into that category&apos;s stack. Use
          stacks to top up a category that is running short, re-earmark savings, fund a goal or record an investment.
          Every move asks for a short note so the history explains itself.
        </p>
      </section>

      {stacks.length === 0 ? (
        <EmptyState
          icon="🪙"
          title="Your stacks are empty"
          description="They fill up automatically at the end of each month from unspent budget."
        />
      ) : (
        <section aria-label="Stack balances" className="mb-8 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {stacks.map(stack => (
            <article key={stack.categoryId} className="card card-interactive flex items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal/10 text-lg" aria-hidden="true">
                {stack.icon}
              </span>
              <div className="min-w-0 flex-1">
                <h2 className="truncate text-sm font-medium text-parchment" title={stack.name}>
                  {stack.name}
                </h2>
                <p className="mono-number text-lg font-semibold text-teal">{formatCurrency(stack.balance)}</p>
              </div>
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() => setMoving({ sourceId: stack.categoryId })}
                aria-label={`Move money from ${stack.name}`}
              >
                Move
              </button>
            </article>
          ))}
        </section>
      )}

      <section aria-labelledby="history-title">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 id="history-title" className="section-title">
            History
          </h2>
          {historyStacks.length > 1 && (
            <div className="flex items-center gap-2">
              <label htmlFor={filterId} className="text-xs text-parchment-faint">
                Stack
              </label>
              <select id={filterId} className="input w-56" value={filter} onChange={e => setFilter(e.target.value)}>
                <option value="all">All stacks</option>
                {historyStacks.map(([id, name]) => (
                  <option key={id} value={id}>
                    {name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
        {visible.length === 0 ? (
          <EmptyState compact icon="📜" title="No stack activity yet" description="Rollovers and moves will be listed here." />
        ) : (
          <div className="card card-flush">
            <ul className="divide-y divide-white/5">
              {visible.map(item => {
                const badge = TYPE_BADGE[item.type] ?? { label: item.type, className: 'badge-muted' }
                return (
                  <li key={item.id} className="flex items-start gap-3 px-4 py-3">
                    <span className="mt-0.5 text-lg" aria-hidden="true">
                      {item.icon}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm text-parchment">{item.title}</p>
                        <span className={`badge ${badge.className}`}>{badge.label}</span>
                      </div>
                      <p className="text-xs text-parchment-faint">
                        {item.stackName} · {formatTimestamp(item.createdAt, timezone)}
                      </p>
                      {item.comment && <p className="mt-1 text-xs italic text-parchment-dim">“{item.comment}”</p>}
                    </div>
                    <span className={`mono-number shrink-0 text-sm font-semibold ${item.amount >= 0 ? 'text-teal' : 'text-parchment'}`}>
                      {formatCurrency(item.amount, { signed: true })}
                    </span>
                  </li>
                )
              })}
            </ul>
          </div>
        )}
      </section>

      {moving && (
        <MoveMoneyModal
          stacks={stacks}
          categories={categoryOptions}
          goals={goalOptions}
          preselectedSourceId={moving.sourceId}
          onClose={() => setMoving(null)}
        />
      )}
    </div>
  )
}
