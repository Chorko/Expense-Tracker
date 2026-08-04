'use client'

import { useState, useTransition } from 'react'
import { addTransaction } from '@/app/actions/transactions'
import type { TransactionInput } from '@/lib/validations'

interface Category {
  id: string
  name: string
  icon: string | null
}

interface AddTransactionModalProps {
  categories: Category[]
  defaultCategoryId?: string
  onClose: () => void
  onSuccess: () => void
}

export function AddTransactionModal({
  categories,
  defaultCategoryId,
  onClose,
  onSuccess,
}: AddTransactionModalProps) {
  const [isPending, startTransition] = useTransition()
  const today = new Date().toISOString().slice(0, 10)

  const [form, setForm] = useState<TransactionInput>({
    amount: 0,
    description: '',
    txn_date: today,
    category_id: defaultCategoryId ?? (categories[0]?.id ?? null),
  })
  const [amountStr, setAmountStr] = useState('')
  const [error, setError] = useState('')

  function update<K extends keyof typeof form>(key: K, val: typeof form[K]) {
    setForm(f => ({ ...f, [key]: val }))
    if (error) setError('')
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const amount = parseFloat(amountStr)
    if (!amountStr || isNaN(amount) || amount <= 0) {
      setError('Please enter a valid amount greater than 0')
      return
    }

    startTransition(async () => {
      const result = await addTransaction({ ...form, amount })
      if (!result.success) {
        setError(result.error)
        return
      }
      onSuccess()
      onClose()
    })
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-lg font-semibold text-parchment">Add Transaction</h2>
            <p className="text-xs text-parchment-dim mt-0.5">
              Updates your category budget instantly
            </p>
          </div>
          <button onClick={onClose} className="btn btn-ghost p-1.5" aria-label="Close">✕</button>
        </div>

        <form onSubmit={handleSubmit} id="add-transaction-form">
          {/* Amount — large, prominent */}
          <div className="mb-5">
            <label htmlFor="txn-amount" className="input-label">Amount (₹)</label>
            <div className="relative">
              <span
                className="absolute left-3 top-1/2 -translate-y-1/2 font-mono text-parchment-dim text-lg"
              >
                ₹
              </span>
              <input
                id="txn-amount"
                type="number"
                value={amountStr}
                onChange={e => setAmountStr(e.target.value)}
                className="input font-mono text-right text-xl"
                style={{ paddingLeft: '2rem', paddingRight: '0.875rem' }}
                placeholder="0"
                min="0.01"
                step="0.01"
                max="10000000"
                autoFocus
              />
            </div>
          </div>

          {/* Category */}
          <div className="mb-4">
            <label htmlFor="txn-category" className="input-label">Category</label>
            <select
              id="txn-category"
              value={form.category_id ?? ''}
              onChange={e => update('category_id', e.target.value || null)}
              className="input"
            >
              <option value="">Uncategorised</option>
              {categories.map(cat => (
                <option key={cat.id} value={cat.id}>
                  {cat.icon ?? '💰'} {cat.name}
                </option>
              ))}
            </select>
          </div>

          {/* Date */}
          <div className="mb-4">
            <label htmlFor="txn-date" className="input-label">Date</label>
            <input
              id="txn-date"
              type="date"
              value={form.txn_date}
              onChange={e => update('txn_date', e.target.value)}
              className="input font-mono"
              max={today}
            />
          </div>

          {/* Description */}
          <div className="mb-5">
            <label htmlFor="txn-description" className="input-label">
              Description <span className="text-parchment-faint text-[0.625rem] normal-case tracking-normal font-normal">(optional)</span>
            </label>
            <input
              id="txn-description"
              type="text"
              value={form.description ?? ''}
              onChange={e => update('description', e.target.value)}
              className="input"
              placeholder="e.g. Milk &amp; vegetables"
              maxLength={500}
            />
          </div>

          {error && (
            <div className="mb-4 p-3 rounded-lg bg-danger/10 border border-danger/20 text-danger text-sm">
              {error}
            </div>
          )}

          <div className="flex gap-3">
            <button type="button" onClick={onClose} className="btn btn-ghost flex-1">
              Cancel
            </button>
            <button
              id="add-txn-submit"
              type="submit"
              className="btn btn-primary"
              style={{ flex: 2 }}
              disabled={isPending}
            >
              {isPending ? (
                <>
                  <span className="inline-block w-4 h-4 border-2 border-ink-navy/30 border-t-ink-navy rounded-full animate-spin" />
                  Adding…
                </>
              ) : (
                'Add transaction'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
