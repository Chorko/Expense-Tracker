'use client'

import { useId, useState, useTransition } from 'react'
import { addTransaction, deleteTransaction, updateTransaction } from '@/app/actions/transactions'
import { Modal } from '@/components/ui/Modal'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { AmountInput } from '@/components/ui/AmountInput'
import { Field } from '@/components/ui/primitives'
import { useToast } from '@/components/ui/Toast'
import { addDays } from '@/lib/dates'
import { amountToInput, formatCurrency, parseAmount } from '@/lib/format'
import type { CategoryOption, TxnRow } from '@/lib/types'

type TransactionModalProps = {
  categories: CategoryOption[]
  today: string
  /** Edit this transaction instead of creating one */
  transaction?: TxnRow
  defaultCategoryId?: string | null
  defaultDate?: string
  onClose: () => void
}

export function TransactionModal({
  categories,
  today,
  transaction,
  defaultCategoryId,
  defaultDate,
  onClose,
}: TransactionModalProps) {
  const isEdit = Boolean(transaction)
  const formId = useId()
  const toast = useToast()
  const [pending, startTransition] = useTransition()

  const [amount, setAmount] = useState(amountToInput(transaction?.amount))
  const [categoryId, setCategoryId] = useState<string>(
    transaction ? transaction.category_id ?? '' : defaultCategoryId ?? categories[0]?.id ?? ''
  )
  const [date, setDate] = useState(transaction?.txn_date ?? defaultDate ?? today)
  const [description, setDescription] = useState(transaction?.description ?? '')
  const [error, setError] = useState('')
  const [amountError, setAmountError] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [addedCount, setAddedCount] = useState(0)

  const unknownCategory = Boolean(categoryId) && !categories.some(c => c.id === categoryId)

  function submit(keepOpen: boolean) {
    const value = parseAmount(amount)
    if (value === null || value <= 0) {
      setAmountError('Enter an amount greater than zero (up to 2 decimals)')
      return
    }
    setAmountError('')
    setError('')

    const payload = {
      amount: value,
      category_id: categoryId || null,
      txn_date: date,
      description,
    }

    startTransition(async () => {
      const result = transaction
        ? await updateTransaction({ id: transaction.id, ...payload })
        : await addTransaction(payload)
      if (!result.success) {
        setError(result.error)
        return
      }
      if (keepOpen) {
        toast.success(`Added ${formatCurrency(value)}`)
        setAddedCount(n => n + 1)
        setAmount('')
        setDescription('')
        document.getElementById(`${formId}-amount`)?.focus()
        return
      }
      toast.success(isEdit ? 'Transaction updated' : `Added ${formatCurrency(value)}`)
      onClose()
    })
  }

  return (
    <>
      <Modal
        title={isEdit ? 'Edit transaction' : 'Add expense'}
        description={isEdit ? undefined : 'Counts against the category budget straight away.'}
        onClose={onClose}
        busy={pending}
        footer={
          <div className="flex w-full flex-wrap items-center gap-2">
            {isEdit && (
              <button type="button" className="btn btn-danger mr-auto" onClick={() => setConfirmDelete(true)} disabled={pending}>
                Delete
              </button>
            )}
            {!isEdit && addedCount > 0 && (
              <span className="mr-auto text-xs text-parchment-faint">{addedCount} added</span>
            )}
            <button type="button" className="btn btn-ghost ml-auto" onClick={onClose} disabled={pending}>
              {addedCount > 0 ? 'Done' : 'Cancel'}
            </button>
            {!isEdit && (
              <button type="button" className="btn btn-outline" onClick={() => submit(true)} disabled={pending}>
                Save & add another
              </button>
            )}
            <button type="submit" form={formId} className="btn btn-primary" disabled={pending}>
              {pending && <span className="spinner" aria-hidden="true" />}
              {isEdit ? 'Save changes' : 'Add expense'}
            </button>
          </div>
        }
      >
        <form
          id={formId}
          noValidate
          onSubmit={event => {
            event.preventDefault()
            submit(false)
          }}
          className="flex flex-col gap-4"
        >
          <Field id={`${formId}-amount`} label="Amount" error={amountError}>
            <AmountInput
              id={`${formId}-amount`}
              value={amount}
              onChange={value => {
                setAmount(value)
                if (amountError) setAmountError('')
              }}
              invalid={Boolean(amountError)}
              describedBy={amountError ? `${formId}-amount-error` : undefined}
              autoFocus
              className="text-lg"
            />
          </Field>

          <Field id={`${formId}-category`} label="Category">
            <select
              id={`${formId}-category`}
              className="input"
              value={categoryId}
              onChange={event => setCategoryId(event.target.value)}
            >
              <option value="">Uncategorised</option>
              {unknownCategory && <option value={categoryId}>Archived category</option>}
              {categories.map(option => (
                <option key={option.id} value={option.id}>
                  {option.parentId ? '\u00a0\u00a0\u00a0' : ''}
                  {option.icon} {option.parentId ? option.name : option.label}
                </option>
              ))}
            </select>
          </Field>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field id={`${formId}-date`} label="Date">
              <input
                id={`${formId}-date`}
                type="date"
                className="input font-mono"
                value={date}
                max={addDays(today, 366)}
                min="2001-01-01"
                onChange={event => setDate(event.target.value)}
                required
              />
            </Field>
            <Field id={`${formId}-description`} label="Note" optional>
              <input
                id={`${formId}-description`}
                type="text"
                className="input"
                value={description}
                maxLength={500}
                placeholder="e.g. Vegetables at the market"
                onChange={event => setDescription(event.target.value)}
              />
            </Field>
          </div>

          {transaction?.recurring_id && (
            <p className="text-xs text-parchment-faint">
              Posted automatically by a recurring rule. Editing it here changes only this occurrence.
            </p>
          )}

          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
        </form>
      </Modal>

      {confirmDelete && transaction && (
        <ConfirmDialog
          title="Delete this transaction?"
          message={`${formatCurrency(transaction.amount)} will be removed and the budget updated. This cannot be undone.`}
          onConfirm={() => deleteTransaction(transaction.id)}
          onClose={() => setConfirmDelete(false)}
          onDone={() => {
            toast.success('Transaction deleted')
            onClose()
          }}
        />
      )}
    </>
  )
}
