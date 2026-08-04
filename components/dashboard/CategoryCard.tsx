'use client'

import { pct, formatCurrency } from '@/lib/utils/format'

interface PeriodData {
  budgeted_amount: number
  rollover_in: number
  spent_amount: number
  categories: {
    id: string
    name: string
    icon: string | null
    monthly_budget_amount: number
    group_id: string | null
    category_groups: { name: string; color_hex: string } | null
  } | null
  category_stacks: { current_balance: number } | null
}

interface CategoryCardProps {
  period: PeriodData
  onAddTransaction?: (categoryId: string) => void
  onMoveStack?: (categoryId: string) => void
}

export function CategoryCard({ period, onAddTransaction, onMoveStack }: CategoryCardProps) {
  const { budgeted_amount, rollover_in, spent_amount, categories, category_stacks } = period
  const stackBalance = category_stacks?.current_balance ?? 0
  const remaining = budgeted_amount + rollover_in - spent_amount
  const spentPct = pct(spent_amount, budgeted_amount + rollover_in)
  const groupColor = categories?.category_groups?.color_hex ?? '#c9a84c'

  const progressClass =
    spentPct >= 100 ? 'danger' :
    spentPct >= 80 ? 'warning' :
    'safe'

  const remainingColor =
    remaining < 0 ? 'var(--rust)' :
    spentPct >= 80 ? 'var(--warning)' :
    'var(--success)'

  if (!categories) return null

  return (
    <div
      className="card group cursor-default"
      style={{ borderLeft: `3px solid ${groupColor}` }}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-xl" aria-hidden="true">{categories.icon ?? '💰'}</span>
          <div>
            <p className="font-medium text-parchment text-sm leading-tight">{categories.name}</p>
            {categories.category_groups && (
              <p className="text-xs text-parchment-faint">{categories.category_groups.name}</p>
            )}
          </div>
        </div>
        {/* Quick actions */}
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={() => onAddTransaction?.(categories.id)}
            className="btn btn-ghost p-1 text-xs"
            title="Add transaction"
            aria-label={`Add transaction to ${categories.name}`}
          >
            +
          </button>
        </div>
      </div>

      {/* Progress bar */}
      <div className="progress-bar mb-3">
        <div
          className={`progress-bar-fill ${progressClass}`}
          style={{ width: `${Math.min(spentPct, 100)}%` }}
          role="progressbar"
          aria-valuenow={spentPct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`${categories.name} budget usage`}
        />
      </div>

      {/* Two-row figures */}
      <div className="grid grid-cols-2 gap-3 text-xs">
        {/* Left: this month */}
        <div>
          <p className="text-parchment-faint uppercase tracking-widest text-[0.625rem] mb-0.5">
            This month
          </p>
          <p className="font-mono font-semibold text-sm" style={{ color: remainingColor }}>
            {formatCurrency(Math.max(0, remaining))}
          </p>
          <p className="text-parchment-faint font-mono">
            left of {formatCurrency(budgeted_amount + rollover_in)}
          </p>
          {rollover_in > 0 && (
            <p className="text-teal font-mono text-[0.625rem] mt-0.5">
              +{formatCurrency(rollover_in)} pulled in
            </p>
          )}
        </div>

        {/* Right: stack */}
        <div className="text-right">
          <p className="text-parchment-faint uppercase tracking-widest text-[0.625rem] mb-0.5">
            Stack balance
          </p>
          <p
            className="font-mono font-semibold text-sm"
            style={{ color: stackBalance > 0 ? 'var(--teal)' : 'var(--parchment-faint)' }}
          >
            {formatCurrency(stackBalance)}
          </p>
          <p className="text-parchment-faint font-mono">accumulated</p>
          {stackBalance > 0 && (
            <button
              onClick={() => onMoveStack?.(categories.id)}
              className="text-[0.625rem] text-teal hover:text-teal-dark transition-colors font-mono mt-0.5"
              aria-label={`Move from ${categories.name} stack`}
            >
              Move →
            </button>
          )}
        </div>
      </div>

      {/* Spent info */}
      <div
        className="mt-3 pt-3 flex items-center justify-between"
        style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}
      >
        <span className="text-parchment-faint text-xs font-mono">
          Spent {formatCurrency(spent_amount)}
        </span>
        <span
          className="text-xs font-mono font-medium"
          style={{ color: spentPct >= 100 ? 'var(--rust)' : 'var(--parchment-faint)' }}
        >
          {Math.round(spentPct)}%
        </span>
      </div>
    </div>
  )
}
