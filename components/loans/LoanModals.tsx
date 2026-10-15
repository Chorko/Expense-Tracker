'use client'

import { useId, useState, useTransition } from 'react'
import { addLoanRepayment, createLoan, deleteLoan, setLoanReminder, updateLoan } from '@/app/actions/loans'
import { Modal } from '@/components/ui/Modal'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { AmountInput } from '@/components/ui/AmountInput'
import { Field } from '@/components/ui/primitives'
import { useToast } from '@/components/ui/Toast'
import { addDays, formatDate, isYmd } from '@/lib/dates'
import { amountToInput, formatCurrency, parseAmount } from '@/lib/format'
import type { LoanRow } from '@/lib/types'
import type { LoanDirection } from '@/lib/validations'

const DIRECTION_COPY: Record<LoanDirection, { person: string; placeholder: string; date: string }> = {
  lent_out: { person: 'Who borrowed it?', placeholder: 'e.g. Vikram', date: 'Date lent' },
  borrowed_in: { person: 'Who lent it to you?', placeholder: 'e.g. Rahul, HDFC Bank', date: 'Date borrowed' },
}

export function LoanModal({
  today,
  loan,
  defaultDirection = 'lent_out',
  onClose,
}: {
  today: string
  loan?: LoanRow
  defaultDirection?: LoanDirection
  onClose: () => void
}) {
  const id = useId()
  const toast = useToast()
  const [pending, startTransition] = useTransition()
  const [direction, setDirection] = useState<LoanDirection>(loan?.direction ?? defaultDirection)
  const [name, setName] = useState(loan?.borrower_name ?? '')
  const [amount, setAmount] = useState(amountToInput(loan?.amount))
  const [dateLent, setDateLent] = useState(loan?.date_lent ?? today)
  const [reason, setReason] = useState(loan?.reason ?? '')
  const [dueDate, setDueDate] = useState(loan?.expected_return_date ?? '')
  const [reminder, setReminder] = useState(loan?.reminder_date ?? '')
  const [notes, setNotes] = useState(loan?.notes ?? '')
  const [error, setError] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const copy = DIRECTION_COPY[direction]

  function submit() {
    const value = parseAmount(amount)
    if (!name.trim()) return setError('Enter a name')
    if (value === null || value <= 0) return setError('Enter an amount greater than zero')
    if (!isYmd(dateLent)) return setError('Enter a valid date')
    if (loan && value + 0.001 < loan.repaid) return setError(`${formatCurrency(loan.repaid)} has already been repaid; the amount cannot be lower`)
    setError('')
    const payload = {
      borrower_name: name,
      amount: value,
      direction,
      date_lent: dateLent,
      reason,
      expected_return_date: dueDate || null,
      reminder_date: reminder || null,
      notes,
    }
    startTransition(async () => {
      const result = loan ? await updateLoan({ id: loan.id, ...payload }) : await createLoan(payload)
      if (!result.success) return setError(result.error)
      toast.success(loan ? 'Saved' : direction === 'lent_out' ? 'Loan recorded' : 'Borrowing recorded')
      onClose()
    })
  }

  return (
    <>
      <Modal
        title={loan ? 'Edit entry' : direction === 'lent_out' ? 'Record money you lent' : 'Record money you borrowed'}
        onClose={onClose}
        busy={pending}
        footer={
          <div className="flex w-full items-center gap-2">
            {loan && (
              <button type="button" className="btn btn-danger mr-auto" onClick={() => setConfirmDelete(true)} disabled={pending}>
                Delete
              </button>
            )}
            <button type="button" className="btn btn-ghost ml-auto" onClick={onClose} disabled={pending}>
              Cancel
            </button>
            <button type="submit" form={id} className="btn btn-primary" disabled={pending}>
              {pending && <span className="spinner" aria-hidden="true" />}
              Save
            </button>
          </div>
        }
      >
        <form
          id={id}
          noValidate
          className="flex flex-col gap-4"
          onSubmit={event => {
            event.preventDefault()
            submit()
          }}
        >
          <div className="segmented" role="group" aria-label="Type">
            <button type="button" aria-pressed={direction === 'lent_out'} onClick={() => setDirection('lent_out')}>
              I lent money
            </button>
            <button type="button" aria-pressed={direction === 'borrowed_in'} onClick={() => setDirection('borrowed_in')}>
              I borrowed money
            </button>
          </div>
          <Field id={`${id}-name`} label={copy.person}>
            <input
              id={`${id}-name`}
              className="input"
              value={name}
              maxLength={200}
              placeholder={copy.placeholder}
              onChange={e => setName(e.target.value)}
              autoFocus
            />
          </Field>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field id={`${id}-amount`} label="Amount">
              <AmountInput id={`${id}-amount`} value={amount} onChange={setAmount} />
            </Field>
            <Field id={`${id}-date`} label={copy.date}>
              <input id={`${id}-date`} type="date" className="input font-mono" value={dateLent} max={addDays(today, 1)} onChange={e => setDateLent(e.target.value)} />
            </Field>
          </div>
          <Field id={`${id}-reason`} label="What for" optional>
            <input id={`${id}-reason`} className="input" value={reason} maxLength={500} placeholder="e.g. Medical bills" onChange={e => setReason(e.target.value)} />
          </Field>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field id={`${id}-due`} label="Expected back by" optional>
              <input
                id={`${id}-due`}
                type="date"
                className="input font-mono"
                value={dueDate}
                onChange={e => {
                  setDueDate(e.target.value)
                  if (!reminder) setReminder(e.target.value)
                }}
              />
            </Field>
            <Field id={`${id}-reminder`} label="E-mail reminder on" optional hint="Sent by the daily reminder job">
              <input id={`${id}-reminder`} type="date" className="input font-mono" value={reminder} onChange={e => setReminder(e.target.value)} />
            </Field>
          </div>
          <Field id={`${id}-notes`} label="Notes" optional>
            <textarea id={`${id}-notes`} className="input" rows={2} value={notes} maxLength={1000} onChange={e => setNotes(e.target.value)} />
          </Field>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
        </form>
      </Modal>
      {confirmDelete && loan && (
        <ConfirmDialog
          title={`Delete the entry for ${loan.borrower_name}?`}
          message="The loan and all of its repayments are removed. This cannot be undone."
          onConfirm={() => deleteLoan(loan.id)}
          onClose={() => setConfirmDelete(false)}
          onDone={() => {
            toast.success('Entry deleted')
            onClose()
          }}
        />
      )}
    </>
  )
}

export function RepaymentModal({ loan, today, onClose }: { loan: LoanRow; today: string; onClose: () => void }) {
  const id = useId()
  const toast = useToast()
  const [pending, startTransition] = useTransition()
  const [amount, setAmount] = useState(amountToInput(loan.outstanding))
  const [date, setDate] = useState(today)
  const [notes, setNotes] = useState('')
  const [error, setError] = useState('')
  const borrowed = loan.direction === 'borrowed_in'

  function submit() {
    const value = parseAmount(amount)
    if (value === null || value <= 0) return setError('Enter an amount greater than zero')
    if (value > loan.outstanding + 0.001) return setError(`Only ${formatCurrency(loan.outstanding)} is outstanding`)
    setError('')
    startTransition(async () => {
      const result = await addLoanRepayment({ loan_id: loan.id, amount: value, repaid_date: date, notes })
      if (!result.success) return setError(result.error)
      toast.success(value >= loan.outstanding ? `${loan.borrower_name} is fully settled` : `Recorded ${formatCurrency(value)}`)
      onClose()
    })
  }

  return (
    <Modal
      title={borrowed ? 'Record a payment you made' : 'Record money you got back'}
      description={`${loan.borrower_name} · ${formatCurrency(loan.outstanding)} outstanding of ${formatCurrency(loan.amount)}`}
      size="sm"
      onClose={onClose}
      busy={pending}
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={pending}>
            Cancel
          </button>
          <button type="submit" form={id} className="btn btn-teal" disabled={pending}>
            {pending && <span className="spinner" aria-hidden="true" />}
            Record
          </button>
        </>
      }
    >
      <form
        id={id}
        noValidate
        className="flex flex-col gap-4"
        onSubmit={event => {
          event.preventDefault()
          submit()
        }}
      >
        <Field id={`${id}-amount`} label="Amount">
          <AmountInput id={`${id}-amount`} value={amount} onChange={setAmount} autoFocus />
        </Field>
        <div className="flex gap-2">
          {[0.25, 0.5, 1].map(share => (
            <button
              key={share}
              type="button"
              className="chip"
              onClick={() => setAmount(amountToInput(Math.round(loan.outstanding * share * 100) / 100))}
            >
              {share === 1 ? 'Full amount' : `${share * 100}%`}
            </button>
          ))}
        </div>
        <Field id={`${id}-date`} label="Date">
          <input id={`${id}-date`} type="date" className="input font-mono" value={date} max={today} onChange={e => setDate(e.target.value)} />
        </Field>
        <Field id={`${id}-notes`} label="Notes" optional>
          <input id={`${id}-notes`} className="input" value={notes} maxLength={500} placeholder="e.g. UPI, cash" onChange={e => setNotes(e.target.value)} />
        </Field>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
      </form>
    </Modal>
  )
}

export function ReminderModal({ loan, today, onClose }: { loan: LoanRow; today: string; onClose: () => void }) {
  const id = useId()
  const toast = useToast()
  const [pending, startTransition] = useTransition()
  const [date, setDate] = useState(loan.reminder_date && loan.reminder_date > today ? loan.reminder_date : addDays(today, 7))
  const [error, setError] = useState('')

  function save(value: string | null) {
    setError('')
    startTransition(async () => {
      const result = await setLoanReminder({ loan_id: loan.id, reminder_date: value })
      if (!result.success) return setError(result.error)
      toast.success(value ? `Reminder set for ${formatDate(value)}` : 'Reminder cleared')
      onClose()
    })
  }

  return (
    <Modal
      title="E-mail reminder"
      description={`For ${loan.borrower_name}`}
      size="sm"
      onClose={onClose}
      busy={pending}
      footer={
        <div className="flex w-full items-center gap-2">
          {loan.reminder_date && (
            <button type="button" className="btn btn-ghost mr-auto text-danger" onClick={() => save(null)} disabled={pending}>
              Clear reminder
            </button>
          )}
          <button type="submit" form={id} className="btn btn-primary ml-auto" disabled={pending}>
            Save
          </button>
        </div>
      }
    >
      <form
        id={id}
        className="flex flex-col gap-3"
        onSubmit={event => {
          event.preventDefault()
          if (!isYmd(date)) return setError('Choose a date')
          save(date)
        }}
      >
        <Field id={`${id}-date`} label="Remind me on">
          <input id={`${id}-date`} type="date" className="input font-mono" value={date} min={today} onChange={e => setDate(e.target.value)} autoFocus />
        </Field>
        <div className="flex flex-wrap gap-2">
          {[3, 7, 14, 30].map(days => (
            <button key={days} type="button" className="chip" onClick={() => setDate(addDays(today, days))}>
              +{days} days
            </button>
          ))}
        </div>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
      </form>
    </Modal>
  )
}
