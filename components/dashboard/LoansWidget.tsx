'use client'

import { formatCurrency, formatDate, formatRelativeDate } from '@/lib/utils/format'

interface LoanSummary {
  totalOutstanding: number
  overdueCount: number
  nextReminder: string | null
  loanCount: number
}

interface LoansWidgetProps {
  summary: LoanSummary | null
  onViewAll: () => void
}

export function LoansWidget({ summary, onViewAll }: LoansWidgetProps) {
  if (!summary || summary.loanCount === 0) {
    return (
      <div
        className="card cursor-pointer hover:border-brass/30 transition-colors"
        onClick={onViewAll}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-lg">🤝</span>
            <div>
              <h3 className="text-sm font-semibold text-parchment">Loans Out</h3>
              <p className="text-xs text-parchment-faint">No outstanding loans</p>
            </div>
          </div>
          <button className="text-xs text-brass hover:text-brass-light transition-colors">
            Track loan →
          </button>
        </div>
      </div>
    )
  }

  const hasOverdue = summary.overdueCount > 0

  return (
    <div
      className="card cursor-pointer"
      style={{
        borderColor: hasOverdue ? 'rgba(239,68,68,0.25)' : 'var(--glass-border)',
      }}
      onClick={onViewAll}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-lg">🤝</span>
          <div>
            <h3 className="text-sm font-semibold text-parchment">Loans Out</h3>
            <p className="text-xs text-parchment-faint">
              {summary.loanCount} outstanding
            </p>
          </div>
        </div>
        <button
          className="text-xs transition-colors"
          style={{ color: 'var(--brass)' }}
          aria-label="View all loans"
        >
          View all →
        </button>
      </div>

      <div className="flex items-end justify-between">
        <div>
          <p className="text-xs text-parchment-faint uppercase tracking-widest text-[0.625rem] mb-0.5">
            Total outstanding
          </p>
          <p className="font-mono font-semibold text-xl text-brass">
            {formatCurrency(summary.totalOutstanding)}
          </p>
        </div>
        {summary.nextReminder && (
          <div className="text-right">
            <p className="text-xs text-parchment-faint text-[0.625rem] mb-0.5">Next reminder</p>
            <p className="text-xs font-mono text-parchment-dim">
              {formatRelativeDate(summary.nextReminder)}
            </p>
          </div>
        )}
      </div>

      {hasOverdue && (
        <div
          className="mt-3 p-2 rounded-lg flex items-center gap-2 animate-fadeIn"
          style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}
        >
          <span className="text-danger text-sm">⚠</span>
          <p className="text-xs text-danger font-medium">
            {summary.overdueCount} reminder{summary.overdueCount > 1 ? 's' : ''} overdue
          </p>
        </div>
      )}
    </div>
  )
}
