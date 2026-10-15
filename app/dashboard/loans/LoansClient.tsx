'use client'

import { useState } from 'react'
import { deleteLoanRepayment } from '@/app/actions/loans'
import { LoanModal, ReminderModal, RepaymentModal } from '@/components/loans/LoanModals'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { EmptyState, PageHeader, ProgressBar } from '@/components/ui/primitives'
import { useToast } from '@/components/ui/Toast'
import { formatDate, formatRelativeDate } from '@/lib/dates'
import { formatCurrency, pct } from '@/lib/format'
import type { LoanRow, LoanSummary } from '@/lib/types'
import type { LoanDirection } from '@/lib/validations'

type LoansClientProps = { loans: LoanRow[]; summary: LoanSummary; today: string }

type Dialog =
  | { kind: 'new'; direction: LoanDirection }
  | { kind: 'edit'; loan: LoanRow }
  | { kind: 'repay'; loan: LoanRow }
  | { kind: 'reminder'; loan: LoanRow }
  | { kind: 'deleteRepayment'; loan: LoanRow; repaymentId: string; amount: number }

export function LoansClient({ loans, summary, today }: LoansClientProps) {
  const toast = useToast()
  const [tab, setTab] = useState<LoanDirection>('lent_out')
  const [showSettled, setShowSettled] = useState(false)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [dialog, setDialog] = useState<Dialog | null>(null)

  const inTab = loans.filter(l => l.direction === tab)
  const open = inTab.filter(l => l.status !== 'repaid')
  const settled = inTab.filter(l => l.status === 'repaid')
  const visible = showSettled ? inTab : open
  const borrowedTab = tab === 'borrowed_in'
  const accent = borrowedTab ? 'var(--rust)' : 'var(--brass)'
  const count = (direction: LoanDirection) => loans.filter(l => l.direction === direction && l.status !== 'repaid').length

  return (
    <div className="animate-fadeIn">
      <PageHeader
        title="Loans"
        subtitle="Money you have lent out and money you owe"
        actions={
          <button type="button" className="btn btn-primary" onClick={() => setDialog({ kind: 'new', direction: tab })}>
            + {borrowedTab ? 'Record borrowing' : 'Record loan'}
          </button>
        }
      />

      <section aria-label="Summary" className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <button type="button" className="card card-interactive text-left" onClick={() => setTab('lent_out')} aria-pressed={tab === 'lent_out'}>
          <p className="eyebrow">Owed to you</p>
          <p className="mono-number mt-1 text-2xl font-bold text-brass">{formatCurrency(summary.lentOutstanding)}</p>
          <p className="text-xs text-parchment-faint">{count('lent_out')} open</p>
        </button>
        <button type="button" className="card card-interactive text-left" onClick={() => setTab('borrowed_in')} aria-pressed={tab === 'borrowed_in'}>
          <p className="eyebrow">You owe</p>
          <p className="mono-number mt-1 text-2xl font-bold text-rust">{formatCurrency(summary.borrowedOutstanding)}</p>
          <p className="text-xs text-parchment-faint">{count('borrowed_in')} open</p>
        </button>
        <div className="card" style={summary.overdueCount ? { borderColor: 'rgba(248,113,113,0.35)' } : undefined}>
          <p className="eyebrow">Reminders due</p>
          <p className={`mono-number mt-1 text-2xl font-bold ${summary.overdueCount ? 'text-danger' : 'text-parchment-dim'}`}>
            {summary.overdueCount}
          </p>
          <p className="text-xs text-parchment-faint">
            {summary.nextReminder ? `Next: ${summary.nextReminder.name}, ${formatDate(summary.nextReminder.date)}` : 'None scheduled'}
          </p>
        </div>
      </section>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="segmented min-w-[18rem] flex-1 sm:max-w-md" role="tablist" aria-label="Direction">
          <button type="button" role="tab" aria-selected={tab === 'lent_out'} data-active={tab === 'lent_out'} onClick={() => setTab('lent_out')}>
            I lent ({count('lent_out')})
          </button>
          <button type="button" role="tab" aria-selected={tab === 'borrowed_in'} data-active={tab === 'borrowed_in'} onClick={() => setTab('borrowed_in')}>
            I borrowed ({count('borrowed_in')})
          </button>
        </div>
        {settled.length > 0 && (
          <button type="button" className="chip" aria-pressed={showSettled} onClick={() => setShowSettled(v => !v)}>
            Show settled ({settled.length})
          </button>
        )}
      </div>

      {visible.length === 0 ? (
        <EmptyState
          icon={borrowedTab ? '💳' : '🤝'}
          title={borrowedTab ? 'You do not owe anyone' : 'Nobody owes you money'}
          description={
            borrowedTab
              ? 'Record money you borrow to keep track of what you still have to pay back.'
              : 'Record money you lend and Ledger can e-mail you a reminder when it is due back.'
          }
          action={
            <button type="button" className="btn btn-primary" onClick={() => setDialog({ kind: 'new', direction: tab })}>
              + {borrowedTab ? 'Record borrowing' : 'Record loan'}
            </button>
          }
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {visible.map(loan => {
            const settledLoan = loan.status === 'repaid'
            const overdue = !settledLoan && Boolean(loan.reminder_date && loan.reminder_date <= today)
            const isExpanded = expanded === loan.id
            return (
              <li
                key={loan.id}
                className="card"
                style={{
                  borderColor: overdue ? 'rgba(248,113,113,0.35)' : settledLoan ? 'rgba(52,211,153,0.2)' : undefined,
                  opacity: settledLoan ? 0.75 : 1,
                }}
              >
                <div className="flex items-start gap-3">
                  <span
                    className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold"
                    style={{ background: `color-mix(in srgb, ${accent} 14%, transparent)`, color: accent }}
                    aria-hidden="true"
                  >
                    {loan.borrower_name.charAt(0).toUpperCase()}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-semibold text-parchment">{loan.borrower_name}</h2>
                      {overdue && <span className="badge badge-danger">Reminder due</span>}
                      {loan.status === 'partially_repaid' && <span className="badge badge-warning">Partly repaid</span>}
                      {settledLoan && <span className="badge badge-success">Settled</span>}
                    </div>
                    {loan.reason && <p className="text-sm text-parchment-dim">{loan.reason}</p>}
                    <p className="text-xs text-parchment-faint">
                      {borrowedTab ? 'Borrowed' : 'Lent'} {formatDate(loan.date_lent)}
                      {loan.expected_return_date && ` · due ${formatDate(loan.expected_return_date)}`}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="mono-number text-lg font-bold" style={{ color: settledLoan ? 'var(--success)' : accent }}>
                      {formatCurrency(settledLoan ? loan.amount : loan.outstanding)}
                    </p>
                    <p className="text-xs text-parchment-faint">
                      {settledLoan ? 'settled' : loan.repaid > 0 ? `left of ${formatCurrency(loan.amount)}` : 'outstanding'}
                    </p>
                  </div>
                </div>

                {loan.repaid > 0 && !settledLoan && (
                  <div className="mt-3">
                    <ProgressBar value={loan.repaid} max={loan.amount} tone="teal" label={`${loan.borrower_name} repayment progress`} />
                    <p className="mt-1 text-xs text-parchment-faint">
                      {Math.round(pct(loan.repaid, loan.amount))}% repaid ({formatCurrency(loan.repaid)})
                    </p>
                  </div>
                )}

                {loan.reminder_date && !settledLoan && (
                  <p className={`mt-2 text-xs ${overdue ? 'text-danger' : 'text-parchment-faint'}`}>
                    🔔 Reminder {formatRelativeDate(loan.reminder_date, today).toLowerCase()} ({formatDate(loan.reminder_date)})
                  </p>
                )}
                {loan.notes && <p className="mt-2 text-xs text-parchment-dim">{loan.notes}</p>}

                <div className="mt-3 flex flex-wrap gap-2 border-t border-white/5 pt-3">
                  {!settledLoan && (
                    <button type="button" className="btn btn-secondary btn-sm" onClick={() => setDialog({ kind: 'repay', loan })}>
                      {borrowedTab ? 'Record payment' : 'Record repayment'}
                    </button>
                  )}
                  {!settledLoan && (
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => setDialog({ kind: 'reminder', loan })}>
                      {loan.reminder_date ? 'Change reminder' : 'Set reminder'}
                    </button>
                  )}
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => setDialog({ kind: 'edit', loan })}>
                    Edit
                  </button>
                  {loan.repayments.length > 0 && (
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm ml-auto"
                      onClick={() => setExpanded(isExpanded ? null : loan.id)}
                      aria-expanded={isExpanded}
                      aria-controls={`repayments-${loan.id}`}
                    >
                      {isExpanded ? 'Hide history' : `History (${loan.repayments.length})`}
                    </button>
                  )}
                </div>

                {isExpanded && (
                  <ul id={`repayments-${loan.id}`} className="mt-3 space-y-1.5">
                    {loan.repayments.map(r => (
                      <li key={r.id} className="surface flex items-center gap-3 px-3 py-2 text-sm">
                        <span className="font-mono text-parchment">{formatCurrency(r.amount)}</span>
                        <span className="min-w-0 flex-1 truncate text-xs text-parchment-faint">
                          {formatDate(r.repaid_date)}
                          {r.notes && ` · ${r.notes}`}
                        </span>
                        <button
                          type="button"
                          className="text-xs text-parchment-faint hover:text-danger"
                          onClick={() => setDialog({ kind: 'deleteRepayment', loan, repaymentId: r.id, amount: r.amount })}
                          aria-label={`Delete repayment of ${formatCurrency(r.amount)} on ${formatDate(r.repaid_date)}`}
                        >
                          Delete
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            )
          })}
        </ul>
      )}

      {dialog?.kind === 'new' && <LoanModal today={today} defaultDirection={dialog.direction} onClose={() => setDialog(null)} />}
      {dialog?.kind === 'edit' && <LoanModal today={today} loan={dialog.loan} onClose={() => setDialog(null)} />}
      {dialog?.kind === 'repay' && <RepaymentModal loan={dialog.loan} today={today} onClose={() => setDialog(null)} />}
      {dialog?.kind === 'reminder' && <ReminderModal loan={dialog.loan} today={today} onClose={() => setDialog(null)} />}
      {dialog?.kind === 'deleteRepayment' && (
        <ConfirmDialog
          title="Delete this repayment?"
          message={`${formatCurrency(dialog.amount)} from ${dialog.loan.borrower_name} will be removed and the balance goes back up.`}
          onConfirm={() => deleteLoanRepayment(dialog.repaymentId)}
          onClose={() => setDialog(null)}
          onDone={() => toast.success('Repayment deleted')}
        />
      )}
    </div>
  )
}
