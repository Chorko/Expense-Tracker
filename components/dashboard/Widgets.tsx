import Link from 'next/link'
import { formatDate, formatRelativeDate } from '@/lib/dates'
import { formatCurrency, pct } from '@/lib/format'
import { ProgressBar } from '@/components/ui/primitives'
import type { CategoryMeta, GoalRow, LoanSummary, StackOption, TxnRow } from '@/lib/types'

function WidgetHeader({ title, href, linkLabel }: { title: string; href: string; linkLabel: string }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-2">
      <h2 className="section-title">{title}</h2>
      <Link href={href} className="text-xs font-medium text-brass hover:text-brass-light">
        {linkLabel} →
      </Link>
    </div>
  )
}

export function RecentTransactions({
  transactions,
  categoryMeta,
  today,
  onEdit,
  onAdd,
}: {
  transactions: TxnRow[]
  categoryMeta: Record<string, CategoryMeta>
  today: string
  onEdit: (txn: TxnRow) => void
  onAdd: () => void
}) {
  return (
    <section className="card">
      <WidgetHeader title="Latest expenses" href="/dashboard/transactions" linkLabel="All transactions" />
      {transactions.length === 0 ? (
        <div className="py-8 text-center">
          <p className="text-sm text-parchment-dim">Nothing recorded this month yet.</p>
          <button type="button" className="btn btn-secondary btn-sm mt-3" onClick={onAdd}>
            + Add your first expense
          </button>
        </div>
      ) : (
        <ul className="-mx-2 divide-y divide-white/5">
          {transactions.map(txn => {
            const meta = txn.category_id ? categoryMeta[txn.category_id] : undefined
            return (
              <li key={txn.id}>
                <button
                  type="button"
                  className="flex w-full items-center gap-3 rounded-md px-2 py-2.5 text-left hover:bg-white/[0.03]"
                  onClick={() => onEdit(txn)}
                  aria-label={`Edit ${txn.description || meta?.name || 'expense'}, ${formatCurrency(txn.amount)}`}
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/[0.04]" aria-hidden="true">
                    {meta?.icon ?? '💳'}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-parchment">{txn.description || meta?.name || 'Uncategorised'}</span>
                    <span className="block truncate text-xs text-parchment-faint">
                      {meta?.label ?? 'Uncategorised'} · {formatRelativeDate(txn.txn_date, today)}
                      {txn.recurring_id && ' · recurring'}
                    </span>
                  </span>
                  <span className="mono-number text-sm font-semibold text-parchment">−{formatCurrency(txn.amount)}</span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

export function LoansWidget({ summary, today }: { summary: LoanSummary; today: string }) {
  const empty = summary.activeCount === 0
  return (
    <section className="card">
      <WidgetHeader title="Loans" href="/dashboard/loans" linkLabel={empty ? 'Track one' : 'Manage'} />
      {empty ? (
        <p className="text-sm text-parchment-dim">No open loans. Track money you lend or borrow and get e-mail reminders.</p>
      ) : (
        <>
          <dl className="grid grid-cols-2 gap-3">
            <div>
              <dt className="eyebrow">Owed to you</dt>
              <dd className="mono-number mt-1 text-lg font-semibold text-brass">{formatCurrency(summary.lentOutstanding)}</dd>
            </div>
            <div>
              <dt className="eyebrow">You owe</dt>
              <dd className="mono-number mt-1 text-lg font-semibold text-rust">{formatCurrency(summary.borrowedOutstanding)}</dd>
            </div>
          </dl>
          <div className="mt-3 flex flex-wrap gap-2 text-xs">
            {summary.overdueCount > 0 && <span className="badge badge-danger">{summary.overdueCount} reminder due</span>}
            {summary.nextReminder && summary.nextReminder.date > today && (
              <span className="text-parchment-faint">
                Next: {summary.nextReminder.name}, {formatRelativeDate(summary.nextReminder.date, today).toLowerCase()}
              </span>
            )}
          </div>
        </>
      )}
    </section>
  )
}

export function GoalsWidget({ goals }: { goals: GoalRow[] }) {
  return (
    <section className="card">
      <WidgetHeader title="Goals" href="/dashboard/goals" linkLabel={goals.length ? 'All goals' : 'Create one'} />
      {goals.length === 0 ? (
        <p className="text-sm text-parchment-dim">Save towards a trip, a gadget or an emergency fund, and fund it straight from your stacks.</p>
      ) : (
        <ul className="space-y-3">
          {goals.slice(0, 3).map(goal => (
            <li key={goal.id}>
              <div className="mb-1 flex items-center justify-between gap-2 text-sm">
                <span className="min-w-0 truncate text-parchment">
                  <span aria-hidden="true">{goal.icon}</span> {goal.name}
                </span>
                <span className="font-mono text-xs text-parchment-dim">{Math.round(pct(goal.current_amount, goal.target_amount))}%</span>
              </div>
              <ProgressBar value={goal.current_amount} max={goal.target_amount} color={goal.color_hex} label={`${goal.name} progress`} />
              <p className="mt-1 text-xs text-parchment-faint">
                {formatCurrency(goal.current_amount)} of {formatCurrency(goal.target_amount)}
                {goal.target_date && ` · by ${formatDate(goal.target_date)}`}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

export function StacksWidget({ stacks, total, onMove }: { stacks: StackOption[]; total: number; onMove: () => void }) {
  return (
    <section className="card">
      <WidgetHeader title="Stacks" href="/dashboard/stacks" linkLabel="History" />
      {stacks.length === 0 ? (
        <p className="text-sm text-parchment-dim">
          When a month ends, every category&apos;s unspent budget is saved to its stack. Nothing saved yet.
        </p>
      ) : (
        <>
          <ul className="space-y-2">
            {stacks.slice(0, 5).map(stack => (
              <li key={stack.categoryId} className="flex items-center gap-2 text-sm">
                <span aria-hidden="true">{stack.icon}</span>
                <span className="min-w-0 flex-1 truncate text-parchment-dim">{stack.name}</span>
                <span className="font-mono text-xs text-teal">{formatCurrency(stack.balance)}</span>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex items-center justify-between border-t border-white/5 pt-3">
            <span className="text-xs text-parchment-faint">
              Total <span className="font-mono text-parchment">{formatCurrency(total)}</span>
            </span>
            <button type="button" className="btn btn-secondary btn-sm" onClick={onMove}>
              Move money
            </button>
          </div>
        </>
      )}
    </section>
  )
}
