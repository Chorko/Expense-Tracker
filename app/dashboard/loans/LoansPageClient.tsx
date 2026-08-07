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
  const [activeTab, setActiveTab] = useState<'lent_out' | 'borrowed_in'>('lent_out')

  const [showNewLoan, setShowNewLoan] = useState(false)
  const [repayingLoan, setRepayingLoan] = useState<Loan | null>(null)
  const [snoozingLoanId, setSnoozingLoanId] = useState<string | null>(null)
  const [expandedLoanId, setExpandedLoanId] = useState<string | null>(null)
  const [error, setError] = useState('')

  // New loan form
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

  // Separate loans by direction
  const lentOutLoans = loans.filter(l => (l.direction || 'lent_out') === 'lent_out')
  const borrowedInLoans = loans.filter(l => l.direction === 'borrowed_in')

  const lentOutOutstanding = lentOutLoans
    .filter(l => l.status !== 'repaid')
    .reduce((sum, l) => {
      const repaid = l.loan_repayments?.reduce((s, r) => s + r.amount, 0) ?? 0
      return sum + Math.max(0, l.amount - repaid)
    }, 0)

  const borrowedInOutstanding = borrowedInLoans
    .filter(l => l.status !== 'repaid')
    .reduce((sum, l) => {
      const repaid = l.loan_repayments?.reduce((s, r) => s + r.amount, 0) ?? 0
      return sum + Math.max(0, l.amount - repaid)
    }, 0)

  const overdueLoans = loans.filter(
    l => l.reminder_date && l.reminder_date <= today && l.status !== 'repaid'
  )

  const displayedLoans = activeTab === 'lent_out' ? lentOutLoans : borrowedInLoans

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
      setNewLoan({ borrower_name: '', amount: '', direction: activeTab, date_lent: today, reason: '', expected_return_date: '', reminder_date: '', notes: '' })
      router.refresh()
    })
  }

  function handleRepaymentSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!repayingLoan) return
    const amount = parseFloat(repayment.amount)
    if (!repayment.amount || isNaN(amount) || amount <= 0) { setError('Valid repayment amount required'); return }
    setError('')

    startTransition(async () => {
      const result = await addLoanRepayment({
        loan_id: repayingLoan.id,
        amount,
        repaid_date: repayment.repaid_date,
        notes: repayment.notes || undefined,
      })

      if (!result.success) { setError(result.error); return }

      setRepayingLoan(null)
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

  function openNewLoan(direction: 'lent_out' | 'borrowed_in') {
    setNewLoan(n => ({ ...n, direction, date_lent: today }))
    setError('')
    setShowNewLoan(true)
  }

  const isBorrowedTab = activeTab === 'borrowed_in'

  return (
    <div className="animate-fadeIn">

      {/* Page Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-parchment">Loans & Borrowings</h1>
          <p className="text-parchment-dim text-sm mt-0.5">Track money lent out and money borrowed in</p>
        </div>
        <button
          id="btn-new-loan"
          onClick={() => openNewLoan(activeTab)}
          className="btn btn-primary"
        >
          + Log {isBorrowedTab ? 'Borrowing' : 'Loan'}
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        {/* Money I Lent Out */}
        <div
          className="card cursor-pointer transition-all hover:border-brass/40"
          onClick={() => setActiveTab('lent_out')}
          style={{ borderColor: activeTab === 'lent_out' ? 'rgba(201,168,76,0.4)' : '', background: activeTab === 'lent_out' ? 'rgba(201,168,76,0.04)' : '' }}
        >
          <div className="flex items-start justify-between mb-2">
            <p className="text-xs text-parchment-faint uppercase tracking-widest">🤝 I Lent Out</p>
            <span className="text-[0.625rem] font-mono text-parchment-faint">{lentOutLoans.filter(l => l.status !== 'repaid').length} active</span>
          </div>
          <p className="font-mono font-bold text-2xl text-brass">{formatCurrency(lentOutOutstanding)}</p>
          <p className="text-[0.625rem] text-parchment-faint mt-1">Others owe me this</p>
        </div>

        {/* Money I Borrowed */}
        <div
          className="card cursor-pointer transition-all hover:border-rust/40"
          onClick={() => setActiveTab('borrowed_in')}
          style={{ borderColor: activeTab === 'borrowed_in' ? 'rgba(239,68,68,0.35)' : '', background: activeTab === 'borrowed_in' ? 'rgba(239,68,68,0.04)' : '' }}
        >
          <div className="flex items-start justify-between mb-2">
            <p className="text-xs text-parchment-faint uppercase tracking-widest">💳 I Borrowed</p>
            <span className="text-[0.625rem] font-mono text-parchment-faint">{borrowedInLoans.filter(l => l.status !== 'repaid').length} active</span>
          </div>
          <p className="font-mono font-bold text-2xl text-rust">{formatCurrency(borrowedInOutstanding)}</p>
          <p className="text-[0.625rem] text-parchment-faint mt-1">I owe this to others</p>
        </div>

        {/* Overdue */}
        <div
          className="card"
          style={{ borderColor: overdueLoans.length > 0 ? 'rgba(239,68,68,0.3)' : '' }}
        >
          <div className="flex items-start justify-between mb-2">
            <p className="text-xs text-parchment-faint uppercase tracking-widest">⚠ Overdue</p>
            <span className="text-[0.625rem] font-mono text-parchment-faint">reminders</span>
          </div>
          <p className={`font-mono font-bold text-2xl ${overdueLoans.length > 0 ? 'text-danger' : 'text-parchment-dim'}`}>
            {overdueLoans.length}
          </p>
          <p className="text-[0.625rem] text-parchment-faint mt-1">Need follow-up</p>
        </div>
      </div>

      {/* Tab Switcher */}
      <div className="flex gap-2 mb-4 p-1 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
        <button
          type="button"
          onClick={() => setActiveTab('lent_out')}
          className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all ${
            activeTab === 'lent_out'
              ? 'bg-brass/15 text-brass border border-brass/25'
              : 'text-parchment-dim hover:text-parchment'
          }`}
        >
          🤝 Money I Lent ({lentOutLoans.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('borrowed_in')}
          className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all ${
            activeTab === 'borrowed_in'
              ? 'bg-rust/15 text-rust border border-rust/25'
              : 'text-parchment-dim hover:text-parchment'
          }`}
        >
          💳 Money I Borrowed ({borrowedInLoans.length})
        </button>
      </div>

      {/* Loan Cards */}
      {displayedLoans.length === 0 ? (
        <div className="card text-center py-16" style={{ borderStyle: 'dashed' }}>
          <span className="text-5xl mb-4 block">{isBorrowedTab ? '💳' : '🤝'}</span>
          <p className="text-parchment-dim font-medium mb-1">
            {isBorrowedTab ? 'No borrowings recorded' : 'No loans recorded'}
          </p>
          <p className="text-parchment-faint text-sm mb-5">
            {isBorrowedTab
              ? 'Track money you\'ve borrowed from others and set repayment reminders'
              : 'Track money you\'ve lent out and get reminded when it\'s due back'}
          </p>
          <button
            onClick={() => openNewLoan(activeTab)}
            className="btn btn-primary mx-auto"
          >
            + Log {isBorrowedTab ? 'a Borrowing' : 'a Loan'}
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {displayedLoans.map(loan => {
            const repaid = loan.loan_repayments?.reduce((s, r) => s + r.amount, 0) ?? 0
            const outstanding = Math.max(0, loan.amount - repaid)
            const repaidPercent = Math.min(100, (repaid / loan.amount) * 100)
            const isOverdue = loan.reminder_date && loan.reminder_date <= today && loan.status !== 'repaid'
            const isRepaid = loan.status === 'repaid'
            const isExpanded = expandedLoanId === loan.id
            const accentColor = isBorrowedTab ? 'var(--rust)' : 'var(--brass)'
            const accentBg = isBorrowedTab ? 'rgba(239,68,68,0.08)' : 'rgba(201,168,76,0.08)'

            return (
              <div
                key={loan.id}
                className="card transition-all"
                style={{
                  borderColor: isOverdue ? 'rgba(239,68,68,0.3)' : isRepaid ? 'rgba(45,212,191,0.2)' : '',
                  opacity: isRepaid ? 0.7 : 1,
                }}
              >
                {/* Main Row */}
                <div className="flex items-start gap-4">
                  {/* Avatar circle */}
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 mt-0.5"
                    style={{ background: accentBg, color: accentColor, border: `1px solid ${accentColor}30` }}
                  >
                    {loan.borrower_name.charAt(0).toUpperCase()}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-parchment">{loan.borrower_name}</p>
                      {isOverdue && !isRepaid && (
                        <span className="text-[0.625rem] bg-danger/10 text-danger border border-danger/20 rounded px-1.5 py-0.5 font-mono">
                          OVERDUE
                        </span>
                      )}
                      {isRepaid && (
                        <span className="text-[0.625rem] bg-teal/10 text-teal border border-teal/20 rounded px-1.5 py-0.5 font-mono">
                          REPAID
                        </span>
                      )}
                      {loan.status === 'partially_repaid' && (
                        <span className="text-[0.625rem] bg-brass/10 text-brass border border-brass/20 rounded px-1.5 py-0.5 font-mono">
                          PARTIAL
                        </span>
                      )}
                    </div>
                    {loan.reason && (
                      <p className="text-xs text-parchment-faint mt-0.5">{loan.reason}</p>
                    )}
                    <p className="text-[0.625rem] text-parchment-faint font-mono mt-1">
                      {isBorrowedTab ? 'Borrowed' : 'Lent'} on {formatDate(loan.date_lent)}
                      {loan.expected_return_date && ` · Due ${formatDate(loan.expected_return_date)}`}
                    </p>
                  </div>

                  {/* Amount */}
                  <div className="text-right flex-shrink-0">
                    <p className="font-mono font-bold text-lg" style={{ color: isRepaid ? 'var(--success)' : accentColor }}>
                      {formatCurrency(outstanding)}
                    </p>
                    {repaid > 0 && !isRepaid && (
                      <p className="text-[0.625rem] text-parchment-faint font-mono">
                        of {formatCurrency(loan.amount)}
                      </p>
                    )}
                    {isRepaid && (
                      <p className="text-[0.625rem] text-teal font-mono">fully settled</p>
                    )}
                  </div>
                </div>

                {/* Progress bar */}
                {repaid > 0 && (
                  <div className="mt-3 mb-1">
                    <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${repaidPercent}%`,
                          background: isRepaid ? 'var(--success)' : accentColor,
                        }}
                      />
                    </div>
                    <p className="text-[0.625rem] text-parchment-faint font-mono mt-0.5">
                      {repaidPercent.toFixed(0)}% repaid ({formatCurrency(repaid)} of {formatCurrency(loan.amount)})
                    </p>
                  </div>
                )}

                {/* Reminder badge */}
                {loan.reminder_date && !isRepaid && (
                  <div className="mt-2">
                    <span
                      className={`text-[0.625rem] font-mono px-2 py-0.5 rounded ${
                        isOverdue
                          ? 'bg-danger/10 text-danger border border-danger/20'
                          : 'bg-white/5 text-parchment-faint border border-white/10'
                      }`}
                    >
                      {isOverdue ? '⚠ ' : '🔔 '} Reminder: {formatRelativeDate(loan.reminder_date)}
                    </span>
                  </div>
                )}

                {/* Action buttons */}
                {!isRepaid && (
                  <div className="flex gap-2 mt-3 pt-3 border-t border-white/5">
                    <button
                      onClick={() => { setRepayingLoan(loan); setRepayment({ amount: outstanding.toFixed(2), repaid_date: today, notes: '' }); setError('') }}
                      className="btn btn-secondary text-xs py-1 flex-1"
                    >
                      {isBorrowedTab ? '💸 Record Payment' : '💰 Record Repayment'}
                    </button>
                    {loan.loan_repayments?.length > 0 && (
                      <button
                        onClick={() => setExpandedLoanId(isExpanded ? null : loan.id)}
                        className="btn btn-ghost text-xs py-1 px-3"
                      >
                        📋 {isExpanded ? 'Hide' : `History (${loan.loan_repayments.length})`}
                      </button>
                    )}
                    {loan.reminder_date && (
                      <button
                        onClick={() => { setSnoozingLoanId(loan.id); setSnoozeDate(''); setError('') }}
                        className="btn btn-ghost text-xs py-1 px-3"
                      >
                        ⏰ Snooze
                      </button>
                    )}
                  </div>
                )}

                {/* Repayment History */}
                {isExpanded && loan.loan_repayments?.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-white/5 animate-fadeIn">
                    <p className="text-xs text-parchment-faint uppercase tracking-widest mb-2">Repayment History</p>
                    <div className="flex flex-col gap-1.5">
                      {loan.loan_repayments.map(r => (
                        <div key={r.id} className="flex items-center justify-between py-1.5 px-2.5 rounded-lg" style={{ background: 'rgba(255,255,255,0.03)' }}>
                          <div>
                            <span className="text-xs text-parchment font-mono">{formatCurrency(r.amount)}</span>
                            {r.notes && <span className="text-[0.625rem] text-parchment-faint ml-2">— {r.notes}</span>}
                          </div>
                          <span className="text-[0.625rem] text-parchment-faint font-mono">{formatDate(r.repaid_date)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* ─── New Loan Modal ─── */}
      {showNewLoan && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowNewLoan(false)}>
          <div className="modal">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold text-parchment">
                Log {newLoan.direction === 'borrowed_in' ? 'a Borrowing' : 'a Loan'}
              </h2>
              <button onClick={() => setShowNewLoan(false)} className="btn btn-ghost p-1.5">✕</button>
            </div>

            <form onSubmit={handleNewLoanSubmit} id="new-loan-form">
              {/* Direction toggle */}
              <div className="mb-4">
                <label className="input-label">Entry Type</label>
                <div className="flex gap-2 p-1 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <button
                    type="button"
                    onClick={() => setNewLoan(n => ({ ...n, direction: 'lent_out' }))}
                    className={`flex-1 py-2 px-3 rounded-lg text-xs font-medium transition-all ${
                      newLoan.direction === 'lent_out'
                        ? 'bg-brass/15 text-brass border border-brass/30 font-semibold'
                        : 'text-parchment-dim hover:text-parchment'
                    }`}
                  >
                    🤝 I Lent (They owe me)
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewLoan(n => ({ ...n, direction: 'borrowed_in' }))}
                    className={`flex-1 py-2 px-3 rounded-lg text-xs font-medium transition-all ${
                      newLoan.direction === 'borrowed_in'
                        ? 'bg-rust/15 text-rust border border-rust/30 font-semibold'
                        : 'text-parchment-dim hover:text-parchment'
                    }`}
                  >
                    💳 I Borrowed (I owe them)
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="col-span-2">
                  <label htmlFor="loan-borrower" className="input-label">
                    {newLoan.direction === 'borrowed_in' ? 'Lender Name (Person I Owe)' : 'Borrower Name (Person Who Owes Me)'}
                  </label>
                  <input
                    id="loan-borrower"
                    type="text"
                    value={newLoan.borrower_name}
                    onChange={e => setNewLoan(n => ({ ...n, borrower_name: e.target.value }))}
                    className="input"
                    placeholder={newLoan.direction === 'borrowed_in' ? 'e.g. Rahul, Bank, Father…' : 'e.g. Vikram, Friend…'}
                    maxLength={200}
                    required
                    autoFocus
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
                  <label htmlFor="loan-reason" className="input-label">
                    Reason / Purpose <span className="text-parchment-faint text-[0.625rem] font-normal normal-case">(optional)</span>
                  </label>
                  <input
                    id="loan-reason"
                    type="text"
                    value={newLoan.reason}
                    onChange={e => setNewLoan(n => ({ ...n, reason: e.target.value }))}
                    className="input"
                    placeholder="e.g. Travel, medical, house repair…"
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
                  <p className="text-parchment-faint text-[0.625rem] mt-0.5">When to send email nudge</p>
                </div>
              </div>

              {error && (
                <div className="mb-4 p-3 rounded-lg bg-danger/10 border border-danger/20 text-danger text-sm">
                  {error}
                </div>
              )}

              <div className="flex gap-3">
                <button type="button" onClick={() => setShowNewLoan(false)} className="btn btn-ghost flex-1">Cancel</button>
                <button
                  id="new-loan-submit"
                  type="submit"
                  className={`btn flex-2 ${newLoan.direction === 'borrowed_in' ? 'btn-danger' : 'btn-primary'}`}
                  style={{ flex: 2 }}
                  disabled={isPending}
                >
                  {isPending ? 'Saving…' : `Save ${newLoan.direction === 'borrowed_in' ? 'Borrowing' : 'Loan'}`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── Repayment Modal ─── */}
      {repayingLoan && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setRepayingLoan(null)}>
          <div className="modal" style={{ maxWidth: '420px' }}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold text-parchment">
                {repayingLoan.direction === 'borrowed_in' ? 'Record My Payment' : 'Record Repayment'}
              </h2>
              <button onClick={() => setRepayingLoan(null)} className="btn btn-ghost p-1.5">✕</button>
            </div>

            {(() => {
              const repaid = repayingLoan.loan_repayments?.reduce((s, r) => s + r.amount, 0) ?? 0
              const outstanding = Math.max(0, repayingLoan.amount - repaid)
              const isBorrowed = repayingLoan.direction === 'borrowed_in'
              return (
                <div className="mb-4 p-3 rounded-xl flex items-center justify-between" style={{ background: isBorrowed ? 'rgba(239,68,68,0.08)' : 'rgba(201,168,76,0.08)', border: `1px solid ${isBorrowed ? 'rgba(239,68,68,0.2)' : 'rgba(201,168,76,0.2)'}` }}>
                  <div>
                    <p className="text-sm text-parchment font-semibold">{repayingLoan.borrower_name}</p>
                    <p className="text-xs text-parchment-faint">{repayingLoan.reason || (isBorrowed ? 'Money I borrowed' : 'Money I lent out')}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-mono font-bold text-lg" style={{ color: isBorrowed ? 'var(--rust)' : 'var(--brass)' }}>
                      {formatCurrency(outstanding)}
                    </p>
                    <p className="text-[0.625rem] text-parchment-faint">outstanding</p>
                  </div>
                </div>
              )
            })()}

            <form onSubmit={handleRepaymentSubmit} id="repayment-form">
              <div className="mb-4">
                <label htmlFor="repay-amount" className="input-label">Amount (₹)</label>
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
              <div className="mb-4">
                <label htmlFor="repay-notes" className="input-label">
                  Notes <span className="text-parchment-faint text-[0.625rem] font-normal normal-case">(optional)</span>
                </label>
                <input
                  id="repay-notes"
                  type="text"
                  value={repayment.notes}
                  onChange={e => setRepayment(r => ({ ...r, notes: e.target.value }))}
                  className="input"
                  placeholder="e.g. UPI, cash, partial…"
                  maxLength={300}
                />
              </div>

              {error && (
                <div className="mb-4 p-3 rounded-lg bg-danger/10 border border-danger/20 text-danger text-sm">
                  {error}
                </div>
              )}

              <div className="flex gap-3">
                <button type="button" onClick={() => setRepayingLoan(null)} className="btn btn-ghost flex-1">Cancel</button>
                <button
                  id="repay-submit"
                  type="submit"
                  className="btn btn-teal flex-2"
                  style={{ flex: 2 }}
                  disabled={isPending}
                >
                  {isPending ? 'Saving…' : '✓ Confirm Payment'}
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
                <button
                  id="snooze-submit"
                  type="submit"
                  className="btn btn-secondary flex-2"
                  style={{ flex: 2 }}
                  disabled={isPending || !snoozeDate}
                >
                  {isPending ? 'Saving…' : '⏰ Snooze'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
