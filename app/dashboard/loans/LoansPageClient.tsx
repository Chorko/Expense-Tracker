'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createLoan, addLoanRepayment, snoozeLoanReminder } from '@/app/actions/loans'
import { formatCurrency, formatDate, formatRelativeDate } from '@/lib/utils/format'

interface Loan {
  id: string
  borrower_name: string
  amount: number
  date_lent: string
  reason: string | null
  expected_return_date: string | null
  reminder_date: string | null
  status: 'outstanding' | 'partially_repaid' | 'repaid'
  notes: string | null
  loan_repayments: Array<{ id: string; amount: number; repaid_date: string; notes: string | null }>
}

interface LoansPageClientProps {
  loans: Loan[]
  totalOutstanding: number
  today: string
}

export function LoansPageClient({ loans, totalOutstanding, today }: LoansPageClientProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [showNewLoan, setShowNewLoan] = useState(false)
  const [repayingLoanId, setRepayingLoanId] = useState<string | null>(null)
  const [snoozingLoanId, setSnoozingLoanId] = useState<string | null>(null)
  const [error, setError] = useState('')

  // New loan form state
  const [newLoan, setNewLoan] = useState({
    borrower_name: '',
    amount: '',
    date_lent: today,
    reason: '',
    expected_return_date: '',
    reminder_date: '',
    notes: '',
  })

  // Repayment form
  const [repayment, setRepayment] = useState({ amount: '', repaid_date: today, notes: '' })

  // Snooze form
  const [snoozeDate, setSnoozeDate] = useState('')

  function handleNewLoanSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!newLoan.borrower_name.trim()) { setError('Borrower name required'); return }
    const amount = parseFloat(newLoan.amount)
    if (!newLoan.amount || isNaN(amount) || amount <= 0) { setError('Valid amount required'); return }
    setError('')

    startTransition(async () => {
      const result = await createLoan({
        borrower_name: newLoan.borrower_name,
        amount,
        date_lent: newLoan.date_lent,
        reason: newLoan.reason || undefined,
        expected_return_date: newLoan.expected_return_date || null,
        reminder_date: newLoan.reminder_date || null,
        notes: newLoan.notes || undefined,
      })

      if (!result.success) { setError(result.error); return }

      setShowNewLoan(false)
      setNewLoan({ borrower_name: '', amount: '', date_lent: today, reason: '', expected_return_date: '', reminder_date: '', notes: '' })
      router.refresh()
    })
  }

  function handleRepaymentSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!repayingLoanId) return
    const amount = parseFloat(repayment.amount)
    if (!repayment.amount || isNaN(amount) || amount <= 0) { setError('Valid repayment amount required'); return }
    setError('')

    startTransition(async () => {
      const result = await addLoanRepayment({
        loan_id: repayingLoanId,
        amount,
        repaid_date: repayment.repaid_date,
        notes: repayment.notes || undefined,
      })

      if (!result.success) { setError(result.error); return }

      setRepayingLoanId(null)
      setRepayment({ amount: '', repaid_date: today, notes: '' })
      router.refresh()
    })
  }

  function handleSnooze(e: React.FormEvent) {
    e.preventDefault()
    if (!snoozingLoanId || !snoozeDate) return
    setError('')

    startTransition(async () => {
      const result = await snoozeLoanReminder(snoozingLoanId, snoozeDate)
      if (!result.success) { setError(result.error); return }
      setSnoozingLoanId(null)
      setSnoozeDate('')
      router.refresh()
    })
  }

  const overdueLoans = loans.filter(
    l => l.reminder_date && l.reminder_date <= today && l.status !== 'repaid'
  )

  return (
    <div className="animate-fadeIn">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-parchment">Loans</h1>
          <p className="text-parchment-dim text-sm mt-0.5">Money you&apos;ve lent out</p>
        </div>
        <button
          id="btn-new-loan"
          onClick={() => { setShowNewLoan(true); setError('') }}
          className="btn btn-primary"
        >
          + Log loan
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="card">
          <p className="text-xs text-parchment-faint uppercase tracking-widest mb-1">Total out</p>
          <p className="font-mono font-bold text-2xl text-brass">{formatCurrency(totalOutstanding)}</p>
        </div>
        <div className="card">
          <p className="text-xs text-parchment-faint uppercase tracking-widest mb-1">Active loans</p>
          <p className="font-mono font-bold text-2xl text-parchment">{loans.length}</p>
        </div>
        <div className="card" style={{ borderColor: overdueLoans.length > 0 ? 'rgba(239,68,68,0.3)' : '' }}>
          <p className="text-xs text-parchment-faint uppercase tracking-widest mb-1">Overdue reminders</p>
          <p className={`font-mono font-bold text-2xl ${overdueLoans.length > 0 ? 'text-danger' : 'text-parchment'}`}>
            {overdueLoans.length}
          </p>
        </div>
      </div>

      {/* Loans table */}
      {loans.length === 0 ? (
        <div
          className="card text-center py-12"
          style={{ borderStyle: 'dashed' }}
        >
          <span className="text-4xl mb-3 block">🤝</span>
          <p className="text-parchment-dim mb-1">No outstanding loans</p>
          <p className="text-parchment-faint text-sm">Log money you&apos;ve lent to track it here</p>
        </div>
      ) : (
        <div className="card">
          <table className="table-ledger">
            <thead>
              <tr>
                <th>Borrower</th>
                <th>Amount</th>
                <th>Outstanding</th>
                <th>Status</th>
                <th>Reminder</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {loans.map(loan => {
                const repaid = loan.loan_repayments.reduce((s, r) => s + r.amount, 0)
                const outstanding = loan.amount - repaid
                const isOverdue = loan.reminder_date && loan.reminder_date <= today

                return (
                  <tr key={loan.id}>
                    <td>
                      <div>
                        <p className="font-medium text-parchment">{loan.borrower_name}</p>
                        {loan.reason && (
                          <p className="text-xs text-parchment-faint">{loan.reason}</p>
                        )}
                        <p className="text-xs text-parchment-faint font-mono">
                          Lent {formatDate(loan.date_lent)}
                        </p>
                      </div>
                    </td>
                    <td className="amount font-mono">{formatCurrency(loan.amount)}</td>
                    <td>
                      <span
                        className="amount font-mono font-semibold"
                        style={{ color: outstanding > 0 ? 'var(--brass)' : 'var(--success)' }}
                      >
                        {formatCurrency(outstanding)}
                      </span>
                    </td>
                    <td>
                      <span className={`badge badge-${loan.status === 'partially_repaid' ? 'partial' : loan.status}`}>
                        {loan.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td>
                      {loan.reminder_date ? (
                        <span
                          className={`text-xs font-mono ${isOverdue ? 'text-danger font-semibold' : 'text-parchment-dim'}`}
                        >
                          {isOverdue ? '⚠ ' : ''}{formatRelativeDate(loan.reminder_date)}
                        </span>
                      ) : (
                        <span className="text-parchment-faint text-xs">—</span>
                      )}
                    </td>
                    <td>
                      <div className="flex gap-1 justify-end">
                        <button
                          onClick={() => { setRepayingLoanId(loan.id); setError('') }}
                          className="btn btn-secondary text-xs py-0.5 px-2"
                          aria-label={`Add repayment for ${loan.borrower_name}`}
                        >
                          Repayment
                        </button>
                        {loan.reminder_date && (
                          <button
                            onClick={() => {
                              setSnoozingLoanId(loan.id)
                              setSnoozeDate('')
                              setError('')
                            }}
                            className="btn btn-ghost text-xs py-0.5 px-2"
                            aria-label={`Snooze reminder for ${loan.borrower_name}`}
                          >
                            Snooze
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ─── New Loan Modal ─── */}
      {showNewLoan && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowNewLoan(false)}>
          <div className="modal">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold text-parchment">Log a Loan</h2>
              <button onClick={() => setShowNewLoan(false)} className="btn btn-ghost p-1.5">✕</button>
            </div>

            <form onSubmit={handleNewLoanSubmit} id="new-loan-form">
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="col-span-2">
                  <label htmlFor="loan-borrower" className="input-label">Borrower name</label>
                  <input
                    id="loan-borrower"
                    type="text"
                    value={newLoan.borrower_name}
                    onChange={e => setNewLoan(n => ({ ...n, borrower_name: e.target.value }))}
                    className="input"
                    placeholder="Friend's name"
                    maxLength={200}
                    required
                  />
                </div>
                <div>
                  <label htmlFor="loan-amount" className="input-label">Amount (₹)</label>
                  <input
                    id="loan-amount"
                    type="number"
                    value={newLoan.amount}
                    onChange={e => setNewLoan(n => ({ ...n, amount: e.target.value }))}
                    className="input font-mono"
                    placeholder="500"
                    min="1"
                    step="0.01"
                  />
                </div>
                <div>
                  <label htmlFor="loan-date" className="input-label">Date lent</label>
                  <input
                    id="loan-date"
                    type="date"
                    value={newLoan.date_lent}
                    onChange={e => setNewLoan(n => ({ ...n, date_lent: e.target.value }))}
                    className="input font-mono"
                  />
                </div>
                <div className="col-span-2">
                  <label htmlFor="loan-reason" className="input-label">Reason <span className="text-parchment-faint text-[0.625rem] font-normal normal-case">(optional)</span></label>
                  <input
                    id="loan-reason"
                    type="text"
                    value={newLoan.reason}
                    onChange={e => setNewLoan(n => ({ ...n, reason: e.target.value }))}
                    className="input"
                    placeholder="e.g. Emergency, travel, etc."
                    maxLength={500}
                  />
                </div>
                <div>
                  <label htmlFor="loan-return-date" className="input-label">Expected return <span className="text-parchment-faint text-[0.625rem] font-normal normal-case">(optional)</span></label>
                  <input
                    id="loan-return-date"
                    type="date"
                    value={newLoan.expected_return_date}
                    onChange={e => setNewLoan(n => ({
                      ...n,
                      expected_return_date: e.target.value,
                      reminder_date: n.reminder_date || e.target.value,
                    }))}
                    className="input font-mono"
                    min={today}
                  />
                </div>
                <div>
                  <label htmlFor="loan-reminder" className="input-label">Reminder date</label>
                  <input
                    id="loan-reminder"
                    type="date"
                    value={newLoan.reminder_date}
                    onChange={e => setNewLoan(n => ({ ...n, reminder_date: e.target.value }))}
                    className="input font-mono"
                    min={today}
                  />
                  <p className="text-parchment-faint text-xs mt-0.5">When to nudge you</p>
                </div>
              </div>

              {error && (
                <div className="mb-4 p-3 rounded-lg bg-danger/10 border border-danger/20 text-danger text-sm">
                  {error}
                </div>
              )}

              <div className="flex gap-3">
                <button type="button" onClick={() => setShowNewLoan(false)} className="btn btn-ghost flex-1">Cancel</button>
                <button id="new-loan-submit" type="submit" className="btn btn-primary flex-2" style={{ flex: 2 }} disabled={isPending}>
                  {isPending ? '…' : 'Log loan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── Repayment Modal ─── */}
      {repayingLoanId && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setRepayingLoanId(null)}>
          <div className="modal" style={{ maxWidth: '400px' }}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold text-parchment">Record Repayment</h2>
              <button onClick={() => setRepayingLoanId(null)} className="btn btn-ghost p-1.5">✕</button>
            </div>

            {(() => {
              const loan = loans.find(l => l.id === repayingLoanId)!
              const repaid = loan.loan_repayments.reduce((s, r) => s + r.amount, 0)
              const outstanding = loan.amount - repaid
              return (
                <div className="mb-4 p-3 rounded-lg" style={{ background: 'var(--ink-navy-3)' }}>
                  <p className="text-sm text-parchment">{loan.borrower_name}</p>
                  <p className="font-mono text-teal font-semibold">
                    {formatCurrency(outstanding)} outstanding
                  </p>
                </div>
              )
            })()}

            <form onSubmit={handleRepaymentSubmit} id="repayment-form">
              <div className="mb-4">
                <label htmlFor="repay-amount" className="input-label">Amount repaid (₹)</label>
                <input
                  id="repay-amount"
                  type="number"
                  value={repayment.amount}
                  onChange={e => setRepayment(r => ({ ...r, amount: e.target.value }))}
                  className="input font-mono"
                  placeholder="0"
                  min="1"
                  step="0.01"
                  autoFocus
                />
              </div>
              <div className="mb-4">
                <label htmlFor="repay-date" className="input-label">Date</label>
                <input
                  id="repay-date"
                  type="date"
                  value={repayment.repaid_date}
                  onChange={e => setRepayment(r => ({ ...r, repaid_date: e.target.value }))}
                  className="input font-mono"
                  max={today}
                />
              </div>

              {error && (
                <div className="mb-4 p-3 rounded-lg bg-danger/10 border border-danger/20 text-danger text-sm">
                  {error}
                </div>
              )}

              <div className="flex gap-3">
                <button type="button" onClick={() => setRepayingLoanId(null)} className="btn btn-ghost flex-1">Cancel</button>
                <button id="repay-submit" type="submit" className="btn btn-teal flex-2" style={{ flex: 2 }} disabled={isPending}>
                  {isPending ? '…' : 'Record repayment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── Snooze Modal ─── */}
      {snoozingLoanId && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setSnoozingLoanId(null)}>
          <div className="modal" style={{ maxWidth: '360px' }}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold text-parchment">Snooze Reminder</h2>
              <button onClick={() => setSnoozingLoanId(null)} className="btn btn-ghost p-1.5">✕</button>
            </div>

            <form onSubmit={handleSnooze} id="snooze-form">
              <div className="mb-4">
                <label htmlFor="snooze-date" className="input-label">New reminder date</label>
                <input
                  id="snooze-date"
                  type="date"
                  value={snoozeDate}
                  onChange={e => setSnoozeDate(e.target.value)}
                  className="input font-mono"
                  min={today}
                  required
                  autoFocus
                />
              </div>

              {error && (
                <div className="mb-4 p-3 rounded-lg bg-danger/10 border border-danger/20 text-danger text-sm">
                  {error}
                </div>
              )}

              <div className="flex gap-3">
                <button type="button" onClick={() => setSnoozingLoanId(null)} className="btn btn-ghost flex-1">Cancel</button>
                <button id="snooze-submit" type="submit" className="btn btn-secondary flex-2" style={{ flex: 2 }} disabled={isPending || !snoozeDate}>
                  {isPending ? '…' : 'Snooze'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
