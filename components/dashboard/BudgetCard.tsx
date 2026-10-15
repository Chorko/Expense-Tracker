import { budgetStatus } from '@/lib/budget'
import { formatCurrency } from '@/lib/format'
import { ProgressBar } from '@/components/ui/primitives'
import type { BudgetLine } from '@/lib/types'

type BudgetCardProps = {
  line: BudgetLine
  canAdd: boolean
  onAdd: (categoryId: string) => void
  onMove: (categoryId: string) => void
}

const STATUS_COLOR = {
  over: 'var(--danger)',
  warning: 'var(--warning)',
  ok: 'var(--success)',
  idle: 'var(--parchment-faint)',
} as const

export function BudgetCard({ line, canAdd, onAdd, onMove }: BudgetCardProps) {
  const figures = line.rollup
  const status = budgetStatus(figures)
  const accent = line.group?.color ?? 'var(--brass)'
  const over = figures.remaining < 0
  // The fullest stack in this card (the parent or one of its sub-categories)
  const stackSource = [line, ...line.children].filter(l => l.stack > 0).sort((a, b) => b.stack - a.stack)[0]

  return (
    <article className="card card-interactive flex flex-col" style={{ borderLeft: `3px solid ${accent}` }}>
      <header className="flex items-start gap-2.5">
        <span className="text-xl leading-none" aria-hidden="true">
          {line.icon}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-semibold text-parchment" title={line.name}>
            {line.name}
          </h3>
          <p className="truncate text-xs text-parchment-faint">
            {line.group?.name ?? 'No group'}
            {!line.isActive && ' · archived'}
          </p>
        </div>
        {canAdd && line.isActive && (
          <button
            type="button"
            className="btn btn-ghost btn-icon -mr-1.5 -mt-1"
            onClick={() => onAdd(line.categoryId)}
            aria-label={`Add expense to ${line.name}`}
            title="Add expense"
          >
            +
          </button>
        )}
      </header>

      <div className="mt-3">
        <ProgressBar
          value={figures.spent}
          max={figures.available}
          tone={status}
          label={`${line.name}: ${formatCurrency(figures.spent)} spent of ${formatCurrency(figures.available)}`}
        />
      </div>

      <div className="mt-3 flex items-end justify-between gap-3">
        <div>
          <p className="mono-number text-base font-semibold" style={{ color: STATUS_COLOR[status] }}>
            {formatCurrency(Math.abs(figures.remaining))}
          </p>
          <p className="text-xs text-parchment-faint">
            {over ? 'over' : 'left'} of {formatCurrency(figures.available)}
          </p>
        </div>
        <div className="text-right">
          <p className="mono-number text-sm text-parchment-dim">{formatCurrency(figures.spent)}</p>
          <p className="text-xs text-parchment-faint">spent</p>
        </div>
      </div>

      {figures.rolloverIn > 0 && (
        <p className="mt-2 text-xs text-teal">+{formatCurrency(figures.rolloverIn)} pulled in from stacks</p>
      )}

      {line.children.length > 0 && (
        <ul className="mt-3 space-y-2 border-t border-white/5 pt-3">
          {line.children.map(child => {
            const childStatus = budgetStatus(child)
            return (
              <li key={child.categoryId}>
                <div className="mb-1 flex items-center justify-between gap-2 text-xs">
                  <span className="min-w-0 truncate text-parchment-dim">
                    <span aria-hidden="true">{child.icon}</span> {child.name}
                  </span>
                  <span className="shrink-0 font-mono text-parchment-faint">
                    {formatCurrency(child.spent)} / {formatCurrency(child.available)}
                  </span>
                </div>
                <ProgressBar
                  value={child.spent}
                  max={child.available}
                  tone={childStatus}
                  label={`${child.name}: ${formatCurrency(child.spent)} of ${formatCurrency(child.available)}`}
                />
              </li>
            )
          })}
        </ul>
      )}

      <footer className="mt-auto flex items-center justify-between gap-2 pt-3 text-xs">
        <span className="text-parchment-faint">
          Stack <span className={`font-mono ${figures.stack > 0 ? 'text-teal' : ''}`}>{formatCurrency(figures.stack)}</span>
        </span>
        {stackSource && (
          <button
            type="button"
            className="font-medium text-teal hover:text-teal-dark"
            onClick={() => onMove(stackSource.categoryId)}
          >
            Use stack →
          </button>
        )}
      </footer>
    </article>
  )
}
