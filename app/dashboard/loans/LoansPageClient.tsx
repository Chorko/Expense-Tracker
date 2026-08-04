'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createLoan, addLoanRepayment, snoozeLoanReminder } from '@/app/actions/loans'
import { formatCurrency, formatDate, formatRelativeDate } from '@/lib/utils/format'

interface Loan {
  id: string
  borrower_name: string
  amount: number
  direction: 'lent_out' | 'borrowed_in'
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

export function LoansPageClient({ loans, today }: LoansPageClientProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [activeTab, setActiveTab] = useState<'all' | 'lent_out' | 'borrowed_in'>('all')

  const [showNewLoan, setShowNewLoan] = useState(false)
  const [repayingLoanId, setRepayingLoanId] = useState<string | null>(null)
  const [snoozingLoanId, setSnoozingLoanId] = useState<string | null>(null)
  const [error, setError] = useState('')

  // New loan form state
  const [newLoan, setNewLoan] = useState({
    borrower_name: '',
    amount: '',
    direction: 'lent_out' as 'lent_out' | 'borrowed_in',
    date_lent: today,
    reason: '',
    expected_return_date: '',
    reminder_date: '',
    notes: '',
  })

  // Repayment form
  const [repayment, setRepayment] = useState({ amount: '', repaid_date: today, notes: '' })
  const [snoozeDate, setSnoozeDate] = useState('')

  const lentOutLoans = loans.filter(l => (l.direction || 'lent_out') === 'lent_out')
  const borrowedInLoans = loans.filter(l => l.direction === 'borrowed_in')

  const lentOutTotal = lentOutLoans.reduce((sum, loan) => {
    const repaid = loan.loan_repayments?.reduce((s, r) => s + r.amount, 0) ?? 0
    return sum + (loan.amount - repaid)
  }, 0)

  const borrowedInTotal = borrowedInLoans.reduce((sum, loan) => {
    const repaid = loan.loan_repayments?.reduce((s, r) => s + r.amount, 0) ?? 0
    return sum + (loan.amount - repaid)
  }, 0)

  const displayedLoans = activeTab === 'all'
    ? loans
    : activeTab === 'lent_out'
    ? lentOutLoans
    : borrowedInLoans

  function handleNewLoanSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!newLoan.borrower_name.trim()) { setError('Person / party name required'); return }
    const amount = parseFloat(newLoan.amount)
    if (!newLoan.amount || isNaN(amount) || amount <= 0) { setError('Valid amount required'); return }
    setError('')

    startTransition(async () => {
      const result = await createLoan({
        borrower_name: newLoan.borrower_name,
        amount,
        direction: newLoan.direction,
        date_lent: newLoan.date_lent,
        reason: newLoan.reason || undefined,
        expected_return_date: newLoan.expected_return_date || null,
        reminder_date: newLoan.reminder_date || null,
        notes: newLoan.notes || undefined,
      })

      if (!result.success) { setError(result.error); return }

      setShowNewLoan(false)
      setNewLoan({ borrower_name: '', amount: '', direction: 'lent_out', date_lent: today, reason: '', expected_return_date: '', reminder_date: '', notes: '' })
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
          <h1 className="text-2xl font-bold text-parchment">Loans &amp; Borrowings</h1>
          <p className="text-parchment-dim text-sm mt-0.5">Track money lent out and money borrowed</p>
        </div>
        <button
          id="btn-new-loan"
          onClick={() => { setShowNewLoan(true); setError('') }}
          className="btn btn-primary"
        >
          + Log Loan / Borrowing
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="card">
          <p className="text-xs text-parchment-faint uppercase tracking-widest mb-1">
            🤝 Money Lent OUT (They Owe Me)
          </p>
          <p className="font-mono font-bold text-2xl text-brass">{formatCurrency(lentOutTotal)}</p>
          <p className="text-[0.625rem] text-parchment-faint mt-1">{lentOutLoans.length} active entries</p>
        </div>

        <div className="card">
          <p className="text-xs text-parchment-faint uppercase tracking-widest mb-1">
            💳 Money Borrowed IN (I Owe Them)
          </p>
          <p className="font-mono font-bold text-2xl text-rust">{formatCurrency(borrowedInTotal)}</p>
          <p className="text-[0.625rem] text-parchment-faint mt-1">{borrowedInLoans.length} active entries</p>
        </div>

        <div className="card" style={{ borderColor: overdueLoans.length > 0 ? 'rgba(239,68,68,0.3)' : '' }}>
          <p className="text-xs text-parchment-faint uppercase tracking-widest mb-1">Overdue Reminders</p>
          <p className={`font-mono font-bold text-2xl ${overdueLoans.length > 0 ? 'text-danger' : 'text-parchment'}`}>
            {overdueLoans.length}
          </p>
          <p className="text-[0.625rem] text-parchment-faint mt-1">Pending payment nudges</p>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 mb-4">
        <button
          type="button"
          onClick={() => setActiveTab('all')}
          className={`btn text-xs py-1.5 px-3 ${activeTab === 'all' ? 'btn-primary' : 'btn-ghost'}`}
        >
          All Entries ({loans.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('lent_out')}
          className={`btn text-xs py-1.5 px-3 ${activeTab === 'lent_out' ? 'btn-primary' : 'btn-ghost'}`}
        >
          🤝 Money I Lent ({lentOutLoans.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('borrowed_in')}
          className={`btn text-xs py-1.5 px-3 ${activeTab === 'borrowed_in' ? 'btn-primary' : 'btn-ghost'}`}
        >
          💳 Money I Borrowed ({borrowedInLoans.length})
        </button>
      </div>

      {/* Loans table */}
      {displayedLoans.length === 0 ? (
        <div className="card text-center py-12" style={{ borderStyle: 'dashed' }}>
          <span className="text-4xl mb-3 block">🤝</span>
          <p className="text-parchment-dim mb-1">No loans found</p>
          <p className="text-parchment-faint text-sm">Log money you&apos;ve lent out or borrowed to track repayments</p>
        </div>
      ) : (
        <div className="card">
          <table className="table-ledger">
            <thead>
              <tr>
                <th>Person / Reason</th>
                <th>Direction</th>
                <th>Original</th>
                <th>Outstanding</th>
                <th>Status</th>
                <th>Reminder</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {displayedLoans.map(loan => {
                const repaid = loan.loan_repayments.reduce((s, r) => s + r.amount, 0)
                const outstanding = loan.amount - repaid
                const isOverdue = loan.reminder_date && loan.reminder_date <= today
                const isBorrowed = loan.direction === 'borrowed_in'

                return (
                  <tr key={loan.id}>
                    <td>
                      <div>
                        <p className="font-medium text-parchment">{loan.borrower_name}</p>
                        {loan.reason && (
                          <p className="text-xs text-parchment-faint">{loan.reason}</p>
                        )}
                        <p className="text-xs text-parchment-faint font-mono">
                          Date: {formatDate(loan.date_lent)}
                        </p>
                      </div>
                    </td>
                    <td>
                      <span
                        className="badge text-xs"
                        style={{
                          background: isBorrowed ? 'rgba(239,68,68,0.1)' : 'rgba(201,168,76,0.1)',
                          color: isBorrowed ? 'var(--rust)' : 'var(--brass)',
                          border: isBorrowed ? '1px solid rgba(239,68,68,0.2)' : '1px solid rgba(201,168,76,0.2)',
                        }}
                      >
                        {isBorrowed ? '💳 Borrowed IN' : '🤝 Lent OUT'}
                      </span>
                    </td>
                    <td className="amount font-mono">{formatCurrency(loan.amount)}</td>
                    <td>
                      <span
                        className="amount font-mono font-semibold"
                        style={{ color: outstanding > 0 ? (isBorrowed ? 'var(--rust)' : 'var(--brass)') : 'var(--success)' }}
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
                          aria-label={`Record repayment for ${loan.borrower_name}`}
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
              <h2 className="text-lg font-semibold text-parchment">Log Loan or Borrowing</h2>
              <button onClick={() => setShowNewLoan(false)} className="btn btn-ghost p-1.5">✕</button>
            </div>

            <form onSubmit={handleNewLoanSubmit} id="new-loan-form">
              {/* Direction selector */}
              <div className="mb-4">
                <label className="input-label">Entry Type</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setNewLoan(n => ({ ...n, direction: 'lent_out' }))}
                    className={`flex-1 p-2.5 rounded-lg border text-center transition-all text-xs ${
                      newLoan.direction === 'lent_out'
                        ? 'bg-brass/10 border-brass text-brass font-semibold'
                        : 'bg-ink-navy border-white/5 text-parchment-dim'
                    }`}
                  >
                    🤝 Money I Lent (They owe me)
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewLoan(n => ({ ...n, direction: 'borrowed_in' }))}
                    className={`flex-1 p-2.5 rounded-lg border text-center transition-all text-xs ${
                      newLoan.direction === 'borrowed_in'
                        ? 'bg-rust/10 border-rust text-rust font-semibold'
                        : 'bg-ink-navy border-white/5 text-parchment-dim'
                    }`}
                  >
                    💳 Money I Borrowed (I owe them)
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="col-span-2">
                  <label htmlFor="loan-borrower" className="input-label">
                    {newLoan.direction === 'borrowed_in' ? 'Lender Name / Person I Owe' : 'Borrower Name / Person Who Owes Me'}
                  </label>
                  <input
                    id="loan-borrower"
                    type="text"
                    value={newLoan.borrower_name}
                    onChange={e => setNewLoan(n => ({ ...n, borrower_name: e.target.value }))}
                    className="input"
                    placeholder="Name of person or entity"
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
                    placeholder="5000"
                    min="1"
                    step="0.01"
                    required
                  />
                </div>
                <div>
                  <label htmlFor="loan-date" className="input-label">Date</label>
                  <input
                    id="loan-date"
                    type="date"
                    value={newLoan.date_lent}
                    onChange={e => setNewLoan(n => ({ ...n, date_lent: e.target.value }))}
                    className="input font-mono"
                  />
                </div>
                <div className="col-span-2">
                  <label htmlFor="loan-reason" className="input-label">Reason / Purpose <span className="text-parchment-faint text-[0.625rem] font-normal normal-case">(optional)</span></label>
                  <input
                    id="loan-reason"
                    type="text"
                    value={newLoan.reason}
                    onChange={e => setNewLoan(n => ({ ...n, reason: e.target.value }))}
                    className="input"
                    placeholder="e.g. Travel emergency, house repair, etc."
                    maxLength={500}
                  />
                </div>
                <div>
                  <label htmlFor="loan-return-date" className="input-label">Expected Repayment Date</label>
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
                  <label htmlFor="loan-reminder" className="input-label">Reminder Date</label>
                  <input
                    id="loan-reminder"
                    type="date"
                    value={newLoan.reminder_date}
                    onChange={e => setNewLoan(n => ({ ...n, reminder_date: e.target.value }))}
                    className="input font-mono"
                    min={today}
                  />
                  <p className="text-parchment-faint text-[0.625rem] mt-0.5">When to receive nudge email</p>
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
                  {isPending ? 'Saving…' : 'Save Entry'}
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
                  <p className="text-sm text-parchment font-medium">{loan.borrower_name}</p>
                  <p className="font-mono text-teal font-semibold">
                    {formatCurrency(outstanding)} outstanding
                  </p>
                </div>
              )
            })()}

            <form onSubmit={handleRepaymentSubmit} id="repayment-form">
              <div className="mb-4">
                <label htmlFor="repay-amount" className="input-label">Amount Repaid (₹)</label>
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
                  required
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
                  {isPending ? 'Saving…' : 'Record Repayment'}
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
                <label htmlFor="snooze-date" className="input-label">New Reminder Date</label>
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
                  {isPending ? 'Saving…' : 'Snooze'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
