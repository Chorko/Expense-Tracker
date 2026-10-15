'use client'

import { useId, useState, useTransition } from 'react'
import { createRecurring, deleteRecurring, updateRecurring } from '@/app/actions/transactions'
import { Modal } from '@/components/ui/Modal'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { AmountInput } from '@/components/ui/AmountInput'
import { Field } from '@/components/ui/primitives'
import { useToast } from '@/components/ui/Toast'
import { formatDate, isYmd, parseYmd } from '@/lib/dates'
import { amountToInput, formatCurrency, parseAmount } from '@/lib/format'
import { FREQUENCY_LABELS, nextRecurringDate } from '@/lib/recurring'
import { FREQUENCIES, type Frequency } from '@/lib/validations'
import type { CategoryOption } from '@/lib/types'
import type { RecurringRuleView } from './types'

type RecurringModalProps = {
  categories: CategoryOption[]
  today: string
  rule?: RecurringRuleView
  onClose: () => void
}

export function RecurringModal({ categories, today, rule, onClose }: RecurringModalProps) {
  const formId = useId()
  const toast = useToast()
  const [pending, startTransition] = useTransition()
  const [amount, setAmount] = useState(amountToInput(rule?.amount))
  const [categoryId, setCategoryId] = useState(rule ? rule.category_id ?? '' : categories[0]?.id ?? '')
  const [description, setDescription] = useState(rule?.description ?? '')
  const [frequency, setFrequency] = useState<Frequency>(rule?.frequency ?? 'monthly')
  const [nextDue, setNextDue] = useState(rule?.next_due_date ?? today)
  const [active, setActive] = useState(rule?.is_active ?? true)
  const [error, setError] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)

  const preview: string[] = []
  if (isYmd(nextDue)) {
    const anchor = parseYmd(nextDue).day
    let date = nextDue
    for (let i = 0; i < 3; i++) {
      preview.push(date)
      date = nextRecurringDate(date, frequency, anchor)
    }
  }

  function submit() {
    const value = parseAmount(amount)
    if (value === null || value <= 0) return setError('Enter an amount greater than zero')
    if (!isYmd(nextDue)) return setError('Choose the next date it is due')
    if (!description.trim()) return setError('Give it a name, e.g. Netflix or Rent')
    setError('')

    const payload = { amount: value, category_id: categoryId || null, description, frequency, next_due_date: nextDue }
    startTransition(async () => {
      const result = rule
        ? await updateRecurring({ id: rule.id, is_active: active, ...payload })
        : await createRecurring(payload)
      if (!result.success) return setError(result.error)
      toast.success(rule ? 'Recurring expense updated' : 'Recurring expense added')
      onClose()
    })
  }

  return (
    <>
      <Modal
        title={rule ? 'Edit recurring expense' : 'New recurring expense'}
        description="Ledger posts it automatically on each due date."
        onClose={onClose}
        busy={pending}
        footer={
          <div className="flex w-full items-center gap-2">
            {rule && (
              <button type="button" className="btn btn-danger mr-auto" onClick={() => setConfirmDelete(true)} disabled={pending}>
                Delete
              </button>
            )}
            <button type="button" className="btn btn-ghost ml-auto" onClick={onClose} disabled={pending}>
              Cancel
            </button>
            <button type="submit" form={formId} className="btn btn-primary" disabled={pending}>
              {pending && <span className="spinner" aria-hidden="true" />}
              {rule ? 'Save' : 'Add'}
            </button>
          </div>
        }
      >
        <form
          id={formId}
          noValidate
          className="flex flex-col gap-4"
          onSubmit={event => {
            event.preventDefault()
            submit()
          }}
        >
          <Field id={`${formId}-name`} label="Name">
            <input
              id={`${formId}-name`}
              className="input"
              value={description}
              maxLength={500}
              placeholder="e.g. Netflix, Rent, Gym"
              onChange={e => setDescription(e.target.value)}
              autoFocus
            />
          </Field>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field id={`${formId}-amount`} label="Amount">
              <AmountInput id={`${formId}-amount`} value={amount} onChange={setAmount} />
            </Field>
            <Field id={`${formId}-category`} label="Category">
              <select id={`${formId}-category`} className="input" value={categoryId} onChange={e => setCategoryId(e.target.value)}>
                <option value="">Uncategorised</option>
                {categories.map(option => (
                  <option key={option.id} value={option.id}>
                    {option.icon} {option.label}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <fieldset>
            <legend className="input-label">Repeats</legend>
            <div className="segmented" role="group" aria-label="Frequency">
              {FREQUENCIES.map(f => (
                <button key={f} type="button" aria-pressed={frequency === f} onClick={() => setFrequency(f)}>
                  {FREQUENCY_LABELS[f].replace('Every ', '')}
                </button>
              ))}
            </div>
          </fieldset>
          <Field
            id={`${formId}-next`}
            label="Next due"
            hint={preview.length ? `Then ${preview.slice(1).map(d => formatDate(d, { withYear: false })).join(', ')}…` : undefined}
          >
            <input
              id={`${formId}-next`}
              type="date"
              className="input font-mono"
              value={nextDue}
              min="2001-01-01"
              onChange={e => setNextDue(e.target.value)}
            />
          </Field>
          {rule && (
            <label className="flex items-center gap-2.5 text-sm text-parchment">
              <input type="checkbox" className="h-4 w-4 accent-[var(--brass)]" checked={active} onChange={e => setActive(e.target.checked)} />
              Active
              <span className="text-xs text-parchment-faint">(paused rules post nothing; resuming skips missed dates)</span>
            </label>
          )}
          {nextDue <= today && (!rule || active) && (
            <p className="text-xs text-warning">
              Due today or earlier: it will be posted as soon as you save ({formatCurrency(parseAmount(amount) ?? 0)}).
            </p>
          )}
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
        </form>
      </Modal>
      {confirmDelete && rule && (
        <ConfirmDialog
          title="Delete this recurring expense?"
          message="Future occurrences stop. Expenses it already posted stay in your history."
          onConfirm={() => deleteRecurring(rule.id)}
          onClose={() => setConfirmDelete(false)}
          onDone={() => {
            toast.success('Recurring expense deleted')
            onClose()
          }}
        />
      )}
    </>
  )
}
